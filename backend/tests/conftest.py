import os

# Must be set before importing `app`: the database module builds its engine at import time.
os.environ.setdefault("DATABASE_URL", "sqlite://")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.main import app
from app.models import UserProfile


@pytest.fixture
def db_session():
    # StaticPool + check_same_thread=False so the TestClient's worker thread shares this in-memory DB.
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    # Only the profile table: other models use Postgres-only column types (pgvector).
    UserProfile.__table__.create(engine)
    session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    session.add(
        UserProfile(
            full_name="Default User",
            target_role="Java Backend Developer",
            english_target="IELTS 7.0",
        )
    )
    session.commit()
    yield session
    session.close()
    engine.dispose()


@pytest.fixture
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()
