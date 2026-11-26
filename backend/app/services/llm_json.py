import logging
from collections.abc import Callable
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from app.core.errors import AppError
from app.services.english_coach import Audio, Llm, LlmRateLimitError

T = TypeVar("T", bound=BaseModel)

logger = logging.getLogger(__name__)

MAX_RETRIES = 2


def call_json(
    llm: Llm,
    system: str,
    prompt: str,
    schema: type[T],
    retry_prompt: Callable[[str], str],
    max_retries: int = MAX_RETRIES,
    audio: Audio | None = None,
    check: Callable[[T], None] | None = None,
) -> T:
    """Ask the model for JSON that fits `schema`, re-asking with the problem spelled out when it does not.

    `audio`, when given, goes to the model with every attempt. `check`, when given, runs on each reply that validates; a `ValueError` from it counts as a problem with the reply and its message goes to `retry_prompt`. A rate limit becomes a 429 with Retry-After; replies that stay unusable become a 502.
    """
    for attempt in range(1, max_retries + 2):
        try:
            raw = llm(system, prompt) if audio is None else llm(system, prompt, audio)
        except LlmRateLimitError as exc:
            raise AppError(
                429,
                "RATE_LIMITED",
                "The AI service is busy. Try again shortly.",
                headers={"Retry-After": str(exc.retry_after)},
            ) from exc
        try:
            result = schema.model_validate_json(raw)
            if check is not None:
                check(result)
            return result
        except ValidationError as exc:
            problems = "; ".join(
                f"{'.'.join(str(p) for p in err['loc']) or 'response'}: {err['msg']}" for err in exc.errors()
            )
            logger.warning("Model reply rejected on attempt %d: %s", attempt, problems)
            prompt = retry_prompt(problems)
        except ValueError as exc:
            # After ValidationError, which is itself a ValueError: this one is the check's own.
            logger.warning("Model reply rejected on attempt %d: %s", attempt, exc)
            prompt = retry_prompt(str(exc))
    raise AppError(502, "AI_INVALID_RESPONSE", "The AI service returned an unusable evaluation")
