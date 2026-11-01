import json

from app.services.english_coach import LlmRateLimitError
from evals.runner import run_samples
from evals.samples import SAMPLES
from tests.test_english_coach import evaluation_payload

TWO = SAMPLES[:2]


def payload_for(sample, band=6.5) -> str:
    # Quote the first words of the essay so the verbatim check passes.
    quote = " ".join(sample.essay.split()[:6])
    data = evaluation_payload(overall_band=band)
    data["sentence_corrections"][0]["original_sentence"] = quote
    data["sentence_corrections"][0]["corrected_sentence"] = quote + " (fixed)"
    return json.dumps(data)


class FakeLlm:
    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = 0

    def __call__(self, system_prompt, user_prompt):
        self.calls += 1
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply


def test_scores_every_sample_and_records_the_band_and_corrections():
    llm = FakeLlm(payload_for(TWO[0], 5.5), payload_for(TWO[1], 6.0))

    results = run_samples(TWO, llm, delay=0)

    assert [r.band for r in results] == [5.5, 6.0]
    assert [r.sample.id for r in results] == [s.id for s in TWO]
    assert all(len(r.corrections) == 1 and r.error is None for r in results)


def test_counts_the_model_calls_made_for_each_sample():
    llm = FakeLlm("not json", payload_for(TWO[0]), payload_for(TWO[1]))

    results = run_samples(TWO, llm, delay=0)

    assert [r.attempts for r in results] == [2, 1]


def test_a_failed_sample_is_recorded_and_the_run_continues():
    llm = FakeLlm("bad", "bad", "bad", payload_for(TWO[1]))

    results = run_samples(TWO, llm, delay=0)

    assert results[0].band is None
    assert results[0].error == "AI_INVALID_RESPONSE"
    assert results[0].attempts == 3
    assert results[1].band == 6.5


def test_a_rate_limit_is_waited_out_once_and_retried():
    sleeps = []
    llm = FakeLlm(LlmRateLimitError(retry_after=7), payload_for(TWO[0]))

    results = run_samples(TWO[:1], llm, delay=0, sleep=sleeps.append)

    assert results[0].band == 6.5
    assert sleeps == [7]


def test_a_second_rate_limit_is_reported_as_a_failure():
    llm = FakeLlm(LlmRateLimitError(retry_after=1), LlmRateLimitError(retry_after=1))

    results = run_samples(TWO[:1], llm, delay=0, sleep=lambda s: None)

    assert results[0].error == "RATE_LIMITED"


def test_pauses_between_samples_but_not_after_the_last():
    sleeps = []
    llm = FakeLlm(payload_for(TWO[0]), payload_for(TWO[1]))

    run_samples(TWO, llm, delay=3, sleep=sleeps.append)

    assert sleeps == [3]
