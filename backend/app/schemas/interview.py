from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, field_validator

MAX_SCORE = 100
DEFAULT_QUESTION_COUNT = 6
MAX_QUESTION_COUNT = 10
MAX_ANSWER_CHARS = 5000


def _check_score(value: int) -> int:
    # Checked here, not with schema keywords, because Gemini's response schema rejects constraints.
    if not 0 <= value <= MAX_SCORE:
        raise ValueError(f"must be between 0 and {MAX_SCORE}")
    return value


class MistakeCardDraft(BaseModel):
    should_create: bool
    front: str
    back: str


class InterviewEvaluation(BaseModel):
    """What the model returns for one answer (KeHoach section 4.1)."""

    technical_accuracy_score: int
    communication_clarity_score: int
    star_method_compliance: bool | None  # null unless the question is behavioural
    is_on_topic: bool
    critique: str
    optimal_reference_answer: str
    should_ask_followup: bool
    next_ai_question: str
    extracted_mistake_card: MistakeCardDraft

    _score = field_validator("technical_accuracy_score", "communication_clarity_score")(_check_score)


class StartInterviewRequest(BaseModel):
    # Role defaults to the saved profile when omitted.
    target_role: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)] | None = None
    job_description: Annotated[str, StringConstraints(max_length=10000)] | None = None
    question_count: int = Field(DEFAULT_QUESTION_COUNT, ge=1, le=MAX_QUESTION_COUNT)
    difficulties: list[Literal["JUNIOR", "MID", "SENIOR"]] | None = None


class QuestionOut(BaseModel):
    message_id: int
    type: Literal["MAIN_QUESTION", "FOLLOW_UP"]
    text: str
    category: str
    difficulty: str
    index: int  # which main question this is, from 1; a follow-up keeps its main question's number
    total: int


class StartInterviewOut(BaseModel):
    session_id: int
    question: QuestionOut


class AnswerRequest(BaseModel):
    answer: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_ANSWER_CHARS)]


class AnswerOut(BaseModel):
    evaluation: InterviewEvaluation
    next_question: QuestionOut | None  # null once the last question has been answered
    session_complete: bool


# --- what the model writes for the report (qualitative parts only; scores are computed in code) ---


class ReportTag(BaseModel):
    text: str
    tone: Literal["good", "warn", "bad"]


class AnswerHighlight(BaseModel):
    quote: str  # copied verbatim from the candidate's answer
    kind: Literal["gap", "error"]


class ReferenceHighlight(BaseModel):
    quote: str  # copied verbatim from the optimal answer: a key point to include


class QuestionAnalysis(BaseModel):
    question_number: int
    tags: list[ReportTag]
    answer_highlights: list[AnswerHighlight]
    reference_highlights: list[ReferenceHighlight]


class Strength(BaseModel):
    title: str
    text: str


class KnowledgeGap(BaseModel):
    title: str
    level: Literal["High", "Medium"]
    text: str


class StarAssessment(BaseModel):
    situation: bool
    task: bool
    action: bool
    result: bool
    note: str


class ReportSynthesis(BaseModel):
    headline: str
    summary: str
    strengths: list[Strength]
    gaps: list[KnowledgeGap]
    star: StarAssessment | None  # null when no behavioural question was answered
    questions: list[QuestionAnalysis]


# --- the report returned by /finish and /report ---


class FragmentOut(BaseModel):
    text: str
    kind: Literal["gap", "error", "key"] | None  # null for plain text


class TurnOut(BaseModel):
    type: Literal["MAIN_QUESTION", "FOLLOW_UP"]
    question: str
    answer: str
    technical_score: int
    clarity_score: int
    critique: str


class MistakeCardOut(BaseModel):
    front: str
    back: str


class QuestionReport(BaseModel):
    number: int
    category: str
    difficulty: str
    question: str
    score: int  # mean technical score over the answers to this question and its follow-ups
    communication_score: int
    tags: list[ReportTag]
    turns: list[TurnOut]
    your_answer: list[FragmentOut]  # the first answer, cut into plain and highlighted pieces
    reference_answer: list[FragmentOut]
    mistake_card: MistakeCardOut | None


class StarReport(BaseModel):
    percent: int
    situation: bool
    task: bool
    action: bool
    result: bool
    note: str


class Comparison(BaseModel):
    previous_average: float | None  # mean overall score of the user's earlier finished interviews
    previous_sessions: int
    delta: float | None


class InterviewReport(BaseModel):
    session_id: int
    target_role: str | None
    status: str
    started_at: datetime | None
    duration_seconds: int | None
    finished_early: bool
    answered_questions: int
    total_questions: int
    overall_score: float
    communication_score: float
    headline: str
    summary: str
    star: StarReport | None
    strengths: list[Strength]
    gaps: list[KnowledgeGap]
    comparison: Comparison
    questions: list[QuestionReport]
