import re
from dataclasses import dataclass
from typing import Literal

from app.schemas.interview import InterviewEvaluation

MAX_FOLLOWUPS = 2


@dataclass(frozen=True)
class NextStep:
    kind: Literal["FOLLOW_UP", "MAIN_QUESTION", "DONE"]
    text: str | None = None  # the follow-up to ask; None for the other kinds


def _normalise(question: str) -> str:
    return re.sub(r"\W+", " ", question.lower()).strip()


def is_repeat(question: str, asked: list[str]) -> bool:
    return _normalise(question) in {_normalise(q) for q in asked}


def decide_next(
    evaluation: InterviewEvaluation,
    *,
    followups_used: int,
    max_followups: int,
    asked_questions: list[str],
    has_next_main: bool,
    main_question: str,
) -> NextStep:
    """What to do after an answer. The model proposes; these rules decide.

    The follow-up limit and the no-repeat rule hold whatever the model says, so a session always ends.
    An off-topic answer is answered with a re-ask, which spends one of the follow-ups.
    """
    if followups_used < max_followups:
        proposed = evaluation.next_ai_question.strip()
        wanted = evaluation.should_ask_followup or not evaluation.is_on_topic
        if wanted and proposed and not is_repeat(proposed, asked_questions):
            return NextStep("FOLLOW_UP", proposed)
        if not evaluation.is_on_topic:
            return NextStep("FOLLOW_UP", f"Let's get back to the question: {main_question}")
    return NextStep("MAIN_QUESTION" if has_next_main else "DONE")
