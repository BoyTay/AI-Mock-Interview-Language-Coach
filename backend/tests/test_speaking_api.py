"""Grading a recorded standup: POST /english/speaking/evaluate with multipart `audio`, `prompt_text`, `duration_seconds`."""
from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.api import routes_english
from app.core.config import Settings
from app.api.routes_english import get_speaking_audio_store, get_speaking_coach
from app.main import app
from app.models import SpeakingSubmission, UserProfile
from app.services.audio_store import MAX_AUDIO_BYTES, AudioStore
from app.services.english_coach import LlmRateLimitError
from app.services.speaking_coach import SpeakingCoach
from app.services.speaking_prompts import PROMPTS
from tests.interview_helpers import mp4_bytes, webm_bytes
from tests.speaking_helpers import TRANSCRIPT, ScriptedAudioLlm, speaking_payload

URL = "/api/v1/english/speaking"


@pytest.fixture
def speaking_store(tmp_path):
    store = AudioStore(tmp_path / "uploads")
    app.dependency_overrides[get_speaking_audio_store] = lambda: store
    return store


@pytest.fixture
def use_llm(client, speaking_store):
    def install(*responses) -> ScriptedAudioLlm:
        scripted = ScriptedAudioLlm(*responses)
        app.dependency_overrides[get_speaking_coach] = lambda: SpeakingCoach(scripted)
        return scripted

    return install


@pytest.fixture
def llm(use_llm):
    return use_llm(*[speaking_payload()] * 10)


def evaluate(client, data=None, prompt_text="Give your update", duration_seconds="84"):
    data = webm_bytes() if data is None else data
    return client.post(
        f"{URL}/evaluate",
        files={"audio": ("recording.webm", data, "audio/webm")},
        data={"prompt_text": prompt_text, "duration_seconds": duration_seconds},
    )


def stored_files(store):
    return [p for p in store.root.rglob("*") if p.is_file()]


def profile(db_session) -> UserProfile:
    return db_session.scalars(select(UserProfile)).first()


def test_evaluate_returns_the_graded_result(client, llm):
    response = evaluate(client)

    assert response.status_code == 201
    body = response.json()
    assert body["overall_band"] == 6.5 and body["band_delta"] is None
    assert body["transcript"] == TRANSCRIPT
    assert body["prompt_text"] == "Give your update"
    assert body["duration_seconds"] == 84
    assert body["words_per_minute"] == 11  # 16 words in 84 s
    assert body["filler_count"] == 2
    issue = TRANSCRIPT.index("issue")
    assert body["marks"][2] == {
        "kind": "pronunciation",
        "text": "issue",
        "start": issue,
        "end": issue + len("issue"),
        "respelling": "ISH-oo",
        "note": "Stress the first syllable and keep the 'sh' sound.",
    }
    assert body["criteria"]["fluency"]["score"] == 7.0
    assert body["criteria"]["pronunciation"]["feedback"] == "Clear apart from 'issue'."
    assert body["grammar_corrections"][0]["corrected"] == "I finished the fix"
    assert body["vocabulary_upgrades"][0]["better"] == "resolve"


def test_the_row_and_the_file_are_stored(client, db_session, speaking_store, llm):
    body = evaluate(client, data=webm_bytes(b"recorded words")).json()

    row = db_session.get(SpeakingSubmission, body["id"])
    assert row.user_id == profile(db_session).id
    assert row.prompt_text == "Give your update"
    assert row.transcript == TRANSCRIPT
    assert row.duration_seconds == 84
    assert row.words_per_minute == 11
    assert float(row.overall_band) == 6.5
    assert row.band_scores["fluency"]["score"] == 7.0
    assert row.summary.startswith("Clear update")
    assert [m["kind"] for m in row.marks] == ["filler", "filler", "pronunciation"]
    assert row.grammar_corrections[0]["original"] == "I, um, finish the fix"
    assert row.vocabulary_upgrades[0]["used"] == "fix"
    assert row.prompt_version == "1"
    assert row.audio_path.startswith(f"speaking/{row.user_id}/") and row.audio_path.endswith(".webm")
    assert speaking_store.open_path(row.audio_path).read_bytes() == webm_bytes(b"recorded words")


def test_the_model_hears_the_audio_and_safari_mp4_is_sent_as_m4a(client, speaking_store, use_llm):
    scripted = use_llm(speaking_payload())

    response = client.post(
        f"{URL}/evaluate",
        files={"audio": ("a.mp4", mp4_bytes(b"abc"), "audio/mp4")},
        data={"prompt_text": "Give your update", "duration_seconds": "60"},
    )

    assert response.status_code == 201
    audio = scripted.calls[0][2]
    assert audio.data == mp4_bytes(b"abc") and audio.mime_type == "audio/m4a"
    assert stored_files(speaking_store)[0].suffix == ".mp4"


def test_band_delta_against_the_previous_recording(client, use_llm):
    lower = speaking_payload()
    for criterion in lower["criteria"].values():
        criterion["score"] = 6.0
    use_llm(speaking_payload(), lower)

    first = evaluate(client).json()
    second = evaluate(client).json()

    assert first["band_delta"] is None
    assert second["overall_band"] == 6.0
    assert second["band_delta"] == -0.5


def test_streak_is_touched(client, db_session, llm):
    p = profile(db_session)
    p.streak_days, p.last_active_date = 4, date.today() - timedelta(days=1)
    db_session.commit()

    evaluate(client)

    assert profile(db_session).streak_days == 5
    assert profile(db_session).last_active_date == date.today()


@pytest.mark.parametrize("seconds,status", [("29", 422), ("30", 201), ("120", 201), ("121", 201), ("126", 422)])
def test_duration_bounds(client, speaking_store, llm, seconds, status):
    response = evaluate(client, duration_seconds=seconds)

    assert response.status_code == status
    if status == 422:
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"
        assert response.json()["error"]["details"][0]["field"] == "body.duration_seconds"
        assert llm.calls == []
        assert stored_files(speaking_store) == []


def test_a_non_numeric_duration_is_422(client, llm):
    response = evaluate(client, duration_seconds="soon")

    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "body.duration_seconds"


def test_missing_prompt_text_is_422(client, speaking_store, llm):
    response = client.post(
        f"{URL}/evaluate",
        files={"audio": ("recording.webm", webm_bytes(), "audio/webm")},
        data={"duration_seconds": "84"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "body.prompt_text"
    assert llm.calls == []
    assert stored_files(speaking_store) == []


def test_blank_prompt_text_is_422(client, llm):
    assert evaluate(client, prompt_text="   ").status_code == 422


def test_missing_audio_is_422_audio_required(client, llm):
    response = client.post(
        f"{URL}/evaluate",
        data={"prompt_text": "Give your update", "duration_seconds": "84"},
        files={"other": ("x", b"y")},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "AUDIO_REQUIRED"
    assert llm.calls == []


def test_unknown_audio_type_is_415(client, speaking_store, llm):
    response = evaluate(client, data=b"%PDF-1.4 not audio")

    assert response.status_code == 415
    assert response.json()["error"]["code"] == "UNSUPPORTED_AUDIO_TYPE"
    assert llm.calls == []
    assert stored_files(speaking_store) == []


def test_too_large_is_413(client, speaking_store, llm):
    response = evaluate(client, data=webm_bytes(b"x" * (MAX_AUDIO_BYTES + 200 * 1024)))

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "AUDIO_TOO_LARGE"
    assert llm.calls == []
    assert stored_files(speaking_store) == []


def test_a_recording_just_over_the_cap_is_413_while_reading(client, speaking_store, llm):
    response = evaluate(client, data=webm_bytes(b"x" * MAX_AUDIO_BYTES))

    assert response.status_code == 413
    assert llm.calls == []
    assert stored_files(speaking_store) == []


def test_no_speech_is_422_and_nothing_is_stored(client, db_session, speaking_store, use_llm):
    use_llm(speaking_payload(transcript="   ", marks=[], grammar_corrections=[]))

    response = evaluate(client)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "NO_SPEECH_DETECTED"
    assert db_session.scalars(select(SpeakingSubmission)).all() == []
    assert stored_files(speaking_store) == []
    assert profile(db_session).streak_days in (None, 0)


def test_rate_limit_is_429_with_retry_after_and_nothing_is_stored(client, db_session, speaking_store, use_llm):
    use_llm(LlmRateLimitError(7))

    response = evaluate(client)

    assert response.status_code == 429
    assert response.headers["Retry-After"] == "7"
    assert db_session.scalars(select(SpeakingSubmission)).all() == []
    assert stored_files(speaking_store) == []


def test_commit_failure_deletes_the_file(client, db_session, speaking_store, llm, monkeypatch):
    def boom():
        raise RuntimeError("database is down")

    monkeypatch.setattr(db_session, "commit", boom)

    with pytest.raises(RuntimeError):
        evaluate(client)

    assert stored_files(speaking_store) == []


def test_prompts_endpoint_returns_a_prompt_with_limits(client):
    response = client.get(f"{URL}/prompts")

    assert response.status_code == 200
    body = response.json()
    assert body["min_seconds"] == 30 and body["max_seconds"] == 120
    assert body["id"] in {p.id for p in PROMPTS}
    assert body["prompt"] == next(p.prompt for p in PROMPTS if p.id == body["id"])


def test_the_openapi_schema_describes_the_multipart_body(client):
    schema = client.get("/openapi.json").json()

    body = schema["paths"]["/api/v1/english/speaking/evaluate"]["post"]["requestBody"]
    properties = body["content"]["multipart/form-data"]["schema"]["properties"]
    assert set(properties) == {"audio", "prompt_text", "duration_seconds"}


def test_missing_gemini_key_gets_503_and_stores_nothing(client, speaking_store, db_session, monkeypatch):
    app.dependency_overrides.pop(get_speaking_coach, None)
    monkeypatch.setattr(routes_english, "get_settings", lambda: Settings(database_url="sqlite://", gemini_api_key=""))

    response = evaluate(client)

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "AI_NOT_CONFIGURED"
    assert db_session.query(SpeakingSubmission).count() == 0
    assert stored_files(speaking_store) == []
