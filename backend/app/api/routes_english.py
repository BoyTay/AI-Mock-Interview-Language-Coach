from datetime import date, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.datastructures import FormData

from app.api.audio_upload import open_form, read_audio_field
from app.api.routes_profile import get_default_profile
from app.core.config import get_settings
from app.core.database import get_db
from app.core.errors import AppError
from app.models import SpeakingSubmission, UserProfile, WritingSubmission
from app.schemas.english import (
    MarkKind,
    PlacedMark,
    SpeakingCriteria,
    SpeakingEvaluateForm,
    SpeakingPromptOut,
    SpeakingSubmissionOut,
    SubmissionType,
    WritingEvaluateRequest,
    WritingEvaluation,
    WritingPromptOut,
    WritingSubmissionOut,
    WritingSubmissionSummary,
)
from app.services import speaking_prompts
from app.services.audio_store import GEMINI_MIME_TYPES, AudioStore
from app.services.english_coach import Audio, EnglishCoach, build_english_coach
from app.services.speaking_coach import GradedSpeech, SpeakingCoach, build_speaking_coach
from app.services.transcript_marks import words_per_minute
from app.services.writing_prompts import TASK_LIMITS, pick_prompt

HISTORY_LIMIT = 50

router = APIRouter(prefix="/english", tags=["english"])


# Placeholder so the router shows up in /docs; remove once real endpoints exist.
@router.get("/ping", include_in_schema=True)
def ping() -> dict[str, str]:
    return {"router": "english", "status": "ok"}


class _LazyCoach:
    """Builds the real coach on first use, so a missing API key can't pre-empt request validation."""

    def evaluate(self, text: str, submission_type: SubmissionType) -> WritingEvaluation:
        return build_english_coach(get_settings()).evaluate(text, submission_type)


def get_coach() -> EnglishCoach:
    return _LazyCoach()  # type: ignore[return-value]


class _LazySpeakingCoach:
    def evaluate(self, audio: Audio, prompt_text: str) -> GradedSpeech:
        return build_speaking_coach(get_settings()).evaluate(audio, prompt_text)


def get_speaking_coach() -> SpeakingCoach:
    return _LazySpeakingCoach()  # type: ignore[return-value]


def get_speaking_audio_store() -> AudioStore:
    return AudioStore(Path(get_settings().upload_dir))


def band_delta(db: Session, submission: WritingSubmission) -> float | None:
    previous = db.scalars(
        select(WritingSubmission.overall_band)
        .where(
            WritingSubmission.user_id == submission.user_id,
            WritingSubmission.task_type == submission.task_type,
            WritingSubmission.id < submission.id,
        )
        .order_by(WritingSubmission.id.desc())
        .limit(1)
    ).first()
    if previous is None:
        return None
    return float(submission.overall_band - previous)


def touch_streak(profile: UserProfile, today: date) -> None:
    last = profile.last_active_date
    if last == today:
        return
    profile.streak_days = (profile.streak_days or 0) + 1 if last == today - timedelta(days=1) else 1
    profile.last_active_date = today


def to_out(db: Session, submission: WritingSubmission) -> WritingSubmissionOut:
    return WritingSubmissionOut(
        id=submission.id,
        task_type=submission.task_type,
        prompt_topic=submission.prompt_topic,
        user_essay=submission.user_essay,
        word_count=submission.word_count,
        overall_band=submission.overall_band,
        band_scores=submission.band_scores,
        sentence_corrections=submission.sentence_corrections or [],
        upgraded_vocab=submission.upgraded_vocab or [],
        band_delta=band_delta(db, submission),
        created_at=submission.created_at,
    )


@router.post("/writing/evaluate", response_model=WritingSubmissionOut, status_code=201)
def evaluate_writing(
    payload: WritingEvaluateRequest,
    db: Session = Depends(get_db),
    coach: EnglishCoach = Depends(get_coach),
) -> WritingSubmissionOut:
    profile = get_default_profile(db)
    evaluation = coach.evaluate(payload.user_essay, payload.task_type)

    submission = WritingSubmission(
        user_id=profile.id,
        task_type=payload.task_type.value,
        prompt_topic=payload.prompt_topic,
        user_essay=payload.user_essay,
        word_count=len(payload.user_essay.split()),
        overall_band=evaluation.overall_band,
        band_scores=evaluation.criteria.model_dump(),
        sentence_corrections=[c.model_dump() for c in evaluation.sentence_corrections],
        upgraded_vocab=[v.model_dump() for v in evaluation.upgraded_vocabulary],
    )
    db.add(submission)
    touch_streak(profile, date.today())
    db.commit()
    db.refresh(submission)
    return to_out(db, submission)


# Declared before /writing/{submission_id}, otherwise "prompts" is parsed as an id.
@router.get("/writing/prompts", response_model=WritingPromptOut)
def get_writing_prompt(task_type: SubmissionType) -> WritingPromptOut:
    chosen = pick_prompt(task_type)
    min_words, max_words, suggested_minutes = TASK_LIMITS[task_type]
    return WritingPromptOut(
        id=chosen.id,
        task_type=chosen.task_type,
        topic=chosen.topic,
        prompt=chosen.prompt,
        min_words=min_words,
        max_words=max_words,
        suggested_minutes=suggested_minutes,
    )


def speaking_band_delta(db: Session, submission: SpeakingSubmission) -> float | None:
    previous = db.scalars(
        select(SpeakingSubmission.overall_band)
        .where(SpeakingSubmission.user_id == submission.user_id, SpeakingSubmission.id < submission.id)
        .order_by(SpeakingSubmission.id.desc())
        .limit(1)
    ).first()
    if previous is None:
        return None
    return float(submission.overall_band - previous)


def to_speaking_out(db: Session, submission: SpeakingSubmission) -> SpeakingSubmissionOut:
    marks = [PlacedMark.model_validate(m) for m in submission.marks or []]
    return SpeakingSubmissionOut(
        id=submission.id,
        prompt_text=submission.prompt_text,
        transcript=submission.transcript,
        duration_seconds=submission.duration_seconds,
        words_per_minute=submission.words_per_minute,
        overall_band=float(submission.overall_band),
        band_delta=speaking_band_delta(db, submission),
        summary=submission.summary,
        criteria=SpeakingCriteria.model_validate(submission.band_scores),
        marks=marks,
        grammar_corrections=submission.grammar_corrections or [],
        vocabulary_upgrades=submission.vocabulary_upgrades or [],
        filler_count=sum(1 for m in marks if m.kind is MarkKind.FILLER),
        created_at=submission.created_at,
    )


def _read_speaking_form(form: FormData) -> SpeakingEvaluateForm:
    """Validate the text fields, failing with the same 422 body FastAPI gives for a declared body."""
    # A field that is missing, or is a file instead of text, counts as missing.
    raw = {name: form.get(name) for name in ("prompt_text", "duration_seconds")}
    fields = {name: value for name, value in raw.items() if isinstance(value, str)}
    try:
        return SpeakingEvaluateForm.model_validate(fields)
    except ValidationError as exc:
        raise RequestValidationError([{**err, "loc": ("body", *err["loc"])} for err in exc.errors()]) from exc


_SPEAKING_BODY = {
    "requestBody": {
        "required": True,
        "content": {
            "multipart/form-data": {
                "schema": {
                    "type": "object",
                    "properties": {
                        "audio": {"type": "string", "format": "binary"},
                        "prompt_text": {"type": "string"},
                        "duration_seconds": {
                            "type": "integer",
                            "minimum": 30,
                            "maximum": 125,
                            "description": "How long the recording is, in seconds.",
                        },
                    },
                    "required": ["audio", "prompt_text", "duration_seconds"],
                }
            }
        },
    }
}


@router.post(
    "/speaking/evaluate", response_model=SpeakingSubmissionOut, status_code=201, openapi_extra=_SPEAKING_BODY
)
async def evaluate_speaking(
    request: Request,
    db: Session = Depends(get_db),
    coach: SpeakingCoach = Depends(get_speaking_coach),
    store: AudioStore = Depends(get_speaking_audio_store),
) -> SpeakingSubmissionOut:
    """Grade a recorded spoken standup (multipart fields `audio`, `prompt_text`, `duration_seconds`)."""
    form = await open_form(request)
    fields = _read_speaking_form(form)
    data, mime_type = await read_audio_field(form)
    # The model call can take many seconds: run the blocking work off the event loop.
    return await run_in_threadpool(_submit_speaking, db, coach, store, fields, data, mime_type)


def _submit_speaking(
    db: Session, coach: SpeakingCoach, store: AudioStore, fields: SpeakingEvaluateForm, data: bytes, mime_type: str
) -> SpeakingSubmissionOut:
    profile = get_default_profile(db)
    # Grade first and write afterwards: a failed call leaves no row and no file.
    graded = coach.evaluate(Audio(data, GEMINI_MIME_TYPES[mime_type]), fields.prompt_text)
    evaluation = graded.evaluation

    audio_path = store.save(f"speaking/{profile.id}", data, mime_type)
    try:
        submission = SpeakingSubmission(
            user_id=profile.id,
            prompt_text=fields.prompt_text,
            transcript=evaluation.transcript,
            audio_path=audio_path,
            duration_seconds=fields.duration_seconds,
            words_per_minute=words_per_minute(graded.word_count, fields.duration_seconds),
            overall_band=graded.overall_band,
            band_scores=evaluation.criteria.model_dump(),
            summary=evaluation.summary,
            marks=[m.model_dump(mode="json") for m in graded.marks],
            grammar_corrections=[c.model_dump() for c in evaluation.grammar_corrections],
            vocabulary_upgrades=[u.model_dump() for u in evaluation.vocabulary_upgrades],
            prompt_version=speaking_prompts.SPEAKING_PROMPT_VERSION,
        )
        db.add(submission)
        touch_streak(profile, date.today())
        db.commit()
    except Exception:
        db.rollback()
        store.delete(audio_path)
        raise
    db.refresh(submission)
    return to_speaking_out(db, submission)


@router.get("/speaking/prompts", response_model=SpeakingPromptOut)
def get_speaking_prompt() -> SpeakingPromptOut:
    chosen = speaking_prompts.pick_prompt()
    return SpeakingPromptOut(
        id=chosen.id,
        prompt=chosen.prompt,
        min_seconds=speaking_prompts.MIN_SECONDS,
        max_seconds=speaking_prompts.MAX_SECONDS,
    )


@router.get("/writing", response_model=list[WritingSubmissionSummary])
def list_writing(db: Session = Depends(get_db)) -> list[WritingSubmissionSummary]:
    profile = get_default_profile(db)
    rows = db.scalars(
        select(WritingSubmission)
        .where(WritingSubmission.user_id == profile.id)
        .order_by(WritingSubmission.id.desc())
        .limit(HISTORY_LIMIT)
    ).all()
    return [
        WritingSubmissionSummary(
            id=r.id,
            task_type=r.task_type,
            prompt_topic=r.prompt_topic,
            word_count=r.word_count,
            overall_band=r.overall_band,
            band_delta=band_delta(db, r),
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/writing/{submission_id}", response_model=WritingSubmissionOut)
def get_writing(submission_id: int, db: Session = Depends(get_db)) -> WritingSubmissionOut:
    profile = get_default_profile(db)
    submission = db.get(WritingSubmission, submission_id)
    if submission is None or submission.user_id != profile.id:
        raise AppError(404, "SUBMISSION_NOT_FOUND", "Không tìm thấy bài nộp")
    return to_out(db, submission)
