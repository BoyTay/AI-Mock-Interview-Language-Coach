from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import InterviewSession, SessionMessage, UserProfile
from app.schemas.interview import (
    AnswerOut,
    AnswerVoice,
    InterviewReport,
    QuestionOut,
    StartInterviewOut,
    StartInterviewRequest,
)
from app.services import interview_policy, interview_report
from app.services.ai_interviewer import Turn
from app.services.audio_store import GEMINI_MIME_TYPES, AudioStore
from app.services.english_coach import Audio

SESSION_TYPE = "TECH_INTERVIEW"
COMPLETED = "COMPLETED"
MAIN_QUESTION = "MAIN_QUESTION"
FOLLOW_UP = "FOLLOW_UP"


def _question_out(message: SessionMessage, entry: dict, index: int, total: int) -> QuestionOut:
    return QuestionOut(
        message_id=message.id,
        type=message.question_type,
        text=message.content_text,
        category=entry["category"],
        difficulty=entry["difficulty"],
        index=index,
        total=total,
    )


def start_interview(db: Session, profile: UserProfile, rag, request: StartInterviewRequest) -> StartInterviewOut:
    target_role = request.target_role or profile.target_role
    picks = rag.retrieve(
        db,
        target_role=target_role,
        job_description=request.job_description,
        cv_text=profile.cv_text,
        difficulties=request.difficulties,
        limit=request.question_count,
    )
    if not picks:
        raise AppError(409, "QUESTION_BANK_EMPTY", "No interview questions available. Seed the question bank first.")

    plan = [
        {
            "id": q.id,
            "category": q.category,
            "difficulty": q.difficulty,
            "question_text": q.question_text,
            "reference_answer": q.reference_answer,
        }
        for q in picks
    ]
    session = InterviewSession(
        user_id=profile.id,
        session_type=SESSION_TYPE,
        target_role=target_role,
        job_description=request.job_description,
        question_plan=plan,
    )
    db.add(session)
    db.flush()
    first = SessionMessage(
        session_id=session.id, sender="AI", question_type=MAIN_QUESTION, content_text=plan[0]["question_text"]
    )
    db.add(first)
    db.commit()
    return StartInterviewOut(session_id=session.id, question=_question_out(first, plan[0], 1, len(plan)))


def _load_owned_session(db: Session, profile: UserProfile, session_id: int) -> InterviewSession:
    session = db.get(InterviewSession, session_id)
    # Someone else's session is reported as missing, so ids cannot be probed.
    if session is None or session.user_id != profile.id:
        raise AppError(404, "SESSION_NOT_FOUND", "Interview session not found")
    return session


@dataclass
class _PendingTurn:
    """The question waiting for an answer, and what the model needs to know about it."""

    session: InterviewSession
    history: list[SessionMessage]
    pending: SessionMessage
    plan: list
    entry: dict
    main_index: int
    thread: list[SessionMessage]
    followups_used: int


def _open_turn(db: Session, profile: UserProfile, session_id: int) -> _PendingTurn:
    session = _load_owned_session(db, profile, session_id)
    if session.status != "IN_PROGRESS":
        raise AppError(409, "SESSION_NOT_ACTIVE", "This interview session is not in progress")

    history = _history(db, session)
    pending = history[-1] if history else None
    if pending is None or pending.sender != "AI":
        raise AppError(409, "NO_PENDING_QUESTION", "There is no question waiting for an answer")

    plan = session.question_plan or []
    main_positions = [i for i, m in enumerate(history) if m.sender == "AI" and m.question_type == MAIN_QUESTION]
    main_index = len(main_positions) - 1
    thread = history[main_positions[-1] :]
    return _PendingTurn(
        session=session,
        history=history,
        pending=pending,
        plan=plan,
        entry=plan[main_index],
        main_index=main_index,
        thread=thread,
        followups_used=sum(1 for m in thread if m.sender == "AI" and m.question_type == FOLLOW_UP),
    )


def _turn_for(turn: _PendingTurn, answer: str) -> Turn:
    return Turn(
        question=turn.entry["question_text"],
        category=turn.entry["category"],
        difficulty=turn.entry["difficulty"],
        reference_answer=turn.entry["reference_answer"],
        thread=[(m.sender, m.content_text) for m in turn.thread],
        answer=answer,
        followups_used=turn.followups_used,
        max_followups=interview_policy.MAX_FOLLOWUPS,
    )


def _decide(turn: _PendingTurn, evaluation) -> interview_policy.NextStep:
    return interview_policy.decide_next(
        evaluation,
        followups_used=turn.followups_used,
        max_followups=interview_policy.MAX_FOLLOWUPS,
        asked_questions=[m.content_text for m in turn.history if m.sender == "AI"],
        has_next_main=turn.main_index + 1 < len(turn.plan),
        main_question=turn.entry["question_text"],
    )


def _add_answer(
    db: Session,
    turn: _PendingTurn,
    step: interview_policy.NextStep,
    *,
    text: str,
    evaluation: dict,
    audio_path: str | None = None,
) -> tuple[SessionMessage, QuestionOut | None]:
    """Stage the answer and the question that follows it. The caller commits."""
    answer_message = SessionMessage(
        session_id=turn.session.id,
        sender="USER",
        question_type=turn.pending.question_type,
        content_text=text,
        audio_path=audio_path,
        evaluation=evaluation,
    )
    db.add(answer_message)
    next_question = None
    if step.kind == FOLLOW_UP:
        message = SessionMessage(
            session_id=turn.session.id, sender="AI", question_type=FOLLOW_UP, content_text=step.text
        )
        db.add(message)
        db.flush()
        next_question = _question_out(message, turn.entry, turn.main_index + 1, len(turn.plan))
    elif step.kind == MAIN_QUESTION:
        upcoming = turn.plan[turn.main_index + 1]
        message = SessionMessage(
            session_id=turn.session.id,
            sender="AI",
            question_type=MAIN_QUESTION,
            content_text=upcoming["question_text"],
        )
        db.add(message)
        db.flush()
        next_question = _question_out(message, upcoming, turn.main_index + 2, len(turn.plan))
    db.flush()
    return answer_message, next_question


def submit_answer(db: Session, profile: UserProfile, interviewer, session_id: int, answer: str) -> AnswerOut:
    turn = _open_turn(db, profile, session_id)

    # Judge first and write afterwards: if the model fails, nothing is stored and the answer can be resent.
    evaluation = interviewer.evaluate(_turn_for(turn, answer))
    step = _decide(turn, evaluation)
    _, next_question = _add_answer(db, turn, step, text=answer, evaluation=evaluation.model_dump())
    db.commit()

    return AnswerOut(evaluation=evaluation, next_question=next_question, session_complete=next_question is None)


def submit_voice_answer(
    db: Session, profile: UserProfile, interviewer, store: AudioStore, session_id: int, data: bytes, mime_type: str
) -> AnswerOut:
    """Answer by voice: the model hears `data` (already checked to be `mime_type` audio) and writes the transcript."""
    turn = _open_turn(db, profile, session_id)

    # Judge first and write afterwards, as for a typed answer: a failed call leaves no message and no file.
    evaluation = interviewer.evaluate_voice(_turn_for(turn, ""), Audio(data, GEMINI_MIME_TYPES[mime_type]))
    transcript = evaluation.transcript.strip()
    if not transcript:
        raise AppError(422, "NO_SPEECH_DETECTED", "We couldn't hear any speech in the recording. Please record again.")
    step = _decide(turn, evaluation)

    audio_path = store.save(session_id, data, mime_type)
    try:
        answer_message, next_question = _add_answer(
            db, turn, step, text=transcript, evaluation=evaluation.model_dump(), audio_path=audio_path
        )
        db.commit()
    except Exception:
        db.rollback()
        store.delete(audio_path)
        raise

    return AnswerOut(
        evaluation=evaluation.as_text_evaluation(),
        next_question=next_question,
        session_complete=next_question is None,
        voice=AnswerVoice(
            message_id=answer_message.id,
            transcript=transcript,
            fluency_score=evaluation.fluency_score,
            pronunciation_notes=evaluation.pronunciation_notes,
            filler_words=evaluation.filler_words,
        ),
    )


def get_answer_audio(
    db: Session, profile: UserProfile, store: AudioStore, session_id: int, message_id: int
) -> tuple[Path, str]:
    """The recording of one of the caller's spoken answers, and its media type."""
    session = _load_owned_session(db, profile, session_id)
    message = db.get(SessionMessage, message_id)
    if message is None or message.session_id != session.id or message.sender != "USER" or not message.audio_path:
        raise AppError(404, "AUDIO_NOT_FOUND", "Recording not found")
    return store.open_path(message.audio_path), store.media_type(message.audio_path)


def _history(db: Session, session: InterviewSession) -> list[SessionMessage]:
    return db.scalars(
        select(SessionMessage).where(SessionMessage.session_id == session.id).order_by(SessionMessage.id)
    ).all()


def _previous_scores(db: Session, profile: UserProfile, session: InterviewSession) -> list[float]:
    rows = db.scalars(
        select(InterviewSession.overall_score).where(
            InterviewSession.user_id == profile.id,
            InterviewSession.session_type == SESSION_TYPE,
            InterviewSession.status == COMPLETED,
            InterviewSession.id != session.id,
            InterviewSession.overall_score.is_not(None),
        )
    ).all()
    return [float(score) for score in rows]


def finish_interview(db: Session, profile: UserProfile, writer, session_id: int) -> InterviewReport:
    session = _load_owned_session(db, profile, session_id)
    if session.status == COMPLETED and session.feedback_summary:
        # Already finished: hand back the stored report instead of asking the model again.
        return InterviewReport.model_validate(session.feedback_summary)
    if session.status != "IN_PROGRESS":
        raise AppError(409, "SESSION_NOT_ACTIVE", "This interview session is not in progress")

    history = _history(db, session)
    groups = interview_report.group_turns(history, session.question_plan or [])
    if not groups:
        raise AppError(409, "NO_ANSWERS", "Answer at least one question before finishing the interview")

    # Summarise first and write afterwards: if the model fails the session stays open and finish can be retried.
    synthesis = writer.write(session.target_role or profile.target_role, groups)
    comparison = interview_report.compare_with_previous(
        interview_report.overall_score(groups), _previous_scores(db, profile, session)
    )
    last = history[-1].created_at
    duration = int(max((last - session.created_at).total_seconds(), 0)) if last and session.created_at else None
    report = interview_report.build_report(session, groups, synthesis, comparison, duration)

    session.status = COMPLETED
    session.overall_score = Decimal(str(report.overall_score))
    session.feedback_summary = report.model_dump(mode="json")
    db.commit()
    return report


def get_report(db: Session, profile: UserProfile, session_id: int) -> InterviewReport:
    session = _load_owned_session(db, profile, session_id)
    if session.status != COMPLETED or not session.feedback_summary:
        raise AppError(409, "REPORT_NOT_READY", "Finish the interview to get its report")
    return InterviewReport.model_validate(session.feedback_summary)
