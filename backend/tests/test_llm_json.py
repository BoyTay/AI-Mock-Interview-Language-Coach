import json

from pydantic import BaseModel

from app.services.english_coach import Audio
from app.services.llm_json import call_json


class Reply(BaseModel):
    ok: bool


class AudioLlm:
    """Records every call, including the audio it was given."""

    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = []

    def __call__(self, system, prompt, audio=None):
        self.calls.append((system, prompt, audio))
        return self.replies.pop(0)


class TextOnlyLlm:
    """Accepts exactly two arguments, like the fakes written before audio existed."""

    def __init__(self, reply):
        self.reply = reply
        self.calls = 0

    def __call__(self, system, prompt):
        self.calls += 1
        return self.reply


def test_call_json_passes_the_audio_to_the_model_and_again_on_a_retry():
    audio = Audio(b"voice", "audio/webm")
    llm = AudioLlm("not json", json.dumps({"ok": True}))

    result = call_json(llm, "SYS", "first", Reply, lambda problem: f"retry: {problem[:5]}", audio=audio)

    assert result.ok is True
    assert [call[2] for call in llm.calls] == [audio, audio]
    assert llm.calls[0][1] == "first"
    assert llm.calls[1][1].startswith("retry: ")


def test_call_json_without_audio_calls_the_model_with_two_arguments():
    llm = TextOnlyLlm(json.dumps({"ok": True}))

    assert call_json(llm, "SYS", "prompt", Reply, lambda problem: problem).ok is True
    assert llm.calls == 1


def test_check_failure_is_retried_with_its_message():
    llm = AudioLlm(json.dumps({"ok": False}), json.dumps({"ok": True}))

    def check(result):
        if not result.ok:
            raise ValueError("ok must be true")

    result = call_json(llm, "SYS", "first", Reply, lambda problem: f"retry: {problem}", check=check)

    assert result.ok is True
    assert len(llm.calls) == 2
    assert llm.calls[1][1] == "retry: ok must be true"
