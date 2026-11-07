import hashlib
import re
import time
from dataclasses import dataclass

from google.genai import errors as genai_errors
from google.genai import types
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.question_bank import EMBEDDING_DIM, QuestionBank


def content_hash(question_text: str) -> str:
    """Idempotency key for a question: SHA-256 of its whitespace-normalised text."""
    normalised = re.sub(r"\s+", " ", question_text).strip()
    return hashlib.sha256(normalised.encode("utf-8")).hexdigest()


class EmbeddingRateLimited(Exception):
    """The embedding API answered 429. `retry_after` is the server's hint in seconds, if any."""

    def __init__(self, retry_after: float | None = None):
        self.retry_after = retry_after
        super().__init__("embedding API rate limited")


def embed_with_backoff(embed, texts, *, max_retries=5, base_delay=2.0, sleep=time.sleep):
    """Call `embed(texts)`, waiting and retrying while the API rate-limits us.

    Waits `base_delay * 2**attempt` seconds unless the server named its own wait.
    """
    for attempt in range(max_retries + 1):
        try:
            return embed(texts)
        except EmbeddingRateLimited as exc:
            if attempt == max_retries:
                raise
            sleep(exc.retry_after if exc.retry_after is not None else base_delay * 2**attempt)


@dataclass
class SeedResult:
    inserted: int
    skipped: int


def seed(
    session: Session,
    questions: list[dict],
    embed,
    *,
    batch_size: int = 50,
    max_retries: int = 5,
    base_delay: float = 2.0,
    sleep=time.sleep,
) -> SeedResult:
    """Insert the questions that are not in question_bank yet, embedding only those.

    Rows are matched by content_hash, so running this again adds nothing. Each batch is
    committed on its own: a failure part-way keeps the finished batches.
    """
    by_hash = {content_hash(q["question_text"]): q for q in questions}
    existing = set(session.scalars(select(QuestionBank.content_hash).where(QuestionBank.content_hash.in_(by_hash))))
    pending = [(h, q) for h, q in by_hash.items() if h not in existing]

    for start in range(0, len(pending), batch_size):
        batch = pending[start : start + batch_size]
        vectors = embed_with_backoff(
            embed,
            [q["question_text"] for _, q in batch],
            max_retries=max_retries,
            base_delay=base_delay,
            sleep=sleep,
        )
        if len(vectors) != len(batch) or any(len(v) != EMBEDDING_DIM for v in vectors):
            raise ValueError(f"expected {len(batch)} embeddings of {EMBEDDING_DIM} dimensions")
        session.add_all(
            QuestionBank(
                category=q["category"],
                difficulty=q["difficulty"],
                question_text=q["question_text"],
                reference_answer=q["reference_answer"],
                embedding=vector,
                content_hash=h,
            )
            for (h, q), vector in zip(batch, vectors)
        )
        session.commit()

    return SeedResult(inserted=len(pending), skipped=len(by_hash) - len(pending))


def category_counts(session: Session) -> dict[str, int]:
    rows = session.execute(
        select(QuestionBank.category, func.count()).group_by(QuestionBank.category).order_by(QuestionBank.category)
    )
    return dict(rows.all())


class GeminiEmbedder:
    """Embeds texts sized to the question_bank.embedding column.

    Stored questions are RETRIEVAL_DOCUMENTs; a search text is a RETRIEVAL_QUERY.
    """

    def __init__(self, client, model: str, task_type: str = "RETRIEVAL_DOCUMENT"):
        self.client = client
        self.model = model
        self.task_type = task_type

    def __call__(self, texts: list[str]) -> list[list[float]]:
        config = types.EmbedContentConfig(task_type=self.task_type, output_dimensionality=EMBEDDING_DIM)
        try:
            response = self.client.models.embed_content(model=self.model, contents=texts, config=config)
        except genai_errors.APIError as exc:
            if exc.code == 429:
                raise EmbeddingRateLimited() from exc
            raise
        return [list(e.values) for e in response.embeddings]
