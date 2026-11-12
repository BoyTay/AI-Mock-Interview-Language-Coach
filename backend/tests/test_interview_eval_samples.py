import json
import re
from pathlib import Path

from app.schemas.interview import MAX_ANSWER_CHARS, MAX_SCORE
from evals.interview_samples import SAMPLES

QUESTIONS_PATH = Path(__file__).resolve().parents[2] / "scripts" / "data" / "questions.json"
BANK = {q["question_text"]: q for q in json.loads(QUESTIONS_PATH.read_text(encoding="utf-8"))}


def by_kind(kind):
    return [s for s in SAMPLES if s.kind == kind]


def test_has_ten_samples_with_unique_ids():
    assert len(SAMPLES) == 10
    assert len({s.id for s in SAMPLES}) == len(SAMPLES)


def test_covers_good_medium_poor_off_topic_and_false_claim_answers():
    for kind in ("GOOD", "MEDIUM", "POOR", "OFF_TOPIC", "FALSE_CLAIM"):
        assert by_kind(kind), kind


def test_questions_and_reference_answers_come_from_the_question_bank():
    for s in SAMPLES:
        entry = BANK[s.question]
        assert entry["reference_answer"] == s.reference_answer, s.id
        assert (entry["category"], entry["difficulty"]) == (s.category, s.difficulty), s.id


def test_answers_are_ones_the_api_would_accept():
    for s in SAMPLES:
        assert 0 < len(s.answer.strip()) <= MAX_ANSWER_CHARS, s.id


def test_score_ranges_are_valid_and_follow_the_kind_of_answer():
    for s in SAMPLES:
        low, high = s.score_range
        assert 0 <= low <= high <= MAX_SCORE, s.id
    assert all(s.score_range[0] >= 70 for s in by_kind("GOOD"))
    assert all(s.score_range[1] <= 70 and s.score_range[0] >= 30 for s in by_kind("MEDIUM"))
    assert all(s.score_range[1] <= 40 for s in by_kind("POOR"))
    assert all(s.score_range[1] <= 55 for s in by_kind("FALSE_CLAIM"))


def test_only_off_topic_answers_are_expected_to_be_off_topic_and_they_score_near_zero():
    for s in SAMPLES:
        assert s.on_topic == (s.kind != "OFF_TOPIC"), s.id
    for s in by_kind("OFF_TOPIC"):
        assert s.score_range[1] <= 10
        assert s.expect_followup is True


def test_follow_up_anchors_are_words_the_candidate_said_or_for_off_topic_the_question_asked():
    for s in SAMPLES:
        if s.expect_followup:
            assert s.followup_anchors, s.id
        # An off-topic answer says nothing to build on, so its follow-up has to point back at the question.
        source = s.answer if s.on_topic else s.question
        for anchor in s.followup_anchors:
            assert anchor.lower() in source.lower(), f"{s.id}: {anchor!r}"


def test_reference_facts_are_taken_from_the_reference_answer():
    for s in SAMPLES:
        for fact in s.reference_facts:
            assert fact.lower() in s.reference_answer.lower(), f"{s.id}: {fact!r}"


def test_critique_terms_exist_for_every_answer_with_a_gap():
    for s in SAMPLES:
        if s.kind in ("MEDIUM", "POOR", "FALSE_CLAIM"):
            assert s.critique_terms, s.id


def test_false_claim_samples_say_what_is_wrong_and_how_adopting_it_looks():
    for s in by_kind("FALSE_CLAIM"):
        assert s.false_claim.strip(), s.id
        assert s.adopts_false_claim, s.id
        for pattern in s.adopts_false_claim:
            re.compile(pattern)


def test_the_false_claim_is_actually_in_the_answer_and_not_in_the_reference():
    for s in by_kind("FALSE_CLAIM"):
        assert s.claim_in_answer.lower() in s.answer.lower(), s.id
        assert s.claim_in_answer.lower() not in s.reference_answer.lower(), s.id


def test_one_behavioural_sample_is_judged_against_star():
    behavioural = [s for s in SAMPLES if s.category == "BEHAVIORAL"]
    assert len(behavioural) == 1
    assert behavioural[0].expect_star is True
    assert all(s.expect_star is None for s in SAMPLES if s.category != "BEHAVIORAL")
