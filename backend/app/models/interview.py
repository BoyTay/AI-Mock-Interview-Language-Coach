from datetime import datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="CASCADE"), index=True
    )
    session_type: Mapped[str] = mapped_column(String(50))  # TECH_INTERVIEW, ENGLISH_SPEAKING, DAILY_STANDUP
    target_role: Mapped[str | None] = mapped_column(String(100))
    job_description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(String(20), server_default="IN_PROGRESS")
    overall_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    feedback_summary: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime | None] = mapped_column(server_default=func.current_timestamp())


class SessionMessage(Base):
    __tablename__ = "session_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int | None] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE"), index=True
    )
    sender: Mapped[str] = mapped_column(String(10))  # AI or USER
    question_type: Mapped[str | None] = mapped_column(String(30))  # MAIN_QUESTION, FOLLOW_UP
    content_text: Mapped[str] = mapped_column(Text)
    audio_path: Mapped[str | None] = mapped_column(String(255))
    evaluation: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime | None] = mapped_column(server_default=func.current_timestamp())
