from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes_profile import get_default_profile
from app.core.config import get_settings
from app.core.database import get_db
from app.core.errors import AppError
from app.models import UserProfile, WritingSubmission
from app.schemas.english import (
    WritingEvaluateRequest,
    WritingSubmissionOut,
    WritingSubmissionSummary,
)
from app.services.english_coach import EnglishCoach, build_english_coach

HISTORY_LIMIT = 50

router = APIRouter(prefix="/english", tags=["english"])


# Placeholder so the router shows up in /docs; remove once real endpoints exist.
@router.get("/ping", include_in_schema=True)
def ping() -> dict[str, str]:
    return {"router": "english", "status": "ok"}


def get_coach() -> EnglishCoach:
    return build_english_coach(get_settings())


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
