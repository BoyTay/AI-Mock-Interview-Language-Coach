from app.schemas.interview import InterviewEvaluation
from evals.interview_checks import (
    InterviewResult,
    check_sample,
    format_details,
    format_report,
    next_step_for,
    summarise,
)
from evals.interview_samples import SAMPLES, InterviewSample
from tests.test_ai_interviewer import evaluation as evaluation_payload


def sample(**overrides) -> InterviewSample:
    base = dict(
        id="s1",
        kind="MEDIUM",
        category="JAVA",
        difficulty="MID",
        question="How does HashMap work?",
        reference_answer="Buckets, hashCode, equals and a load factor.",
        answer="It uses buckets and hashCode.",
        score_range=(40, 70),
        expect_followup=True,
        critique_terms=("equals", "load factor"),
        followup_anchors=("buckets", "hashCode"),
        reference_facts=("hashCode", "load factor"),
    )
    base.update(overrides)
    return InterviewSample(**base)


def evaluation(**overrides) -> InterviewEvaluation:
    base = dict(
        technical_accuracy_score=55,
        critique="Đúng phần buckets nhưng thiếu equals và load factor.",
        optimal_reference_answer="Buckets are picked from hashCode; equals resolves collisions; a load factor triggers resize.",
        should_ask_followup=True,
        next_ai_question="You mentioned buckets: what happens when two keys collide?",
    )
    base.update(overrides)
    return InterviewEvaluation.model_validate(evaluation_payload(**base))


def checks(s=None, e=None):
    s = s or sample()
    e = e or evaluation()
    return check_sample(s, e, next_step_for(s, e))


def test_score_must_fall_inside_the_expected_range_inclusive():
    assert checks(e=evaluation(technical_accuracy_score=40)).score_in_range
    assert checks(e=evaluation(technical_accuracy_score=70)).score_in_range
    assert not checks(e=evaluation(technical_accuracy_score=71)).score_in_range
    assert not checks(e=evaluation(technical_accuracy_score=39)).score_in_range


def test_on_topic_flag_must_match_what_the_sample_expects():
    assert checks().topic_matches
    assert not checks(e=evaluation(is_on_topic=False)).topic_matches
    assert checks(sample(on_topic=False), evaluation(is_on_topic=False)).topic_matches


def test_critique_must_name_one_of_the_expected_terms_ignoring_case():
    assert checks(e=evaluation(critique="Bạn chưa nhắc tới EQUALS.")).critique_names_gap
    assert not checks(e=evaluation(critique="Câu trả lời khá tốt.")).critique_names_gap


def test_critique_check_does_not_apply_without_expected_terms():
    assert checks(sample(critique_terms=())).critique_names_gap is None


def test_follow_up_must_be_asked_and_mention_something_the_candidate_said():
    assert checks().followup_builds_on_answer is True
    unrelated = evaluation(next_ai_question="What is your biggest weakness?")
    assert checks(e=unrelated).followup_builds_on_answer is False


def test_a_missing_follow_up_fails_when_one_is_expected():
    none = evaluation(should_ask_followup=False, next_ai_question="")

    assert checks(e=none).followup_builds_on_answer is False


def test_follow_up_check_does_not_apply_when_either_outcome_is_fine():
    s = sample(expect_followup=None, followup_anchors=())
    none = evaluation(should_ask_followup=False, next_ai_question="")

    assert checks(s, none).followup_builds_on_answer is None


def test_follow_up_is_judged_after_the_policy_so_a_repeat_of_the_question_does_not_count():
    s = sample()
    repeat = evaluation(next_ai_question=s.question)

    assert next_step_for(s, repeat).kind == "MAIN_QUESTION"
    assert check_sample(s, repeat, next_step_for(s, repeat)).followup_builds_on_answer is False


def test_off_topic_answer_without_a_proposed_question_gets_the_policys_re_ask():
    s = sample(on_topic=False, followup_anchors=("HashMap",), critique_terms=())
    off = evaluation(is_on_topic=False, should_ask_followup=False, next_ai_question="")

    step = next_step_for(s, off)

    assert step.kind == "FOLLOW_UP"
    assert check_sample(s, off, step).followup_builds_on_answer is True


def test_facts_kept_counts_reference_terms_present_in_the_models_ideal_answer():
    kept = evaluation(optimal_reference_answer="Use hashCode and equals.")

    assert checks(e=kept).facts_kept == (1, 2)
    assert checks().facts_kept == (2, 2)


def test_false_claim_is_repeated_when_the_ideal_answer_matches_an_adoption_pattern():
    s = sample(kind="FALSE_CLAIM", adopts_false_claim=(r"volatile[^.]*makes[^.]*atomic",), claim_in_answer="x")
    bad = evaluation(optimal_reference_answer="volatile makes counter++ atomic.")
    good = evaluation(optimal_reference_answer="volatile does not make counter++ atomic.")

    assert checks(s, bad).claim_repeated is True
    assert checks(s, good).claim_repeated is False
    assert checks().claim_repeated is None


def test_star_flag_must_match_for_behavioural_samples_only():
    s = sample(category="BEHAVIORAL", expect_star=True)

    assert checks(s, evaluation(star_method_compliance=True)).star_matches is True
    assert checks(s, evaluation(star_method_compliance=False)).star_matches is False
    assert checks().star_matches is None


def test_critique_must_be_written_in_vietnamese():
    assert checks().critique_in_vietnamese
    assert not checks(e=evaluation(critique="Good answer but equals is missing.")).critique_in_vietnamese


def test_summary_counts_only_the_runs_that_produced_an_evaluation():
    s = sample()
    ok = InterviewResult(s, evaluation(), 1)
    low = InterviewResult(s, evaluation(technical_accuracy_score=10), 1)
    failed = InterviewResult(s, None, 1, error="RATE_LIMITED")

    summary = summarise([ok, low, failed])

    assert summary.evaluated == 2
    assert summary.failed == 1
    assert summary.score_in_range == (1, 2)
    assert summary.facts_kept == (4, 4)


def test_summary_averages_the_technical_score_per_kind_of_answer():
    good = sample(kind="GOOD", score_range=(70, 100))
    results = [
        InterviewResult(good, evaluation(technical_accuracy_score=80), 1),
        InterviewResult(good, evaluation(technical_accuracy_score=90), 1),
        InterviewResult(sample(kind="POOR", score_range=(0, 35)), evaluation(technical_accuracy_score=20), 1),
    ]

    assert summarise(results).mean_score_by_kind == {"GOOD": 85.0, "POOR": 20.0}


def test_summary_counts_false_claims_the_model_repeated():
    s = sample(kind="FALSE_CLAIM", adopts_false_claim=(r"atomic",), claim_in_answer="x")
    repeated = InterviewResult(s, evaluation(optimal_reference_answer="It is atomic."), 1)
    corrected = InterviewResult(s, evaluation(optimal_reference_answer="It is not safe."), 1)

    assert summarise([repeated, corrected]).claims_repeated == (1, 2)


def test_report_lists_every_sample_and_shows_failures():
    results = [InterviewResult(SAMPLES[0], evaluation(technical_accuracy_score=80), 1), InterviewResult(SAMPLES[1], None, 3, error="AI_INVALID_RESPONSE")]

    report = format_report(results)

    assert SAMPLES[0].id in report and SAMPLES[1].id in report
    assert "FAILED: AI_INVALID_RESPONSE" in report
    assert "Score in expected range" in report
    assert "Failed: 1 of 2" in report


def test_details_print_what_the_model_said_so_a_person_can_check_it_for_made_up_facts():
    s = sample()
    details = format_details([InterviewResult(s, evaluation(critique="Thiếu equals."), 1)])

    assert "Thiếu equals." in details
    assert "Buckets are picked from hashCode" in details
    assert "You mentioned buckets" in details
    assert s.id in details


def test_ideal_answer_must_be_in_the_language_of_the_question_which_is_english_in_the_bank():
    vietnamese = evaluation(optimal_reference_answer="useEffect chạy các tác dụng phụ sau khi React render.")

    assert checks().ideal_in_question_language is True
    assert checks(e=vietnamese).ideal_in_question_language is False


def test_follow_up_must_be_in_the_language_of_the_question_even_though_the_critique_is_vietnamese():
    vietnamese = evaluation(next_ai_question="Bạn có thể giải thích thêm về buckets không?")
    none = evaluation(should_ask_followup=False, next_ai_question="")

    assert checks().followup_in_question_language is True
    assert checks(e=vietnamese).followup_in_question_language is False
    assert checks(e=none).followup_in_question_language is None


def test_summary_and_report_count_the_language_slips():
    s = sample()
    slip = InterviewResult(s, evaluation(optimal_reference_answer="Đáp án mẫu bằng tiếng Việt."), 1)
    fine = InterviewResult(s, evaluation(), 1)

    summary = summarise([slip, fine])

    assert summary.ideal_in_question_language == (1, 2)
    assert summary.followup_in_question_language == (2, 2)
    assert "Ideal answer in the question's language: 1/2" in format_report([slip, fine])
    assert "Follow-up in the question's language: 2/2" in format_report([slip, fine])
