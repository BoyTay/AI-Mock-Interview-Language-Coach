"""Answering an interview question by voice: POST /interviews/{id}/answer with a multipart `audio` field."""
import pytest

from app.core.errors import AppError
from app.models import InterviewSession, UserProfile
from app.services.audio_store import MAX_AUDIO_BYTES
from app.services.english_coach import LlmRateLimitError
from tests.interview_helpers import (
    answer,
    answer_voice,
    evaluation,
    follow_up,
    messages,
    mp4_bytes,
    start,
    voice_evaluation,
    webm_bytes,
)


def stored_files(store):
    return [p for p in store.root.rglob("*") if p.is_file()]


def test_a_voice_answer_returns_the_evaluation_the_next_question_and_the_transcript(
    client, rag, use_interviewer, audio_store
):
    use_interviewer(voice=[voice_evaluation(technical_accuracy_score=81, communication_clarity_score=77)])
    session_id = start(client)["session_id"]

    response = answer_voice(client, session_id)

    assert response.status_code == 200
    body = response.json()
    assert body["evaluation"]["technical_accuracy_score"] == 81
    assert body["evaluation"]["communication_clarity_score"] == 77
    assert "transcript" not in body["evaluation"]
    assert body["voice"]["transcript"] == "I would use a hash map."
    assert body["voice"]["fluency_score"] == 72
    assert body["voice"]["pronunciation_notes"] == "Phát âm rõ."
    assert body["voice"]["filler_words"] == ["um"]
    assert body["next_question"]["text"] == "Main question 2?"
    assert body["session_complete"] is False


def test_the_transcript_is_stored_as_the_answer_with_the_audio_path_and_the_file_exists(
    client, db_session, rag, use_interviewer, audio_store
):
    use_interviewer()
    session_id = start(client)["session_id"]

    body = answer_voice(client, session_id, data=webm_bytes(b"recorded words")).json()

    stored = messages(db_session, session_id)[1]
    assert stored.id == body["voice"]["message_id"]
    assert stored.sender == "USER"
    assert stored.content_text == "I would use a hash map."
    assert stored.audio_path.startswith(f"interviews/{session_id}/")
    assert audio_store.open_path(stored.audio_path).read_bytes() == webm_bytes(b"recorded words")
    assert stored.evaluation["fluency_score"] == 72
    assert stored.evaluation["transcript"] == "I would use a hash map."


def test_the_next_turn_sees_the_transcript_in_the_conversation(client, rag, use_interviewer, audio_store):
    interviewer = use_interviewer(evaluation(), voice=[voice_evaluation(should_ask_followup=True, next_ai_question="Why?")])
    session_id = start(client)["session_id"]

    answer_voice(client, session_id)
    answer(client, session_id, "Because it is fast.")

    thread = interviewer.turns[0].thread
    assert ("USER", "I would use a hash map.") in thread
    assert thread[-1] == ("AI", "Why?")


def test_the_model_receives_the_audio_and_an_empty_answer(client, rag, use_interviewer, audio_store):
    interviewer = use_interviewer()
    session_id = start(client)["session_id"]

    answer_voice(client, session_id, data=webm_bytes(b"abc"))

    turn, audio = interviewer.voice_turns[0]
    assert audio.data == webm_bytes(b"abc")
    assert audio.mime_type == "audio/webm"
    assert turn.answer == ""
    assert turn.reference_answer == "Reference answer 1."


def test_safari_mp4_is_sent_to_gemini_as_m4a_but_stored_as_mp4(client, db_session, rag, use_interviewer, audio_store):
    interviewer = use_interviewer()
    session_id = start(client)["session_id"]

    answer_voice(client, session_id, data=mp4_bytes(), filename="a.mp4", content_type="audio/mp4")

    assert interviewer.voice_turns[0][1].mime_type == "audio/m4a"
    assert messages(db_session, session_id)[1].audio_path.endswith(".mp4")


def test_the_declared_content_type_is_not_trusted_only_the_bytes(client, rag, use_interviewer, audio_store):
    interviewer = use_interviewer()
    session_id = start(client)["session_id"]

    response = answer_voice(client, session_id, data=mp4_bytes(), filename="a.webm", content_type="audio/webm")

    assert response.status_code == 200
    assert interviewer.voice_turns[0][1].mime_type == "audio/m4a"


def test_a_follow_up_for_a_spoken_answer_is_asked_like_for_a_typed_one(client, rag, use_interviewer, audio_store):
    use_interviewer(voice=[voice_evaluation(should_ask_followup=True, next_ai_question="What about collisions?")])
    session_id = start(client)["session_id"]

    body = answer_voice(client, session_id).json()

    assert body["next_question"]["type"] == "FOLLOW_UP"
    assert body["next_question"]["text"] == "What about collisions?"


def test_the_fluency_score_does_not_change_the_content_scores(client, rag, use_interviewer, audio_store):
    use_interviewer(
        voice=[voice_evaluation(fluency_score=5), voice_evaluation(fluency_score=100)]
    )
    session_id = start(client)["session_id"]

    low = answer_voice(client, session_id).json()
    high = answer_voice(client, session_id).json()

    assert low["evaluation"]["technical_accuracy_score"] == high["evaluation"]["technical_accuracy_score"] == 70
    assert low["evaluation"]["communication_clarity_score"] == high["evaluation"]["communication_clarity_score"] == 80


def test_a_file_that_is_not_audio_is_415_and_stores_nothing(client, db_session, rag, use_interviewer, audio_store):
    interviewer = use_interviewer()
    session_id = start(client)["session_id"]

    response = answer_voice(client, session_id, data=b"%PDF-1.7 not audio", filename="a.webm")

    assert response.status_code == 415
    assert response.json()["error"]["code"] == "UNSUPPORTED_AUDIO_TYPE"
    assert interviewer.voice_turns == []
    assert len(messages(db_session, session_id)) == 1
    assert stored_files(audio_store) == []


def test_an_oversized_upload_is_413_and_stores_nothing(client, rag, use_interviewer, audio_store):
    interviewer = use_interviewer()
    session_id = start(client)["session_id"]

    response = answer_voice(client, session_id, data=webm_bytes(b"x" * MAX_AUDIO_BYTES))

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "AUDIO_TOO_LARGE"
    assert interviewer.voice_turns == []
    assert stored_files(audio_store) == []


def test_a_body_that_announces_itself_as_far_too_big_is_refused_up_front(client, rag, use_interviewer, audio_store):
    interviewer = use_interviewer()
    session_id = start(client)["session_id"]

    response = answer_voice(client, session_id, data=webm_bytes(b"x" * (MAX_AUDIO_BYTES + 200 * 1024)))

    assert response.status_code == 413
    assert interviewer.voice_turns == []
    assert stored_files(audio_store) == []


def test_a_multipart_request_without_the_audio_field_is_422_audio_required(client, rag, use_interviewer, audio_store):
    use_interviewer()
    session_id = start(client)["session_id"]

    response = client.post(f"/api/v1/interviews/{session_id}/answer", data={"note": "hi"}, files={"other": ("x", b"y")})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "AUDIO_REQUIRED"


def test_a_recording_with_no_speech_is_422_and_leaves_nothing(client, db_session, rag, use_interviewer, audio_store):
    use_interviewer(voice=[voice_evaluation(transcript="  ", technical_accuracy_score=0, is_on_topic=False)])
    session_id = start(client)["session_id"]

    response = answer_voice(client, session_id)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "NO_SPEECH_DETECTED"
    assert len(messages(db_session, session_id)) == 1
    assert stored_files(audio_store) == []


def test_a_failed_model_call_stores_no_message_and_no_file_so_the_answer_can_be_resent(
    client, db_session, rag, use_interviewer, audio_store
):
    use_interviewer(voice=[AppError(502, "AI_INVALID_RESPONSE", "bad"), voice_evaluation()])
    session_id = start(client)["session_id"]

    assert answer_voice(client, session_id).status_code == 502
    assert len(messages(db_session, session_id)) == 1
    assert stored_files(audio_store) == []

    assert answer_voice(client, session_id).status_code == 200
    assert len(stored_files(audio_store)) == 1


def test_a_rate_limited_voice_answer_is_429_with_retry_after(client, db_session, rag, use_interviewer, audio_store):
    use_interviewer(voice=[AppError(429, "RATE_LIMITED", "busy", headers={"Retry-After": "11"})])
    session_id = start(client)["session_id"]

    response = answer_voice(client, session_id)

    assert response.status_code == 429
    assert response.headers["retry-after"] == "11"
    assert len(messages(db_session, session_id)) == 1


def test_the_file_is_removed_when_saving_the_message_fails(client, db_session, rag, use_interviewer, audio_store, monkeypatch):
    use_interviewer()
    session_id = start(client)["session_id"]
    real_commit = db_session.commit
    calls = []

    def failing_commit():
        calls.append(1)
        raise RuntimeError("database down")

    monkeypatch.setattr(db_session, "commit", failing_commit)

    with pytest.raises(RuntimeError, match="database down"):  # the test client re-raises what the app turns into a 500
        answer_voice(client, session_id)

    assert calls
    assert stored_files(audio_store) == []
    monkeypatch.setattr(db_session, "commit", real_commit)
    assert len(messages(db_session, session_id)) == 1


def test_a_voice_answer_to_a_finished_session_is_409(client, db_session, rag, use_interviewer, audio_store):
    use_interviewer()
    session_id = start(client)["session_id"]
    db_session.get(InterviewSession, session_id).status = "COMPLETED"
    db_session.commit()

    response = answer_voice(client, session_id)

    assert response.status_code == 409
    assert stored_files(audio_store) == []


def test_another_users_session_is_404_for_voice_too(client, db_session, rag, use_interviewer, audio_store):
    use_interviewer()
    other = UserProfile(full_name="Someone Else", target_role="Dev")
    db_session.add(other)
    db_session.flush()
    foreign = InterviewSession(user_id=other.id, session_type="TECH_INTERVIEW", question_plan=[])
    db_session.add(foreign)
    db_session.commit()

    response = answer_voice(client, foreign.id)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SESSION_NOT_FOUND"
    assert stored_files(audio_store) == []


def test_a_typed_answer_still_works_beside_the_voice_ones(client, db_session, rag, use_interviewer, audio_store):
    use_interviewer(evaluation(), voice=[voice_evaluation()])
    session_id = start(client)["session_id"]

    assert answer_voice(client, session_id).status_code == 200
    typed = answer(client, session_id, "Typed words.").json()

    assert typed["voice"] is None
    assert [m.audio_path is not None for m in messages(db_session, session_id) if m.sender == "USER"] == [True, False]
