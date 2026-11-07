import re

import pytest
from google.genai import errors as genai_errors
from google.genai import types
from pgvector.sqlalchemy import Vector
from sqlalchemy import create_engine, func, select
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

from app.models import QuestionBank

from app.services import question_seeder


def test_content_hash_is_a_stable_sha256_hex_digest():
    digest = question_seeder.content_hash("What is a JVM?")

    assert re.fullmatch(r"[0-9a-f]{64}", digest)
    assert digest == question_seeder.content_hash("What is a JVM?")


def test_content_hash_ignores_surrounding_and_repeated_whitespace():
    assert question_seeder.content_hash("  What is\n a  JVM? ") == question_seeder.content_hash("What is a JVM?")


def test_content_hash_differs_for_different_questions():
    assert question_seeder.content_hash("What is a JVM?") != question_seeder.content_hash("What is a JRE?")


class _FlakyEmbedder:
    def __init__(self, failures: int):
        self.failures = failures
        self.calls = 0

    def __call__(self, texts):
        self.calls += 1
        if self.calls <= self.failures:
            raise question_seeder.EmbeddingRateLimited()
        return [[0.0] * 3 for _ in texts]


def test_backoff_retries_a_rate_limited_batch_with_doubling_waits():
    embedder = _FlakyEmbedder(failures=3)
    waits = []

    vectors = question_seeder.embed_with_backoff(
        embedder, ["a", "b"], base_delay=2.0, sleep=waits.append
    )

    assert len(vectors) == 2
    assert embedder.calls == 4
    assert waits == [2.0, 4.0, 8.0]


def test_backoff_prefers_the_retry_after_the_server_asked_for():
    calls = []

    def embedder(texts):
        calls.append(1)
        if len(calls) == 1:
            raise question_seeder.EmbeddingRateLimited(retry_after=30)
        return [[0.0]]

    waits = []
    question_seeder.embed_with_backoff(embedder, ["a"], base_delay=2.0, sleep=waits.append)

    assert waits == [30]


def test_backoff_gives_up_after_max_retries():
    embedder = _FlakyEmbedder(failures=99)

    with pytest.raises(question_seeder.EmbeddingRateLimited):
        question_seeder.embed_with_backoff(embedder, ["a"], max_retries=2, sleep=lambda s: None)

    assert embedder.calls == 3


# --- seeding against an in-memory SQLite (pgvector's column is stored as TEXT there) ---

DIM = 768


@compiles(Vector, "sqlite")
def _vector_as_text_on_sqlite(type_, compiler, **kw):
    return "TEXT"


@pytest.fixture
def session():
    engine = create_engine("sqlite://")
    QuestionBank.__table__.create(engine)
    with Session(engine) as s:
        yield s
    engine.dispose()


def _q(n, category="JAVA"):
    return {
        "category": category,
        "difficulty": "MID",
        "question_text": f"Question number {n}?",
        "reference_answer": f"Answer {n}.",
    }


class _RecordingEmbedder:
    def __init__(self):
        self.batches = []

    def __call__(self, texts):
        self.batches.append(list(texts))
        return [[0.5] * DIM for _ in texts]


def _seed(session, questions, embed, **kw):
    return question_seeder.seed(session, questions, embed, sleep=lambda s: None, **kw)


def test_seed_inserts_every_question_with_an_embedding_and_hash(session):
    questions = [_q(1), _q(2, "SQL"), _q(3)]

    result = _seed(session, questions, _RecordingEmbedder())

    rows = session.scalars(select(QuestionBank).order_by(QuestionBank.id)).all()
    assert result.inserted == 3 and result.skipped == 0
    assert [r.question_text for r in rows] == [q["question_text"] for q in questions]
    assert all(r.embedding is not None and len(r.embedding) == DIM for r in rows)
    assert all(r.content_hash == question_seeder.content_hash(r.question_text) for r in rows)


def test_seed_embeds_in_batches_of_the_requested_size(session):
    embedder = _RecordingEmbedder()

    _seed(session, [_q(n) for n in range(5)], embedder, batch_size=2)

    assert [len(b) for b in embedder.batches] == [2, 2, 1]


def test_running_seed_twice_creates_no_duplicates_and_skips_the_embedding_call(session):
    questions = [_q(1), _q(2)]
    _seed(session, questions, _RecordingEmbedder())
    second_embedder = _RecordingEmbedder()

    result = _seed(session, questions, second_embedder)

    assert session.scalar(select(func.count()).select_from(QuestionBank)) == 2
    assert result.inserted == 0 and result.skipped == 2
    assert second_embedder.batches == []


def test_seed_only_adds_questions_missing_from_the_bank(session):
    _seed(session, [_q(1), _q(2)], _RecordingEmbedder())
    embedder = _RecordingEmbedder()

    result = _seed(session, [_q(1), _q(2), _q(3)], embedder)

    assert result.inserted == 1 and result.skipped == 2
    assert embedder.batches == [["Question number 3?"]]


def test_seed_collapses_duplicate_questions_within_the_file(session):
    result = _seed(session, [_q(1), _q(1)], _RecordingEmbedder())

    assert result.inserted == 1
    assert session.scalar(select(func.count()).select_from(QuestionBank)) == 1


def test_seed_rejects_an_embedding_of_the_wrong_dimension(session):
    with pytest.raises(ValueError, match="768"):
        _seed(session, [_q(1)], lambda texts: [[0.1, 0.2] for _ in texts])

    assert session.scalar(select(func.count()).select_from(QuestionBank)) == 0


def test_seed_keeps_finished_batches_when_a_later_batch_fails(session):
    calls = []

    def embedder(texts):
        calls.append(1)
        if len(calls) == 2:
            raise RuntimeError("boom")
        return [[0.5] * DIM for _ in texts]

    with pytest.raises(RuntimeError):
        _seed(session, [_q(n) for n in range(4)], embedder, batch_size=2)

    assert session.scalar(select(func.count()).select_from(QuestionBank)) == 2


def test_category_counts_reports_the_bank_per_category(session):
    _seed(session, [_q(1), _q(2), _q(3, "SQL")], _RecordingEmbedder())

    assert question_seeder.category_counts(session) == {"JAVA": 2, "SQL": 1}


# --- Gemini embedder ---


class _FakeModels:
    def __init__(self, error=None):
        self.error = error
        self.kwargs = None

    def embed_content(self, **kwargs):
        self.kwargs = kwargs
        if self.error:
            raise self.error
        vectors = [types.ContentEmbedding(values=[float(i)] * DIM) for i, _ in enumerate(kwargs["contents"])]
        return types.EmbedContentResponse(embeddings=vectors)


class _FakeClient:
    def __init__(self, error=None):
        self.models = _FakeModels(error)


def test_gemini_embedder_asks_for_document_embeddings_of_the_column_size():
    client = _FakeClient()

    vectors = question_seeder.GeminiEmbedder(client, "text-embedding-004")(["a", "b"])

    kwargs = client.models.kwargs
    assert kwargs["model"] == "text-embedding-004"
    assert kwargs["contents"] == ["a", "b"]
    assert kwargs["config"].task_type == "RETRIEVAL_DOCUMENT"
    assert kwargs["config"].output_dimensionality == DIM
    assert [v[0] for v in vectors] == [0.0, 1.0]


def test_gemini_embedder_turns_a_429_into_a_rate_limit_signal():
    error = genai_errors.ClientError(429, {"error": {"code": 429, "message": "quota", "status": "RESOURCE_EXHAUSTED"}})

    with pytest.raises(question_seeder.EmbeddingRateLimited):
        question_seeder.GeminiEmbedder(_FakeClient(error), "m")(["a"])


def test_gemini_embedder_lets_other_api_errors_through():
    error = genai_errors.ClientError(400, {"error": {"code": 400, "message": "bad", "status": "INVALID_ARGUMENT"}})

    with pytest.raises(genai_errors.ClientError):
        question_seeder.GeminiEmbedder(_FakeClient(error), "m")(["a"])


def test_gemini_embedder_can_embed_queries_instead_of_documents():
    client = _FakeClient()

    question_seeder.GeminiEmbedder(client, "m", task_type="RETRIEVAL_QUERY")(["a"])

    assert client.models.kwargs["config"].task_type == "RETRIEVAL_QUERY"
