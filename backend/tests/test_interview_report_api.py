from decimal import Decimal

from sqlalchemy import select

from app.api.routes_interview import get_rag_service
from app.core.errors import AppError
from app.main import app
from app.models import InterviewSession, UserProfile
from tests.interview_helpers import (
    FakeRag,
    answer,
    bank_question,
    evaluation,
    finish,
    follow_up,
    get_report,
    start,
    synthesis_dict,
)


def run(client, scores, texts=None):
    """Start an interview and answer once per score (technical score), returning the session id."""
    session_id = start(client)["session_id"]
    for i, _ in enumerate(scores):
        answer(client, session_id, (texts or {}).get(i, f"My answer {i + 1}."))
    return session_id


def scored(*scores, **extra):
    return [evaluation(technical_accuracy_score=s, communication_clarity_score=80, **extra) for s in scores]


# --- finish: scores and storage ---


def test_finish_scores_the_interview_from_the_stored_evaluations(client, db_session, rag, use_interviewer, use_writer):
    use_interviewer(*scored(80, 60, 70))
    use_writer(synthesis_dict())
    session_id = run(client, [80, 60, 70])

    response = finish(client, session_id)

    assert response.status_code == 200
    body = response.json()
    assert body["overall_score"] == 70.0
    assert body["communication_score"] == 80.0
    assert [q["score"] for q in body["questions"]] == [80, 60, 70]
    assert (body["answered_questions"], body["total_questions"], body["finished_early"]) == (3, 6, True)
    assert body["target_role"] == "Java Backend Developer"


def test_finish_marks_the_session_completed_and_keeps_the_report(client, db_session, rag, use_interviewer, use_writer):
    use_interviewer(*scored(80))
    use_writer(synthesis_dict())
    session_id = run(client, [80])

    body = finish(client, session_id).json()

    session = db_session.get(InterviewSession, session_id)
    assert session.status == "COMPLETED"
    assert session.overall_score == Decimal("80.00")
    assert session.feedback_summary["overall_score"] == 80.0
    assert session.feedback_summary["headline"] == body["headline"]
    assert session.feedback_summary["questions"][0]["question"] == body["questions"][0]["question"]


def test_the_qualitative_parts_come_from_the_writer(client, rag, use_interviewer, use_writer):
    use_interviewer(*scored(80))
    writer = use_writer(synthesis_dict(headline="Rất tốt", summary="Tóm tắt."))
    session_id = run(client, [80])

    body = finish(client, session_id).json()

    assert (body["headline"], body["summary"]) == ("Rất tốt", "Tóm tắt.")
    assert body["strengths"] == [{"title": "Indexing", "text": "Nêu đúng đánh đổi."}]
    assert body["gaps"] == [{"title": "Atomics", "level": "High", "text": "Chưa nói về read-modify-write."}]
    assert writer.calls[0][0] == "Java Backend Developer"


# --- finish: STAR ---


def test_star_is_scored_as_a_percentage_of_the_four_letters(client, db_session, use_interviewer, use_writer):
    app.dependency_overrides[get_rag_service] = lambda: FakeRag([bank_question(1, "BEHAVIORAL"), bank_question(2)])
    use_interviewer(*scored(70))
    use_writer(synthesis_dict())
    session_id = run(client, [70])

    star = finish(client, session_id).json()["star"]

    assert star == {"percent": 75, "situation": True, "task": True, "action": True, "result": False, "note": "Thiếu kết quả."}


def test_star_is_left_out_when_no_behavioural_question_was_answered(client, rag, use_interviewer, use_writer):
    use_interviewer(*scored(70))
    use_writer(synthesis_dict())  # the model returns a STAR block anyway
    session_id = run(client, [70])

    assert finish(client, session_id).json()["star"] is None


# --- finish: per-question detail ---


def test_each_question_carries_its_turns_critique_and_reference(client, rag, use_interviewer, use_writer):
    use_interviewer(
        evaluation(
            technical_accuracy_score=70,
            critique="Thiếu chi phí ghi.",
            optimal_reference_answer="An index keeps keys sorted and costs writes.",
            should_ask_followup=True,
            next_ai_question="What does it cost?",
            extracted_mistake_card={"should_create": True, "front": "Cost of an index?", "back": "Slower writes."},
        ),
        evaluation(technical_accuracy_score=90, critique="Đúng."),
    )
    use_writer(synthesis_dict())
    session_id = start(client)["session_id"]
    answer(client, session_id, "It is a sorted thing.")
    answer(client, session_id, "Slower writes.")

    (question,) = finish(client, session_id).json()["questions"]

    assert question["number"] == 1
    assert (question["category"], question["difficulty"], question["question"]) == ("SQL", "MID", "Main question 1?")
    assert question["score"] == 80  # mean of 70 and 90
    assert [(t["type"], t["answer"], t["technical_score"], t["critique"]) for t in question["turns"]] == [
        ("MAIN_QUESTION", "It is a sorted thing.", 70, "Thiếu chi phí ghi."),
        ("FOLLOW_UP", "Slower writes.", 90, "Đúng."),
    ]
    assert question["turns"][1]["question"] == "What does it cost?"
    assert question["mistake_card"] == {"front": "Cost of an index?", "back": "Slower writes."}
    assert "".join(f["text"] for f in question["reference_answer"]) == "An index keeps keys sorted and costs writes."


def test_highlights_split_the_answer_and_unknown_quotes_are_dropped(client, rag, use_interviewer, use_writer):
    use_interviewer(evaluation(optimal_reference_answer="Keys stay sorted, so reads are fast."))
    use_writer(
        synthesis_dict(
            questions=[
                {
                    "question_number": 1,
                    "tags": [{"text": "Đúng ý chính", "tone": "good"}],
                    "answer_highlights": [
                        {"quote": "sorted thing", "kind": "gap"},
                        {"quote": "never said this", "kind": "error"},
                    ],
                    "reference_highlights": [{"quote": "reads are fast"}],
                }
            ]
        )
    )
    session_id = start(client)["session_id"]
    answer(client, session_id, "It is a sorted thing, I think.")

    (question,) = finish(client, session_id).json()["questions"]

    assert question["your_answer"] == [
        {"text": "It is a ", "kind": None},
        {"text": "sorted thing", "kind": "gap"},
        {"text": ", I think.", "kind": None},
    ]
    assert question["reference_answer"] == [
        {"text": "Keys stay sorted, so ", "kind": None},
        {"text": "reads are fast", "kind": "key"},
        {"text": ".", "kind": None},
    ]
    assert question["tags"] == [{"text": "Đúng ý chính", "tone": "good"}]


def test_a_question_the_writer_skipped_still_appears_without_highlights(client, rag, use_interviewer, use_writer):
    use_interviewer(*scored(75))
    use_writer(synthesis_dict(questions=[]))
    session_id = run(client, [75])

    (question,) = finish(client, session_id).json()["questions"]

    assert question["tags"] == []
    assert question["your_answer"] == [{"text": "My answer 1.", "kind": None}]


# --- finish: early finish, empty, repeat, failure ---


def test_finishing_early_scores_only_the_answered_questions(client, rag, use_interviewer, use_writer):
    use_interviewer(*scored(90, 50))
    writer = use_writer(synthesis_dict())
    session_id = run(client, [90, 50])  # a third question is now waiting unanswered

    body = finish(client, session_id).json()

    assert (body["answered_questions"], body["total_questions"], body["finished_early"]) == (2, 6, True)
    assert body["overall_score"] == 70.0
    assert [g.number for g in writer.calls[0][1]] == [1, 2]


def test_a_full_interview_is_not_flagged_as_finished_early(client, rag, use_interviewer, use_writer):
    use_interviewer(*scored(80))
    use_writer(synthesis_dict())
    session_id = run(client, [80] * 6)

    body = finish(client, session_id).json()

    assert (body["answered_questions"], body["finished_early"]) == (6, False)


def test_finishing_before_any_answer_is_refused_and_leaves_the_session_open(client, db_session, rag, use_writer):
    writer = use_writer(synthesis_dict())
    session_id = start(client)["session_id"]

    response = finish(client, session_id)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "NO_ANSWERS"
    assert writer.calls == []
    assert db_session.get(InterviewSession, session_id).status == "IN_PROGRESS"


def test_finishing_twice_returns_the_same_report_without_asking_the_model_again(client, rag, use_interviewer, use_writer):
    use_interviewer(*scored(80))
    writer = use_writer(synthesis_dict())
    session_id = run(client, [80])

    first = finish(client, session_id).json()
    second = finish(client, session_id).json()

    assert second == first
    assert len(writer.calls) == 1


def test_a_failed_summary_leaves_the_session_open_so_finish_can_be_retried(client, db_session, rag, use_interviewer, use_writer):
    use_interviewer(*scored(80))
    use_writer(AppError(502, "AI_INVALID_RESPONSE", "bad"), synthesis_dict())
    session_id = run(client, [80])

    assert finish(client, session_id).status_code == 502
    session = db_session.get(InterviewSession, session_id)
    assert (session.status, session.overall_score, session.feedback_summary) == ("IN_PROGRESS", None, None)
    assert finish(client, session_id).status_code == 200


def test_a_finished_session_takes_no_more_answers(client, rag, use_interviewer, use_writer):
    use_interviewer(*scored(80))
    use_writer(synthesis_dict())
    session_id = run(client, [80])
    finish(client, session_id)

    assert answer(client, session_id).status_code == 409


# --- comparison with earlier sessions ---


def test_the_first_finished_session_has_nothing_to_compare_with(client, rag, use_interviewer, use_writer):
    use_interviewer(*scored(80))
    use_writer(synthesis_dict())

    comparison = finish(client, run(client, [80])).json()["comparison"]

    assert comparison == {"previous_average": None, "previous_sessions": 0, "delta": None}


def test_a_session_is_compared_with_the_average_of_earlier_finished_sessions(client, rag, use_interviewer, use_writer):
    use_writer(synthesis_dict())
    for score in (70, 80):
        use_interviewer(*scored(score))
        finish(client, run(client, [score]))
    use_interviewer(*scored(90))

    comparison = finish(client, run(client, [90])).json()["comparison"]

    assert comparison == {"previous_average": 75.0, "previous_sessions": 2, "delta": 15.0}


def test_an_unfinished_session_does_not_count_as_an_earlier_one(client, rag, use_interviewer, use_writer):
    use_interviewer(*scored(60))
    use_writer(synthesis_dict())
    start(client)  # started, never finished
    session_id = run(client, [60])

    assert finish(client, session_id).json()["comparison"]["previous_sessions"] == 0


# --- report ---


def test_the_report_is_the_one_stored_at_finish(client, rag, use_interviewer, use_writer):
    use_interviewer(*scored(80, 60))
    use_writer(synthesis_dict())
    session_id = run(client, [80, 60])
    finished = finish(client, session_id).json()

    response = get_report(client, session_id)

    assert response.status_code == 200
    assert response.json() == finished


def test_the_report_is_not_ready_before_the_interview_is_finished(client, rag, use_interviewer):
    use_interviewer(*scored(80))
    session_id = run(client, [80])

    response = get_report(client, session_id)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "REPORT_NOT_READY"


def test_report_carries_a_duration(client, rag, use_interviewer, use_writer):
    use_interviewer(*scored(80))
    use_writer(synthesis_dict())

    body = finish(client, run(client, [80])).json()

    assert isinstance(body["duration_seconds"], int) and body["duration_seconds"] >= 0


# --- ownership ---


def test_another_users_session_cannot_be_finished_or_read(client, db_session, rag, use_writer):
    use_writer(synthesis_dict())
    other = UserProfile(full_name="Someone Else", target_role="Dev")
    db_session.add(other)
    db_session.flush()
    foreign = InterviewSession(
        user_id=other.id, session_type="TECH_INTERVIEW", status="COMPLETED", question_plan=[], feedback_summary={}
    )
    db_session.add(foreign)
    db_session.commit()

    for response in (finish(client, foreign.id), get_report(client, foreign.id)):
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "SESSION_NOT_FOUND"


def test_an_unknown_session_is_404_for_both_endpoints(client, rag, use_writer):
    use_writer(synthesis_dict())

    assert finish(client, 99999).status_code == 404
    assert get_report(client, 99999).status_code == 404
