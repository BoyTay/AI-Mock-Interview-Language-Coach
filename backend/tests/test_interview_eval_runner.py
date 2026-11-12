import json

from google.genai import errors as genai_errors

from app.services.english_coach import LlmRateLimitError
from evals.interview_runner import run_samples
from evals.interview_samples import SAMPLES
from tests.test_ai_interviewer import evaluation

TWO = SAMPLES[:2]


class FakeLlm:
    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = []

    def __call__(self, system_prompt, user_prompt):
        self.calls.append((system_prompt, user_prompt))
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply if isinstance(reply, str) else json.dumps(reply)


class Sleeps:
    def __init__(self):
        self.waits = []

    def __call__(self, seconds):
        self.waits.append(seconds)


def server_error(code=503):
    return genai_errors.ServerError(code, {"error": {"message": "overloaded"}})


def test_evaluates_every_sample_through_the_interviewer_and_records_the_scores():
    llm = FakeLlm(evaluation(technical_accuracy_score=80), evaluation(technical_accuracy_score=90))

    results = run_samples(TWO, llm, delay=0)

    assert [r.sample.id for r in results] == [s.id for s in TWO]
    assert [r.evaluation.technical_accuracy_score for r in results] == [80, 90]
    assert all(r.error is None and r.checks is not None for r in results)


def test_the_prompt_carries_the_samples_question_reference_answer_and_answer():
    llm = FakeLlm(evaluation(), evaluation())

    run_samples(TWO, llm, delay=0)

    system, user = llm.calls[0]
    assert TWO[0].question in user
    assert TWO[0].reference_answer in user
    assert TWO[0].answer in user
    assert "senior engineer" in system


def test_counts_the_model_calls_made_for_each_sample():
    llm = FakeLlm("not json", evaluation(), evaluation())

    results = run_samples(TWO, llm, delay=0)

    assert [r.attempts for r in results] == [2, 1]


def test_waits_out_a_rate_limit_once_then_tries_the_sample_again():
    llm = FakeLlm(LlmRateLimitError(retry_after=7), evaluation())
    sleeps = Sleeps()

    results = run_samples(TWO[:1], llm, delay=0, sleep=sleeps)

    assert sleeps.waits == [7]
    assert results[0].evaluation is not None and results[0].error is None


def test_a_second_rate_limit_marks_the_sample_failed_and_the_run_goes_on():
    llm = FakeLlm(LlmRateLimitError(retry_after=1), LlmRateLimitError(retry_after=1), evaluation())

    results = run_samples(TWO, llm, delay=0, sleep=Sleeps())

    assert results[0].error == "RATE_LIMITED" and results[0].evaluation is None
    assert results[1].evaluation is not None


def test_retries_an_overloaded_model_twice_before_giving_up_on_the_sample():
    llm = FakeLlm(server_error(), server_error(), server_error(), evaluation())
    sleeps = Sleeps()

    results = run_samples(TWO, llm, delay=0, sleep=sleeps)

    assert results[0].error == "UPSTREAM_503"
    assert len(sleeps.waits) == 2
    assert results[1].evaluation is not None


def test_an_unusable_reply_is_recorded_as_a_failure_not_a_crash():
    llm = FakeLlm("nope", "nope", "nope", evaluation())

    results = run_samples(TWO, llm, delay=0)

    assert results[0].error == "AI_INVALID_RESPONSE"
    assert results[0].attempts == 3
    assert results[1].evaluation is not None


def test_pauses_between_samples_but_not_before_the_first():
    llm = FakeLlm(evaluation(), evaluation())
    sleeps = Sleeps()

    run_samples(TWO, llm, delay=2.5, sleep=sleeps)

    assert sleeps.waits == [2.5]
