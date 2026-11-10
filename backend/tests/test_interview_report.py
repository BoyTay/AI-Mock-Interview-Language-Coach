from types import SimpleNamespace

from app.services import interview_report as report

PLAN = [
    {"id": n, "category": "SQL", "difficulty": "MID", "question_text": f"Main {n}?", "reference_answer": f"Ref {n}."}
    for n in range(1, 4)
]


def ai(kind, text):
    return SimpleNamespace(sender="AI", question_type=kind, content_text=text, evaluation=None)


def user(kind, text, tech=70, clarity=80):
    evaluation = {"technical_accuracy_score": tech, "communication_clarity_score": clarity}
    return SimpleNamespace(sender="USER", question_type=kind, content_text=text, evaluation=evaluation)


def test_turns_are_grouped_under_their_main_question():
    messages = [
        ai("MAIN_QUESTION", "Main 1?"),
        user("MAIN_QUESTION", "Answer 1."),
        ai("FOLLOW_UP", "Why?"),
        user("FOLLOW_UP", "Because."),
        ai("MAIN_QUESTION", "Main 2?"),
        user("MAIN_QUESTION", "Answer 2."),
    ]

    groups = report.group_turns(messages, PLAN)

    assert [g.number for g in groups] == [1, 2]
    assert [t.type for t in groups[0].turns] == ["MAIN_QUESTION", "FOLLOW_UP"]
    assert [(t.question, t.answer) for t in groups[0].turns] == [("Main 1?", "Answer 1."), ("Why?", "Because.")]
    assert groups[0].entry["reference_answer"] == "Ref 1."


def test_a_question_that_was_asked_but_never_answered_is_left_out():
    messages = [
        ai("MAIN_QUESTION", "Main 1?"),
        user("MAIN_QUESTION", "Answer 1."),
        ai("MAIN_QUESTION", "Main 2?"),
    ]

    groups = report.group_turns(messages, PLAN)

    assert [g.number for g in groups] == [1]


def test_a_pending_follow_up_does_not_remove_an_answered_main_question():
    messages = [
        ai("MAIN_QUESTION", "Main 1?"),
        user("MAIN_QUESTION", "Answer 1."),
        ai("FOLLOW_UP", "Why?"),
    ]

    groups = report.group_turns(messages, PLAN)

    assert [len(g.turns) for g in groups] == [1]


def test_a_question_scores_the_mean_technical_score_of_its_answers():
    messages = [
        ai("MAIN_QUESTION", "Main 1?"),
        user("MAIN_QUESTION", "A", tech=60),
        ai("FOLLOW_UP", "Why?"),
        user("FOLLOW_UP", "B", tech=85),
    ]
    (group,) = report.group_turns(messages, PLAN)

    assert report.question_score(group) == 73  # 72.5 rounds up


def test_overall_and_communication_average_only_the_answered_questions():
    messages = [
        ai("MAIN_QUESTION", "Main 1?"),
        user("MAIN_QUESTION", "A", tech=80, clarity=90),
        ai("MAIN_QUESTION", "Main 2?"),
        user("MAIN_QUESTION", "B", tech=60, clarity=70),
        ai("MAIN_QUESTION", "Main 3?"),
    ]
    groups = report.group_turns(messages, PLAN)

    assert report.overall_score(groups) == 70.0
    assert report.communication_score(groups) == 80.0


def test_scores_round_to_two_and_one_decimals():
    messages = [
        ai("MAIN_QUESTION", "Main 1?"),
        user("MAIN_QUESTION", "A", tech=80, clarity=81),
        ai("MAIN_QUESTION", "Main 2?"),
        user("MAIN_QUESTION", "B", tech=81, clarity=80),
        ai("MAIN_QUESTION", "Main 3?"),
        user("MAIN_QUESTION", "C", tech=81, clarity=80),
    ]
    groups = report.group_turns(messages, PLAN)

    assert report.overall_score(groups) == 80.67
    assert report.communication_score(groups) == 80.3


# --- highlighted fragments ---


def texts(fragments):
    return [(f.text, f.kind) for f in fragments]


def test_text_without_highlights_is_one_plain_fragment():
    assert texts(report.split_fragments("Plain text.", [])) == [("Plain text.", None)]


def test_a_quote_becomes_its_own_fragment_between_plain_ones():
    fragments = report.split_fragments("It worked well. Then we left.", [("worked well", "gap")])

    assert texts(fragments) == [("It ", None), ("worked well", "gap"), (". Then we left.", None)]
    assert "".join(f.text for f in fragments) == "It worked well. Then we left."


def test_quotes_are_matched_ignoring_case():
    fragments = report.split_fragments("The Trade-off is slower writes.", [("trade-off", "gap")])

    assert texts(fragments)[1] == ("Trade-off", "gap")


def test_a_quote_that_is_not_in_the_text_is_dropped():
    fragments = report.split_fragments("Short answer.", [("something invented", "error")])

    assert texts(fragments) == [("Short answer.", None)]


def test_overlapping_quotes_keep_the_earlier_one():
    fragments = report.split_fragments("abcdefgh", [("abcd", "gap"), ("cdef", "error")])

    assert texts(fragments) == [("abcd", "gap"), ("efgh", None)]


def test_fragments_follow_the_order_of_the_text_not_of_the_quotes():
    fragments = report.split_fragments("one two three", [("three", "key"), ("one", "gap")])

    assert texts(fragments) == [("one", "gap"), (" two ", None), ("three", "key")]


def test_empty_quotes_are_ignored():
    assert texts(report.split_fragments("Text.", [("", "gap"), ("  ", "gap")])) == [("Text.", None)]
