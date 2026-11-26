from datetime import datetime
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator, model_validator

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


class MarkKind(str, Enum):
    FILLER = "filler"
    PRONUNCIATION = "pronunciation"
    NON_ENGLISH = "non_english"  # a stretch spoken in another language


class SpeechMark(BaseModel):
    kind: MarkKind
    text: str
    occurrence: int  # 1-based: the n-th time this text appears in the transcript
    respelling: str | None = None
    note: str | None = None

    @model_validator(mode="after")
    def _pronunciation_needs_respelling_and_note(self) -> "SpeechMark":
        if self.kind is MarkKind.PRONUNCIATION and not ((self.respelling or "").strip() and (self.note or "").strip()):
            raise ValueError("a pronunciation mark needs a respelling and a note")
        return self


class SpeakingCriteria(BaseModel):
    fluency: CriterionScore
    pronunciation: CriterionScore
    vocabulary: CriterionScore
    grammar: CriterionScore


class GrammarCorrection(BaseModel):
    original: str
    corrected: str
    explanation: str


class VocabularyUpgrade(BaseModel):
    used: str
    better: str
    explanation: str


class SpeakingEvaluation(BaseModel):
    # The response schema Gemini fills in. No overall band: the server computes it.
    transcript: str
    summary: str
    criteria: SpeakingCriteria
    marks: list[SpeechMark]
    grammar_corrections: list[GrammarCorrection]
    vocabulary_upgrades: list[VocabularyUpgrade]


class PlacedMark(BaseModel):
    kind: MarkKind
    text: str
    # UTF-16 code-unit offsets into the transcript, as JavaScript's String.slice uses (not Python code points).
    start: int
    end: int
    respelling: str | None = None
    note: str | None = None


class SpeakingEvaluateForm(BaseModel):
    prompt_text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_TOPIC_CHARS)]
    # The recorder stops at 120 seconds; a few seconds of slack cover timer ticks.
    duration_seconds: Annotated[int, Field(ge=30, le=125)]


class SpeakingSubmissionOut(BaseModel):
    id: int
    prompt_text: str
    transcript: str
    duration_seconds: int
    words_per_minute: int
    overall_band: float
    band_delta: float | None
    summary: str
    criteria: SpeakingCriteria
    marks: list[PlacedMark]
    grammar_corrections: list[GrammarCorrection]
    vocabulary_upgrades: list[VocabularyUpgrade]
    filler_count: int
    created_at: datetime


class SpeakingPromptOut(BaseModel):
    id: str
    prompt: str
    min_seconds: int
    max_seconds: int
