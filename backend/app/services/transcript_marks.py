import math
import re
from dataclasses import dataclass

# A word is a run of letters and digits, with single apostrophes allowed inside it ("don't"); the underscore
# that \w allows is not a letter, and an apostrophe at either edge ('login') is quoting, not part of the word.
_WORD = re.compile(r"[^\W_]+(?:['’][^\W_]+)*")


class MarkPlacementError(ValueError):
    """A mark cannot be placed on the transcript. The message names the mark and the problem."""


@dataclass(frozen=True)
class Token:
    start: int
    end: int
    norm: str


@dataclass(frozen=True)
class PlacedSpan:
    start: int
    end: int


def tokenize(text: str) -> list[Token]:
    return [
        Token(m.start(), m.end(), m.group().lower().replace("’", "'"))
        for m in _WORD.finditer(text)
    ]


def count_words(text: str) -> int:
    return len(tokenize(text))


def find_all(transcript: str, text: str) -> list[PlacedSpan]:
    """Every place `text` appears in `transcript` as whole words, ignoring case and punctuation."""
    needle = [t.norm for t in tokenize(text)]
    if not needle:
        return []
    tokens = tokenize(transcript)
    norms = [t.norm for t in tokens]
    size = len(needle)
    return [
        PlacedSpan(tokens[i].start, tokens[i + size - 1].end)
        for i in range(len(tokens) - size + 1)
        if norms[i : i + size] == needle
    ]


def overlaps(a: PlacedSpan, b: PlacedSpan) -> bool:
    return a.start < b.end and b.start < a.end


def place(transcript: str, text: str, occurrence: int, taken: list[PlacedSpan]) -> PlacedSpan:
    if not tokenize(text):
        raise MarkPlacementError(f'Mark "{text}" has no words to place.')
    if occurrence < 1:
        raise MarkPlacementError(f'Mark "{text}" has occurrence {occurrence}; it starts at 1.')

    found = find_all(transcript, text)
    if len(found) < occurrence:
        raise MarkPlacementError(
            f'Mark "{text}" occurrence {occurrence} is not in the transcript ({len(found)} found).'
        )

    span = found[occurrence - 1]
    if any(overlaps(span, t) for t in taken):
        raise MarkPlacementError(f'Mark "{text}" would overlap another mark.')
    return span


def overall_band(scores: list[float]) -> float:
    # Nearest half band, with a quarter or three quarters rounding up.
    return math.floor(sum(scores) / len(scores) * 2 + 0.5) / 2


def words_per_minute(word_count: int, duration_seconds: int) -> int:
    return round(word_count * 60 / duration_seconds)
