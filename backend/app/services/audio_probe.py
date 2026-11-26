"""Measuring how long a recording is with ffprobe, from the bytes alone."""
import os
import subprocess
import tempfile
from collections.abc import Callable

_TIMEOUT_SECONDS = 10
# A recording this short or shorter is treated as empty.
_MIN_SECONDS = 0.5


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
    """The recording's length in seconds, taken from its audio packets.

    The bytes go to a temporary file because ffprobe cannot read an mp4 whose index sits at the end from a pipe.
    The length is the end of the last audio packet, never a duration in the header: a header can be missing (a webm
    from the browser) or edited, and a file with no audio stream (a video-only webm) has no packets at all.
    A recording with no audio packets, or one of 0.5 seconds or less, is unreadable.
    """
    run = run or _run_ffprobe
    fd, path = tempfile.mkstemp(prefix="audio-probe-")
    try:
        with os.fdopen(fd, "wb") as file:
            file.write(data)
        try:
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
    if seconds <= _MIN_SECONDS:
        raise AudioUnreadable("the recording is empty")
    return seconds
