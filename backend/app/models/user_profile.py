from datetime import date, datetime

from sqlalchemy import Date, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str | None] = mapped_column(String(100))
    target_role: Mapped[str] = mapped_column(String(100))
    cv_text: Mapped[str | None] = mapped_column(Text)
    english_target: Mapped[str | None] = mapped_column(String(50))
    streak_days: Mapped[int | None] = mapped_column(Integer, server_default="0")
    last_active_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime | None] = mapped_column(server_default=func.current_timestamp())
