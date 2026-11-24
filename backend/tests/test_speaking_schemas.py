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


@pytest.mark.parametrize("seconds,ok", [(29, False), (30, True), (120, True), (121, True), (125, True), (126, False)])
def test_duration_range(seconds, ok):
    if ok:
        SpeakingEvaluateForm(prompt_text="Give your update", duration_seconds=seconds)
    else:
        with pytest.raises(ValidationError):
            SpeakingEvaluateForm(prompt_text="Give your update", duration_seconds=seconds)
