from enum import Enum

from pydantic import BaseModel, field_validator

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
    advanced_alternative: str
    context_example: str


class WritingEvaluation(BaseModel):
    overall_band: float
    criteria: Criteria
    sentence_corrections: list[SentenceCorrection]
    upgraded_vocabulary: list[UpgradedVocabulary]

    _band = field_validator("overall_band")(_check_band)
