import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from google.genai import errors as genai_errors

from app.core.config import Settings
from app.core.errors import AppError, register_error_handlers
from app.schemas.english import SubmissionType, WritingEvaluation
from app.services.english_coach import EnglishCoach, GeminiLlm, LlmRateLimitError, build_english_coach

BAD_SENTENCE = "Many software company nowadays uses AI for automate testing process."
ESSAY = f"{BAD_SENTENCE} This makes release cycles shorter. Teams must still review the output."


def evaluation_payload(**overrides) -> dict:
    payload = {
        "overall_band": 6.5,
        "criteria": {
            "task_response": {"score": 7.0, "feedback": "All parts of the task are answered."},
            "coherence_cohesion": {"score": 6.5, "feedback": "Linking is fine but paragraph 2 jumps."},
            "lexical_resource": {"score": 6.5, "feedback": "Good range but repeats 'important'."},
            "grammatical_range": {"score": 6.0, "feedback": "Subject-verb agreement slips."},
        },
        "sentence_corrections": [
            {
                "original_sentence": BAD_SENTENCE,
                "corrected_sentence": "Numerous software companies currently utilize AI to automate the testing process.",
                "error_category": "Subject-Verb Agreement",
                "explanation": "'Many' takes a plural noun, and purpose needs 'to + verb'.",
            }
        ],
        "upgraded_vocabulary": [
            {
                "basic_word": "use AI for automate",
                "advanced_alternative": "leverage AI to streamline and automate",
                "c2_alternative": "harness AI to orchestrate end-to-end test automation",
                "context_example": "Modern teams leverage AI to streamline deployment.",
            }
        ],
    }
    payload.update(overrides)
    return payload


class ScriptedLlm:
    """Plays back canned responses and records every call, like a stand-in for Gemini."""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls: list[tuple[str, str]] = []

    def __call__(self, system_prompt: str, user_prompt: str) -> str:
        self.calls.append((system_prompt, user_prompt))
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response if isinstance(response, str) else json.dumps(response)


def coach_with(*responses) -> tuple[EnglishCoach, ScriptedLlm]:
    llm = ScriptedLlm(*responses)
    return EnglishCoach(llm), llm


def test_vocabulary_without_a_c2_alternative_is_rejected_and_retried():
    incomplete = evaluation_payload()
    del incomplete["upgraded_vocabulary"][0]["c2_alternative"]
    coach, llm = coach_with(incomplete, evaluation_payload())

    result = coach.evaluate(ESSAY, SubmissionType.IELTS_TASK2)

    assert result.upgraded_vocabulary[0].c2_alternative.startswith("harness")
    assert len(llm.calls) == 2
    assert "c2_alternative" in llm.calls[1][1]


def test_prompt_asks_for_both_c1_and_c2_alternatives():
    from app.services.english_prompts import system_prompt

    prompt = system_prompt(SubmissionType.IELTS_TASK2)
    assert "advanced_alternative" in prompt and "c2_alternative" in prompt


def test_valid_response_is_parsed_into_evaluation():
    coach, llm = coach_with(evaluation_payload())

    result = coach.evaluate(ESSAY, SubmissionType.IELTS_TASK2)

    assert isinstance(result, WritingEvaluation)
    assert result.overall_band == 6.5
    assert result.criteria.grammatical_range.score == 6.0
    assert result.sentence_corrections[0].original_sentence == BAD_SENTENCE
    assert len(llm.calls) == 1


@pytest.mark.parametrize("band", [6.3, 6.75, 9.5, -0.5, 10])
def test_overall_band_must_be_half_step_within_0_to_9(band):
    coach, llm = coach_with(*[evaluation_payload(overall_band=band)] * 3)

    with pytest.raises(AppError) as exc:
        coach.evaluate(ESSAY, SubmissionType.IELTS_TASK2)

    assert exc.value.code == "AI_INVALID_RESPONSE"
    assert len(llm.calls) == 3


@pytest.mark.parametrize("band", [0, 4.5, 9])
def test_boundary_bands_are_accepted(band):
    coach, _ = coach_with(evaluation_payload(overall_band=band))

    assert coach.evaluate(ESSAY, SubmissionType.IELTS_TASK2).overall_band == band


def test_criterion_score_must_also_be_half_step():
    bad = evaluation_payload()
    bad["criteria"]["lexical_resource"]["score"] = 6.75
    coach, _ = coach_with(bad, evaluation_payload())

    result = coach.evaluate(ESSAY, SubmissionType.IELTS_TASK2)

    assert result.criteria.lexical_resource.score == 6.5


def test_invalid_json_is_retried_then_succeeds():
    coach, llm = coach_with("not json at all", '{"overall_band": 6.5', evaluation_payload())

    result = coach.evaluate(ESSAY, SubmissionType.IELTS_TASK2)

    assert result.overall_band == 6.5
    assert len(llm.calls) == 3


def test_gives_up_after_two_retries_with_502():
    coach, llm = coach_with("nope", "nope", "nope", evaluation_payload())

    with pytest.raises(AppError) as exc:
        coach.evaluate(ESSAY, SubmissionType.IELTS_TASK2)

    assert exc.value.status_code == 502
    assert exc.value.code == "AI_INVALID_RESPONSE"
    assert len(llm.calls) == 3


def test_missing_field_counts_as_invalid():
    broken = evaluation_payload()
    del broken["criteria"]["task_response"]
    coach, llm = coach_with(broken, evaluation_payload())

    coach.evaluate(ESSAY, SubmissionType.IELTS_TASK2)

    assert len(llm.calls) == 2


def test_correction_not_quoted_verbatim_is_rejected():
    paraphrased = evaluation_payload()
    paraphrased["sentence_corrections"][0]["original_sentence"] = "Many software companys nowadays use AI."
    coach, llm = coach_with(paraphrased, evaluation_payload())

    result = coach.evaluate(ESSAY, SubmissionType.IELTS_TASK2)

    assert result.sentence_corrections[0].original_sentence == BAD_SENTENCE
    assert len(llm.calls) == 2


def test_retry_tells_the_model_what_was_wrong():
    coach, llm = coach_with(evaluation_payload(overall_band=6.3), evaluation_payload())

    coach.evaluate(ESSAY, SubmissionType.IELTS_TASK2)

    assert "overall_band" in llm.calls[1][1]


def test_rate_limit_maps_to_429_with_retry_after_and_is_not_retried():
    coach, llm = coach_with(LlmRateLimitError(retry_after=42), evaluation_payload())

    with pytest.raises(AppError) as exc:
        coach.evaluate(ESSAY, SubmissionType.IELTS_TASK2)

    assert exc.value.status_code == 429
    assert exc.value.code == "RATE_LIMITED"
    assert exc.value.headers == {"Retry-After": "42"}
    assert len(llm.calls) == 1


def test_blank_submission_is_rejected_without_calling_the_model():
    coach, llm = coach_with(evaluation_payload())

    with pytest.raises(AppError) as exc:
        coach.evaluate("   \n ", SubmissionType.IELTS_TASK2)

    assert exc.value.status_code == 422
    assert llm.calls == []


def test_each_submission_type_gets_its_own_rubric():
    coach, llm = coach_with(evaluation_payload(), evaluation_payload())

    coach.evaluate(ESSAY, SubmissionType.IELTS_TASK2)
    coach.evaluate(ESSAY, SubmissionType.TECH_STANDUP)

    ielts_system, standup_system = llm.calls[0][0], llm.calls[1][0]
    assert "Task 2" in ielts_system and "Task 2" not in standup_system
    assert "standup" in standup_system.lower() and "standup" not in ielts_system.lower()
    assert ielts_system != standup_system


def test_prompt_demands_verbatim_quotes_and_keeps_submission_as_data():
    coach, llm = coach_with(evaluation_payload())

    coach.evaluate(ESSAY, SubmissionType.IELTS_TASK2)

    system, user = llm.calls[0]
    assert "verbatim" in system.lower()
    assert ESSAY in user


def test_rate_limit_error_reaches_the_client_with_retry_after_header():
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/limited")
    def limited():
        coach = EnglishCoach(ScriptedLlm(LlmRateLimitError(retry_after=30)))
        return coach.evaluate(ESSAY, SubmissionType.IELTS_TASK2)

    response = TestClient(app).get("/limited")

    assert response.status_code == 429
    assert response.headers["Retry-After"] == "30"
    assert response.json()["error"]["code"] == "RATE_LIMITED"


class FakeGenaiClient:
    def __init__(self, result=None, error=None):
        self.result, self.error, self.kwargs = result, error, None
        self.models = self

    def generate_content(self, **kwargs):
        self.kwargs = kwargs
        if self.error:
            raise self.error
        return self.result


class FakeResult:
    def __init__(self, text):
        self.text = text


def test_gemini_adapter_requests_low_temperature_json_with_schema():
    client = FakeGenaiClient(result=FakeResult('{"ok": true}'))

    text = GeminiLlm(client, model="gemini-test")("SYSTEM", "USER")

    config = client.kwargs["config"]
    assert text == '{"ok": true}'
    assert client.kwargs["model"] == "gemini-test"
    assert client.kwargs["contents"] == "USER"
    assert config.system_instruction == "SYSTEM"
    assert config.temperature <= 0.2
    assert config.response_mime_type == "application/json"
    assert config.response_schema is WritingEvaluation


def test_gemini_adapter_maps_429_to_rate_limit_error():
    error = genai_errors.ClientError(429, {"error": {"code": 429, "message": "quota", "status": "RESOURCE_EXHAUSTED"}})
    llm = GeminiLlm(FakeGenaiClient(error=error), model="gemini-test")

    with pytest.raises(LlmRateLimitError) as exc:
        llm("SYSTEM", "USER")

    assert exc.value.retry_after > 0


def test_gemini_adapter_does_not_swallow_other_errors():
    error = genai_errors.ClientError(400, {"error": {"code": 400, "message": "bad", "status": "INVALID_ARGUMENT"}})
    llm = GeminiLlm(FakeGenaiClient(error=error), model="gemini-test")

    with pytest.raises(genai_errors.ClientError):
        llm("SYSTEM", "USER")


def test_factory_refuses_to_run_without_an_api_key():
    settings = Settings(database_url="sqlite://", gemini_api_key="")

    with pytest.raises(AppError) as exc:
        build_english_coach(settings)

    assert exc.value.status_code == 503
    assert exc.value.code == "AI_NOT_CONFIGURED"


def test_factory_builds_a_coach_for_the_configured_model():
    settings = Settings(database_url="sqlite://", gemini_api_key="test-key", gemini_model="gemini-test")

    coach = build_english_coach(settings)

    assert isinstance(coach, EnglishCoach)
    assert coach.llm.model == "gemini-test"
