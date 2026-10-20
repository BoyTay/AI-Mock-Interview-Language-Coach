from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Index, Integer, Numeric, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class MistakeCard(Base):
    __tablename__ = "mistake_cards"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("user_profiles.id", ondelete="CASCADE"))
    source_type: Mapped[str] = mapped_column(String(30))  # TECH_CONCEPT, GRAMMAR_ERROR, VOCABULARY
    front_content: Mapped[str] = mapped_column(Text)
    back_content: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str | None] = mapped_column(Text)
    repetition_count: Mapped[int | None] = mapped_column(Integer, server_default="0")
    ease_factor: Mapped[Decimal | None] = mapped_column(Numeric(4, 2), server_default="2.50")
    interval_days: Mapped[int | None] = mapped_column(Integer, server_default="1")
    next_review_date: Mapped[date | None] = mapped_column(Date, server_default=text("CURRENT_DATE"))
    created_at: Mapped[datetime | None] = mapped_column(server_default=func.current_timestamp())

    __table_args__ = (Index("ix_mistake_cards_user_due", "user_id", "next_review_date"),)
