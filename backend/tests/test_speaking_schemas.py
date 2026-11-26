import pytest
from pydantic import ValidationError

from app.schemas.english import SpeakingCriteria, SpeakingEvaluateForm, SpeechMark


def test_pronunciation_mark_needs_respelling_and_note():
    with pytest.raises(ValidationError):
        SpeechMark(kind="pronunciation", text="issue", occurrence=1, note="x")
    with pytest.raises(ValidationError):
        SpeechMark(kind="pronunciation", text="issue", occurrence=1, respelling="ISH-oo", note=" ")


def test_pronunciation_mark_with_both_is_valid():
    mark = SpeechMark(kind="pronunciation", text="issue", occurrence=1, respelling="ISH-oo", note="Say the sh sound.")
    assert mark.respelling == "ISH-oo"


def test_filler_mark_needs_neither():
    assert SpeechMark(kind="filler", text="um", occurrence=2).respelling is None


def test_speaking_criteria_reject_off_step_bands():
    with pytest.raises(ValidationError):
        SpeakingCriteria(**{k: {"score": 6.3, "feedback": "x"} for k in ("fluency", "pronunciation", "vocabulary", "grammar")})


def test_duration_is_optional():
    assert SpeakingEvaluateForm(prompt_text="Give your update").duration_seconds is None
