from datetime import datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class WritingSubmission(Base):
    __tablename__ = "writing_submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="CASCADE"), index=True
    )
    task_type: Mapped[str] = mapped_column(String(50))  # IELTS_TASK_1, IELTS_TASK_2, TECH_DOCUMENTATION
    prompt_topic: Mapped[str] = mapped_column(Text)
    user_essay: Mapped[str] = mapped_column(Text)
    word_count: Mapped[int | None] = mapped_column(Integer)
    overall_band: Mapped[Decimal | None] = mapped_column(Numeric(3, 1))
    band_scores: Mapped[dict] = mapped_column(JSONB)  # TR, CC, LR, GRA
    sentence_corrections: Mapped[list | None] = mapped_column(JSONB)
    upgraded_vocab: Mapped[list | None] = mapped_column(JSONB)
    created_at: Mapped[datetime | None] = mapped_column(server_default=func.current_timestamp())
