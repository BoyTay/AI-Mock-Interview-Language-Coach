from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes_profile import get_default_profile
from app.core.database import get_db
from app.models import MistakeCard
from app.schemas.flashcards import FlashcardCreate, FlashcardOut

router = APIRouter(prefix="/flashcards", tags=["flashcards"])


# Placeholder so the router shows up in /docs; remove once real endpoints exist.
@router.get("/ping", include_in_schema=True)
def ping() -> dict[str, str]:
    return {"router": "flashcards", "status": "ok"}


@router.post("", response_model=FlashcardOut, status_code=201)
def create_flashcard(
    payload: FlashcardCreate, response: Response, db: Session = Depends(get_db)
) -> MistakeCard:
    profile = get_default_profile(db)
    existing = db.scalars(
        select(MistakeCard).where(
            MistakeCard.user_id == profile.id,
            MistakeCard.source_type == payload.source_type.value,
            MistakeCard.front_content == payload.front_content,
            MistakeCard.back_content == payload.back_content,
        )
    ).first()
    if existing is not None:
        # Saving the same card twice is not an error: hand back the one already there.
        response.status_code = 200
        return existing

    card = MistakeCard(
        user_id=profile.id,
        source_type=payload.source_type.value,
        front_content=payload.front_content,
        back_content=payload.back_content,
        explanation=payload.explanation or None,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return card
