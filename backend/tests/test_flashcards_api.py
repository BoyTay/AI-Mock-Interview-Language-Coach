from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import func, insert, select, update

from app.models import MistakeCard, UserProfile

URL = "/api/v1/flashcards"


def grammar(**overrides) -> dict:
    payload = {
        "source_type": "GRAMMAR_ERROR",
        "front_content": "He go home.",
        "back_content": "He goes home.",
        "explanation": "Third person singular takes -es.",
    }
    payload.update(overrides)
    return payload


def card_count(db_session) -> int:
    return db_session.scalar(select(func.count()).select_from(MistakeCard))


TODAY = date.today()
_UNSET = object()


def default_profile(db_session) -> UserProfile:
    return db_session.scalars(select(UserProfile).order_by(UserProfile.id)).first()


def other_profile(db_session) -> UserProfile:
    other = UserProfile(full_name="Someone Else", target_role="Go Developer")
    db_session.add(other)
    db_session.commit()
    return other


def add_card(
    db_session, front, *, profile_id=_UNSET, n=0, i=1, ef="2.50", due=_UNSET, source="GRAMMAR_ERROR", **extra
):
    """Insert a row directly; None is written as NULL (core insert skips the ORM's defaults)."""
    values = {
        "user_id": default_profile(db_session).id if profile_id is _UNSET else profile_id,
        "source_type": source,
        "front_content": front,
        "back_content": f"{front} (fixed)",
        "repetition_count": n,
        "interval_days": i,
        "ease_factor": None if ef is None else Decimal(ef),
        "next_review_date": TODAY if due is _UNSET else due,
        **extra,
    }
    card_id = db_session.execute(insert(MistakeCard).values(**values)).inserted_primary_key[0]
    db_session.commit()
    return db_session.get(MistakeCard, card_id)


def fronts(response) -> list[str]:
    return [c["front_content"] for c in response.json()["cards"]]


def test_creates_a_grammar_card_due_today(client, db_session):
    response = client.post(URL, json=grammar())

    assert response.status_code == 201
    data = response.json()
    assert data["source_type"] == "GRAMMAR_ERROR"
    assert data["front_content"] == "He go home."
    assert data["back_content"] == "He goes home."
    assert data["explanation"] == "Third person singular takes -es."
    assert data["next_review_date"]

    row = db_session.get(MistakeCard, data["id"])
    assert row.user_id is not None
    assert row.repetition_count == 0
    assert float(row.ease_factor) == 2.5


def test_creates_a_vocabulary_card_without_an_explanation(client):
    response = client.post(
        URL, json={"source_type": "VOCABULARY", "front_content": "good", "back_content": "C1: superb\nC2: exemplary"}
    )

    assert response.status_code == 201
    assert response.json()["explanation"] is None


def test_saving_the_same_card_again_returns_the_existing_one(client, db_session):
    first = client.post(URL, json=grammar())
    second = client.post(URL, json=grammar())

    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert card_count(db_session) == 1


def test_whitespace_differences_do_not_create_a_duplicate(client, db_session):
    first = client.post(URL, json=grammar())
    second = client.post(URL, json=grammar(front_content="  He  go\nhome. ", back_content="He goes home.  "))

    assert second.json()["id"] == first.json()["id"]
    assert card_count(db_session) == 1


def test_same_text_with_another_source_type_is_a_different_card(client, db_session):
    client.post(URL, json=grammar())
    response = client.post(URL, json=grammar(source_type="VOCABULARY"))

    assert response.status_code == 201
    assert card_count(db_session) == 2


def test_a_different_correction_for_the_same_text_is_a_different_card(client, db_session):
    client.post(URL, json=grammar())
    response = client.post(URL, json=grammar(back_content="He went home."))

    assert response.status_code == 201
    assert card_count(db_session) == 2


def test_creates_a_tech_concept_card_from_an_interview(client, db_session):
    payload = grammar(
        source_type="TECH_CONCEPT",
        front_content="Why not over-index a write-heavy table?",
        back_content="Every write must update each index.",
    )

    response = client.post(URL, json=payload)

    assert response.status_code == 201
    assert response.json()["source_type"] == "TECH_CONCEPT"
    assert card_count(db_session) == 1


def test_rejects_unknown_source_type_and_blank_content(client, db_session):
    for bad in (
        grammar(source_type="NOT_A_SOURCE"),
        grammar(source_type="NOPE"),
        grammar(front_content="   "),
        grammar(back_content=""),
    ):
        response = client.post(URL, json=bad)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert card_count(db_session) == 0


def test_the_documented_path_has_no_trailing_slash_redirect(client):
    response = client.post(URL, json=grammar(), follow_redirects=False)

    assert response.status_code == 201


def test_create_returns_schedule_and_next_intervals(client):
    data = client.post(URL, json=grammar()).json()

    assert (data["repetition_count"], data["interval_days"]) == (0, 1)
    assert data["next_intervals"] == {"again": 1, "hard": 1, "good": 1, "easy": 1}


def test_due_returns_cards_due_today_oldest_first(client, db_session):
    add_card(db_session, "today", due=TODAY)
    add_card(db_session, "later", due=TODAY + timedelta(days=1))
    add_card(db_session, "old", due=TODAY - timedelta(days=3))

    response = client.get(f"{URL}/due")

    assert response.status_code == 200
    assert fronts(response) == ["old", "today"]
    assert response.json()["total_due"] == 2


def test_due_ties_are_ordered_by_id(client, db_session):
    first = add_card(db_session, "first")
    second = add_card(db_session, "second")

    ids = [c["id"] for c in client.get(f"{URL}/due").json()["cards"]]

    assert ids == [first.id, second.id]


def test_due_limit_caps_cards_not_total(client, db_session):
    for n in range(3):
        add_card(db_session, f"card {n}")

    data = client.get(f"{URL}/due?limit=2").json()

    assert len(data["cards"]) == 2
    assert data["total_due"] == 3


def test_due_default_limit_is_20(client, db_session):
    for n in range(25):
        add_card(db_session, f"card {n}")

    data = client.get(f"{URL}/due").json()

    assert len(data["cards"]) == 20
    assert data["total_due"] == 25


@pytest.mark.parametrize("limit", [0, 101])
def test_due_rejects_limit_out_of_range(client, limit):
    assert client.get(f"{URL}/due?limit={limit}").status_code == 422


def test_due_ignores_other_profiles_cards(client, db_session):
    add_card(db_session, "mine")
    add_card(db_session, "theirs", profile_id=other_profile(db_session).id)

    response = client.get(f"{URL}/due")

    assert fronts(response) == ["mine"]
    assert response.json()["total_due"] == 1


def test_due_card_shows_its_next_intervals(client, db_session):
    add_card(db_session, "second review", n=2, i=6, ef="2.50")

    card = client.get(f"{URL}/due").json()["cards"][0]

    assert card["next_intervals"] == {"again": 1, "hard": 1, "good": 14, "easy": 16}
    assert (card["repetition_count"], card["interval_days"]) == (2, 6)


def test_null_schedule_card_is_listed_and_due(client, db_session):
    add_card(db_session, "due today")
    row = add_card(db_session, "hand edited", n=None, i=None, ef=None, due=None)
    assert row.next_review_date is None and row.ease_factor is None

    due = client.get(f"{URL}/due")
    listed = client.get(URL)

    assert due.status_code == 200 and listed.status_code == 200
    assert fronts(due) == ["hand edited", "due today"]
    card = due.json()["cards"][0]
    assert (card["repetition_count"], card["interval_days"], card["next_review_date"]) == (0, 1, None)
    assert card["next_intervals"] == {"again": 1, "hard": 1, "good": 1, "easy": 1}
    assert "hand edited" in fronts(listed)


def test_list_returns_all_cards_newest_first(client, db_session):
    add_card(db_session, "a")
    add_card(db_session, "b", due=TODAY + timedelta(days=10))
    add_card(db_session, "c")

    response = client.get(URL)

    assert response.status_code == 200
    assert fronts(response) == ["c", "b", "a"]
    assert response.json()["total"] == 3


def test_list_paginates(client, db_session):
    for name in "abcde":
        add_card(db_session, name)

    data = client.get(f"{URL}?limit=2&offset=2").json()

    assert [c["front_content"] for c in data["cards"]] == ["c", "b"]
    assert data["total"] == 5


@pytest.mark.parametrize("query", ["limit=0", "limit=201", "offset=-1"])
def test_list_rejects_bad_paging(client, query):
    assert client.get(f"{URL}?{query}").status_code == 422


def test_list_ignores_other_profiles_cards(client, db_session):
    add_card(db_session, "mine")
    add_card(db_session, "theirs", profile_id=other_profile(db_session).id)

    data = client.get(URL).json()

    assert [c["front_content"] for c in data["cards"]] == ["mine"]
    assert data["total"] == 1


def test_ping_placeholder_is_gone(client):
    # 405 rather than 404 once /{card_id} has PATCH and DELETE: the path shape exists, GET does not.
    assert client.get(f"{URL}/ping").status_code in (404, 405)
    assert f"{URL}/ping" not in client.get("/openapi.json").json()["paths"]


def assert_card_not_found(response) -> None:
    # The message tells our 404 apart from FastAPI's "route does not exist" 404.
    assert response.status_code == 404
    assert response.json()["error"] == {"code": "NOT_FOUND", "message": "Card not found"}


def snapshot(db_session, card_id) -> tuple:
    db_session.expire_all()
    row = db_session.get(MistakeCard, card_id)
    if row is None:
        return None
    return (
        row.front_content,
        row.back_content,
        row.explanation,
        row.repetition_count,
        row.interval_days,
        row.ease_factor,
        row.next_review_date,
    )


def test_edit_changes_text_and_keeps_schedule(client, db_session):
    card = add_card(db_session, "He go home.", n=2, i=6, ef="2.36", due=TODAY + timedelta(days=3))

    response = client.patch(f"{URL}/{card.id}", json={"front_content": "She go home.", "back_content": "She goes home."})

    assert response.status_code == 200
    assert response.json()["front_content"] == "She go home."
    assert snapshot(db_session, card.id) == (
        "She go home.", "She goes home.", None, 2, 6, Decimal("2.36"), TODAY + timedelta(days=3)
    )


def test_edit_only_explanation_keeps_sides(client, db_session):
    card = add_card(db_session, "He go home.")

    response = client.patch(f"{URL}/{card.id}", json={"explanation": "Third person singular."})

    assert response.status_code == 200
    front, back, explanation, *_ = snapshot(db_session, card.id)
    assert (front, back, explanation) == ("He go home.", "He go home. (fixed)", "Third person singular.")


@pytest.mark.parametrize("value", [None, "   "])
def test_edit_clears_explanation(client, db_session, value):
    card = add_card(db_session, "He go home.")
    client.patch(f"{URL}/{card.id}", json={"explanation": "Something."})

    response = client.patch(f"{URL}/{card.id}", json={"explanation": value})

    assert response.status_code == 200
    assert response.json()["explanation"] is None
    assert snapshot(db_session, card.id)[2] is None


def test_edit_squashes_whitespace(client, db_session):
    card = add_card(db_session, "x")

    response = client.patch(f"{URL}/{card.id}", json={"front_content": "  He  go\nhome. "})

    assert response.json()["front_content"] == "He go home."


@pytest.mark.parametrize(
    "body",
    [{"front_content": None}, {"back_content": None}, {"front_content": "   "}, {"front_content": "x" * 1001}],
)
def test_edit_rejects_invalid_sides(client, db_session, body):
    card = add_card(db_session, "He go home.")
    before = snapshot(db_session, card.id)

    response = client.patch(f"{URL}/{card.id}", json=body)

    assert response.status_code == 422
    assert snapshot(db_session, card.id) == before


def test_empty_edit_returns_card_unchanged(client, db_session):
    card = add_card(db_session, "He go home.")
    before = snapshot(db_session, card.id)

    response = client.patch(f"{URL}/{card.id}", json={})

    assert response.status_code == 200
    assert response.json()["front_content"] == "He go home."
    assert snapshot(db_session, card.id) == before


def test_edit_into_another_card_returns_409(client, db_session):
    add_card(db_session, "taken")
    card = add_card(db_session, "mine")
    before = snapshot(db_session, card.id)

    response = client.patch(f"{URL}/{card.id}", json={"front_content": "taken", "back_content": "taken (fixed)"})

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "DUPLICATE_CARD"
    assert snapshot(db_session, card.id) == before


def test_edit_to_its_own_text_is_not_a_duplicate(client, db_session):
    card = add_card(db_session, "mine")

    response = client.patch(f"{URL}/{card.id}", json={"front_content": "mine", "back_content": "mine (fixed)"})

    assert response.status_code == 200


def test_edit_unknown_or_other_profiles_card_is_404(client, db_session):
    theirs = add_card(db_session, "theirs", profile_id=other_profile(db_session).id)

    for card_id in (theirs.id, 9999):
        response = client.patch(f"{URL}/{card_id}", json={"front_content": "changed"})
        assert_card_not_found(response)
    assert snapshot(db_session, theirs.id)[0] == "theirs"


def test_delete_removes_the_card(client, db_session):
    card = add_card(db_session, "mine")

    response = client.delete(f"{URL}/{card.id}")

    assert response.status_code == 204
    assert response.content == b""
    assert snapshot(db_session, card.id) is None
    assert_card_not_found(client.delete(f"{URL}/{card.id}"))


def test_delete_other_profiles_card_is_404(client, db_session):
    theirs = add_card(db_session, "theirs", profile_id=other_profile(db_session).id)

    response = client.delete(f"{URL}/{theirs.id}")

    assert_card_not_found(response)
    assert snapshot(db_session, theirs.id) is not None


def review_url(card) -> str:
    return f"{URL}/{card.id}/review"


def streak(db_session) -> tuple:
    db_session.expire_all()
    p = default_profile(db_session)
    return (p.streak_days, p.last_active_date)


def test_review_good_on_second_success(client, db_session):
    card = add_card(db_session, "x", n=1, i=1, ef="2.50")

    response = client.patch(review_url(card), json={"q": 3})

    assert response.status_code == 200
    data = response.json()
    assert (data["repetition_count"], data["interval_days"]) == (2, 6)
    assert data["next_review_date"] == (TODAY + timedelta(days=6)).isoformat()
    assert data["next_intervals"] == {"again": 1, "hard": 1, "good": 13, "easy": 15}
    assert snapshot(db_session, card.id)[3:] == (2, 6, Decimal("2.36"), TODAY + timedelta(days=6))


def test_review_again_resets(client, db_session):
    card = add_card(db_session, "x", n=4, i=36, ef="2.50")

    data = client.patch(review_url(card), json={"q": 0}).json()

    assert (data["repetition_count"], data["interval_days"]) == (0, 1)
    assert data["next_review_date"] == (TODAY + timedelta(days=1)).isoformat()


def test_review_overdue_card(client, db_session):
    card = add_card(db_session, "x", due=TODAY - timedelta(days=5))

    assert client.patch(review_url(card), json={"q": 5}).status_code == 200


def test_review_card_not_due_returns_409(client, db_session):
    card = add_card(db_session, "x", n=2, i=6, due=TODAY + timedelta(days=1))
    before, streak_before = snapshot(db_session, card.id), streak(db_session)

    response = client.patch(review_url(card), json={"q": 3})

    assert response.status_code == 409
    assert response.json()["error"] == {"code": "CARD_NOT_DUE", "message": "This card is not due for review yet."}
    assert snapshot(db_session, card.id) == before
    assert streak(db_session) == streak_before


def test_second_rating_today_returns_409(client, db_session):
    card = add_card(db_session, "x")

    assert client.patch(review_url(card), json={"q": 3}).status_code == 200
    assert client.patch(review_url(card), json={"q": 5}).status_code == 409


def test_review_that_loses_a_race_returns_409(client, db_session, monkeypatch):
    import app.api.routes_flashcards as routes

    card = add_card(db_session, "x", n=2, i=6)
    streak_before = streak(db_session)
    real_review = routes.review

    def another_rating_lands_first(state, q, today):
        result = real_review(state, q, today)
        db_session.execute(
            update(MistakeCard)
            .where(MistakeCard.id == card.id)
            .values(repetition_count=9, next_review_date=TODAY + timedelta(days=4))
            .execution_options(synchronize_session=False)
        )
        db_session.commit()
        return result

    monkeypatch.setattr(routes, "review", another_rating_lands_first)

    response = client.patch(review_url(card), json={"q": 5})

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CARD_NOT_DUE"
    row = snapshot(db_session, card.id)
    assert (row[3], row[6]) == (9, TODAY + timedelta(days=4))
    assert streak(db_session) == streak_before


@pytest.mark.parametrize("body", [{"q": 2}, {"q": 4}, {"q": -1}, {"q": True}, {"q": "3"}, {"q": 3.0}, {}])
def test_review_rejects_invalid_grades(client, db_session, body):
    card = add_card(db_session, "x", n=2, i=6)
    before = snapshot(db_session, card.id)

    response = client.patch(review_url(card), json=body)

    assert response.status_code == 422
    assert snapshot(db_session, card.id) == before


def test_review_unknown_or_other_profiles_card_is_404(client, db_session):
    theirs = add_card(db_session, "theirs", profile_id=other_profile(db_session).id)

    assert_card_not_found(client.patch(review_url(theirs), json={"q": 3}))
    assert_card_not_found(client.patch(f"{URL}/9999/review", json={"q": 3}))
    assert snapshot(db_session, theirs.id)[3] == 0


def test_review_card_with_null_schedule(client, db_session):
    card = add_card(db_session, "x", n=None, i=None, ef=None, due=None)

    response = client.patch(review_url(card), json={"q": 3})

    assert response.status_code == 200
    assert snapshot(db_session, card.id)[3:] == (1, 1, Decimal("2.36"), TODAY + timedelta(days=1))


def test_review_with_overflowing_interval_returns_422(client, db_session):
    card = add_card(db_session, "x", n=5, i=3_000_000)
    before = snapshot(db_session, card.id)

    response = client.patch(review_url(card), json={"q": 5})

    assert response.status_code == 422
    assert response.json()["error"] == {
        "code": "CARD_SCHEDULE_INVALID",
        "message": "This card's schedule is invalid. Edit or delete the card.",
    }
    assert snapshot(db_session, card.id) == before


def test_review_extends_streak(client, db_session):
    p = default_profile(db_session)
    p.streak_days, p.last_active_date = 4, TODAY - timedelta(days=1)
    db_session.commit()
    card = add_card(db_session, "x")

    client.patch(review_url(card), json={"q": 3})

    assert streak(db_session) == (5, TODAY)


def test_review_starts_streak_on_first_activity(client, db_session):
    card = add_card(db_session, "x")

    client.patch(review_url(card), json={"q": 3})

    assert streak(db_session) == (1, TODAY)


def test_card_with_null_created_at_is_listed_and_reviewable(client, db_session):
    add_card(db_session, "normal")
    card = add_card(db_session, "imported", created_at=None)

    listed = client.get(URL)
    due = client.get(f"{URL}/due")
    reviewed = client.patch(review_url(card), json={"q": 3})

    assert listed.status_code == 200 and "imported" in fronts(listed)
    assert due.status_code == 200 and "imported" in fronts(due)
    assert reviewed.status_code == 200
    assert reviewed.json()["created_at"] is None


def test_explanation_edit_on_a_card_with_an_identical_twin(client, db_session):
    # Two identical rows can exist (a double-clicked save racing the create dedupe on Postgres).
    card = add_card(db_session, "twin")
    add_card(db_session, "twin")

    response = client.patch(f"{URL}/{card.id}", json={"explanation": "Why it is wrong."})

    assert response.status_code == 200
    assert snapshot(db_session, card.id)[2] == "Why it is wrong."
