from app.schemas.english import MAX_ESSAY_CHARS, MIN_ESSAY_CHARS, SubmissionType
from evals.samples import SAMPLES


def test_has_eight_to_ten_samples_covering_band_5_to_8():
    bands = [s.reference_band for s in SAMPLES]

    assert 8 <= len(SAMPLES) <= 10
    assert min(bands) == 5.0
    assert max(bands) == 8.0


def test_reference_bands_are_half_steps_and_ids_are_unique():
    assert all(s.reference_band * 2 % 1 == 0 for s in SAMPLES)
    assert len({s.id for s in SAMPLES}) == len(SAMPLES)


def test_every_sample_is_an_ielts_essay_the_api_would_accept():
    for s in SAMPLES:
        assert s.task_type == SubmissionType.IELTS_TASK2
        assert MIN_ESSAY_CHARS <= len(s.essay) <= MAX_ESSAY_CHARS
        assert s.prompt_topic.strip()


def test_essays_reach_250_words_unless_the_reference_band_is_capped_at_5_5():
    for s in SAMPLES:
        assert len(s.essay.split()) >= 250 or s.reference_band <= 5.5, s.id


def test_planted_errors_appear_verbatim_in_their_essay():
    for s in SAMPLES:
        assert s.planted_errors, s.id
        for phrase in s.planted_errors:
            assert phrase in s.essay, f"{s.id}: {phrase!r}"


def test_weaker_essays_carry_more_planted_errors_than_the_strongest():
    by_band = sorted(SAMPLES, key=lambda s: s.reference_band)
    assert len(by_band[0].planted_errors) > len(by_band[-1].planted_errors)
