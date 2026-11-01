from app.schemas.english import SentenceCorrection
from evals.report import Result, format_report, mean_abs_error, mean_bias, noop_corrections, planted_recall
from evals.samples import Sample


def sample(id="s1", band=6.0, planted=("He go",)) -> Sample:
    return Sample(id=id, prompt_topic="Topic", essay="He go home.", reference_band=band, planted_errors=planted)


def correction(original: str, corrected: str) -> SentenceCorrection:
    return SentenceCorrection(
        original_sentence=original, corrected_sentence=corrected, error_category="Grammar", explanation="why"
    )


def result(s=None, band=6.0, attempts=1, corrections=(), error=None) -> Result:
    return Result(sample=s or sample(), band=band, attempts=attempts, corrections=list(corrections), error=error)


def test_mean_abs_error_is_the_average_distance_to_the_reference():
    results = [result(sample("a", 6.0), band=6.5), result(sample("b", 7.0), band=6.0), result(sample("c", 5.0), band=5.0)]

    assert mean_abs_error(results) == (0.5 + 1.0 + 0.0) / 3


def test_mean_bias_is_negative_when_the_ai_scores_lower():
    results = [result(sample("a", 6.0), band=5.0), result(sample("b", 7.0), band=6.5)]

    assert mean_bias(results) == -0.75


def test_failed_evaluations_are_left_out_of_the_error_averages():
    results = [result(sample("a", 6.0), band=6.5), result(sample("b", 7.0), band=None, error="AI_INVALID_RESPONSE")]

    assert mean_abs_error(results) == 0.5
    assert mean_bias(results) == 0.5


def test_averages_are_none_without_any_successful_result():
    failed = [result(band=None, error="RATE_LIMITED")]

    assert mean_abs_error(failed) is None
    assert mean_bias([]) is None


def test_planted_recall_counts_phrases_inside_a_flagged_sentence():
    s = sample(planted=("He go", "peoples is", "never flagged"))
    corrections = [correction("He go  home.", "He goes home."), correction("Many peoples is here.", "Many people are here.")]

    assert planted_recall(s, corrections) == (2, 3)


def test_planted_recall_with_no_corrections_finds_nothing():
    assert planted_recall(sample(planted=("a", "b")), []) == (0, 2)


def test_noop_corrections_counts_fixes_that_change_nothing():
    corrections = [correction("Fine sentence.", "Fine  sentence."), correction("He go.", "He goes.")]

    assert noop_corrections(corrections) == 1


def test_report_has_one_row_per_essay_with_both_bands_and_the_gap():
    results = [result(sample("w01", 5.0), band=6.0, attempts=2, corrections=[correction("He go.", "He goes.")])]

    report = format_report(results)

    row = next(line for line in report.splitlines() if line.startswith("w01"))
    assert "5.0" in row and "6.0" in row and "+1.0" in row
    assert "1/1" in row  # planted errors found
    assert " 2 " in row + " "  # attempts


def test_report_ends_with_the_average_error_and_bias():
    results = [result(sample("a", 6.0), band=6.5), result(sample("b", 7.0), band=6.0)]

    report = format_report(results)

    assert "Mean absolute error: 0.75" in report
    assert "Mean bias: -0.25" in report


def test_report_shows_failures_instead_of_hiding_them():
    report = format_report([result(sample("w09", 7.5), band=None, error="AI_INVALID_RESPONSE")])

    assert "AI_INVALID_RESPONSE" in report
    assert "Failed: 1 of 1" in report
