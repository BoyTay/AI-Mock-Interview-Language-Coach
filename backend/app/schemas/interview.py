from pydantic import BaseModel, field_validator

MAX_SCORE = 100


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
