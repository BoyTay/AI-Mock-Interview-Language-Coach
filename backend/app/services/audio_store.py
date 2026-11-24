"""Accepting, storing and finding the recordings of spoken interview answers."""
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.core.errors import AppError

# Three minutes of browser audio is about 3 MB; this leaves room for a better codec setting.
MAX_AUDIO_BYTES = 10 * 1024 * 1024
_CHUNK_BYTES = 64 * 1024

_EXTENSIONS = {"audio/webm": "webm", "audio/mp4": "mp4", "audio/ogg": "ogg", "audio/wav": "wav"}
_MEDIA_TYPES = {extension: mime for mime, extension in _EXTENSIONS.items()}

# What each type is called when it is sent to Gemini. Its docs list audio/m4a, not audio/mp4 (Safari records
# mp4); that label has not been tried with a real Safari recording.
GEMINI_MIME_TYPES = {
    "audio/webm": "audio/webm",
    "audio/mp4": "audio/m4a",
    "audio/ogg": "audio/ogg",
    "audio/wav": "audio/wav",
}


def sniff_audio_type(data: bytes) -> str | None:
    """The type of audio the bytes are, from their first bytes; the client's declared type is not trusted."""
    if data[:4] == b"\x1a\x45\xdf\xa3":
        return "audio/webm"
    if data[4:8] == b"ftyp":
        return "audio/mp4"
    if data[:4] == b"OggS":
        return "audio/ogg"
    if data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return "audio/wav"
    return None


def read_audio(file: UploadFile) -> bytes:
    """Read the upload in chunks, giving up as soon as it is over MAX_AUDIO_BYTES."""
    chunks: list[bytes] = []
    total = 0
    while chunk := file.file.read(_CHUNK_BYTES):
        total += len(chunk)
        if total > MAX_AUDIO_BYTES:
            raise AppError(413, "AUDIO_TOO_LARGE", "The recording is too large. The limit is 10 MB.")
        chunks.append(chunk)
    return b"".join(chunks)


class AudioStore:
    """Recordings on disk under `root`, addressed by paths relative to it (what `audio_path` holds)."""

    def __init__(self, root: Path):
        self.root = Path(root)

    def save(self, folder: str, data: bytes, mime_type: str) -> str:
        """Write the recording under `folder` (relative to the root) and return its path relative to the root."""
        directory = self.root / folder
        directory.mkdir(parents=True, exist_ok=True)
        name = f"{uuid4().hex}.{_EXTENSIONS[mime_type]}"
        (directory / name).write_bytes(data)
        return f"{folder}/{name}"

    def open_path(self, relative: str) -> Path:
        """The file for a stored path; 404 when it is gone or the path leads outside the store."""
        missing = AppError(404, "AUDIO_NOT_FOUND", "Recording not found")
        if not relative:
            raise missing
        candidate = (self.root / relative).resolve()
        if not candidate.is_relative_to(self.root.resolve()) or not candidate.is_file():
            raise missing
        return candidate

    def media_type(self, relative: str) -> str:
        return _MEDIA_TYPES.get(Path(relative).suffix.lstrip("."), "application/octet-stream")

    def delete(self, relative: str) -> None:
        try:
            self.open_path(relative).unlink()
        except (AppError, FileNotFoundError):
            pass
