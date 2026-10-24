from pydantic import BaseModel

from app.models import UserProfile


class ProfileOut(BaseModel):
    id: int
    full_name: str | None
    target_role: str
    english_target: str | None
    cv_text: str | None
    has_cv: bool

    @classmethod
    def from_orm_profile(cls, p: UserProfile) -> "ProfileOut":
        return cls(
            id=p.id,
            full_name=p.full_name,
            target_role=p.target_role,
            english_target=p.english_target,
            cv_text=p.cv_text,
            has_cv=bool(p.cv_text),
        )
