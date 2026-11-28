# Flashcards API design (issue #31)

**Intent:** the Flashcards screen (#33) still runs on mock data. Issue #31 gives it a real API: the cards due today, rating a card with SM-2 (`app/services/sm2_scheduler.py`, #30), the real interval for each rating button, a list of all cards with edit and delete, and the daily streak. Single user (`get_default_profile`), as everywhere else in the app.

## Goals

- `GET /flashcards/due` returns the cards to review now, capped per session, with how many are due in total.
- `PATCH /flashcards/{id}/review` stores the first rating of a due card and refuses a card that is not due.
- Every card in a response carries `next_intervals` so the buttons show what will really be stored.
- List, edit and delete cards.
- A rating keeps the daily streak alive, the same way a Writing or Speaking submission does.

## Non-goals

- Frontend changes (#33), auto-creating cards (#32), dashboard stats (#34).
- Re-showing Again cards within the session: that is practice in the UI and is not sent to the server (classic SM-2: only the first grade of the day counts).
- Search, filters or tags on the card list.
- Changing the SM-2 rules or the rating mapping.

## Anti-goals

- A double click or a retry rating the same card twice and pushing its interval up.
- A review that crashes (500) on any stored card.

## Approaches

- **A. Logic in `routes_flashcards.py`, guarded write (picked).** Same structure as the existing `create_flashcard` and English routes. `touch_streak` moves to `app/services/streak.py` so Writing, Speaking and Flashcards share it. The review is saved with a conditional UPDATE that only writes if the card is still due and unchanged, so of two simultaneous ratings exactly one wins.
- B. Same, but read, check, then save. Slightly simpler, but two concurrent requests can both pass the "is due" check and apply the rating twice.
- C. A `flashcard_service.py` layer between routes and DB. Easier to unit test in isolation, but the project does not do this for plain CRUD; extra indirection for no gain.

## Endpoints

All under `/api/v1/flashcards`, scoped to the default profile; another profile's card is 404 `NOT_FOUND`. Errors use the existing `AppError` body `{"error": {"code", "message"}}`. "Today" is `date.today()` on the server, as in the English routes.

| Method | Path | Request | Response |
| :-- | :-- | :-- | :-- |
| `GET` | `/due?limit=20` | `limit` 1-100, default 20 | `{cards: [Card], total_due: int}`; `next_review_date <= today`, oldest due first, then `id` |
| `GET` | `?limit=50&offset=0` | `limit` 1-200, `offset` ≥ 0 | `{cards: [Card], total: int}`; newest first (`created_at`, then `id`, descending) |
| `POST` | `` | unchanged | unchanged (201 new, 200 existing duplicate), now returns the full `Card` |
| `PATCH` | `/{id}` | any of `front_content`, `back_content`, `explanation` (same validation as create; `null` or blank `explanation` clears it) | 200 `Card`; schedule untouched; 409 `DUPLICATE_CARD` if the edit makes it identical to another card of this profile (same source type, front, back) |
| `DELETE` | `/{id}` | | 204 |
| `PATCH` | `/{id}/review` | `{"q": 0 \| 1 \| 3 \| 5}` | 200 `Card` with the new schedule and new `next_intervals`; 409 `CARD_NOT_DUE` if `next_review_date > today`; 422 for any other `q` |

`Card` = today's `FlashcardOut` fields (`id`, `source_type`, `front_content`, `back_content`, `explanation`, `next_review_date`, `created_at`) plus `repetition_count`, `interval_days`, and `next_intervals: {again, hard, good, easy}` (days, from `preview_intervals`).

## Review rules

- State is read with `state_from_card` (handles NULL columns and float EF), then `review(state, q, today)`.
- `q` is typed `Literal[0, 1, 3, 5]` so the scheduler always receives a plain `int`.
- Guarded write: `UPDATE mistake_cards SET ... WHERE id = :id AND user_id = :profile AND next_review_date <= :today AND repetition_count IS NOT DISTINCT FROM :old_n AND interval_days IS NOT DISTINCT FROM :old_i`. Zero rows updated means another rating got there first: 409 `CARD_NOT_DUE`. Works on SQLite (tests) and Postgres.
- `touch_streak(profile, today)` runs in the same transaction, so a refused review does not count.
- Because only due cards are rated, an interval can only grow once per due date; the date overflow found in the #30 review is out of reach in normal use. If `review` still raises `OverflowError` (only with corrupt stored data), return 422 `CARD_SCHEDULE_INVALID` instead of a 500.

## Other changes

- Remove the `/flashcards/ping` placeholder (its comment says to remove it once real endpoints exist).
- `touch_streak` moves to `app/services/streak.py`; `routes_english.py` imports it from there. Behaviour unchanged.

## Left to the builder

Schema class names, test layout following `tests/test_flashcards_api.py`, and whether edit and delete share a "load own card or 404" helper.
