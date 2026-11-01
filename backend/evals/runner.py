import time
from collections.abc import Callable

from google.genai import errors as genai_errors

from app.core.errors import AppError
from app.services.english_coach import EnglishCoach, Llm
from evals.report import Result
from evals.samples import Sample

DEFAULT_DELAY_SECONDS = 2.0
OVERLOAD_WAIT_SECONDS = 10
MAX_OVERLOAD_RETRIES = 2


class _CountingLlm:
    def __init__(self, llm: Llm):
        self.llm = llm
        self.calls = 0

    def __call__(self, system_prompt: str, user_prompt: str) -> str:
        self.calls += 1
        return self.llm(system_prompt, user_prompt)


def _evaluate(sample: Sample, llm: _CountingLlm, sleep: Callable[[float], None]) -> Result:
    coach = EnglishCoach(llm)
    rate_limit_waited = False
    overload_retries = 0
    while True:
        try:
            evaluation = coach.evaluate(sample.essay, sample.task_type)
        except AppError as exc:
            if exc.code == "RATE_LIMITED" and not rate_limit_waited:
                rate_limit_waited = True  # wait out the limit once, then try this essay again
                sleep(float((exc.headers or {}).get("Retry-After", 30)))
                continue
            return Result(sample, None, llm.calls, [], error=exc.code)
        except genai_errors.ServerError as exc:
            if overload_retries < MAX_OVERLOAD_RETRIES:
                overload_retries += 1
                sleep(OVERLOAD_WAIT_SECONDS)
                continue
            return Result(sample, None, llm.calls, [], error=f"UPSTREAM_{exc.code}")
        except Exception as exc:  # one bad essay must not lose the rest of the run
            return Result(sample, None, llm.calls, [], error=type(exc).__name__)
        return Result(sample, evaluation.overall_band, llm.calls, evaluation.sentence_corrections)


def run_samples(
    samples: list[Sample],
    llm: Llm,
    delay: float = DEFAULT_DELAY_SECONDS,
    sleep: Callable[[float], None] = time.sleep,
) -> list[Result]:
    """Scores each sample through the real EnglishCoach, so retries and checks behave as in the API."""
    results = []
    for i, sample in enumerate(samples):
        if i > 0 and delay:
            sleep(delay)
        results.append(_evaluate(sample, _CountingLlm(llm), sleep))
    return results
