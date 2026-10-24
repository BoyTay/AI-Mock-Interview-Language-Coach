from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import AppError
from app.models import UserProfile
from app.schemas.profile import ProfileOut, ProfileUpdate

router = APIRouter(prefix="/profile", tags=["profile"])


def get_default_profile(db: Session) -> UserProfile:
    """There is no login in v1: the app runs as the first (seeded) profile."""
    profile = db.scalars(select(UserProfile).order_by(UserProfile.id).limit(1)).first()
    if profile is None:
        raise AppError(404, "PROFILE_NOT_FOUND", "Chưa có hồ sơ người dùng")
    return profile


@router.get("", response_model=ProfileOut)
def get_profile(db: Session = Depends(get_db)) -> ProfileOut:
    return ProfileOut.from_orm_profile(get_default_profile(db))


@router.put("", response_model=ProfileOut)
def update_profile(payload: ProfileUpdate, db: Session = Depends(get_db)) -> ProfileOut:
    profile = get_default_profile(db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    return ProfileOut.from_orm_profile(profile)
