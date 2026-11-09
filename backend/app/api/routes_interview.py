from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.routes_profile import get_default_profile
from app.core.config import get_settings
from app.core.database import get_db
from app.schemas.interview import AnswerOut, AnswerRequest, StartInterviewOut, StartInterviewRequest
from app.services import interview_service
from app.services.ai_interviewer import Interviewer, Turn, build_interviewer
from app.services.rag_service import RagService, build_rag_service

router = APIRouter(prefix="/interviews", tags=["interviews"])


class _LazyRag:
    """Builds the real service on first use, so a missing API key can't pre-empt request validation."""

    def retrieve(self, session, **kwargs):
        return build_rag_service(get_settings()).retrieve(session, **kwargs)


class _LazyInterviewer:
    def evaluate(self, turn: Turn):
        return build_interviewer(get_settings()).evaluate(turn)


def get_rag_service() -> RagService:
    return _LazyRag()  # type: ignore[return-value]


def get_interviewer() -> Interviewer:
    return _LazyInterviewer()  # type: ignore[return-value]


@router.post("/start", response_model=StartInterviewOut, status_code=201)
def start_interview(
    payload: StartInterviewRequest,
    db: Session = Depends(get_db),
    rag: RagService = Depends(get_rag_service),
) -> StartInterviewOut:
    return interview_service.start_interview(db, get_default_profile(db), rag, payload)


@router.post("/{session_id}/answer", response_model=AnswerOut)
def answer_question(
    session_id: int,
    payload: AnswerRequest,
    db: Session = Depends(get_db),
    interviewer: Interviewer = Depends(get_interviewer),
) -> AnswerOut:
    return interview_service.submit_answer(db, get_default_profile(db), interviewer, session_id, payload.answer)
