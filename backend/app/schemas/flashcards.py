import re
from datetime import date, datetime
from enum import Enum
from typing import Annotated

from pydantic import AfterValidator, BaseModel, StringConstraints

MAX_SIDE_CHARS = 1000
MAX_EXPLANATION_CHARS = 2000


class CardSource(str, Enum):
    GRAMMAR_ERROR = "GRAMMAR_ERROR"
    VOCABULARY = "VOCABULARY"


def _squash(text: str) -> str:
    # Whitespace-only differences must not produce a second copy of the same card.
    return re.sub(r"\s+", " ", text).strip()


Side = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_SIDE_CHARS),
    AfterValidator(_squash),
]


class FlashcardCreate(BaseModel):
    source_type: CardSource
    front_content: Side
    back_content: Side
    explanation: Annotated[str, StringConstraints(strip_whitespace=True, max_length=MAX_EXPLANATION_CHARS)] | None = None


class FlashcardOut(BaseModel):
    id: int
    source_type: str
    front_content: str
    back_content: str
    explanation: str | None
    next_review_date: date
    created_at: datetime
