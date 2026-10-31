from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.api import routes_english
from app.api.routes_english import get_coach
from app.core.config import Settings
from app.main import app
from app.models import UserProfile, WritingSubmission
from app.services.english_coach import EnglishCoach
from tests.test_english_coach import ESSAY, ScriptedLlm, evaluation_payload

URL = "/api/v1/english/writing"


def body(**overrides) -> dict:
    payload = {"task_type": "IELTS_TASK2", "prompt_topic": "AI in software testing", "user_essay": ESSAY}
    payload.update(overrides)
    return payload


@pytest.fixture
def llm(client):
    scripted = ScriptedLlm(*[evaluation_payload()] * 10)
    app.dependency_overrides[get_coach] = lambda: EnglishCoach(scripted)
    return scripted


def test_evaluate_saves_submission_and_returns_schema(client, db_session, llm):
    response = client.post(f"{URL}/evaluate", json=body())

    assert response.status_code == 201
    data = response.json()
    assert data["task_type"] == "IELTS_TASK2"
    assert data["prompt_topic"] == "AI in software testing"
    assert data["overall_band"] == 6.5
    assert data["band_scores"]["task_response"]["score"] == 7.0
    assert data["sentence_corrections"][0]["error_category"] == "Subject-Verb Agreement"
    assert data["upgraded_vocab"][0]["advanced_alternative"].startswith("leverage")
    assert data["upgraded_vocab"][0]["c2_alternative"].startswith("harness")
    assert data["band_delta"] is None

    row = db_session.get(WritingSubmission, data["id"])
    assert row.user_essay == ESSAY
    assert float(row.overall_band) == 6.5
    assert row.band_scores["grammatical_range"]["score"] == 6.0
    assert row.upgraded_vocab[0]["basic_word"] == "use AI for automate"


def test_word_count_is_computed_by_server(client, llm):
    data = client.post(f"{URL}/evaluate", json=body(word_count=999)).json()

    assert data["word_count"] == len(ESSAY.split())


def test_essay_too_short_is_rejected_without_calling_the_llm(client, db_session, llm):
    response = client.post(f"{URL}/evaluate", json=body(user_essay="Too short."))

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert llm.calls == []
    assert db_session.query(WritingSubmission).count() == 0


def test_essay_too_long_is_rejected_without_calling_the_llm(client, llm):
    response = client.post(f"{URL}/evaluate", json=body(user_essay="word " * 1001))

    assert response.status_code == 422
    assert llm.calls == []


def test_invalid_body_gets_422_even_when_gemini_key_is_missing(client, monkeypatch):
    monkeypatch.setattr(routes_english, "get_settings", lambda: Settings(database_url="sqlite://", gemini_api_key=""))

    short = client.post(f"{URL}/evaluate", json=body(user_essay="Too short."))
    valid = client.post(f"{URL}/evaluate", json=body())

    assert short.status_code == 422
    assert valid.status_code == 503
    assert valid.json()["error"]["code"] == "AI_NOT_CONFIGURED"


def test_unknown_task_type_is_rejected(client, llm):
    assert client.post(f"{URL}/evaluate", json=body(task_type="POEM")).status_code == 422


def test_ai_failure_saves_nothing(client, db_session):
    app.dependency_overrides[get_coach] = lambda: EnglishCoach(ScriptedLlm("nope", "nope", "nope"))

    response = client.post(f"{URL}/evaluate", json=body())

    assert response.status_code == 502
    assert db_session.query(WritingSubmission).count() == 0


def script_bands(*bands: float) -> None:
    coach = EnglishCoach(ScriptedLlm(*[evaluation_payload(overall_band=b) for b in bands]))
    app.dependency_overrides[get_coach] = lambda: coach


def test_band_delta_compares_with_previous_submission_of_same_task_type(client, llm):
    script_bands(6.0, 7.0, 3.0)
    client.post(f"{URL}/evaluate", json=body())
    second = client.post(f"{URL}/evaluate", json=body()).json()
    other_type = client.post(f"{URL}/evaluate", json=body(task_type="TECH_STANDUP")).json()

    assert second["band_delta"] == 1.0
    assert other_type["band_delta"] is None


def test_get_submission_by_id(client, llm):
    created = client.post(f"{URL}/evaluate", json=body()).json()

    response = client.get(f"{URL}/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_get_unknown_submission_is_404(client):
    response = client.get(f"{URL}/999")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SUBMISSION_NOT_FOUND"


def test_history_lists_newest_first_with_deltas(client):
    script_bands(6.0, 6.5)
    first = client.post(f"{URL}/evaluate", json=body()).json()
    second = client.post(f"{URL}/evaluate", json=body()).json()

    items = client.get(URL).json()

    assert [i["id"] for i in items] == [second["id"], first["id"]]
    assert [i["band_delta"] for i in items] == [0.5, None]
    assert "user_essay" not in items[0]
    assert items[0]["overall_band"] == 6.5


def profile(db_session) -> UserProfile:
    return db_session.query(UserProfile).one()


def test_first_submission_starts_streak_at_one(client, db_session, llm):
    client.post(f"{URL}/evaluate", json=body())

    assert profile(db_session).streak_days == 1
    assert profile(db_session).last_active_date == date.today()


def test_second_submission_same_day_keeps_streak(client, db_session, llm):
    client.post(f"{URL}/evaluate", json=body())
    client.post(f"{URL}/evaluate", json=body())

    assert profile(db_session).streak_days == 1


def test_submission_the_day_after_extends_streak(client, db_session, llm):
    p = profile(db_session)
    p.streak_days, p.last_active_date = 4, date.today() - timedelta(days=1)
    db_session.commit()

    client.post(f"{URL}/evaluate", json=body())

    assert profile(db_session).streak_days == 5


def test_gap_of_more_than_a_day_resets_streak(client, db_session, llm):
    p = profile(db_session)
    p.streak_days, p.last_active_date = 9, date.today() - timedelta(days=3)
    db_session.commit()

    client.post(f"{URL}/evaluate", json=body())

    assert profile(db_session).streak_days == 1


def test_prompt_endpoint_returns_a_task2_prompt_with_limits(client):
    response = client.get(f"{URL}/prompts", params={"task_type": "IELTS_TASK2"})

    assert response.status_code == 200
    data = response.json()
    assert data["task_type"] == "IELTS_TASK2"
    assert data["prompt"]
    assert data["min_words"] == 250
    assert data["max_words"] is None
    assert data["suggested_minutes"] == 40


def test_prompt_endpoint_returns_a_standup_prompt_with_limits(client):
    data = client.get(f"{URL}/prompts", params={"task_type": "TECH_STANDUP"}).json()

    assert data["task_type"] == "TECH_STANDUP"
    assert (data["min_words"], data["max_words"], data["suggested_minutes"]) == (80, 120, 5)


def test_prompt_endpoint_rejects_missing_or_unknown_task_type(client):
    assert client.get(f"{URL}/prompts").status_code == 422
    assert client.get(f"{URL}/prompts", params={"task_type": "NOPE"}).status_code == 422


def test_submission_saved_before_c2_existed_is_still_readable(client, db_session):
    old = WritingSubmission(
        user_id=db_session.scalars(select(UserProfile.id)).first(),
        task_type="IELTS_TASK2",
        prompt_topic="Old topic",
        user_essay="Old essay",
        word_count=2,
        overall_band=6.0,
        band_scores={},
        sentence_corrections=[],
        upgraded_vocab=[{"basic_word": "good", "advanced_alternative": "superb", "context_example": "A superb idea."}],
    )
    db_session.add(old)
    db_session.commit()

    data = client.get(f"{URL}/{old.id}").json()

    assert data["upgraded_vocab"][0]["advanced_alternative"] == "superb"
    assert data["upgraded_vocab"][0]["c2_alternative"] is None
