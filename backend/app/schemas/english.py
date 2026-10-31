from datetime import datetime
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

MAX_BAND = 9.0


class SubmissionType(str, Enum):
    IELTS_TASK2 = "IELTS_TASK2"
    TECH_STANDUP = "TECH_STANDUP"


def _check_band(value: float) -> float:
    # IELTS bands move in half steps. Checked here rather than with schema keywords
    # because Gemini's response schema rejects constraints like multipleOf.
    if not 0 <= value <= MAX_BAND or (value * 2) % 1 != 0:
        raise ValueError("must be a multiple of 0.5 between 0 and 9")
    return value


class CriterionScore(BaseModel):
    score: float
    feedback: str

    _band = field_validator("score")(_check_band)


class Criteria(BaseModel):
    task_response: CriterionScore
    coherence_cohesion: CriterionScore
    lexical_resource: CriterionScore
    grammatical_range: CriterionScore


class SentenceCorrection(BaseModel):
    original_sentence: str
    corrected_sentence: str
    error_category: str
    explanation: str


class UpgradedVocabulary(BaseModel):
    basic_word: str
    advanced_alternative: str  # a C1 alternative
    c2_alternative: str
    context_example: str


class StoredUpgradedVocabulary(UpgradedVocabulary):
    # Submissions saved before the C2 alternative existed have none.
    c2_alternative: str | None = None


class WritingEvaluation(BaseModel):
    overall_band: float
    criteria: Criteria
    sentence_corrections: list[SentenceCorrection]
    upgraded_vocabulary: list[UpgradedVocabulary]

    _band = field_validator("overall_band")(_check_band)


MIN_ESSAY_CHARS = 50
MAX_ESSAY_CHARS = 5000
MAX_TOPIC_CHARS = 500


class WritingEvaluateRequest(BaseModel):
    task_type: SubmissionType
    prompt_topic: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_TOPIC_CHARS)]
    user_essay: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=MIN_ESSAY_CHARS, max_length=MAX_ESSAY_CHARS)
    ]


class WritingSubmissionOut(BaseModel):
    id: int
    task_type: str
    prompt_topic: str
    user_essay: str
    word_count: int
    overall_band: float
    band_scores: dict
    sentence_corrections: list[SentenceCorrection]
    upgraded_vocab: list[StoredUpgradedVocabulary]
    # Change in overall band against the previous submission of the same task type.
    band_delta: float | None
    created_at: datetime


class WritingSubmissionSummary(BaseModel):
    id: int
    task_type: str
    prompt_topic: str
    word_count: int
    overall_band: float
    band_delta: float | None
    created_at: datetime


class WritingPromptOut(BaseModel):
    id: str
    task_type: SubmissionType
    topic: str
    prompt: str
    min_words: int
    max_words: int | None
    suggested_minutes: int
