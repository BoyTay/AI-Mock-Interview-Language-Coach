import pytest
from pydantic import ValidationError

from app.schemas.interview import AnswerOut, AnswerVoice, InterviewEvaluation, VoiceEvaluation
from tests.interview_helpers import evaluation


def voice_payload(**overrides):
    base = evaluation().model_dump()
    base.update(
        transcript="I would use a hash map.",
        fluency_score=72,
        pronunciation_notes="Phát âm rõ.",
        filler_words=["um"],
    )
    base.update(overrides)
    return base


@pytest.mark.parametrize("score", [101, -1])
def test_voice_evaluation_rejects_a_fluency_score_outside_0_to_100(score):
    with pytest.raises(ValidationError):
        VoiceEvaluation.model_validate(voice_payload(fluency_score=score))


def test_voice_evaluation_keeps_the_text_evaluation_fields_and_validations():
    with pytest.raises(ValidationError):
        VoiceEvaluation.model_validate(voice_payload(technical_accuracy_score=101))

    assert VoiceEvaluation.model_validate(voice_payload()).technical_accuracy_score == 70


def test_as_text_evaluation_drops_the_voice_fields():
    text = VoiceEvaluation.model_validate(voice_payload()).as_text_evaluation()

    assert type(text) is InterviewEvaluation
    assert "transcript" not in text.model_dump()
    assert text.critique == "Nhận xét."


def test_answer_out_serialises_with_and_without_voice():
    voice = AnswerVoice(message_id=5, transcript="Hi.", fluency_score=60, pronunciation_notes="", filler_words=[])

    without = AnswerOut(evaluation=evaluation(), next_question=None, session_complete=True)
    with_voice = AnswerOut(evaluation=evaluation(), next_question=None, session_complete=True, voice=voice)

    assert without.model_dump()["voice"] is None
    assert with_voice.model_dump()["voice"]["transcript"] == "Hi."
