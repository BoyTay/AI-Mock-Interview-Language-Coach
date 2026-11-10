import math
from dataclasses import dataclass, field

from app.schemas.interview import (
    Comparison,
    FragmentOut,
    InterviewReport,
    MistakeCardOut,
    QuestionAnalysis,
    QuestionReport,
    ReportSynthesis,
    StarReport,
    TurnOut,
)

MAIN_QUESTION = "MAIN_QUESTION"


def _round_half_up(value: float, digits: int = 0) -> float:
    # Python's round() sends 72.5 to 72; a score of 72.5 should read 73.
    factor = 10**digits
    return math.floor(value * factor + 0.5) / factor


def _mean(values: list[float]) -> float:
    return sum(values) / len(values)


@dataclass
class TurnRecord:
    type: str  # MAIN_QUESTION or FOLLOW_UP: the kind of question that was answered
    question: str
    answer: str
    evaluation: dict


@dataclass
class QuestionGroup:
    number: int  # 1-based position of the main question in the session
    entry: dict  # the question_plan snapshot for this main question
    turns: list[TurnRecord] = field(default_factory=list)


def group_turns(messages, plan: list[dict]) -> list[QuestionGroup]:
    """Pair each answer with the question it answers and group them by main question.

    Only questions that received at least one answer are returned, so an early finish
    scores just what the candidate actually did.
    """
    groups: list[QuestionGroup] = []
    current: QuestionGroup | None = None
    asked = None
    for message in messages:
        if message.sender == "AI":
            if message.question_type == MAIN_QUESTION:
                number = len(groups) + 1
                current = QuestionGroup(number=number, entry=plan[number - 1])
                groups.append(current)
            asked = message
        elif current is not None and asked is not None:
            current.turns.append(
                TurnRecord(
                    type=asked.question_type,
                    question=asked.content_text,
                    answer=message.content_text,
                    evaluation=message.evaluation,
                )
            )
    return [g for g in groups if g.turns]


def question_score(group: QuestionGroup) -> int:
    return int(_round_half_up(_mean([t.evaluation["technical_accuracy_score"] for t in group.turns])))


def _clarity(group: QuestionGroup) -> float:
    return _mean([t.evaluation["communication_clarity_score"] for t in group.turns])


def overall_score(groups: list[QuestionGroup]) -> float:
    return _round_half_up(_mean([question_score(g) for g in groups]), 2)


def communication_score(groups: list[QuestionGroup]) -> float:
    return _round_half_up(_mean([_clarity(g) for g in groups]), 1)


@dataclass(frozen=True)
class Fragment:
    text: str
    kind: str | None  # None for plain text, otherwise the kind of highlight


def split_fragments(text: str, highlights: list[tuple[str, str]]) -> list[Fragment]:
    """Cut `text` into plain and highlighted pieces.

    A highlight is a (quote, kind) pair. Quotes the model got wrong, that are not in the text,
    are dropped, and a quote overlapping an earlier one is dropped, so the pieces always
    join back into the original text.
    """
    lowered = text.lower()
    spans: list[tuple[int, int, str]] = []
    for quote, kind in highlights:
        quote = quote.strip()
        if not quote:
            continue
        start = text.find(quote)
        if start == -1:
            start = lowered.find(quote.lower())
        if start != -1:
            spans.append((start, start + len(quote), kind))
    spans.sort()

    fragments: list[Fragment] = []
    cursor = 0
    for start, end, kind in spans:
        if start < cursor:
            continue
        if start > cursor:
            fragments.append(Fragment(text[cursor:start], None))
        fragments.append(Fragment(text[start:end], kind))
        cursor = end
    if cursor < len(text):
        fragments.append(Fragment(text[cursor:], None))
    return fragments or [Fragment(text, None)]


MAX_STRENGTHS = 3
MAX_GAPS = 4
MAX_TAGS = 4
STAR_LETTERS = ("situation", "task", "action", "result")


def _mistake_card(group: QuestionGroup) -> MistakeCardOut | None:
    for turn in group.turns:
        card = turn.evaluation.get("extracted_mistake_card") or {}
        if card.get("should_create") and card.get("front") and card.get("back"):
            return MistakeCardOut(front=card["front"], back=card["back"])
    return None


def _question_report(group: QuestionGroup, analysis: QuestionAnalysis | None) -> QuestionReport:
    first = group.turns[0]
    reference = first.evaluation.get("optimal_reference_answer") or group.entry["reference_answer"]
    answer_marks = [(h.quote, h.kind) for h in analysis.answer_highlights] if analysis else []
    reference_marks = [(h.quote, "key") for h in analysis.reference_highlights] if analysis else []
    return QuestionReport(
        number=group.number,
        category=group.entry["category"],
        difficulty=group.entry["difficulty"],
        question=group.entry["question_text"],
        score=question_score(group),
        communication_score=int(_round_half_up(_clarity(group))),
        tags=(analysis.tags if analysis else [])[:MAX_TAGS],
        turns=[
            TurnOut(
                type=t.type,
                question=t.question,
                answer=t.answer,
                technical_score=t.evaluation["technical_accuracy_score"],
                clarity_score=t.evaluation["communication_clarity_score"],
                critique=t.evaluation["critique"],
            )
            for t in group.turns
        ],
        your_answer=[FragmentOut(text=f.text, kind=f.kind) for f in split_fragments(first.answer, answer_marks)],
        reference_answer=[FragmentOut(text=f.text, kind=f.kind) for f in split_fragments(reference, reference_marks)],
        mistake_card=_mistake_card(group),
    )


def _star_report(synthesis: ReportSynthesis, groups: list[QuestionGroup]) -> StarReport | None:
    # STAR only applies to behavioural answers, so ignore a block the model gave for anything else.
    if synthesis.star is None or not any(g.entry["category"] == "BEHAVIORAL" for g in groups):
        return None
    star = synthesis.star
    return StarReport(
        percent=25 * sum(getattr(star, letter) for letter in STAR_LETTERS),
        situation=star.situation,
        task=star.task,
        action=star.action,
        result=star.result,
        note=star.note,
    )


def build_report(
    session,
    groups: list[QuestionGroup],
    synthesis: ReportSynthesis,
    comparison: Comparison,
    duration_seconds: int | None,
) -> InterviewReport:
    """Put the computed scores and the model's write-up together into the stored report."""
    analyses = {a.question_number: a for a in synthesis.questions}
    total = len(session.question_plan or [])
    overall = overall_score(groups)
    return InterviewReport(
        session_id=session.id,
        target_role=session.target_role,
        status="COMPLETED",
        started_at=session.created_at,
        duration_seconds=duration_seconds,
        finished_early=len(groups) < total,
        answered_questions=len(groups),
        total_questions=total,
        overall_score=overall,
        communication_score=communication_score(groups),
        headline=synthesis.headline,
        summary=synthesis.summary,
        star=_star_report(synthesis, groups),
        strengths=synthesis.strengths[:MAX_STRENGTHS],
        gaps=synthesis.gaps[:MAX_GAPS],
        comparison=comparison,
        questions=[_question_report(g, analyses.get(g.number)) for g in groups],
    )


def compare_with_previous(overall: float, previous_scores: list[float]) -> Comparison:
    if not previous_scores:
        return Comparison(previous_average=None, previous_sessions=0, delta=None)
    average = _round_half_up(_mean(previous_scores), 2)
    return Comparison(
        previous_average=average,
        previous_sessions=len(previous_scores),
        delta=_round_half_up(overall - average, 2),
    )
