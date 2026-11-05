import re

from app.services import question_seeder


def test_content_hash_is_a_stable_sha256_hex_digest():
    digest = question_seeder.content_hash("What is a JVM?")

    assert re.fullmatch(r"[0-9a-f]{64}", digest)
    assert digest == question_seeder.content_hash("What is a JVM?")


def test_content_hash_ignores_surrounding_and_repeated_whitespace():
    assert question_seeder.content_hash("  What is\n a  JVM? ") == question_seeder.content_hash("What is a JVM?")


def test_content_hash_differs_for_different_questions():
    assert question_seeder.content_hash("What is a JVM?") != question_seeder.content_hash("What is a JRE?")
