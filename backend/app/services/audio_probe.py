"""Measuring how long a recording is with ffprobe, from the bytes alone."""
import os
import subprocess
import tempfile
from collections.abc import Callable

_TIMEOUT_SECONDS = 10


class AudioUnreadable(Exception):
    """ffprobe could not read the bytes as audio."""


class AudioProbeUnavailable(Exception):
    """ffprobe is not installed, so the length cannot be measured."""


def _run_ffprobe(args: list[str]) -> str:
    result = subprocess.run(args, capture_output=True, text=True, timeout=_TIMEOUT_SECONDS, check=True)
    return result.stdout


def _number(text: str) -> float | None:
    try:
        return float(text)
    except ValueError:
        return None


def _format_duration(output: str) -> float | None:
    value = _number(output.strip())
    return value if value is not None and value > 0 else None


def _last_packet_end(output: str) -> float | None:
    """The largest pts_time + duration_time over the packet lines; a missing duration counts as 0."""
    end = None
    for line in output.splitlines():
        start, _, duration = line.strip().partition(",")
        start_time = _number(start)
        if start_time is None:
            continue
        stop = start_time + (_number(duration.strip(",")) or 0.0)
        end = stop if end is None else max(end, stop)
    return end


def probe_duration(data: bytes, run: Callable[[list[str]], str] | None = None) -> float:
    """The recording's length in seconds.

    The bytes go to a temporary file because ffprobe cannot read an mp4 whose index sits at the end from a pipe.
    A webm from the browser has no duration in its header, so the last audio packet's end is used then.
    """
    run = run or _run_ffprobe
    fd, path = tempfile.mkstemp(prefix="audio-probe-")
    try:
        with os.fdopen(fd, "wb") as file:
            file.write(data)
        try:
            seconds = _format_duration(
                run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path])
            )
            if seconds is None:
                seconds = _last_packet_end(
                    run([
                        "ffprobe", "-v", "error", "-select_streams", "a:0",
                        "-show_entries", "packet=pts_time,duration_time", "-of", "csv=p=0", path,
                    ])
                )
        except FileNotFoundError as error:
            raise AudioProbeUnavailable("ffprobe is not installed") from error
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
            raise AudioUnreadable("ffprobe could not read the recording") from error
    finally:
        os.unlink(path)
    if seconds is None:
        raise AudioUnreadable("the recording has no audio")
    return seconds
