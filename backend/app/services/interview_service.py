from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import InterviewSession, SessionMessage, UserProfile
from app.schemas.interview import AnswerOut, InterviewReport, QuestionOut, StartInterviewOut, StartInterviewRequest
from app.services import interview_policy, interview_report
from app.services.ai_interviewer import Turn

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


def submit_answer(db: Session, profile: UserProfile, interviewer, session_id: int, answer: str) -> AnswerOut:
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
    entry = plan[main_index]
    thread = history[main_positions[-1] :]
    followups_used = sum(1 for m in thread if m.sender == "AI" and m.question_type == FOLLOW_UP)

    # Judge first and write afterwards: if the model fails, nothing is stored and the answer can be resent.
    evaluation = interviewer.evaluate(
        Turn(
            question=entry["question_text"],
            category=entry["category"],
            difficulty=entry["difficulty"],
            reference_answer=entry["reference_answer"],
            thread=[(m.sender, m.content_text) for m in thread],
            answer=answer,
            followups_used=followups_used,
            max_followups=interview_policy.MAX_FOLLOWUPS,
        )
    )
    step = interview_policy.decide_next(
        evaluation,
        followups_used=followups_used,
        max_followups=interview_policy.MAX_FOLLOWUPS,
        asked_questions=[m.content_text for m in history if m.sender == "AI"],
        has_next_main=main_index + 1 < len(plan),
        main_question=entry["question_text"],
    )

    db.add(
        SessionMessage(
            session_id=session.id,
            sender="USER",
            question_type=pending.question_type,
            content_text=answer,
            evaluation=evaluation.model_dump(),
        )
    )
    next_question = None
    if step.kind == FOLLOW_UP:
        message = SessionMessage(session_id=session.id, sender="AI", question_type=FOLLOW_UP, content_text=step.text)
        db.add(message)
        db.flush()
        next_question = _question_out(message, entry, main_index + 1, len(plan))
    elif step.kind == MAIN_QUESTION:
        upcoming = plan[main_index + 1]
        message = SessionMessage(
            session_id=session.id, sender="AI", question_type=MAIN_QUESTION, content_text=upcoming["question_text"]
        )
        db.add(message)
        db.flush()
        next_question = _question_out(message, upcoming, main_index + 2, len(plan))
    db.commit()

    return AnswerOut(evaluation=evaluation, next_question=next_question, session_complete=next_question is None)


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
