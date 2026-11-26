from datetime import datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SpeakingSubmission(Base):
    __tablename__ = "speaking_submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_profiles.id", ondelete="CASCADE"), index=True)
    prompt_text: Mapped[str] = mapped_column(Text)
    transcript: Mapped[str] = mapped_column(Text)
    audio_path: Mapped[str | None] = mapped_column(String(255))  # relative to the upload directory; None once expired
    duration_seconds: Mapped[int] = mapped_column(Integer)
    words_per_minute: Mapped[int] = mapped_column(Integer)
    overall_band: Mapped[Decimal] = mapped_column(Numeric(3, 1))
    band_scores: Mapped[dict] = mapped_column(JSONB)  # fluency, pronunciation, vocabulary, grammar: score + feedback
    summary: Mapped[str] = mapped_column(Text)
    marks: Mapped[list] = mapped_column(JSONB)  # placed marks, each with start / end
    grammar_corrections: Mapped[list] = mapped_column(JSONB)
    vocabulary_upgrades: Mapped[list] = mapped_column(JSONB)
    prompt_version: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[datetime | None] = mapped_column(server_default=func.current_timestamp())
