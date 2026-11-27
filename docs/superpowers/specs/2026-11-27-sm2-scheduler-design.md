# SM-2 scheduler design (issue #30)

**Intent:** flashcards (`mistake_cards`) are reviewed with SM-2. Issue #30 asks for the algorithm as a pure module, `backend/app/services/sm2_scheduler.py`, with unit tests, so the review API (#31) can store the result and the Flashcards screen (#33) can show the real interval on each rating button. The rules are fixed by `KeHoach.md` sections 4.3 and 8.3; this module is their single implementation.

## Goals

- `review(state, q, today)` returns the card's new state and its `next_review_date`.
- `preview_intervals(state)` returns the interval in days for each of the four buttons, using the same logic as `review`, so the number on a button always equals the number stored when it is pressed.
- Tests cover every branch and agree with the worked example in 8.3 and with a hand-computed SM-2 review sequence.
- No database, no clock: tests run in milliseconds.

## Non-goals

- Writing to the database, the API, or `next_intervals` in responses (#31).
- Formatting `Nd` / `Nmo` for the buttons (#33).
- Changing the rating mapping (Again 0, Hard 1, Good 3, Easy 5); 8.3 parks that for v1.1.
- An interval cap.

## Rules (from KeHoach 4.3 / 8.3)

- q must be one of 0, 1, 3, 5.
- EF is updated on every review, first: `EF' = max(1.3, EF + 0.1 - (5-q)(0.08 + (5-q)·0.02))`.
- q < 3: n = 0, I = 1.
- q ≥ 3: n = 0 → I = 1; n = 1 → I = 6; n > 1 → I = round(I_old × EF'); then n += 1.
- `next_review_date = today + I days`.
- Check: n=2, I=6, EF=2.5 gives Again 1, Hard 1, Good 14, Easy 16.

## Approaches

1. **Pure functions over a small frozen dataclass (picked).** `CardState(repetition_count, interval_days, ease_factor)`; `review` returns a new state plus the date. The caller copies fields onto `MistakeCard`. Easy to test, no ORM import.
2. Functions that mutate a `MistakeCard` in place. Fewer lines in #31, but ties the tests to the ORM and makes the preview mutate-and-discard.
3. A scheduler class with configuration. Nothing needs configuring; extra structure for no gain.

## Decisions (Claude's calls, approved)

- **Decimal for EF**, quantized to 2 places (matches the `Numeric(4,2)` column), so EF never drifts like `2.3600000000000003`.
- **Round half up** for `I_old × EF'` (6 × 2.25 = 13.5 → 14), same rule as score rounding in 8.2; Python's `round()` would give 14 here but 12 for 12.5, which is banker's rounding.
- **`today` is a parameter**, not read from the clock.
- **Invalid q raises `ValueError`**; the API validates first, this is the backstop.
- **`None` fields** from the nullable DB columns fall back to the column defaults: n = 0, I = 1, EF = 2.50. A helper builds a `CardState` from any object with those attributes.

## Left to the builder

Exact names of the helper and the result type, and test layout, following `backend/tests` conventions.
