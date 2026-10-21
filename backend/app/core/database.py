from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

engine = create_engine(
    get_settings().sqlalchemy_url,
    pool_pre_ping=True,
    # Fail fast when the database is unreachable instead of hanging a request.
    connect_args={"connect_timeout": 3},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency that yields one session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
