from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

EMBEDDING_DIM = 768  # gemini-embedding-001 truncated to 768 dims


class QuestionBank(Base):
    __tablename__ = "question_bank"

    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[str] = mapped_column(String(50))
    difficulty: Mapped[str] = mapped_column(String(20))
    question_text: Mapped[str] = mapped_column(Text)
    reference_answer: Mapped[str] = mapped_column(Text)
    embedding = mapped_column(Vector(EMBEDDING_DIM))
    # SHA-256 of the normalised question_text; the seed script's idempotency key.
    content_hash: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime | None] = mapped_column(server_default=func.current_timestamp())

    __table_args__ = (
        Index("ix_question_bank_content_hash", "content_hash", unique=True),
        Index(
            "ix_question_bank_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )
