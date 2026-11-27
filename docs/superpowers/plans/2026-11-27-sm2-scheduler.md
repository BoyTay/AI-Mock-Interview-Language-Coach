# SM-2 Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pure SM-2 module, `backend/app/services/sm2_scheduler.py`, that computes a flashcard's next state after a rating and previews the interval for each of the four rating buttons (issue #30).

**Architecture:** Frozen dataclasses in, frozen dataclasses out; no ORM, no DB, no clock. One private function computes the next state for a grade; `review` and `preview_intervals` both call it, so the preview always equals what is stored.

**Tech Stack:** Python 3.12 standard library (`dataclasses`, `decimal`, `datetime`), pytest.

**Spec:** `docs/superpowers/specs/2026-11-27-sm2-scheduler-design.md` (rules from `KeHoach.md` 4.3 and 8.3).

## Global Constraints

- Grades: exactly 0, 1, 3, 5 (Again, Hard, Good, Easy). Anything else, including `bool` and `str`, raises `ValueError`.
- EF first: `EF' = max(1.3, EF + 0.1 - (5-q)*(0.08 + (5-q)*0.02))`, updated on every grade, quantized to `Decimal("0.01")`.
- q < 3: n = 0, I = 1. q ≥ 3: n = 0 → I = 1; n = 1 → I = 6; n > 1 → I = round_half_up(I_old × EF'); then n += 1.
- `next_review_date = today + timedelta(days=I)`.
- Defaults for missing (`None`) card fields: n = 0, I = 1, EF = `Decimal("2.50")`.
- The module imports nothing from `app.models` or `app.core`.
- Backend test command (run from `backend/`): `/c/Users/Admin/AppData/Local/Temp/claude/599bdacca99f21d2/114b0c47-ed52-41f3-9e46-79ca6b1b8ec2/scratchpad/venv/Scripts/python.exe -m pytest`. Baseline on main: 483 passed, 10 skipped.

## Review Focus

1. **Half-way products under banker's rounding:** I=5, EF'=2.50 gives 12.5, which must become 13, not Python's 12. Test `test_interval_rounds_half_up` (Task 1).
2. **EF from the DB arrives as `Decimal("2.50")`, from tests or JSON maybe as `float`:** both must give exact two-decimal EF (no `2.3600000000000003`). Tests `test_state_from_card_*` and `test_ease_factor_has_two_decimals` (Task 1).
3. **Nullable columns:** a `MistakeCard` with `None` in any SM-2 field must schedule like a new card. Test `test_state_from_card_fills_none_with_defaults` (Task 1).
4. **`True` passes `q in {0,1,3,5}`:** bools and strings are refused. Test `test_rejects_invalid_grade` (Task 1).
5. **Preview must not drift from review:** for every grade, `preview_intervals(s)[name] == review(s, q, today).state.interval_days`. Test `test_preview_matches_review` (Task 2).

---

### Task 1: `review` and `state_from_card`

**Files:**
- Create: `backend/app/services/sm2_scheduler.py`
- Test: `backend/tests/test_sm2_scheduler.py`

**Interfaces:**
- Produces:
  - `GRADES: dict[str, int] = {"again": 0, "hard": 1, "good": 3, "easy": 5}` (insertion order is button order)
  - `MIN_EASE = Decimal("1.30")`
  - `@dataclass(frozen=True) class CardState: repetition_count: int = 0; interval_days: int = 1; ease_factor: Decimal = Decimal("2.50")`
  - `@dataclass(frozen=True) class ReviewResult: state: CardState; next_review_date: date`
  - `state_from_card(card: object) -> CardState` — reads the three attributes by name (duck-typed, works on `MistakeCard`), `None` → default, EF via `Decimal(str(value))` quantized to 0.01.
  - `review(state: CardState, q: int, today: date) -> ReviewResult`
  - private `_next_state(state: CardState, q: int) -> CardState` (Task 2 uses it)

- [ ] **Step 1: Write the failing tests** in `backend/tests/test_sm2_scheduler.py`, using `TODAY = date(2026, 11, 27)` and a helper `s(n, i, ef)` → `CardState(n, i, Decimal(ef))`:

```python
@pytest.mark.parametrize("q,ef", [(0, "1.70"), (1, "1.96"), (3, "2.36"), (5, "2.60")])
def test_ease_factor_change_per_grade(q, ef):
    assert review(s(2, 6, "2.50"), q, TODAY).state.ease_factor == Decimal(ef)

@pytest.mark.parametrize("q", [0, 1])
def test_failed_grade_resets(q):
    r = review(s(4, 36, "2.50"), q, TODAY)
    assert (r.state.repetition_count, r.state.interval_days) == (0, 1)
    assert r.next_review_date == date(2026, 11, 28)

def test_first_success_is_one_day():      # n=0, q=3 -> n=1, I=1
def test_second_success_is_six_days():    # n=1, q=3 -> n=2, I=6, date 2026-12-03
def test_later_success_multiplies_by_new_ef():
    # KeHoach 8.3 example: n=2, I=6, EF=2.50 -> Good 14 (n=3), Easy 16
def test_interval_rounds_half_up():       # s(2, 5, "2.40"), q=5 -> EF 2.50, I 13 (not 12)
def test_ease_factor_floor():             # s(2, 6, "1.30") q=0 -> 1.30; s(2,6,"1.50") q=1 -> 1.30
def test_ease_factor_has_two_decimals():  # every grade on s(2, 6, "2.50"): ease_factor.as_tuple().exponent == -2
def test_date_crosses_year():             # review(..., q=0, today=date(2026,12,31)) -> date(2027,1,1)

def test_standard_sequence():
    # From a new card, grades 5,5,3,3,1,3,0 give (n, I, EF):
    # (1,1,2.60) (2,6,2.70) (3,15,2.56) (4,36,2.42) (0,1,1.88) (1,1,1.74) (0,1,1.30)
    # Feed each result's state into the next review; assert all seven tuples.

@pytest.mark.parametrize("q", [2, 4, -1, 6, True, "3", 3.0])
def test_rejects_invalid_grade(q):        # pytest.raises(ValueError)

def test_review_does_not_change_input():  # input state equals its copy after review

def test_state_from_card_reads_decimal():  # SimpleNamespace(repetition_count=2, interval_days=6, ease_factor=Decimal("2.50")) -> s(2,6,"2.50")
def test_state_from_card_accepts_float():  # ease_factor=2.36 -> Decimal("2.36") exactly
def test_state_from_card_fills_none_with_defaults():  # all three None -> CardState()
```

- [ ] **Step 2: Run** `pytest tests/test_sm2_scheduler.py -v`. Expected: FAIL (`ModuleNotFoundError: app.services.sm2_scheduler`).

- [ ] **Step 3: Implement** the Produces list in `backend/app/services/sm2_scheduler.py`. Validate with `type(q) is int and q in GRADES.values()`. Compute EF in `Decimal` (`Decimal("0.1")`, `Decimal("0.08")`, `Decimal("0.02")`), floor at `MIN_EASE`, quantize `Decimal("0.01")`. Interval for n > 1: `int((state.interval_days * new_ef).quantize(Decimal("1"), rounding=ROUND_HALF_UP))`. Module docstring points to KeHoach 4.3 / 8.3.

- [ ] **Step 4: Run** `pytest tests/test_sm2_scheduler.py -v`. Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/sm2_scheduler.py backend/tests/test_sm2_scheduler.py
git commit -m "Schedule flashcard reviews with SM-2"
```

### Task 2: `preview_intervals`

**Files:**
- Modify: `backend/app/services/sm2_scheduler.py`
- Test: `backend/tests/test_sm2_scheduler.py`

**Interfaces:**
- Consumes: `GRADES`, `CardState`, `review`, `_next_state` from Task 1.
- Produces: `preview_intervals(state: CardState) -> dict[str, int]` with keys `again, hard, good, easy` in that order. #31 returns it as `next_intervals`.

- [ ] **Step 1: Write the failing tests**

```python
def test_preview_example_from_plan():
    assert preview_intervals(s(2, 6, "2.50")) == {"again": 1, "hard": 1, "good": 14, "easy": 16}
    assert list(preview_intervals(s(2, 6, "2.50"))) == ["again", "hard", "good", "easy"]

def test_preview_new_card_is_all_one_day():   # CardState() -> all four 1
def test_preview_second_review():             # s(1, 1, "2.50") -> again 1, hard 1, good 6, easy 6

@pytest.mark.parametrize("state", [CardState(), s(1, 1, "2.50"), s(2, 6, "2.50"), s(4, 36, "1.30"), s(2, 5, "2.40")])
def test_preview_matches_review(state):
    preview = preview_intervals(state)
    for name, q in GRADES.items():
        assert preview[name] == review(state, q, TODAY).state.interval_days
```

- [ ] **Step 2: Run** `pytest tests/test_sm2_scheduler.py -v`. Expected: the new tests FAIL (`ImportError: preview_intervals`).

- [ ] **Step 3: Implement** `preview_intervals` as `{name: _next_state(state, q).interval_days for name, q in GRADES.items()}`.

- [ ] **Step 4: Run** the full backend suite. Expected: 483 + new tests passed, 10 skipped, no failures.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/sm2_scheduler.py backend/tests/test_sm2_scheduler.py
git commit -m "Preview the SM-2 interval for each rating button"
```
