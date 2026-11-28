import re
from datetime import date, datetime
from enum import Enum
from typing import Annotated

from pydantic import AfterValidator, BaseModel, StringConstraints, model_validator

MAX_SIDE_CHARS = 1000
MAX_EXPLANATION_CHARS = 2000


class CardSource(str, Enum):
    GRAMMAR_ERROR = "GRAMMAR_ERROR"
    VOCABULARY = "VOCABULARY"
    TECH_CONCEPT = "TECH_CONCEPT"


def _squash(text: str) -> str:
    # Whitespace-only differences must not produce a second copy of the same card.
    return re.sub(r"\s+", " ", text).strip()


Side = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_SIDE_CHARS),
    AfterValidator(_squash),
]


Explanation = Annotated[str, StringConstraints(strip_whitespace=True, max_length=MAX_EXPLANATION_CHARS)]


class FlashcardCreate(BaseModel):
    source_type: CardSource
    front_content: Side
    back_content: Side
    explanation: Explanation | None = None


class FlashcardUpdate(BaseModel):
    """Only the fields sent are changed; `explanation: null` (or blank) clears it."""

    front_content: Side | None = None
    back_content: Side | None = None
    explanation: Explanation | None = None

    @model_validator(mode="after")
    def _sides_cannot_be_null(self) -> "FlashcardUpdate":
        for name in ("front_content", "back_content"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class NextIntervals(BaseModel):
    """Days until the next review if the matching rating button is pressed."""

    again: int
    hard: int
    good: int
    easy: int


class FlashcardOut(BaseModel):
    id: int
    source_type: str
    front_content: str
    back_content: str
    explanation: str | None
    # None only for hand-edited rows; such a card counts as due.
    next_review_date: date | None
    created_at: datetime
    repetition_count: int
    interval_days: int
    next_intervals: NextIntervals


class DueFlashcards(BaseModel):
    cards: list[FlashcardOut]
    total_due: int


class FlashcardPage(BaseModel):
    cards: list[FlashcardOut]
    total: int
