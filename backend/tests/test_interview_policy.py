from app.schemas.interview import InterviewEvaluation
from app.services import interview_policy as policy


def evaluation(**overrides):
    base = {
        "technical_accuracy_score": 60,
        "communication_clarity_score": 70,
        "star_method_compliance": None,
        "is_on_topic": True,
        "critique": "c",
        "optimal_reference_answer": "o",
        "should_ask_followup": True,
        "next_ai_question": "What happens to writes?",
        "extracted_mistake_card": {"should_create": False, "front": "", "back": ""},
    }
    base.update(overrides)
    return InterviewEvaluation.model_validate(base)


def decide(ev, *, used=0, cap=2, asked=("What is an index?",), more=True, question="What is an index?"):
    return policy.decide_next(
        ev, followups_used=used, max_followups=cap, asked_questions=list(asked), has_next_main=more, main_question=question
    )


def test_a_wanted_follow_up_is_asked():
    step = decide(evaluation())

    assert (step.kind, step.text) == ("FOLLOW_UP", "What happens to writes?")


def test_without_a_follow_up_the_interview_moves_to_the_next_main_question():
    step = decide(evaluation(should_ask_followup=False, next_ai_question=""))

    assert step.kind == "MAIN_QUESTION" and step.text is None


def test_the_follow_up_limit_is_enforced_even_if_the_model_asks_for_more():
    step = decide(evaluation(), used=2, cap=2)

    assert step.kind == "MAIN_QUESTION"


def test_after_the_last_main_question_the_interview_is_done():
    step = decide(evaluation(should_ask_followup=False, next_ai_question=""), more=False)

    assert step.kind == "DONE"


def test_a_follow_up_with_no_text_is_dropped():
    step = decide(evaluation(next_ai_question="   "))

    assert step.kind == "MAIN_QUESTION"


def test_a_follow_up_that_repeats_an_earlier_question_is_dropped():
    asked = ["What is an index?", "What happens to writes?"]

    step = decide(evaluation(next_ai_question="what happens to writes"), asked=asked)

    assert step.kind == "MAIN_QUESTION"


def test_repeat_detection_ignores_case_punctuation_and_spacing():
    asked = ["What is an   index?"]

    assert policy.is_repeat("WHAT is an index", asked)
    assert not policy.is_repeat("What is a hash index?", asked)


def test_an_off_topic_answer_gets_the_question_asked_again():
    step = decide(evaluation(is_on_topic=False, should_ask_followup=False, next_ai_question=""))

    assert step.kind == "FOLLOW_UP"
    assert "What is an index?" in step.text


def test_an_off_topic_answer_uses_the_models_re_ask_when_it_gives_one():
    step = decide(evaluation(is_on_topic=False, next_ai_question="Could you describe how an index is stored?"))

    assert (step.kind, step.text) == ("FOLLOW_UP", "Could you describe how an index is stored?")


def test_off_topic_answers_cannot_loop_forever():
    step = decide(evaluation(is_on_topic=False), used=2, cap=2)

    assert step.kind == "MAIN_QUESTION"
