"""SM-2 spaced repetition for flashcards (KeHoach.md 4.3 and 8.3).

Pure functions: no database and no clock, so the review API stores exactly
what the rating buttons preview.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

# Button name -> grade q. Order is the order of the buttons on screen.
GRADES: dict[str, int] = {"again": 0, "hard": 1, "good": 3, "easy": 5}
MIN_EASE = Decimal("1.30")
PASSING_GRADE = 3
SECOND_INTERVAL_DAYS = 6

_CENT = Decimal("0.01")


@dataclass(frozen=True)
class CardState:
    """Defaults match the `mistake_cards` column defaults."""

    repetition_count: int = 0
    interval_days: int = 1
    ease_factor: Decimal = Decimal("2.50")


@dataclass(frozen=True)
class ReviewResult:
    state: CardState
    next_review_date: date


def state_from_card(card: object) -> CardState:
    """Read the SM-2 fields of a card (e.g. a MistakeCard); None means the column default."""
    default = CardState()
    n = getattr(card, "repetition_count", None)
    interval = getattr(card, "interval_days", None)
    ease = getattr(card, "ease_factor", None)
    return CardState(
        repetition_count=default.repetition_count if n is None else n,
        interval_days=default.interval_days if interval is None else interval,
        # str() first so a float like 2.36 becomes exactly 2.36, not its binary expansion.
        ease_factor=default.ease_factor if ease is None else Decimal(str(ease)).quantize(_CENT),
    )


def _next_ease(ease: Decimal, q: int) -> Decimal:
    miss = 5 - q
    new = ease + Decimal("0.1") - miss * (Decimal("0.08") + miss * Decimal("0.02"))
    return max(MIN_EASE, new).quantize(_CENT)


def _next_state(state: CardState, q: int) -> CardState:
    # bool is an int subclass, so `True in GRADES.values()` would pass without the type check.
    if type(q) is not int or q not in GRADES.values():
        raise ValueError(f"grade must be one of {sorted(GRADES.values())}, got {q!r}")

    # EF first, then the interval uses the new EF (KeHoach 8.3).
    ease = _next_ease(state.ease_factor, q)
    if q < PASSING_GRADE:
        return CardState(repetition_count=0, interval_days=1, ease_factor=ease)

    n = state.repetition_count
    if n == 0:
        interval = 1
    elif n == 1:
        interval = SECOND_INTERVAL_DAYS
    else:
        # Half up, like score rounding in 8.2; round() would turn 12.5 into 12.
        interval = int((state.interval_days * ease).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    return CardState(repetition_count=n + 1, interval_days=interval, ease_factor=ease)


def review(state: CardState, q: int, today: date) -> ReviewResult:
    new_state = _next_state(state, q)
    return ReviewResult(state=new_state, next_review_date=today + timedelta(days=new_state.interval_days))


def preview_intervals(state: CardState) -> dict[str, int]:
    """Days until the next review for each button; nothing is stored."""
    return {name: _next_state(state, q).interval_days for name, q in GRADES.items()}
