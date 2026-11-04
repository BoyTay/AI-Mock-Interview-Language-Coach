import json
from collections import Counter
from pathlib import Path

QUESTIONS_PATH = Path(__file__).resolve().parents[2] / "scripts" / "data" / "questions.json"
EXPECTED_COUNTS = {
    "JAVA": 15,
    "SQL": 15,
    "PYTHON": 10,
    "REACT": 10,
    "OOP": 10,
    "SYSTEM_DESIGN": 10,
    "BEHAVIORAL": 10,
}
FIELDS = {"category", "difficulty", "question_text", "reference_answer"}

QUESTIONS = json.loads(QUESTIONS_PATH.read_text(encoding="utf-8"))


def test_distribution_matches_the_plan():
    assert Counter(q["category"] for q in QUESTIONS) == EXPECTED_COUNTS


def test_every_question_has_exactly_the_required_non_empty_fields():
    for q in QUESTIONS:
        assert set(q) == FIELDS
        assert all(isinstance(v, str) and v.strip() for v in q.values())


def test_difficulty_values_and_column_lengths_fit_the_schema():
    for q in QUESTIONS:
        assert q["difficulty"] in {"JUNIOR", "MID", "SENIOR"}
        assert len(q["category"]) <= 50


def test_question_texts_are_unique():
    texts = [q["question_text"] for q in QUESTIONS]
    assert len(set(texts)) == len(texts)


def test_behavioral_questions_ask_for_star():
    star = [q for q in QUESTIONS if q["category"] == "BEHAVIORAL" and "STAR" in q["question_text"]]
    assert len(star) >= 8
