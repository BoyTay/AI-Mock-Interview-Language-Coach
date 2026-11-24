import pytest
from google.genai import errors as genai_errors

from app.core.config import Settings
from app.core.errors import AppError
from app.schemas.english import SpeakingEvaluation
from app.services.english_coach import Audio, LlmRateLimitError
from app.services.speaking_coach import SpeakingCoach, build_speaking_coach
from tests.speaking_helpers import TRANSCRIPT as T
from tests.speaking_helpers import ScriptedAudioLlm, speaking_payload

AUDIO = Audio(b"x", "audio/webm")


def coach_with(*responses) -> tuple[SpeakingCoach, ScriptedAudioLlm]:
    llm = ScriptedAudioLlm(*responses)
    return SpeakingCoach(llm), llm


def test_returns_placed_marks_overall_band_and_counts():
    coach, llm = coach_with(speaking_payload())

    graded = coach.evaluate(Audio(b"x", "audio/webm"), "Give your update")

    assert graded.overall_band == 6.5
    assert [(m.kind.value, T[m.start : m.end]) for m in graded.marks] == [
        ("filler", "um"),
        ("filler", "um"),
        ("pronunciation", "issue"),
    ]
    assert graded.marks[2].respelling == "ISH-oo"
    assert graded.filler_count == 2 and graded.word_count == 16
    assert graded.evaluation.transcript == T
    assert llm.calls[0][2] == Audio(b"x", "audio/webm")


def test_unplaceable_mark_is_retried_with_the_problem():
    coach, llm = coach_with(
        speaking_payload(marks=[{"kind": "filler", "text": "uh", "occurrence": 1}]), speaking_payload()
    )

    coach.evaluate(AUDIO, "p")

    assert len(llm.calls) == 2
    assert "marks[0]" in llm.calls[1][1] and "uh" in llm.calls[1][1]
    assert llm.calls[1][2] == AUDIO


def test_grammar_original_not_in_transcript_is_retried():
    bad = speaking_payload(
        grammar_corrections=[{"original": "I did not say this", "corrected": "x", "explanation": "y"}]
    )
    coach, llm = coach_with(bad, speaking_payload())

    coach.evaluate(AUDIO, "p")

    assert len(llm.calls) == 2
    assert "I did not say this" in llm.calls[1][1]


def test_grammar_original_matches_across_whitespace_differences():
    payload = speaking_payload(
        grammar_corrections=[{"original": "I, um,   finish\nthe fix", "corrected": "x", "explanation": "y"}]
    )
    coach, llm = coach_with(payload)

    coach.evaluate(AUDIO, "p")

    assert len(llm.calls) == 1


def test_gives_up_after_two_retries_with_502():
    bad = speaking_payload(marks=[{"kind": "filler", "text": "uh", "occurrence": 1}])
    coach, llm = coach_with(bad, bad, bad)

    with pytest.raises(AppError) as exc:
        coach.evaluate(AUDIO, "p")

    assert exc.value.status_code == 502 and exc.value.code == "AI_INVALID_RESPONSE"
    assert len(llm.calls) == 3


def test_empty_transcript_is_no_speech_detected_after_one_call():
    coach, llm = coach_with(
        speaking_payload(transcript="  ", marks=[{"kind": "filler", "text": "um", "occurrence": 1}])
    )

    with pytest.raises(AppError) as exc:
        coach.evaluate(AUDIO, "p")

    assert exc.value.status_code == 422 and exc.value.code == "NO_SPEECH_DETECTED"
    assert exc.value.message == "We couldn't hear any speech in the recording. Please record again."
    assert len(llm.calls) == 1


def test_gemini_400_is_audio_unreadable():
    error = genai_errors.ClientError(400, {"error": {"code": 400, "message": "bad audio", "status": "INVALID_ARGUMENT"}})
    coach, _ = coach_with(error)

    with pytest.raises(AppError) as exc:
        coach.evaluate(AUDIO, "p")

    assert exc.value.status_code == 422 and exc.value.code == "AUDIO_UNREADABLE"
    assert exc.value.message == "We could not read this recording. Please record again."


def test_other_gemini_client_errors_propagate():
    error = genai_errors.ClientError(403, {"error": {"code": 403, "message": "no", "status": "PERMISSION_DENIED"}})
    coach, _ = coach_with(error)

    with pytest.raises(genai_errors.ClientError):
        coach.evaluate(AUDIO, "p")


def test_rate_limit_is_429_with_retry_after():
    coach, _ = coach_with(LlmRateLimitError(42))

    with pytest.raises(AppError) as exc:
        coach.evaluate(AUDIO, "p")

    assert exc.value.status_code == 429 and exc.value.code == "RATE_LIMITED"
    assert exc.value.headers == {"Retry-After": "42"}


def test_build_without_key_is_503():
    settings = Settings(database_url="sqlite://", gemini_api_key="")

    with pytest.raises(AppError) as exc:
        build_speaking_coach(settings)

    assert exc.value.status_code == 503 and exc.value.code == "AI_NOT_CONFIGURED"


def test_factory_builds_a_coach_that_uses_the_speaking_schema():
    settings = Settings(database_url="sqlite://", gemini_api_key="test-key", gemini_model="gemini-test")

    coach = build_speaking_coach(settings)

    assert isinstance(coach, SpeakingCoach)
    assert coach.llm.model == "gemini-test"
    assert coach.llm.schema is SpeakingEvaluation
