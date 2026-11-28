# Flashcards API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real Flashcards endpoints (due list, full list, edit, delete, SM-2 review with streak) so the Flashcards screen (#33) can drop its mock data (issue #31).

**Architecture:** Everything stays in `app/api/routes_flashcards.py` with Pydantic schemas in `app/schemas/flashcards.py`, like the existing create route. Scheduling comes from `app/services/sm2_scheduler.py`. The review is saved with a conditional UPDATE so two simultaneous ratings cannot both apply. `touch_streak` moves to `app/services/streak.py`.

**Tech Stack:** FastAPI, SQLAlchemy 2, Pydantic 2, pytest (SQLite in tests, Postgres in Docker).

**Spec:** `docs/superpowers/specs/2026-11-28-flashcards-api-design.md`

## Global Constraints

- All routes under `/api/v1/flashcards`, scoped to `get_default_profile(db)`; another profile's card or an unknown id is `AppError(404, "NOT_FOUND", "Card not found")`.
- Errors use `AppError` from `app/core/errors.py` (body `{"error": {"code", "message"}}`).
- "Today" is `date.today()`.
- Codes and messages, exactly:
  - 409 `CARD_NOT_DUE` "This card is not due for review yet."
  - 409 `DUPLICATE_CARD` "Another card already has this front and back."
  - 422 `CARD_SCHEDULE_INVALID` "This card's schedule is invalid. Edit or delete the card."
- State is always read with `state_from_card`; never build `CardState` from row fields directly.
- Test command (from `backend/`): `/c/Users/Admin/AppData/Local/Temp/claude/599bdacca99f21d2/114b0c47-ed52-41f3-9e46-79ca6b1b8ec2/scratchpad/venv/Scripts/python.exe -m pytest`. Baseline on main: 519 passed, 10 skipped.

## Decisions made while planning (not in the spec)

- **`q` is `StrictInt` + validator, not `Literal[0, 1, 3, 5]`.** Probed with this venv: Pydantic's `Literal` turns JSON `true` into `1` (a Hard rating) and `3.0` into `3`, even with `strict=True`. `Annotated[StrictInt, AfterValidator(...)]` rejects both.
- **A NULL `next_review_date` counts as due** (in `/due` and in review), and `Card.next_review_date` is `date | None`. Only hand-edited rows have it; this way they can be rated instead of disappearing or crashing the response.

## Review Focus

1. **JSON `true` / `"3"` / `3.0` as `q`:** must be 422, never a Hard or Good rating. Test `test_review_rejects_invalid_grades` (Task 3).
2. **Rows with NULL schedule columns** (hand-edited data): list, due and review must not 500. Tests `test_null_schedule_card_is_listed_and_due` (Task 1), `test_review_card_with_null_schedule` (Task 3).
3. **Lost race:** a second rating that arrives after another one changed the card gets 409 and leaves the winner's values and the streak alone. Test `test_review_that_loses_a_race_returns_409` (Task 3).
4. **Editing a card into its own current text** is not a duplicate; editing it into another card's text is. Tests `test_edit_to_its_own_text_is_not_a_duplicate`, `test_edit_into_another_card_returns_409` (Task 2).
5. **Date overflow from corrupt data** gives 422, not 500, and writes nothing. Test `test_review_with_overflowing_interval_returns_422` (Task 3).

---

### Task 1: Card output, due list, full list

**Files:**
- Modify: `backend/app/schemas/flashcards.py`
- Modify: `backend/app/api/routes_flashcards.py` (remove `/ping`)
- Test: `backend/tests/test_flashcards_api.py`

**Interfaces:**
- Consumes: `state_from_card`, `preview_intervals` from `app.services.sm2_scheduler`.
- Produces:
  - `class NextIntervals(BaseModel): again: int; hard: int; good: int; easy: int`
  - `FlashcardOut` gains `repetition_count: int`, `interval_days: int`, `next_intervals: NextIntervals`; `next_review_date` becomes `date | None`.
  - `class DueFlashcards(BaseModel): cards: list[FlashcardOut]; total_due: int`
  - `class FlashcardPage(BaseModel): cards: list[FlashcardOut]; total: int`
  - `to_card_out(card: MistakeCard) -> FlashcardOut` in `routes_flashcards.py`: `repetition_count` / `interval_days` from `state_from_card(card)` (so NULL shows the default), `next_intervals` from `preview_intervals` of that state. Every route returns cards through it, including `POST`.
  - `get_own_card(db: Session, profile: UserProfile, card_id: int) -> MistakeCard` raising the 404 above (Tasks 2 and 3 use it).
  - `GET /due` `limit: int = Query(20, ge=1, le=100)`; filter `or_(next_review_date <= today, next_review_date.is_(None))`; order `next_review_date.asc().nulls_first(), id.asc()`.
  - `GET ""` `limit: int = Query(50, ge=1, le=200)`, `offset: int = Query(0, ge=0)`; order `created_at.desc(), id.desc()`.

- [ ] **Step 1: Write the failing tests.** Add a helper `add_card(db_session, front, *, profile_id=None, n=0, i=1, ef="2.50", due=date.today(), source="GRAMMAR_ERROR") -> MistakeCard` that inserts a row directly (default `profile_id` = the fixture's profile; `None` values are written as NULL), and a helper `other_profile(db_session) -> UserProfile`. Tests:

```python
def test_create_returns_schedule_and_next_intervals(client):
    data = client.post(URL, json=grammar()).json()
    assert (data["repetition_count"], data["interval_days"]) == (0, 1)
    assert data["next_intervals"] == {"again": 1, "hard": 1, "good": 1, "easy": 1}

def test_due_returns_cards_due_today_oldest_first(client, db_session):
    # fronts "old" (today-3), "today" (today), "later" (today+1)
    # -> [c["front_content"] for c in cards] == ["old", "today"], total_due == 2

def test_due_ties_are_ordered_by_id(...)            # two cards due today -> ascending id
def test_due_limit_caps_cards_not_total(...)        # 3 due, ?limit=2 -> 2 cards, total_due 3
def test_due_default_limit_is_20(...)               # 25 due -> 20 cards, total_due 25
@pytest.mark.parametrize("limit", [0, 101])
def test_due_rejects_limit_out_of_range(...)        # 422
def test_due_ignores_other_profiles_cards(...)      # other profile's due card not listed, not counted
def test_due_card_shows_its_next_intervals(...)     # n=2, i=6, ef "2.50" -> {1, 1, 14, 16}
def test_null_schedule_card_is_listed_and_due(...)  # n=i=ef=due=None -> in /due and in list,
                                                    # repetition_count 0, interval_days 1, intervals all 1,
                                                    # next_review_date None, comes first in /due
def test_list_returns_all_cards_newest_first(...)   # 3 cards (one not due) -> reverse insert order, total 3
def test_list_paginates(...)                        # 5 cards, ?limit=2&offset=2 -> 3rd and 4th newest, total 5
@pytest.mark.parametrize("query", ["limit=0", "limit=201", "offset=-1"])
def test_list_rejects_bad_paging(...)               # 422
def test_list_ignores_other_profiles_cards(...)
def test_ping_placeholder_is_gone(client):          # GET /flashcards/ping -> 404
```

- [ ] **Step 2: Run** `pytest tests/test_flashcards_api.py -q`. Expected: the new tests FAIL (missing fields, 404/405 on `/due` and list, ping still 200); existing create tests PASS.

- [ ] **Step 3: Implement** the Produces list. Declare `/due` before any `/{card_id}` route.

- [ ] **Step 4: Run** `pytest tests/test_flashcards_api.py -q`. Expected: all PASS.

- [ ] **Step 5: Commit** `git commit -m "List due and all flashcards with their next intervals"` (schemas, routes, tests).

### Task 2: Edit and delete

**Files:**
- Modify: `backend/app/schemas/flashcards.py`, `backend/app/api/routes_flashcards.py`
- Test: `backend/tests/test_flashcards_api.py`

**Interfaces:**
- Consumes: `get_own_card`, `to_card_out`, `Side` (Task 1 / existing).
- Produces:
  - `class FlashcardUpdate(BaseModel)`: `front_content: Side | None = None`, `back_content: Side | None = None`, `explanation` (same type as in `FlashcardCreate`) `| None = None`. A `model_validator(mode="after")` rejects an explicit `null` for `front_content` / `back_content` (check `model_fields_set`).
  - `PATCH /{card_id}` → 200 `FlashcardOut`. Only fields in `model_fields_set` change; `explanation` `null` or blank → stored `None`. Schedule columns untouched. Before saving, if another card of this profile (different `id`) has the same `source_type`, `front_content`, `back_content` → 409 `DUPLICATE_CARD`, nothing saved.
  - `DELETE /{card_id}` → 204, empty body.

- [ ] **Step 1: Write the failing tests**

```python
def test_edit_changes_text_and_keeps_schedule(...)       # card n=2, i=6, due today+3: new front/back saved,
                                                         # repetition_count, interval_days, ease_factor, next_review_date unchanged
def test_edit_only_explanation_keeps_sides(...)
@pytest.mark.parametrize("value", [None, "   "])
def test_edit_clears_explanation(...)                    # row.explanation is None
def test_edit_squashes_whitespace(...)                   # "He  go\nhome." -> "He go home."
@pytest.mark.parametrize("body", [{"front_content": None}, {"back_content": None},
                                  {"front_content": "   "}, {"front_content": "x" * 1001}])
def test_edit_rejects_invalid_sides(...)                 # 422, row unchanged
def test_empty_edit_returns_card_unchanged(...)          # {} -> 200, same values
def test_edit_into_another_card_returns_409(...)         # code DUPLICATE_CARD, row unchanged
def test_edit_to_its_own_text_is_not_a_duplicate(...)    # send its current front/back -> 200
def test_edit_unknown_or_other_profiles_card_is_404(...) # both cases, code NOT_FOUND
def test_delete_removes_the_card(...)                    # 204, row gone, second DELETE -> 404
def test_delete_other_profiles_card_is_404(...)          # row still there
```

- [ ] **Step 2: Run** `pytest tests/test_flashcards_api.py -q`. Expected: the new tests FAIL (405 Method Not Allowed).

- [ ] **Step 3: Implement** the Produces list.

- [ ] **Step 4: Run** `pytest tests/test_flashcards_api.py -q`. Expected: all PASS.

- [ ] **Step 5: Commit** `git commit -m "Edit and delete flashcards"`.

### Task 3: Review with SM-2 and streak

**Files:**
- Create: `backend/app/services/streak.py`
- Modify: `backend/app/api/routes_english.py` (import `touch_streak` from the new module, delete the local copy and now-unused imports)
- Modify: `backend/app/schemas/flashcards.py`, `backend/app/api/routes_flashcards.py`
- Test: `backend/tests/test_flashcards_api.py`

**Interfaces:**
- Consumes: `get_own_card`, `to_card_out` (Task 1); `state_from_card`, `review`, `GRADES` from `sm2_scheduler`.
- Produces:
  - `touch_streak(profile: UserProfile, today: date) -> None` in `app/services/streak.py`, body moved unchanged.
  - `class ReviewRequest(BaseModel): q: Annotated[StrictInt, AfterValidator(_check_grade)]`, `_check_grade` raises `ValueError` unless `q in GRADES.values()`.
  - `PATCH /{card_id}/review` → 200 `FlashcardOut`.

Route order (the algorithm the tests do not fully pin):
1. `card = get_own_card(...)`; if `card.next_review_date` is not None and `> today` → 409 `CARD_NOT_DUE`.
2. `result = review(state_from_card(card), payload.q, today)`; `OverflowError` → 422 `CARD_SCHEDULE_INVALID`.
3. Guarded `update(MistakeCard)` with `.execution_options(synchronize_session=False)`, `WHERE id, user_id, or_(next_review_date IS NULL, next_review_date <= today), repetition_count.is_not_distinct_from(card.repetition_count), interval_days.is_not_distinct_from(card.interval_days)` (raw row values captured before step 2, not state defaults), setting the four schedule columns from `result`.
4. `rowcount == 0` → `db.rollback()`, 409 `CARD_NOT_DUE`. Otherwise `touch_streak(profile, today)`, `db.commit()`, `db.refresh(card)`, return `to_card_out(card)`.

- [ ] **Step 1: Write the failing tests**

```python
def test_review_good_on_second_success(...)
    # card n=1, i=1, ef "2.50", due today, q=3 -> repetition_count 2, interval_days 6,
    # next_review_date today+6, next_intervals {"again": 1, "hard": 1, "good": 13, "easy": 15};
    # row.ease_factor == Decimal("2.36")
def test_review_again_resets(...)                 # n=4, i=36, q=0 -> n 0, i 1, due today+1
def test_review_overdue_card(...)                 # due today-5, q=5 -> 200
def test_review_card_not_due_returns_409(...)     # due today+1 -> 409 CARD_NOT_DUE; row and streak unchanged
def test_second_rating_today_returns_409(...)     # q=3 then q=5 on the same card -> 200 then 409
def test_review_that_loses_a_race_returns_409(client, db_session, monkeypatch):
    # wrap app.api.routes_flashcards.review: call the real one, then before returning
    # db_session.execute(update(MistakeCard).where(id==card.id).values(repetition_count=9,
    #     next_review_date=today+4).execution_options(synchronize_session=False)); db_session.commit()
    # (the test and the route share one session: without synchronize_session=False the
    #  route's in-memory card would pick up the new values and the guard would compare against them)
    # -> 409 CARD_NOT_DUE; row keeps repetition_count 9; profile streak unchanged
@pytest.mark.parametrize("body", [{"q": 2}, {"q": 4}, {"q": -1}, {"q": True}, {"q": "3"}, {"q": 3.0}, {}])
def test_review_rejects_invalid_grades(...)       # 422; row unchanged
def test_review_unknown_or_other_profiles_card_is_404(...)
def test_review_card_with_null_schedule(...)      # n=i=ef=due=None, q=3 -> n 1, i 1, row.ease_factor Decimal("2.36")
def test_review_with_overflowing_interval_returns_422(...)
    # n=5, i=3_000_000, due today, q=5 -> 422 CARD_SCHEDULE_INVALID; row unchanged
def test_review_extends_streak(...)               # profile streak 4, last_active yesterday -> 5, last_active today
def test_review_starts_streak_on_first_activity(...)  # streak 0, last_active None -> 1
```

- [ ] **Step 2: Run** `pytest tests/test_flashcards_api.py -q`. Expected: the new tests FAIL (404/405 on `/review`).

- [ ] **Step 3: Move `touch_streak`** to `app/services/streak.py` and import it in `routes_english.py`. **Run** `pytest tests/test_writing_api.py tests/test_speaking_api.py -q`. Expected: all PASS.

- [ ] **Step 4: Implement** `ReviewRequest` and the review route.

- [ ] **Step 5: Run** the full backend suite. Expected: 519 + new tests passed, 10 skipped, no failures.

- [ ] **Step 6: Commit** `git commit -m "Rate flashcards with SM-2 and keep the streak"` (streak module, English routes, schemas, flashcard routes, tests).
