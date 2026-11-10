from collections.abc import Callable
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from app.core.errors import AppError
from app.services.english_coach import Llm, LlmRateLimitError

T = TypeVar("T", bound=BaseModel)

MAX_RETRIES = 2


def call_json(
    llm: Llm,
    system: str,
    prompt: str,
    schema: type[T],
    retry_prompt: Callable[[str], str],
    max_retries: int = MAX_RETRIES,
) -> T:
    """Ask the model for JSON that fits `schema`, re-asking with the problem spelled out when it does not.

    A rate limit becomes a 429 with Retry-After; replies that stay unusable become a 502.
    """
    for _ in range(max_retries + 1):
        try:
            raw = llm(system, prompt)
        except LlmRateLimitError as exc:
            raise AppError(
                429,
                "RATE_LIMITED",
                "The AI service is busy. Try again shortly.",
                headers={"Retry-After": str(exc.retry_after)},
            ) from exc
        try:
            return schema.model_validate_json(raw)
        except ValidationError as exc:
            problems = "; ".join(
                f"{'.'.join(str(p) for p in err['loc']) or 'response'}: {err['msg']}" for err in exc.errors()
            )
            prompt = retry_prompt(problems)
    raise AppError(502, "AI_INVALID_RESPONSE", "The AI service returned an unusable evaluation")
