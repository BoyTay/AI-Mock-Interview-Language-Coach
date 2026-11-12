"""Checks and report for the interview scoring evaluation.

Every check is a rough proxy that a person should confirm by reading `format_details`: a keyword
match cannot prove a critique is right, only that it names the expected gap.
"""
import re
from dataclasses import dataclass, field

from app.schemas.interview import InterviewEvaluation
from app.services.interview_policy import MAX_FOLLOWUPS, NextStep, decide_next
from evals.interview_samples import InterviewSample

_VIETNAMESE = re.compile("[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]", re.IGNORECASE)


def next_step_for(sample: InterviewSample, evaluation: InterviewEvaluation) -> NextStep:
    """What the real interview would do next after this answer: the model proposes, the policy decides."""
    return decide_next(
        evaluation,
        followups_used=0,
        max_followups=MAX_FOLLOWUPS,
        asked_questions=[sample.question],
        has_next_main=True,
        main_question=sample.question,
    )


@dataclass(frozen=True)
class Checks:
    score_in_range: bool
    topic_matches: bool
    critique_names_gap: bool | None  # None: the sample names no expected terms
    followup_builds_on_answer: bool | None  # None: either outcome is fine for this sample
    facts_kept: tuple[int, int]  # (reference terms present in the model's ideal answer, terms expected)
    claim_repeated: bool | None  # None: not a false-claim sample. True is the bad outcome
    star_matches: bool | None  # None: not a behavioural sample
    critique_in_vietnamese: bool


def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
    lowered = text.lower()
    return any(term.lower() in lowered for term in terms)


def check_sample(sample: InterviewSample, evaluation: InterviewEvaluation, step: NextStep) -> Checks:
    low, high = sample.score_range
    followup: bool | None = None
    if sample.expect_followup is not None:
        asked = step.kind == "FOLLOW_UP"
        if not sample.expect_followup:
            followup = not asked
        else:
            followup = asked and (not sample.followup_anchors or _contains_any(step.text or "", sample.followup_anchors))

    ideal = evaluation.optimal_reference_answer
    return Checks(
        score_in_range=low <= evaluation.technical_accuracy_score <= high,
        topic_matches=evaluation.is_on_topic == sample.on_topic,
        critique_names_gap=_contains_any(evaluation.critique, sample.critique_terms) if sample.critique_terms else None,
        followup_builds_on_answer=followup,
        facts_kept=(sum(fact.lower() in ideal.lower() for fact in sample.reference_facts), len(sample.reference_facts)),
        claim_repeated=(
            any(re.search(p, ideal, re.IGNORECASE) for p in sample.adopts_false_claim)
            if sample.adopts_false_claim
            else None
        ),
        star_matches=(evaluation.star_method_compliance == sample.expect_star) if sample.expect_star is not None else None,
        critique_in_vietnamese=bool(_VIETNAMESE.search(evaluation.critique)),
    )


@dataclass
class InterviewResult:
    sample: InterviewSample
    evaluation: InterviewEvaluation | None  # None when the evaluation failed
    attempts: int  # calls made to the model; more than 1 means a reply was rejected and retried
    error: str | None = None
    step: NextStep | None = field(init=False, default=None)
    checks: Checks | None = field(init=False, default=None)

    def __post_init__(self):
        if self.evaluation is not None:
            self.step = next_step_for(self.sample, self.evaluation)
            self.checks = check_sample(self.sample, self.evaluation, self.step)


Tally = tuple[int, int]  # (passed, applicable)


@dataclass(frozen=True)
class Summary:
    evaluated: int
    failed: int
    retried: int
    score_in_range: Tally
    topic_matches: Tally
    critique_names_gap: Tally
    followup_builds_on_answer: Tally
    critique_in_vietnamese: Tally
    star_matches: Tally
    facts_kept: Tally
    claims_repeated: Tally  # (claims the model repeated, false-claim samples). Lower is better
    mean_score_by_kind: dict[str, float]


def _tally(values: list[bool | None]) -> Tally:
    applicable = [v for v in values if v is not None]
    return sum(applicable), len(applicable)


def summarise(results: list[InterviewResult]) -> Summary:
    ok = [r for r in results if r.checks is not None]
    scores: dict[str, list[int]] = {}
    for r in ok:
        scores.setdefault(r.sample.kind, []).append(r.evaluation.technical_accuracy_score)
    return Summary(
        evaluated=len(ok),
        failed=len(results) - len(ok),
        retried=sum(r.attempts > 1 for r in ok),
        score_in_range=_tally([r.checks.score_in_range for r in ok]),
        topic_matches=_tally([r.checks.topic_matches for r in ok]),
        critique_names_gap=_tally([r.checks.critique_names_gap for r in ok]),
        followup_builds_on_answer=_tally([r.checks.followup_builds_on_answer for r in ok]),
        critique_in_vietnamese=_tally([r.checks.critique_in_vietnamese for r in ok]),
        star_matches=_tally([r.checks.star_matches for r in ok]),
        facts_kept=(sum(r.checks.facts_kept[0] for r in ok), sum(r.checks.facts_kept[1] for r in ok)),
        claims_repeated=_tally([r.checks.claim_repeated for r in ok]),
        mean_score_by_kind={kind: sum(v) / len(v) for kind, v in scores.items()},
    )


def _mark(value: bool | None, bad_when_true: bool = False) -> str:
    if value is None:
        return "-"
    return "NO" if value == bad_when_true else "ok"


def format_report(results: list[InterviewResult]) -> str:
    header = (
        f"{'sample':<30} {'kind':<11} {'tech':>4} {'range':>8} {'clar':>4}  "
        f"{'score':>5} {'topic':>5} {'gap':>4} {'follow':>6} {'viet':>4} {'star':>4} {'facts':>5} {'claim':>5} {'tries':>5}"
    )
    lines = [header, "-" * len(header)]
    for r in results:
        s = r.sample
        rng = f"{s.score_range[0]}-{s.score_range[1]}"
        if r.checks is None:
            lines.append(f"{s.id:<30} {s.kind:<11} {'-':>4} {rng:>8} {'-':>4}  FAILED: {r.error}")
            continue
        c, e = r.checks, r.evaluation
        found, total = c.facts_kept
        lines.append(
            f"{s.id:<30} {s.kind:<11} {e.technical_accuracy_score:>4} {rng:>8} {e.communication_clarity_score:>4}  "
            f"{_mark(c.score_in_range):>5} {_mark(c.topic_matches):>5} {_mark(c.critique_names_gap):>4} "
            f"{_mark(c.followup_builds_on_answer):>6} {_mark(c.critique_in_vietnamese):>4} {_mark(c.star_matches):>4} "
            f"{f'{found}/{total}':>5} {_mark(c.claim_repeated, bad_when_true=True):>5} {r.attempts:>5}"
        )

    m = summarise(results)
    lines.append("")
    if m.evaluated:
        for label, (passed, total) in (
            ("Score in expected range", m.score_in_range),
            ("On-topic flag correct", m.topic_matches),
            ("Critique names the gap", m.critique_names_gap),
            ("Follow-up builds on the answer", m.followup_builds_on_answer),
            ("Critique written in Vietnamese", m.critique_in_vietnamese),
            ("STAR flag correct", m.star_matches),
            ("Reference terms kept in the ideal answer", m.facts_kept),
            ("False claims repeated in the ideal answer (lower is better)", m.claims_repeated),
        ):
            lines.append(f"{label}: {passed}/{total}")
        by_kind = ", ".join(f"{k} {v:.1f}" for k, v in sorted(m.mean_score_by_kind.items()))
        lines.append(f"Mean technical score by kind: {by_kind}")
        lines.append(f"Answers needing a retry: {m.retried} of {m.evaluated}")
    lines.append(f"Failed: {m.failed} of {len(results)}")
    return "\n".join(lines)


def format_details(results: list[InterviewResult]) -> str:
    """What the model wrote for each answer, so a person can read it for made-up facts."""
    blocks = []
    for r in results:
        s = r.sample
        if r.evaluation is None:
            blocks.append(f"=== {s.id} ({s.kind}) FAILED: {r.error}")
            continue
        step = r.step
        asked = f"{step.kind}: {step.text}" if step.kind == "FOLLOW_UP" else step.kind
        blocks.append(
            "\n".join(
                [
                    f"=== {s.id} ({s.kind}) on-topic={r.evaluation.is_on_topic}",
                    f"Question: {s.question}",
                    f"Answer: {s.answer}",
                    f"Critique: {r.evaluation.critique}",
                    f"Next: {asked}",
                    f"Ideal answer: {r.evaluation.optimal_reference_answer}",
                ]
            )
        )
    return "\n\n".join(blocks)
