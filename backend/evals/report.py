import re
from dataclasses import dataclass

from app.schemas.english import SentenceCorrection
from evals.samples import Sample


@dataclass
class Result:
    sample: Sample
    band: float | None  # None when the evaluation failed
    attempts: int  # calls made to the model; more than 1 means a reply was rejected and retried
    corrections: list[SentenceCorrection]
    error: str | None = None


def _squash(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _gaps(results: list[Result]) -> list[float]:
    return [r.band - r.sample.reference_band for r in results if r.band is not None]


def mean_abs_error(results: list[Result]) -> float | None:
    gaps = _gaps(results)
    return sum(abs(g) for g in gaps) / len(gaps) if gaps else None


def mean_bias(results: list[Result]) -> float | None:
    """Positive when the AI scores higher than the reference on average."""
    gaps = _gaps(results)
    return sum(gaps) / len(gaps) if gaps else None


def planted_recall(sample: Sample, corrections: list[SentenceCorrection]) -> tuple[int, int]:
    """(planted errors covered by a flagged sentence, planted errors in the essay)."""
    flagged = [_squash(c.original_sentence) for c in corrections]
    found = sum(any(_squash(p) in sentence for sentence in flagged) for p in sample.planted_errors)
    return found, len(sample.planted_errors)


def noop_corrections(corrections: list[SentenceCorrection]) -> int:
    """Corrections that rewrite a sentence into itself: errors the AI made up."""
    return sum(_squash(c.original_sentence) == _squash(c.corrected_sentence) for c in corrections)


def format_report(results: list[Result]) -> str:
    header = f"{'essay':<15} {'ref':>4} {'AI':>4} {'gap':>5}  {'planted':>7} {'fixes':>5} {'no-op':>5} {'tries':>5}"
    lines = [header, "-" * len(header)]
    for r in results:
        found, total = planted_recall(r.sample, r.corrections)
        if r.band is None:
            lines.append(f"{r.sample.id:<15} {r.sample.reference_band:>4.1f} {'-':>4} {'-':>5}  FAILED: {r.error}")
            continue
        gap = r.band - r.sample.reference_band
        lines.append(
            f"{r.sample.id:<15} {r.sample.reference_band:>4.1f} {r.band:>4.1f} {gap:>+5.1f}  "
            f"{f'{found}/{total}':>7} {len(r.corrections):>5} {noop_corrections(r.corrections):>5} {r.attempts:>5}"
        )

    ok = [r for r in results if r.band is not None]
    lines.append("")
    if ok:
        found = sum(planted_recall(r.sample, r.corrections)[0] for r in ok)
        total = sum(planted_recall(r.sample, r.corrections)[1] for r in ok)
        lines.append(f"Mean absolute error: {mean_abs_error(results):.2f}")
        lines.append(f"Mean bias: {mean_bias(results):+.2f}")
        lines.append(f"Planted errors flagged: {found}/{total}")
        lines.append(f"No-op corrections: {sum(noop_corrections(r.corrections) for r in ok)}")
        lines.append(f"Essays needing a retry: {sum(r.attempts > 1 for r in ok)} of {len(ok)}")
    lines.append(f"Failed: {len(results) - len(ok)} of {len(results)}")
    return "\n".join(lines)
