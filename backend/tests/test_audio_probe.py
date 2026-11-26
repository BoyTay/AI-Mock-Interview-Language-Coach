import os
import shutil
import subprocess
import wave

import pytest

from app.services.audio_probe import AudioProbeUnavailable, AudioUnreadable, probe_duration


class FakeRun:
    """Stands in for ffprobe: records each call's args and returns scripted outputs (or raises them)."""

    def __init__(self, *outputs):
        self.outputs = list(outputs)
        self.calls: list[list[str]] = []
        self.seen_bytes: list[bytes] = []

    def __call__(self, args):
        self.calls.append(args)
        self.seen_bytes.append(open(args[-1], "rb").read())
        output = self.outputs.pop(0)
        if isinstance(output, BaseException):
            raise output
        return output


def test_format_duration_is_used():
    run = FakeRun("84.120000\n")

    assert probe_duration(b"audio-bytes", run) == pytest.approx(84.12)
    assert len(run.calls) == 1
    assert run.calls[0][0] == "ffprobe"
    assert run.seen_bytes[0] == b"audio-bytes"


def test_webm_without_duration_falls_back_to_the_last_packet():
    run = FakeRun("N/A\n", "0.000,0.020\n0.020,0.020\n83.980,0.020\n")

    assert probe_duration(b"x", run) == pytest.approx(84.0)
    assert len(run.calls) == 2
    assert "a:0" in run.calls[1]


def test_packet_without_a_duration_counts_as_zero():
    run = FakeRun("", "0.000,0.020\n5.000,\n")

    assert probe_duration(b"x", run) == pytest.approx(5.0)


def test_no_audio_packets_is_unreadable():
    run = FakeRun("N/A\n", "\n")

    with pytest.raises(AudioUnreadable):
        probe_duration(b"x", run)


def test_nonzero_exit_is_unreadable():
    run = FakeRun(subprocess.CalledProcessError(1, ["ffprobe"]))

    with pytest.raises(AudioUnreadable):
        probe_duration(b"x", run)


def test_timeout_is_unreadable():
    run = FakeRun(subprocess.TimeoutExpired(["ffprobe"], 10))

    with pytest.raises(AudioUnreadable):
        probe_duration(b"x", run)


def test_missing_binary_is_unavailable():
    run = FakeRun(FileNotFoundError("ffprobe"))

    with pytest.raises(AudioProbeUnavailable):
        probe_duration(b"x", run)


def test_temporary_file_is_deleted_afterwards():
    paths = []

    def run(args):
        paths.append(args[-1])
        assert os.path.exists(args[-1])
        return "1.5\n"

    probe_duration(b"x", run)

    assert not os.path.exists(paths[0])


def test_temporary_file_is_deleted_when_the_probe_fails():
    paths = []

    def run(args):
        paths.append(args[-1])
        raise subprocess.CalledProcessError(1, args)

    with pytest.raises(AudioUnreadable):
        probe_duration(b"x", run)

    assert not os.path.exists(paths[0])


@pytest.mark.skipif(shutil.which("ffprobe") is None, reason="ffprobe is not installed")
def test_real_ffprobe_measures_a_wav(tmp_path):
    path = tmp_path / "silence.wav"
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"\x00\x00" * int(16000 * 2.5))

    assert probe_duration(path.read_bytes()) == pytest.approx(2.5, abs=0.05)
