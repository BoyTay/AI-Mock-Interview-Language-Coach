"""Fakes and call helpers shared by the interview API tests."""
from sqlalchemy import select

from app.models import SessionMessage
from app.schemas.interview import InterviewEvaluation
from app.services.rag_service import RetrievedQuestion


def bank_question(n, category="SQL"):
    return RetrievedQuestion(
        id=n,
        category=category,
        difficulty="MID",
        question_text=f"Main question {n}?",
        reference_answer=f"Reference answer {n}.",
        distance=0.3,
        keyword_score=0.0,
        score=0.7,
    )


class FakeRag:
    def __init__(self, questions):
        self.questions = questions
        self.calls = []

    def retrieve(self, session, **kwargs):
        self.calls.append(kwargs)
        return self.questions[: kwargs["limit"]]


def evaluation(**overrides):
    base = {
        "technical_accuracy_score": 70,
        "communication_clarity_score": 80,
        "star_method_compliance": None,
        "is_on_topic": True,
        "critique": "Nhận xét.",
        "optimal_reference_answer": "Optimal.",
        "should_ask_followup": False,
        "next_ai_question": "",
        "extracted_mistake_card": {"should_create": False, "front": "", "back": ""},
    }
    base.update(overrides)
    return InterviewEvaluation.model_validate(base)


def follow_up(text):
    return evaluation(should_ask_followup=True, next_ai_question=text)


class FakeInterviewer:
    """Hands out the scripted evaluations in order (the last one repeats) and records every turn."""

    def __init__(self, *evaluations):
        self.evaluations = list(evaluations) or [evaluation()]
        self.turns = []

    def evaluate(self, turn):
        self.turns.append(turn)
        item = self.evaluations.pop(0) if len(self.evaluations) > 1 else self.evaluations[0]
        if isinstance(item, Exception):
            raise item
        return item


def start(client, **body):
    response = client.post("/api/v1/interviews/start", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def answer(client, session_id, text="My answer."):
    return client.post(f"/api/v1/interviews/{session_id}/answer", json={"answer": text})


def messages(db_session, session_id):
    return db_session.scalars(
        select(SessionMessage).where(SessionMessage.session_id == session_id).order_by(SessionMessage.id)
    ).all()
