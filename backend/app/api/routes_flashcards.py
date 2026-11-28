from datetime import date

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from app.api.routes_profile import get_default_profile
from app.core.database import get_db
from app.core.errors import AppError
from app.models import MistakeCard, UserProfile
from app.schemas.flashcards import (
    DueFlashcards,
    FlashcardCreate,
    FlashcardOut,
    FlashcardPage,
    FlashcardUpdate,
    NextIntervals,
    ReviewRequest,
)
from app.services.sm2_scheduler import preview_intervals, review, state_from_card
from app.services.streak import touch_streak

router = APIRouter(prefix="/flashcards", tags=["flashcards"])


def _not_due() -> AppError:
    return AppError(409, "CARD_NOT_DUE", "This card is not due for review yet.")


def to_card_out(card: MistakeCard) -> FlashcardOut:
    # Read the schedule through the scheduler so NULL columns show the same defaults it uses.
    state = state_from_card(card)
    return FlashcardOut(
        id=card.id,
        source_type=card.source_type,
        front_content=card.front_content,
        back_content=card.back_content,
        explanation=card.explanation,
        next_review_date=card.next_review_date,
        created_at=card.created_at,
        repetition_count=state.repetition_count,
        interval_days=state.interval_days,
        next_intervals=NextIntervals(**preview_intervals(state)),
    )


def get_own_card(db: Session, profile: UserProfile, card_id: int) -> MistakeCard:
    card = db.get(MistakeCard, card_id)
    if card is None or card.user_id != profile.id:
        raise AppError(404, "NOT_FOUND", "Card not found")
    return card


def _is_due(today: date):
    # A NULL date only comes from hand-edited rows: treat it as due rather than hide the card.
    return or_(MistakeCard.next_review_date <= today, MistakeCard.next_review_date.is_(None))


@router.get("/due", response_model=DueFlashcards)
def list_due_flashcards(limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)) -> DueFlashcards:
    profile = get_default_profile(db)
    where = (MistakeCard.user_id == profile.id, _is_due(date.today()))
    cards = db.scalars(
        select(MistakeCard)
        .where(*where)
        .order_by(MistakeCard.next_review_date.asc().nulls_first(), MistakeCard.id.asc())
        .limit(limit)
    ).all()
    total_due = db.scalar(select(func.count()).select_from(MistakeCard).where(*where))
    return DueFlashcards(cards=[to_card_out(card) for card in cards], total_due=total_due)


@router.get("", response_model=FlashcardPage)
def list_flashcards(
    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0), db: Session = Depends(get_db)
) -> FlashcardPage:
    profile = get_default_profile(db)
    mine = MistakeCard.user_id == profile.id
    cards = db.scalars(
        select(MistakeCard)
        .where(mine)
        .order_by(MistakeCard.created_at.desc(), MistakeCard.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    total = db.scalar(select(func.count()).select_from(MistakeCard).where(mine))
    return FlashcardPage(cards=[to_card_out(card) for card in cards], total=total)


@router.post("", response_model=FlashcardOut, status_code=201)
def create_flashcard(
    payload: FlashcardCreate, response: Response, db: Session = Depends(get_db)
) -> FlashcardOut:
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
        return to_card_out(existing)

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
    return to_card_out(card)


@router.patch("/{card_id}", response_model=FlashcardOut)
def update_flashcard(card_id: int, payload: FlashcardUpdate, db: Session = Depends(get_db)) -> FlashcardOut:
    profile = get_default_profile(db)
    card = get_own_card(db, profile, card_id)
    changes = payload.model_dump(include=payload.model_fields_set)
    if "explanation" in changes:
        changes["explanation"] = changes["explanation"] or None
    # Only a change to a side can create a duplicate; an explanation-only edit must work even if a twin exists.
    if "front_content" in changes or "back_content" in changes:
        duplicate = db.scalars(
            select(MistakeCard.id).where(
                MistakeCard.user_id == profile.id,
                MistakeCard.id != card.id,
                MistakeCard.source_type == card.source_type,
                MistakeCard.front_content == changes.get("front_content", card.front_content),
                MistakeCard.back_content == changes.get("back_content", card.back_content),
            )
        ).first()
        if duplicate is not None:
            raise AppError(409, "DUPLICATE_CARD", "Another card already has this front and back.")

    for name, value in changes.items():
        setattr(card, name, value)  # schedule columns are not in FlashcardUpdate, so they stay as they are
    db.commit()
    db.refresh(card)
    return to_card_out(card)


@router.delete("/{card_id}", status_code=204)
def delete_flashcard(card_id: int, db: Session = Depends(get_db)) -> Response:
    card = get_own_card(db, get_default_profile(db), card_id)
    db.delete(card)
    db.commit()
    return Response(status_code=204)


@router.patch("/{card_id}/review", response_model=FlashcardOut)
def review_flashcard(card_id: int, payload: ReviewRequest, db: Session = Depends(get_db)) -> FlashcardOut:
    today = date.today()
    profile = get_default_profile(db)
    card = get_own_card(db, profile, card_id)
    if card.next_review_date is not None and card.next_review_date > today:
        # Only the first rating of a due card counts; re-showing it later in the session is UI practice.
        raise _not_due()
    # The values this rating was computed from: the write below only lands if they are still in the row.
    old_n, old_interval = card.repetition_count, card.interval_days

    try:
        result = review(state_from_card(card), payload.q, today)
    except OverflowError:
        # Only reachable with corrupt stored data (an interval so long the date passes year 9999).
        raise AppError(422, "CARD_SCHEDULE_INVALID", "This card's schedule is invalid. Edit or delete the card.")

    written = db.execute(
        update(MistakeCard)
        .where(
            MistakeCard.id == card.id,
            MistakeCard.user_id == profile.id,
            _is_due(today),
            MistakeCard.repetition_count.is_not_distinct_from(old_n),
            MistakeCard.interval_days.is_not_distinct_from(old_interval),
        )
        .values(
            repetition_count=result.state.repetition_count,
            interval_days=result.state.interval_days,
            ease_factor=result.state.ease_factor,
            next_review_date=result.next_review_date,
        )
        .execution_options(synchronize_session=False)
    ).rowcount
    if written == 0:
        # Another rating (double click, retry) changed the card first.
        db.rollback()
        raise _not_due()

    touch_streak(profile, today)
    db.commit()
    db.refresh(card)
    return to_card_out(card)
