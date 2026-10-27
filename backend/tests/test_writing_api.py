import pytest

from app.api.routes_english import get_coach
from app.main import app
from app.models import WritingSubmission
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
    assert "user_essay" not in items[0]
    assert items[0]["overall_band"] == 6.5
