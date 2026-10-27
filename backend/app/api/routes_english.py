from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.routes_profile import get_default_profile
from app.core.config import get_settings
from app.core.database import get_db
from app.models import UserProfile, WritingSubmission
from app.schemas.english import (
    WritingEvaluateRequest,
    WritingSubmissionOut,
)
from app.services.english_coach import EnglishCoach, build_english_coach

router = APIRouter(prefix="/english", tags=["english"])


# Placeholder so the router shows up in /docs; remove once real endpoints exist.
@router.get("/ping", include_in_schema=True)
def ping() -> dict[str, str]:
    return {"router": "english", "status": "ok"}


def get_coach() -> EnglishCoach:
    return build_english_coach(get_settings())


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
        band_delta=None,
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
    db.commit()
    db.refresh(submission)
    return to_out(db, submission)
