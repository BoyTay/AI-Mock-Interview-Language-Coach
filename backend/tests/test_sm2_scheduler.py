from dataclasses import replace
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.services.sm2_scheduler import GRADES, CardState, preview_intervals, review, state_from_card

TODAY = date(2026, 11, 27)


def s(n: int, i: int, ef: str) -> CardState:
    return CardState(repetition_count=n, interval_days=i, ease_factor=Decimal(ef))


def triple(state: CardState) -> tuple[int, int, Decimal]:
    return (state.repetition_count, state.interval_days, state.ease_factor)


@pytest.mark.parametrize("q,ef", [(0, "1.70"), (1, "1.96"), (3, "2.36"), (5, "2.60")])
def test_ease_factor_change_per_grade(q, ef):
    assert review(s(2, 6, "2.50"), q, TODAY).state.ease_factor == Decimal(ef)


@pytest.mark.parametrize("q", [0, 1])
def test_failed_grade_resets(q):
    result = review(s(4, 36, "2.50"), q, TODAY)
    assert (result.state.repetition_count, result.state.interval_days) == (0, 1)
    assert result.next_review_date == date(2026, 11, 28)


def test_first_success_is_one_day():
    result = review(CardState(), 3, TODAY)
    assert (result.state.repetition_count, result.state.interval_days) == (1, 1)
    assert result.next_review_date == date(2026, 11, 28)


def test_second_success_is_six_days():
    result = review(s(1, 1, "2.50"), 3, TODAY)
    assert (result.state.repetition_count, result.state.interval_days) == (2, 6)
    assert result.next_review_date == date(2026, 12, 3)


def test_later_success_multiplies_by_new_ef():
    # KeHoach 8.3: n=2, I=6, EF=2.5 -> Good 14 days, Easy 16 days.
    good = review(s(2, 6, "2.50"), 3, TODAY)
    easy = review(s(2, 6, "2.50"), 5, TODAY)
    assert triple(good.state) == (3, 14, Decimal("2.36"))
    assert triple(easy.state) == (3, 16, Decimal("2.60"))
    assert good.next_review_date == date(2026, 12, 11)


def test_interval_rounds_half_up():
    # EF' = 2.50, 5 x 2.50 = 12.5: half up gives 13, Python's round() would give 12.
    assert review(s(2, 5, "2.40"), 5, TODAY).state.interval_days == 13


def test_ease_factor_floor():
    assert review(s(2, 6, "1.30"), 0, TODAY).state.ease_factor == Decimal("1.30")
    assert review(s(2, 6, "1.50"), 1, TODAY).state.ease_factor == Decimal("1.30")


@pytest.mark.parametrize("q", [0, 1, 3, 5])
def test_ease_factor_has_two_decimals(q):
    assert review(s(2, 6, "2.50"), q, TODAY).state.ease_factor.as_tuple().exponent == -2


def test_date_crosses_year():
    assert review(s(3, 15, "2.50"), 0, date(2026, 12, 31)).next_review_date == date(2027, 1, 1)


def test_standard_sequence():
    expected = [
        (5, (1, 1, Decimal("2.60"))),
        (5, (2, 6, Decimal("2.70"))),
        (3, (3, 15, Decimal("2.56"))),
        (3, (4, 36, Decimal("2.42"))),
        (1, (0, 1, Decimal("1.88"))),
        (3, (1, 1, Decimal("1.74"))),
        (0, (0, 1, Decimal("1.30"))),
    ]
    state = CardState()
    for q, want in expected:
        state = review(state, q, TODAY).state
        assert triple(state) == want


@pytest.mark.parametrize("q", [2, 4, -1, 6, True, "3", 3.0])
def test_rejects_invalid_grade(q):
    with pytest.raises(ValueError):
        review(CardState(), q, TODAY)


def test_review_does_not_change_input():
    state = s(2, 6, "2.50")
    before = replace(state)
    review(state, 5, TODAY)
    assert state == before


def test_state_from_card_reads_decimal():
    card = SimpleNamespace(repetition_count=2, interval_days=6, ease_factor=Decimal("2.50"))
    assert state_from_card(card) == s(2, 6, "2.50")


def test_state_from_card_accepts_float():
    card = SimpleNamespace(repetition_count=3, interval_days=14, ease_factor=2.36)
    assert state_from_card(card).ease_factor == Decimal("2.36")


def test_state_from_card_fills_none_with_defaults():
    card = SimpleNamespace(repetition_count=None, interval_days=None, ease_factor=None)
    assert state_from_card(card) == CardState()


def test_preview_example_from_plan():
    preview = preview_intervals(s(2, 6, "2.50"))
    assert preview == {"again": 1, "hard": 1, "good": 14, "easy": 16}
    assert list(preview) == ["again", "hard", "good", "easy"]


def test_preview_new_card_is_all_one_day():
    assert preview_intervals(CardState()) == {"again": 1, "hard": 1, "good": 1, "easy": 1}


def test_preview_second_review():
    assert preview_intervals(s(1, 1, "2.50")) == {"again": 1, "hard": 1, "good": 6, "easy": 6}


@pytest.mark.parametrize(
    "state", [CardState(), s(1, 1, "2.50"), s(2, 6, "2.50"), s(4, 36, "1.30"), s(2, 5, "2.40")]
)
def test_preview_matches_review(state):
    preview = preview_intervals(state)
    for name, q in GRADES.items():
        assert preview[name] == review(state, q, TODAY).state.interval_days
