import os

# Must be set before importing `app`: the database module builds its engine at import time.
os.environ.setdefault("DATABASE_URL", "sqlite://")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.audio_upload import get_audio_probe
from app.core.database import get_db
from app.services.audio_store import AudioStore
from app.main import app
from app.api.routes_interview import get_audio_store, get_interviewer, get_rag_service, get_report_writer
from tests.interview_helpers import FakeInterviewer, FakeRag, FakeReportWriter, bank_question
from app.models import InterviewSession, MistakeCard, SessionMessage, SpeakingSubmission, UserProfile, WritingSubmission


@compiles(JSONB, "sqlite")
def _jsonb_as_json_on_sqlite(type_, compiler, **kw):
    return "JSON"


@pytest.fixture
def db_session():
    # StaticPool + check_same_thread=False so the TestClient's worker thread shares this in-memory DB.
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    # Only the tables whose columns SQLite can hold: other models use pgvector.
    UserProfile.__table__.create(engine)
    WritingSubmission.__table__.create(engine)
    SpeakingSubmission.__table__.create(engine)
    MistakeCard.__table__.create(engine)
    InterviewSession.__table__.create(engine)
    SessionMessage.__table__.create(engine)
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


class FakeProbe:
    """Stands in for ffprobe: returns `seconds`, or raises `error` when a test sets one."""

    def __init__(self, seconds: float = 84.0):
        self.seconds = seconds
        self.error: Exception | None = None

    def __call__(self, data: bytes) -> float:
        if self.error is not None:
            raise self.error
        return self.seconds


@pytest.fixture
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    fake_probe = FakeProbe()
    app.dependency_overrides[get_audio_probe] = lambda: fake_probe
    test_client = TestClient(app)
    test_client.fake_probe = fake_probe
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def probe(client):
    """The fake length probe the client uses: set `.seconds` or `.error` in a test."""
    return client.fake_probe


@pytest.fixture
def rag():
    fake = FakeRag([bank_question(n) for n in range(1, 9)])
    app.dependency_overrides[get_rag_service] = lambda: fake
    return fake


@pytest.fixture
def use_interviewer():
    def install(*evaluations, voice=()):
        fake = FakeInterviewer(*evaluations, voice=voice)
        app.dependency_overrides[get_interviewer] = lambda: fake
        return fake

    return install


@pytest.fixture
def use_writer():
    def install(*items):
        fake = FakeReportWriter(*items)
        app.dependency_overrides[get_report_writer] = lambda: fake
        return fake

    return install


@pytest.fixture
def audio_store(tmp_path):
    """Spoken answers are stored under tmp_path instead of the real upload directory."""
    store = AudioStore(tmp_path / "uploads")
    app.dependency_overrides[get_audio_store] = lambda: store
    return store
