from dataclasses import dataclass, field

MAIN_QUESTION = "MAIN_QUESTION"


def _round_half_up(value: float, digits: int = 0) -> float:
    # Python's round() sends 72.5 to 72; a score of 72.5 should read 73.
    factor = 10**digits
    return int(value * factor + 0.5) / factor


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
