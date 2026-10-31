from sqlalchemy import func, select

from app.models import MistakeCard

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


def test_rejects_unknown_source_type_and_blank_content(client, db_session):
    for bad in (
        grammar(source_type="TECH_CONCEPT"),
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
