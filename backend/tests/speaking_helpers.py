import json

TRANSCRIPT = "Yesterday I, um, finish the fix for the login issue. Today I will, um, write tests."


def speaking_payload(**overrides) -> dict:
    payload = {
        "transcript": TRANSCRIPT,
        "summary": "Clear update with a few fillers and one pronunciation slip.",
        "criteria": {
            "fluency": {"score": 7.0, "feedback": "Steady pace with two fillers."},
            "pronunciation": {"score": 6.0, "feedback": "Clear apart from 'issue'."},
            "vocabulary": {"score": 6.5, "feedback": "Adequate technical vocabulary."},
            "grammar": {"score": 6.5, "feedback": "Tense slip in the first sentence."},
        },
        "marks": [
            {"kind": "filler", "text": "um", "occurrence": 1},
            {"kind": "filler", "text": "um", "occurrence": 2},
            {
                "kind": "pronunciation",
                "text": "issue",
                "occurrence": 1,
                "respelling": "ISH-oo",
                "note": "Stress the first syllable and keep the 'sh' sound.",
            },
        ],
        "grammar_corrections": [
            {
                "original": "I, um, finish the fix",
                "corrected": "I finished the fix",
                "explanation": "Use the past simple for a finished action.",
            }
        ],
        "vocabulary_upgrades": [
            {"used": "fix", "better": "resolve", "explanation": "More precise for a defect."}
        ],
    }
    payload.update(overrides)
    return payload


class ScriptedAudioLlm:
    """Plays back canned responses and records every call, including the audio."""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls: list[tuple] = []

    def __call__(self, system_prompt, user_prompt, audio=None):
        self.calls.append((system_prompt, user_prompt, audio))
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response if isinstance(response, str) else json.dumps(response)
