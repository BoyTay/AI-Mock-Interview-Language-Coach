import logging
import re
from collections import Counter
from collections.abc import Callable, Sequence
from dataclasses import dataclass

from google import genai
from sqlalchemy import Float, cast, func, literal, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.models.question_bank import QuestionBank
from app.services.question_seeder import GeminiEmbedder

logger = logging.getLogger(__name__)

MAX_JD_CHARS = 2000
MAX_CV_CHARS = 1500
MAX_KEYWORDS = 15
DEFAULT_LIMIT = 5
DEFAULT_MAX_PER_CATEGORY = 2
# How much a full keyword match is worth next to cosine similarity (which spans 0..1).
DEFAULT_KEYWORD_WEIGHT = 0.3
# Candidates fetched before diversifying; more than `limit` so the category cap has room to work.
DEFAULT_CANDIDATE_POOL = 30
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


# (texts) -> one embedding per text. Embed with the RETRIEVAL_QUERY task type.
Embed = Callable[[list[str]], list[list[float]]]


class RagService:
    """Finds the interview questions that best fit a candidate's role, job description and CV.

    Ranking is hybrid: cosine similarity of the query embedding to each question, plus a
    bonus for words from the role and job description found in the question text or category.
    """

    def __init__(
        self,
        embed: Embed,
        *,
        max_per_category: int = DEFAULT_MAX_PER_CATEGORY,
        keyword_weight: float = DEFAULT_KEYWORD_WEIGHT,
        candidate_pool: int = DEFAULT_CANDIDATE_POOL,
    ):
        self.embed = embed
        self.max_per_category = max_per_category
        self.keyword_weight = keyword_weight
        self.candidate_pool = candidate_pool

    def retrieve(
        self,
        session: Session,
        *,
        target_role: str,
        job_description: str | None,
        cv_text: str | None,
        difficulties: Sequence[str] | None = None,
        limit: int = DEFAULT_LIMIT,
    ) -> list[RetrievedQuestion]:
        query = build_query(target_role, job_description, cv_text)
        (query_vector,) = self.embed([query])
        keywords = extract_keywords(f"{target_role} {job_description or ''}")

        distance = QuestionBank.embedding.cosine_distance(query_vector)
        if keywords:
            # Words are OR-ed: a job description rarely matches a short question on every word.
            searchable = func.to_tsvector(
                "english", QuestionBank.question_text + " " + func.replace(QuestionBank.category, "_", " ")
            )
            # Flag 32 scales the rank into 0..1 so the weight means the same for any query.
            keyword = func.ts_rank_cd(searchable, func.to_tsquery("english", " | ".join(keywords)), 32)
        else:
            keyword = literal(0.0)
        score = (1 - distance) + self.keyword_weight * keyword

        stmt = (
            select(QuestionBank, cast(distance, Float), cast(keyword, Float), cast(score, Float))
            .where(QuestionBank.embedding.is_not(None))
            .order_by(score.desc(), QuestionBank.id)
            .limit(self.candidate_pool)
        )
        if difficulties:
            stmt = stmt.where(QuestionBank.difficulty.in_(difficulties))

        ranked = [
            RetrievedQuestion(
                id=row.id,
                category=row.category,
                difficulty=row.difficulty,
                question_text=row.question_text,
                reference_answer=row.reference_answer,
                distance=dist,
                keyword_score=kw,
                score=total,
            )
            for row, dist, kw, total in session.execute(stmt)
        ]
        picked = diversify(ranked, limit, self.max_per_category)
        for hit in picked:
            logger.info(
                "RAG pick id=%s category=%s difficulty=%s distance=%.4f keyword=%.4f score=%.4f",
                hit.id, hit.category, hit.difficulty, hit.distance, hit.keyword_score, hit.score,
            )
        return picked


def build_rag_service(settings: Settings) -> RagService:
    if not settings.gemini_api_key:
        raise AppError(503, "AI_NOT_CONFIGURED", "GEMINI_API_KEY is not set")
    client = genai.Client(api_key=settings.gemini_api_key)
    return RagService(GeminiEmbedder(client, settings.gemini_embedding_model, task_type="RETRIEVAL_QUERY"))
