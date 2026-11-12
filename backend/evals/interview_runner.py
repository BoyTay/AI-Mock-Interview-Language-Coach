import time
from collections.abc import Callable

from google.genai import errors as genai_errors

from app.core.errors import AppError
from app.services.ai_interviewer import Interviewer, Turn
from app.services.english_coach import Llm
from app.services.interview_policy import MAX_FOLLOWUPS
from evals.interview_checks import InterviewResult
from evals.interview_samples import InterviewSample
from evals.runner import DEFAULT_DELAY_SECONDS, MAX_OVERLOAD_RETRIES, OVERLOAD_WAIT_SECONDS, _CountingLlm


def _turn(sample: InterviewSample) -> Turn:
    """The first answer to a main question, as the interview room would send it."""
    return Turn(
        question=sample.question,
        category=sample.category,
        difficulty=sample.difficulty,
        reference_answer=sample.reference_answer,
        thread=[("AI", sample.question)],
        answer=sample.answer,
        followups_used=0,
        max_followups=MAX_FOLLOWUPS,
    )


def _evaluate(sample: InterviewSample, llm: _CountingLlm, sleep: Callable[[float], None]) -> InterviewResult:
    interviewer = Interviewer(llm)
    rate_limit_waited = False
    overload_retries = 0
    while True:
        try:
            evaluation = interviewer.evaluate(_turn(sample))
        except AppError as exc:
            if exc.code == "RATE_LIMITED" and not rate_limit_waited:
                rate_limit_waited = True  # wait out the limit once, then try this answer again
                sleep(float((exc.headers or {}).get("Retry-After", 30)))
                continue
            return InterviewResult(sample, None, llm.calls, error=exc.code)
        except genai_errors.ServerError as exc:
            if overload_retries < MAX_OVERLOAD_RETRIES:
                overload_retries += 1
                sleep(OVERLOAD_WAIT_SECONDS)
                continue
            return InterviewResult(sample, None, llm.calls, error=f"UPSTREAM_{exc.code}")
        except Exception as exc:  # one bad answer must not lose the rest of the run
            return InterviewResult(sample, None, llm.calls, error=type(exc).__name__)
        return InterviewResult(sample, evaluation, llm.calls)


def run_samples(
    samples: list[InterviewSample],
    llm: Llm,
    delay: float = DEFAULT_DELAY_SECONDS,
    sleep: Callable[[float], None] = time.sleep,
) -> list[InterviewResult]:
    """Scores each sample through the real Interviewer, so retries and the reply schema behave as in the API."""
    results = []
    for i, sample in enumerate(samples):
        if i > 0 and delay:
            sleep(delay)
        results.append(_evaluate(sample, _CountingLlm(llm), sleep))
    return results
