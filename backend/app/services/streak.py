from datetime import date, timedelta

from app.models import UserProfile


def touch_streak(profile: UserProfile, today: date) -> None:
    """Count today as active: the streak grows after a consecutive day and restarts after a gap."""
    last = profile.last_active_date
    if last == today:
        return
    profile.streak_days = (profile.streak_days or 0) + 1 if last == today - timedelta(days=1) else 1
    profile.last_active_date = today
