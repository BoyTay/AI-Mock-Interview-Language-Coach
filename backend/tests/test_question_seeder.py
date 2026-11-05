import re

import pytest

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
