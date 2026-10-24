from pydantic import BaseModel, Field, field_validator

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


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(None, max_length=100)
    target_role: str | None = Field(None, max_length=100)
    english_target: str | None = Field(None, max_length=50)

    @field_validator("target_role")
    @classmethod
    def target_role_not_blank(cls, value: str | None) -> str:
        # The column is NOT NULL, so an explicit null is as invalid as a blank string.
        if value is None or not value.strip():
            raise ValueError("target_role must not be blank")
        return value.strip()


class CvUploadOut(BaseModel):
    char_count: int
    preview: str
