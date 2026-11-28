from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import func, insert, select

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


def add_card(db_session, front, *, profile_id=_UNSET, n=0, i=1, ef="2.50", due=_UNSET, source="GRAMMAR_ERROR"):
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
    assert client.get(f"{URL}/ping").status_code == 404
