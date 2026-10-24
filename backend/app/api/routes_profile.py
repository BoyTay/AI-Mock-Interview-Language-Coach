from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import AppError
from app.models import UserProfile
from app.schemas.profile import CvUploadOut, ProfileOut, ProfileUpdate
from app.services.cv_parser import CvParseError, extract_text

MAX_CV_BYTES = 5 * 1024 * 1024
PREVIEW_CHARS = 500
_CHUNK_BYTES = 64 * 1024

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


def read_limited(file: UploadFile, limit: int) -> bytes:
    """Read the upload in chunks, giving up as soon as it exceeds `limit` bytes."""
    chunks: list[bytes] = []
    total = 0
    while chunk := file.file.read(_CHUNK_BYTES):
        total += len(chunk)
        if total > limit:
            raise AppError(413, "FILE_TOO_LARGE", "File quá lớn, tối đa 5 MB")
        chunks.append(chunk)
    return b"".join(chunks)


@router.post("/upload-cv", response_model=CvUploadOut)
def upload_cv(file: UploadFile = File(...), db: Session = Depends(get_db)) -> CvUploadOut:
    unsupported = AppError(415, "UNSUPPORTED_FILE_TYPE", "Chỉ chấp nhận file PDF")
    if not (file.filename or "").lower().endswith(".pdf"):
        raise unsupported
    data = read_limited(file, MAX_CV_BYTES)
    if not data.startswith(b"%PDF-"):
        raise unsupported
    try:
        cv_text = extract_text(data)
    except CvParseError as e:
        raise AppError(422, e.code, e.message) from e
    profile = get_default_profile(db)
    profile.cv_text = cv_text
    db.commit()
    return CvUploadOut(char_count=len(cv_text), preview=cv_text[:PREVIEW_CHARS])
