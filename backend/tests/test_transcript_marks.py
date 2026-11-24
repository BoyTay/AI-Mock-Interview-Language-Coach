import pytest

from app.services.transcript_marks import (
    MarkPlacementError,
    PlacedSpan,
    count_words,
    overall_band,
    place,
    words_per_minute,
)

T = "Yesterday I, um, finish the fix. I like it, um, like, really. Don’t worry."


def test_places_a_single_word():
    span = place(T, "finish", 1, [])
    assert T[span.start:span.end] == "finish"


def test_places_the_nth_occurrence():
    span = place(T, "um", 2, [])
    assert span.start == T.index("um", T.index("um") + 1)


def test_occurrence_counts_every_appearance_not_only_fillers():
    span = place(T, "like", 2, [])  # the first "like" is a verb
    assert span.start == T.index("like,")


def test_places_a_phrase_across_punctuation_and_case():
    span = place("So, You know, it works.", "you know", 1, [])
    assert span == PlacedSpan(4, 12)


def test_curly_and_straight_apostrophes_match():
    span = place(T, "don't", 1, [])
    assert T[span.start:span.end] == "Don’t"


def test_missing_text_is_rejected():
    with pytest.raises(MarkPlacementError, match="architecture"):
        place(T, "architecture", 1, [])


def test_too_high_occurrence_is_rejected():
    with pytest.raises(MarkPlacementError):
        place(T, "um", 3, [])


def test_occurrence_below_one_is_rejected():
    with pytest.raises(MarkPlacementError):
        place(T, "um", 0, [])


def test_text_without_words_is_rejected():
    with pytest.raises(MarkPlacementError):
        place(T, "...", 1, [])


def test_overlapping_marks_are_rejected():
    taken = [place(T, "I like", 1, [])]
    with pytest.raises(MarkPlacementError, match="overlap"):
        place(T, "like", 1, taken)


def test_adjacent_marks_are_allowed():
    taken = [place(T, "I", 1, [])]
    assert place(T, "um", 1, taken).start == T.index("um")


def test_vietnamese_words_are_tokenized():
    assert count_words("Hôm nay tôi fix bug") == 5


@pytest.mark.parametrize(
    "scores,band",
    [
        ([7, 6, 6.5, 6.5], 6.5),
        ([7, 7, 7, 6.5], 7.0),
        ([6, 6, 6.5, 6.5], 6.5),
        ([6, 6, 6, 6.5], 6.0),
        ([6, 6, 6, 6], 6.0),
    ],
)
def test_overall_band_rounds_quarters_up(scores, band):
    assert overall_band(scores) == band


def test_words_per_minute():
    assert words_per_minute(180, 84) == 129


def test_apostrophes_quoting_a_word_are_not_part_of_it():
    transcript = "I fixed the 'login' bug"
    span = place(transcript, "login", 1, [])
    assert transcript[span.start:span.end] == "login"


def test_a_lone_apostrophe_is_not_a_word():
    assert count_words("it ' s") == 2


def test_inner_apostrophes_are_kept_in_a_word():
    assert count_words("don't Don’t") == 2
    assert place("so don't go", "Don’t", 1, []).start == 3
