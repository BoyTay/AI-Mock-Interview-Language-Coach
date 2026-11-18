import json
from pathlib import Path

from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy.orm import Session
from starlette.datastructures import UploadFile

from app.api.routes_profile import get_default_profile
from app.core.config import get_settings
from app.core.database import get_db
from app.core.errors import AppError
from app.schemas.interview import (
    AnswerOut,
    AnswerRequest,
    InterviewReport,
    StartInterviewOut,
    StartInterviewRequest,
)
from app.services import interview_service
from app.services.ai_interviewer import Interviewer, Turn, build_interviewer
from app.services.audio_store import MAX_AUDIO_BYTES, AudioStore, read_audio, sniff_audio_type
from app.services.rag_service import RagService, build_rag_service
from app.services.report_writer import ReportWriter, build_report_writer

router = APIRouter(prefix="/interviews", tags=["interviews"])

# Room for the multipart boundaries and headers around a recording of the maximum size.
_MULTIPART_OVERHEAD_BYTES = 64 * 1024


class _LazyRag:
    """Builds the real service on first use, so a missing API key can't pre-empt request validation."""

    def retrieve(self, session, **kwargs):
        return build_rag_service(get_settings()).retrieve(session, **kwargs)


class _LazyInterviewer:
    def evaluate(self, turn: Turn):
        return build_interviewer(get_settings()).evaluate(turn)


class _LazyReportWriter:
    def write(self, role, groups):
        return build_report_writer(get_settings()).write(role, groups)


def get_rag_service() -> RagService:
    return _LazyRag()  # type: ignore[return-value]


def get_interviewer() -> Interviewer:
    return _LazyInterviewer()  # type: ignore[return-value]


def get_report_writer() -> ReportWriter:
    return _LazyReportWriter()  # type: ignore[return-value]


@router.post("/start", response_model=StartInterviewOut, status_code=201)
def start_interview(
    payload: StartInterviewRequest,
    db: Session = Depends(get_db),
    rag: RagService = Depends(get_rag_service),
) -> StartInterviewOut:
    return interview_service.start_interview(db, get_default_profile(db), rag, payload)


def get_audio_store() -> AudioStore:
    return AudioStore(Path(get_settings().upload_dir))


def _is_multipart(request: Request) -> bool:
    return request.headers.get("content-type", "").lower().startswith("multipart/form-data")


def _is_json(request: Request) -> bool:
    # Like FastAPI's own body parsing: a request that names no content type is read as JSON too.
    media_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    return media_type == "" or media_type == "application/json" or media_type.endswith("+json")


async def _read_json_answer(request: Request) -> AnswerRequest:
    """Parse the JSON body by hand, failing with the same 422 body FastAPI gives for a declared body."""
    raw = await request.body()
    if not raw:
        raise RequestValidationError([{"type": "missing", "loc": ("body",), "msg": "Field required", "input": None}])
    body: object = raw
    if _is_json(request):
        try:
            body = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise RequestValidationError(
                [{"type": "json_invalid", "loc": ("body", exc.pos), "msg": "JSON decode error", "input": {}}]
            ) from exc
    try:
        return AnswerRequest.model_validate(body)
    except ValidationError as exc:
        raise RequestValidationError([{**err, "loc": ("body", *err["loc"])} for err in exc.errors()]) from exc


_ANSWER_BODY = {
    "requestBody": {
        "required": True,
        "content": {
            "application/json": {"schema": AnswerRequest.model_json_schema()},
            "multipart/form-data": {
                "schema": {
                    "type": "object",
                    "properties": {"audio": {"type": "string", "format": "binary"}},
                    "required": ["audio"],
                }
            },
        },
    }
}


@router.post("/{session_id}/answer", response_model=AnswerOut, openapi_extra=_ANSWER_BODY)
async def answer_question(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    interviewer: Interviewer = Depends(get_interviewer),
    store: AudioStore = Depends(get_audio_store),
) -> AnswerOut:
    """Answer the pending question with text (JSON `{"answer": ...}`) or by voice (multipart field `audio`)."""
    if _is_multipart(request):
        data, mime_type = await _read_audio_upload(request)
        return await run_in_threadpool(
            _submit_voice, db, interviewer, store, session_id, data, mime_type
        )
    payload = await _read_json_answer(request)
    # The model call can take many seconds: run the blocking service off the event loop.
    return await run_in_threadpool(_submit_text, db, interviewer, session_id, payload.answer)


def _submit_text(db: Session, interviewer: Interviewer, session_id: int, answer: str) -> AnswerOut:
    return interview_service.submit_answer(db, get_default_profile(db), interviewer, session_id, answer)


def _submit_voice(
    db: Session, interviewer: Interviewer, store: AudioStore, session_id: int, data: bytes, mime_type: str
) -> AnswerOut:
    return interview_service.submit_voice_answer(
        db, get_default_profile(db), interviewer, store, session_id, data, mime_type
    )


async def _read_audio_upload(request: Request) -> tuple[bytes, str]:
    """The recording from the multipart `audio` field and its type, judged by its bytes."""
    # Refuse a body that announces itself as far too big before the multipart parser spools it to disk.
    if int(request.headers.get("content-length") or 0) > MAX_AUDIO_BYTES + _MULTIPART_OVERHEAD_BYTES:
        raise AppError(413, "AUDIO_TOO_LARGE", "The recording is too large. The limit is 10 MB.")
    form = await request.form()
    upload = form.get("audio")
    if not isinstance(upload, UploadFile):
        raise AppError(422, "AUDIO_REQUIRED", "Attach the recording in the 'audio' form field")
    data = await run_in_threadpool(read_audio, upload)
    mime_type = sniff_audio_type(data)
    if mime_type is None:
        raise AppError(415, "UNSUPPORTED_AUDIO_TYPE", "Send the recording as webm, mp4, ogg or wav audio")
    return data, mime_type


@router.get("/{session_id}/answers/{message_id}/audio")
def answer_audio(
    session_id: int,
    message_id: int,
    db: Session = Depends(get_db),
    store: AudioStore = Depends(get_audio_store),
) -> FileResponse:
    """Play back the recording of one of the caller's spoken answers."""
    path, media_type = interview_service.get_answer_audio(db, get_default_profile(db), store, session_id, message_id)
    return FileResponse(path, media_type=media_type)


@router.post("/{session_id}/finish", response_model=InterviewReport)
def finish_interview(
    session_id: int,
    db: Session = Depends(get_db),
    writer: ReportWriter = Depends(get_report_writer),
) -> InterviewReport:
    return interview_service.finish_interview(db, get_default_profile(db), writer, session_id)


@router.get("/{session_id}/report", response_model=InterviewReport)
def interview_report(session_id: int, db: Session = Depends(get_db)) -> InterviewReport:
    return interview_service.get_report(db, get_default_profile(db), session_id)
