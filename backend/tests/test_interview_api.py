from sqlalchemy import select

from app.api.routes_interview import get_rag_service
from app.core.errors import AppError
from app.main import app
from app.models import InterviewSession, SessionMessage, UserProfile
from tests.interview_helpers import FakeRag, answer, evaluation, follow_up, messages, start


# --- start ---


def test_start_creates_a_session_and_returns_the_first_question(client, db_session, rag):
    body = start(client)

    session = db_session.get(InterviewSession, body["session_id"])
    assert session.session_type == "TECH_INTERVIEW"
    assert session.status == "IN_PROGRESS"
    assert body["question"]["text"] == "Main question 1?"
    assert body["question"]["type"] == "MAIN_QUESTION"
    assert (body["question"]["index"], body["question"]["total"]) == (1, 6)
    (first,) = messages(db_session, session.id)
    assert (first.sender, first.question_type, first.content_text) == ("AI", "MAIN_QUESTION", "Main question 1?")
    assert body["question"]["message_id"] == first.id


def test_start_retrieves_six_questions_for_the_profile_role_and_cv_by_default(client, db_session, rag):
    profile = db_session.scalars(select(UserProfile)).first()
    profile.cv_text = "Built payment services."
    db_session.commit()

    start(client, job_description="Spring Boot and PostgreSQL")

    call = rag.calls[0]
    assert call["target_role"] == "Java Backend Developer"
    assert call["job_description"] == "Spring Boot and PostgreSQL"
    assert call["cv_text"] == "Built payment services."
    assert call["limit"] == 6


def test_start_accepts_a_role_and_question_count_and_difficulty(client, rag):
    body = start(client, target_role="React Developer", question_count=3, difficulties=["MID"])

    call = rag.calls[0]
    assert (call["target_role"], call["limit"], call["difficulties"]) == ("React Developer", 3, ["MID"])
    assert body["question"]["total"] == 3


def test_start_keeps_a_snapshot_of_the_chosen_questions(client, db_session, rag):
    body = start(client)

    plan = db_session.get(InterviewSession, body["session_id"]).question_plan
    assert [q["question_text"] for q in plan] == [f"Main question {n}?" for n in range(1, 7)]
    assert plan[0]["reference_answer"] == "Reference answer 1."


def test_start_fails_clearly_when_the_question_bank_is_empty(client, db_session):
    app.dependency_overrides[get_rag_service] = lambda: FakeRag([])

    response = client.post("/api/v1/interviews/start", json={})

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "QUESTION_BANK_EMPTY"
    assert db_session.scalars(select(InterviewSession)).all() == []


def test_start_rejects_an_unreasonable_question_count(client, rag):
    assert client.post("/api/v1/interviews/start", json={"question_count": 0}).status_code == 422
    assert client.post("/api/v1/interviews/start", json={"question_count": 50}).status_code == 422


# --- answer ---


def test_answering_returns_the_evaluation_and_the_next_main_question(client, db_session, rag, use_interviewer):
    use_interviewer(evaluation(technical_accuracy_score=82, critique="Tốt."))
    session_id = start(client)["session_id"]

    response = answer(client, session_id, "An index is a sorted structure.")

    assert response.status_code == 200
    body = response.json()
    assert body["evaluation"]["technical_accuracy_score"] == 82
    assert body["evaluation"]["critique"] == "Tốt."
    assert body["next_question"]["text"] == "Main question 2?"
    assert body["next_question"]["type"] == "MAIN_QUESTION"
    assert body["next_question"]["index"] == 2
    assert body["session_complete"] is False


def test_every_turn_is_stored_with_its_type_and_the_evaluation(client, db_session, rag, use_interviewer):
    use_interviewer(follow_up("What about writes?"))
    session_id = start(client)["session_id"]

    answer(client, session_id, "An index is a sorted structure.")

    first, reply, follow = messages(db_session, session_id)
    assert (reply.sender, reply.question_type, reply.content_text) == (
        "USER",
        "MAIN_QUESTION",
        "An index is a sorted structure.",
    )
    assert reply.evaluation["technical_accuracy_score"] == 70
    assert reply.evaluation["critique"] == "Nhận xét."
    assert (follow.sender, follow.question_type, follow.content_text) == ("AI", "FOLLOW_UP", "What about writes?")
    assert follow.evaluation is None


def test_the_model_gets_the_question_reference_answer_and_conversation(client, rag, use_interviewer):
    interviewer = use_interviewer(follow_up("What about writes?"), evaluation())
    session_id = start(client)["session_id"]

    answer(client, session_id, "First answer.")
    answer(client, session_id, "Second answer.")

    first, second = interviewer.turns
    assert (first.question, first.reference_answer, first.answer) == (
        "Main question 1?",
        "Reference answer 1.",
        "First answer.",
    )
    assert first.thread == [("AI", "Main question 1?")]
    assert first.followups_used == 0 and first.max_followups == 2
    assert second.question == "Main question 1?"
    assert second.thread == [("AI", "Main question 1?"), ("USER", "First answer."), ("AI", "What about writes?")]
    assert second.followups_used == 1


def test_at_most_two_follow_ups_per_main_question(client, rag, use_interviewer):
    use_interviewer(follow_up("Follow-up A?"), follow_up("Follow-up B?"), follow_up("Follow-up C?"))
    session_id = start(client)["session_id"]

    kinds = [answer(client, session_id).json()["next_question"]["type"] for _ in range(3)]

    assert kinds == ["FOLLOW_UP", "FOLLOW_UP", "MAIN_QUESTION"]


def test_a_follow_up_does_not_advance_the_question_number(client, rag, use_interviewer):
    use_interviewer(follow_up("Follow-up A?"))
    session_id = start(client)["session_id"]

    next_question = answer(client, session_id).json()["next_question"]

    assert (next_question["index"], next_question["total"]) == (1, 6)


def test_a_repeated_follow_up_is_replaced_by_the_next_main_question(client, rag, use_interviewer):
    use_interviewer(follow_up("main question 1"))
    session_id = start(client)["session_id"]

    next_question = answer(client, session_id).json()["next_question"]

    assert next_question["type"] == "MAIN_QUESTION"


def test_an_off_topic_answer_is_asked_again_and_scored_low(client, db_session, rag, use_interviewer):
    use_interviewer(evaluation(is_on_topic=False, technical_accuracy_score=0, communication_clarity_score=0))
    session_id = start(client)["session_id"]

    body = answer(client, session_id, "I like football.").json()

    assert body["evaluation"]["is_on_topic"] is False
    assert body["next_question"]["type"] == "FOLLOW_UP"
    assert "Main question 1?" in body["next_question"]["text"]


def test_an_empty_answer_is_rejected_and_not_stored(client, db_session, rag, use_interviewer):
    interviewer = use_interviewer()
    session_id = start(client)["session_id"]

    for text in ("", "   \n "):
        assert answer(client, session_id, text).status_code == 422

    assert interviewer.turns == []
    assert len(messages(db_session, session_id)) == 1


def test_a_failed_evaluation_stores_nothing_so_the_answer_can_be_resent(client, db_session, rag, use_interviewer):
    use_interviewer(AppError(502, "AI_INVALID_RESPONSE", "bad"), evaluation())
    session_id = start(client)["session_id"]

    assert answer(client, session_id).status_code == 502
    assert len(messages(db_session, session_id)) == 1
    assert answer(client, session_id).status_code == 200


def test_a_six_question_interview_runs_end_to_end_with_a_follow_up(client, db_session, rag, use_interviewer):
    use_interviewer(follow_up("Can you give an example?"), evaluation())
    session_id = start(client)["session_id"]

    seen = []
    for _ in range(7):  # 6 main questions + 1 follow-up
        body = answer(client, session_id, "An answer.").json()
        seen.append(body["next_question"]["type"] if body["next_question"] else "END")

    assert seen == [
        "FOLLOW_UP",
        "MAIN_QUESTION",
        "MAIN_QUESTION",
        "MAIN_QUESTION",
        "MAIN_QUESTION",
        "MAIN_QUESTION",
        "END",
    ]
    assert body["session_complete"] is True
    stored = messages(db_session, session_id)
    ai_types = [m.question_type for m in stored if m.sender == "AI"]
    assert ai_types.count("MAIN_QUESTION") == 6
    assert ai_types.count("FOLLOW_UP") == 1
    assert len([m for m in stored if m.sender == "USER"]) == 7
    assert answer(client, session_id).status_code == 409


# --- ownership and state ---


def test_another_users_session_looks_like_it_does_not_exist(client, db_session, rag, use_interviewer):
    use_interviewer()
    other = UserProfile(full_name="Someone Else", target_role="Dev")
    db_session.add(other)
    db_session.flush()
    foreign = InterviewSession(user_id=other.id, session_type="TECH_INTERVIEW", question_plan=[])
    db_session.add(foreign)
    db_session.commit()

    response = answer(client, foreign.id)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SESSION_NOT_FOUND"


def test_an_unknown_session_is_404(client, rag, use_interviewer):
    use_interviewer()

    assert answer(client, 99999).status_code == 404


def test_a_finished_session_does_not_accept_answers(client, db_session, rag, use_interviewer):
    use_interviewer()
    session_id = start(client)["session_id"]
    db_session.get(InterviewSession, session_id).status = "COMPLETED"
    db_session.commit()

    response = answer(client, session_id)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "SESSION_NOT_ACTIVE"
