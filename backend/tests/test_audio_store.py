import io

import pytest
from fastapi import UploadFile

from app.core.errors import AppError
from app.services.audio_store import (
    GEMINI_MIME_TYPES,
    MAX_AUDIO_BYTES,
    AudioStore,
    read_audio,
    sniff_audio_type,
)
from tests.interview_helpers import mp4_bytes, ogg_bytes, wav_bytes, webm_bytes


@pytest.mark.parametrize(
    ("data", "expected"),
    [
        (webm_bytes(), "audio/webm"),
        (mp4_bytes(), "audio/mp4"),
        (ogg_bytes(), "audio/ogg"),
        (wav_bytes(), "audio/wav"),
        (b"%PDF-1.7 not audio", None),
        (b"", None),
        (b"RIFF\x00\x00\x00\x00AVI LIST", None),
    ],
)
def test_the_audio_type_comes_from_the_bytes(data, expected):
    assert sniff_audio_type(data) == expected


def test_safari_mp4_is_labelled_m4a_for_gemini_and_the_others_keep_their_type():
    assert GEMINI_MIME_TYPES == {
        "audio/webm": "audio/webm",
        "audio/mp4": "audio/m4a",
        "audio/ogg": "audio/ogg",
        "audio/wav": "audio/wav",
    }


class CountingFile(io.BytesIO):
    def __init__(self, data):
        super().__init__(data)
        self.bytes_read = 0

    def read(self, size=-1):
        chunk = super().read(size)
        self.bytes_read += len(chunk)
        return chunk


def upload(data):
    return UploadFile(file=CountingFile(data), filename="answer.webm")


def test_an_upload_at_the_limit_is_read_whole():
    data = webm_bytes(b"x" * (MAX_AUDIO_BYTES - 4))

    assert read_audio(upload(data)) == data


def test_an_oversized_upload_is_413_and_is_not_read_to_the_end():
    file = upload(webm_bytes(b"x" * (MAX_AUDIO_BYTES + 5 * 1024 * 1024)))

    with pytest.raises(AppError) as exc:
        read_audio(file)

    assert exc.value.status_code == 413
    assert exc.value.code == "AUDIO_TOO_LARGE"
    assert file.file.bytes_read <= MAX_AUDIO_BYTES + 1024 * 1024


def test_saved_audio_is_filed_under_its_session_and_can_be_read_back(tmp_path):
    store = AudioStore(tmp_path)

    relative = store.save("interviews/7", webm_bytes(), "audio/webm")

    assert relative.startswith("interviews/7/") and relative.endswith(".webm")
    assert "\\" not in relative
    assert store.open_path(relative).read_bytes() == webm_bytes()
    assert store.media_type(relative) == "audio/webm"


def test_save_puts_the_file_under_the_given_folder(tmp_path):
    store = AudioStore(tmp_path)

    relative = store.save("speaking/1", webm_bytes(), "audio/webm")

    assert relative.startswith("speaking/1/") and relative.endswith(".webm")
    assert store.open_path(relative).read_bytes() == webm_bytes()


def test_each_saved_recording_gets_its_own_file(tmp_path):
    store = AudioStore(tmp_path)

    assert store.save("interviews/1", webm_bytes(), "audio/webm") != store.save("interviews/1", webm_bytes(), "audio/webm")


@pytest.mark.parametrize("relative", ["../../etc/passwd", "interviews/1/missing.webm", "/etc/passwd", ""])
def test_a_missing_file_or_a_path_outside_the_store_is_404(tmp_path, relative):
    with pytest.raises(AppError) as exc:
        AudioStore(tmp_path).open_path(relative)

    assert exc.value.status_code == 404
    assert exc.value.code == "AUDIO_NOT_FOUND"


def test_a_file_beside_the_store_cannot_be_reached_through_a_stored_path(tmp_path):
    root = tmp_path / "uploads"
    root.mkdir()
    (tmp_path / "secret.webm").write_bytes(b"secret")

    with pytest.raises(AppError) as exc:
        AudioStore(root).open_path("../secret.webm")

    assert exc.value.status_code == 404


def test_delete_removes_the_file_and_is_quiet_when_it_is_already_gone(tmp_path):
    store = AudioStore(tmp_path)
    relative = store.save("interviews/1", webm_bytes(), "audio/webm")

    store.delete(relative)
    store.delete(relative)

    with pytest.raises(AppError):
        store.open_path(relative)
