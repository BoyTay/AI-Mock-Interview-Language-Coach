from collections.abc import Callable

from fastapi import Request
from fastapi.concurrency import run_in_threadpool
from starlette.datastructures import FormData, UploadFile

from app.core.errors import AppError
from app.services.audio_probe import AudioProbeUnavailable, AudioUnreadable, probe_duration
from app.services.audio_store import MAX_AUDIO_BYTES, read_audio, sniff_audio_type

# Room for the multipart boundaries and headers around a recording of the maximum size.
_MULTIPART_OVERHEAD_BYTES = 64 * 1024


async def open_form(request: Request) -> FormData:
    """Parse the multipart body, refusing one that announces itself as far too big first."""
    # Refuse before the multipart parser spools the body to disk.
    if int(request.headers.get("content-length") or 0) > MAX_AUDIO_BYTES + _MULTIPART_OVERHEAD_BYTES:
        raise AppError(413, "AUDIO_TOO_LARGE", "The recording is too large. The limit is 10 MB.")
    return await request.form()


async def read_audio_field(form: FormData) -> tuple[bytes, str]:
    """The recording from the multipart `audio` field and its type, judged by its bytes."""
    upload = form.get("audio")
    if not isinstance(upload, UploadFile):
        raise AppError(422, "AUDIO_REQUIRED", "Attach the recording in the 'audio' form field")
    data = await run_in_threadpool(read_audio, upload)
    mime_type = sniff_audio_type(data)
    if mime_type is None:
        raise AppError(415, "UNSUPPORTED_AUDIO_TYPE", "Send the recording as webm, mp4, ogg or wav audio")
    return data, mime_type


AudioProbe = Callable[[bytes], float]


def get_audio_probe() -> AudioProbe:
    return probe_duration


def measure(
    probe: AudioProbe, data: bytes, *, max_seconds: float, max_label: str, min_seconds: float | None = None
) -> float:
    """The recording's real length, or a 422/503 when it cannot be measured or is outside the limits. Blocks."""
    try:
        seconds = probe(data)
    except AudioUnreadable as error:
        raise AppError(422, "AUDIO_UNREADABLE", "We could not read this recording. Please record again.") from error
    except AudioProbeUnavailable as error:
        raise AppError(
            503, "AUDIO_PROBE_UNAVAILABLE", "The server cannot check recordings right now. Please try again later."
        ) from error
    if min_seconds is not None and seconds < min_seconds:
        raise AppError(
            422, "AUDIO_TOO_SHORT", "This recording is shorter than 30 seconds. Please record a longer answer."
        )
    if seconds > max_seconds:
        raise AppError(
            422,
            "AUDIO_TOO_LONG",
            f"This recording is longer than the limit of {max_label}. Please record a shorter answer.",
        )
    return seconds
