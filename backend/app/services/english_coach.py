import re
from collections.abc import Callable

from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import ValidationError

from app.core.config import Settings
from app.core.errors import AppError
from app.schemas.english import SubmissionType, WritingEvaluation
from app.services import english_prompts

MAX_RETRIES = 2
DEFAULT_RETRY_AFTER_SECONDS = 30
# Low for stable bands. Not 0: Gemini can loop on long structured output with greedy decoding.
TEMPERATURE = 0.1

# (system_prompt, user_prompt) -> raw JSON text from the model.
Llm = Callable[[str, str], str]


class LlmRateLimitError(Exception):
    def __init__(self, retry_after: int = DEFAULT_RETRY_AFTER_SECONDS):
        self.retry_after = retry_after
        super().__init__(f"rate limited, retry after {retry_after}s")


class _InvalidEvaluation(Exception):
    pass


def _squash(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


class GeminiLlm:
    def __init__(self, client, model: str, temperature: float = TEMPERATURE):
        self.client = client
        self.model = model
        self.temperature = temperature

    def __call__(self, system_prompt: str, user_prompt: str) -> str:
        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=self.temperature,
            response_mime_type="application/json",
            response_schema=WritingEvaluation,
        )
        try:
            response = self.client.models.generate_content(
                model=self.model, contents=user_prompt, config=config
            )
        except genai_errors.APIError as exc:
            if exc.code == 429:
                raise LlmRateLimitError() from exc
            raise
        # A blocked or empty reply has no text; return "" so the coach treats it as invalid.
        return response.text or ""


class EnglishCoach:
    def __init__(self, llm: Llm, max_retries: int = MAX_RETRIES):
        self.llm = llm
        self.max_retries = max_retries

    def evaluate(self, text: str, submission_type: SubmissionType) -> WritingEvaluation:
        if not text.strip():
            raise AppError(422, "EMPTY_SUBMISSION", "Submission text must not be empty")

        system = english_prompts.system_prompt(submission_type)
        prompt = english_prompts.user_prompt(text)
        for _ in range(self.max_retries + 1):
            try:
                raw = self.llm(system, prompt)
            except LlmRateLimitError as exc:
                raise AppError(
                    429,
                    "RATE_LIMITED",
                    "The AI service is busy. Try again shortly.",
                    headers={"Retry-After": str(exc.retry_after)},
                ) from exc
            try:
                return self._parse(raw, text)
            except _InvalidEvaluation as exc:
                prompt = english_prompts.retry_prompt(text, str(exc))

        raise AppError(502, "AI_INVALID_RESPONSE", "The AI service returned an unusable evaluation")

    @staticmethod
    def _parse(raw: str, text: str) -> WritingEvaluation:
        try:
            evaluation = WritingEvaluation.model_validate_json(raw)
        except ValidationError as exc:
            problems = "; ".join(
                f"{'.'.join(str(p) for p in err['loc']) or 'response'}: {err['msg']}" for err in exc.errors()
            )
            raise _InvalidEvaluation(problems) from exc

        haystack = _squash(text)
        for correction in evaluation.sentence_corrections:
            if _squash(correction.original_sentence) not in haystack:
                raise _InvalidEvaluation(
                    f"original_sentence is not quoted verbatim from the submission: {correction.original_sentence!r}"
                )
        return evaluation


def build_english_coach(settings: Settings) -> EnglishCoach:
    if not settings.gemini_api_key:
        raise AppError(503, "AI_NOT_CONFIGURED", "GEMINI_API_KEY is not set")
    client = genai.Client(api_key=settings.gemini_api_key)
    return EnglishCoach(GeminiLlm(client, settings.gemini_model))
