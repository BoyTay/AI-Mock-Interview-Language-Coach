"""Retrieval SQL (pgvector `<=>`, full-text search) can only be checked on real Postgres.

Set TEST_DATABASE_URL to a dev database that has the pgvector extension, e.g.
postgresql+psycopg://devcoach:...@localhost:5434/devcoach_db. Each test builds its own
table in a throwaway schema inside a transaction that is rolled back, so no data is touched.
"""
import logging
import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.models import QuestionBank
from app.models.question_bank import EMBEDDING_DIM
from app.services import rag_service

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="TEST_DATABASE_URL is not set")


def vec(axis: int, tilt: float = 0.0) -> list[float]:
    """Unit-ish vector along `axis`, tilted toward axis 0 by `tilt` to make it a bit farther from queries on `axis`."""
    v = [0.0] * EMBEDDING_DIM
    v[axis] = 1.0
    v[0] += tilt
    return v


@pytest.fixture
def session():
    engine = create_engine(TEST_DATABASE_URL)
    with engine.connect() as conn:
        outer = conn.begin()
        conn.execute(text("CREATE SCHEMA rag_test"))
        conn.execute(text("SET LOCAL search_path TO rag_test, public"))
        QuestionBank.__table__.create(conn)
        with Session(bind=conn) as s:
            yield s
        outer.rollback()
    engine.dispose()


def add(session, id_, category, question, embedding, difficulty="MID"):
    session.add(
        QuestionBank(
            id=id_,
            category=category,
            difficulty=difficulty,
            question_text=question,
            reference_answer="answer",
            embedding=embedding,
        )
    )
    session.flush()


def service(query_vector, **kw):
    return rag_service.RagService(lambda texts: [query_vector for _ in texts], **kw)


def retrieve(svc, session, jd="", **kw):
    return svc.retrieve(session, target_role="Dev", job_description=jd, cv_text=None, **kw)


def test_nearest_questions_come_first_by_cosine_distance(session):
    add(session, 1, "JAVA", "far", vec(3))
    add(session, 2, "SQL", "near", vec(1))
    add(session, 3, "OOP", "middle", vec(1, tilt=1.0))

    hits = retrieve(service(vec(1)), session)

    assert [h.id for h in hits] == [2, 3, 1]
    assert hits[0].distance == pytest.approx(0.0, abs=1e-6)
    assert hits[0].distance < hits[1].distance < hits[2].distance


def test_returns_at_most_the_requested_number(session):
    for n in range(1, 8):
        add(session, n, f"CAT{n}", f"q{n}", vec(n))

    assert len(retrieve(service(vec(1)), session, limit=5)) == 5


def test_difficulty_filter_keeps_only_the_requested_levels(session):
    add(session, 1, "JAVA", "junior one", vec(1), difficulty="JUNIOR")
    add(session, 2, "SQL", "senior one", vec(1), difficulty="SENIOR")
    add(session, 3, "OOP", "mid one", vec(1), difficulty="MID")

    hits = retrieve(service(vec(1)), session, difficulties=["JUNIOR", "MID"])

    assert sorted(h.id for h in hits) == [1, 3]


def test_questions_without_an_embedding_are_ignored(session):
    add(session, 1, "JAVA", "has vector", vec(1))
    add(session, 2, "SQL", "no vector", None)

    assert [h.id for h in retrieve(service(vec(1)), session)] == [1]


def test_a_keyword_match_in_the_job_description_lifts_a_slightly_farther_question(session):
    add(session, 1, "SQL", "How do indexes work?", vec(1))
    add(session, 2, "REACT", "Explain hooks and the virtual DOM", vec(1, tilt=0.3))

    without = retrieve(service(vec(1)), session, jd="")
    with_jd = retrieve(service(vec(1)), session, jd="We build UIs with React hooks")

    assert [h.id for h in without] == [1, 2]
    assert [h.id for h in with_jd] == [2, 1]
    assert with_jd[0].keyword_score > 0
    assert without[0].keyword_score == 0


def test_the_category_name_counts_as_a_keyword(session):
    add(session, 1, "SQL", "How do indexes work?", vec(1))
    add(session, 2, "SYSTEM_DESIGN", "Design a rate limiter", vec(1, tilt=0.3))

    hits = retrieve(service(vec(1)), session, jd="system design interviews")

    assert hits[0].id == 2


def test_no_single_category_fills_the_list_when_others_are_available(session):
    for n in range(1, 5):
        add(session, n, "JAVA", f"java question {n}", vec(1, tilt=0.01 * n))
    add(session, 5, "SQL", "sql question", vec(2))

    hits = retrieve(service(vec(1), max_per_category=2), session, limit=3)

    assert sorted(h.category for h in hits) == ["JAVA", "JAVA", "SQL"]


def test_logs_each_chosen_question_with_its_distance(session, caplog):
    add(session, 1, "JAVA", "java question", vec(1))

    with caplog.at_level(logging.INFO, logger="app.services.rag_service"):
        retrieve(service(vec(1)), session)

    assert "id=1" in caplog.text and "JAVA" in caplog.text and "distance=" in caplog.text


def test_the_query_text_sent_to_the_embedder_contains_role_jd_and_cv(session):
    seen = []

    def embed(texts):
        seen.extend(texts)
        return [vec(1) for _ in texts]

    rag_service.RagService(embed).retrieve(
        session, target_role="Java Dev", job_description="Spring Boot", cv_text="Acme payments"
    )

    assert len(seen) == 1
    assert all(part in seen[0] for part in ("Java Dev", "Spring Boot", "Acme payments"))
