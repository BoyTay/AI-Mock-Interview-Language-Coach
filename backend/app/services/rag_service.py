import re
from collections import Counter
from dataclasses import dataclass

MAX_JD_CHARS = 2000
MAX_CV_CHARS = 1500
MAX_KEYWORDS = 15
MIN_KEYWORD_LENGTH = 3

# Filler that appears in nearly every job description and says nothing about the stack.
_STOPWORDS = frozenset(
    """
    the and for with that this from have has are was were will would can could should you your our their
    who what when where which while into over under about also not but all any more most other such than then
    need needs needed looking join work working works team teams experience experienced years year developer
    developers engineer engineers strong good great ability able knowledge skills skill using use used
    including etc plus must nice well new role position company candidate responsibilities requirements
    """.split()
)


def _squash(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def build_query(target_role: str, job_description: str | None, cv_text: str | None) -> str:
    """Text to embed: the role, the job description and a short extract of the CV."""
    parts = [f"Target role: {_squash(target_role)}"]
    if job_description and job_description.strip():
        parts.append(f"Job description: {_squash(job_description)[:MAX_JD_CHARS]}")
    if cv_text and cv_text.strip():
        parts.append(f"Candidate background: {_squash(cv_text)[:MAX_CV_CHARS]}")
    return "\n".join(parts)


def extract_keywords(text: str) -> list[str]:
    """Distinctive words of `text`, most frequent first. Letters and digits only, so they are safe in a tsquery."""
    words = [
        w
        for w in re.findall(r"[a-z0-9]+", text.lower())
        if len(w) >= MIN_KEYWORD_LENGTH and w not in _STOPWORDS
    ]
    # Counter keeps first-seen order, and most_common is stable for equal counts.
    return [w for w, _ in Counter(words).most_common(MAX_KEYWORDS)]


@dataclass(frozen=True)
class RetrievedQuestion:
    id: int
    category: str
    difficulty: str
    question_text: str
    reference_answer: str
    distance: float  # cosine distance to the query embedding; 0 is identical
    keyword_score: float  # 0..1 full-text match against the role and JD keywords
    score: float  # hybrid score used for ranking; higher is better


def diversify(ranked: list[RetrievedQuestion], limit: int, max_per_category: int) -> list[RetrievedQuestion]:
    """Pick `limit` questions from best-first `ranked`, at most `max_per_category` of each category.

    If the cap leaves the list short, the best of the rejected ones fill the gap, so a bank
    with few categories still returns `limit` questions. The result keeps the ranking order.
    """
    per_category: Counter[str] = Counter()
    picked: list[RetrievedQuestion] = []
    deferred: list[RetrievedQuestion] = []
    for hit in ranked:
        if len(picked) == limit:
            break
        if per_category[hit.category] < max_per_category:
            per_category[hit.category] += 1
            picked.append(hit)
        else:
            deferred.append(hit)
    picked += deferred[: limit - len(picked)]
    rank = {hit.id: i for i, hit in enumerate(ranked)}
    return sorted(picked, key=lambda h: rank[h.id])
