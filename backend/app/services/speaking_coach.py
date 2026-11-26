from dataclasses import dataclass

from google import genai
from google.genai import errors as genai_errors

from app.core.config import Settings
from app.core.errors import AppError
from app.schemas.english import MarkKind, PlacedMark, SpeakingEvaluation, SpeechMark
from app.services import speaking_prompts
from app.services.english_coach import MAX_RETRIES, Audio, GeminiLlm, Llm, _squash
from app.services.llm_json import call_json
from app.services.transcript_marks import (
    MarkPlacementError,
    PlacedSpan,
    count_words,
    find_all,
    overall_band,
    overlaps,
    place,
    tokenize,
)


@dataclass(frozen=True)
class GradedSpeech:
    evaluation: SpeakingEvaluation
    marks: list[PlacedMark]  # in the order the model sent them
    overall_band: float
    word_count: int
    filler_count: int


def _utf16_offset(text: str, index: int) -> int:
    # The client slices with JavaScript's String.slice, which counts UTF-16 code units, not code points.
    return len(text[:index].encode("utf-16-le")) // 2


def _same_words(a: str, b: str) -> bool:
    return _squash(a).lower() == _squash(b).lower()


def _without_no_ops(evaluation: SpeakingEvaluation) -> SpeakingEvaluation:
    """Drops corrections and upgrades that suggest the same words back."""
    return evaluation.model_copy(
        update={
            "grammar_corrections": [
                c for c in evaluation.grammar_corrections if not _same_words(c.original, c.corrected)
            ],
            "vocabulary_upgrades": [u for u in evaluation.vocabulary_upgrades if not _same_words(u.used, u.better)],
        }
    )


def _place_marks(evaluation: SpeakingEvaluation) -> list[tuple[PlacedSpan, SpeechMark]]:
    taken: list[PlacedSpan] = []
    placed: list[tuple[PlacedSpan, SpeechMark]] = []
    for index, mark in enumerate(evaluation.marks):
        try:
            span = place(evaluation.transcript, mark.text, mark.occurrence, taken)
        except MarkPlacementError as exc:
            raise ValueError(f"marks[{index}] {mark.text!r}: {exc}") from exc
        taken.append(span)
        placed.append((span, mark))
    return placed


def _changed_by_a_correction(transcript: str, span: PlacedSpan, evaluation: SpeakingEvaluation) -> bool:
    """True when a grammar correction covers this span and rewrites its words, as with a dropped -ed or -s.

    Those slips are grammar errors (see the prompt); a pronunciation mark on them would count the slip twice.
    """
    words = {t.norm for t in tokenize(transcript[span.start : span.end])}
    for correction in evaluation.grammar_corrections:
        if any(overlaps(span, s) for s in find_all(transcript, correction.original)):
            if not words <= {t.norm for t in tokenize(correction.corrected)}:
                return True
    return False


def _to_placed_marks(
    evaluation: SpeakingEvaluation, placed: list[tuple[PlacedSpan, SpeechMark]]
) -> list[PlacedMark]:
    transcript = evaluation.transcript
    return [
        PlacedMark(
            kind=mark.kind,
            text=transcript[span.start : span.end],
            start=_utf16_offset(transcript, span.start),
            end=_utf16_offset(transcript, span.end),
            respelling=mark.respelling,
            note=mark.note,
        )
        for span, mark in placed
        if not (mark.kind is MarkKind.PRONUNCIATION and _changed_by_a_correction(transcript, span, evaluation))
    ]


class SpeakingCoach:
    def __init__(self, llm: Llm, max_retries: int = MAX_RETRIES):
        self.llm = llm
        self.max_retries = max_retries

    def evaluate(self, audio: Audio, prompt_text: str) -> GradedSpeech:
        placed: list[tuple[PlacedSpan, SpeechMark]] = []

        def check(evaluation: SpeakingEvaluation) -> None:
            # A silent recording has nothing to place; it is reported below, not retried.
            if not evaluation.transcript.strip():
                return
            placed[:] = _place_marks(evaluation)
            haystack = _squash(evaluation.transcript)
            for index, correction in enumerate(evaluation.grammar_corrections):
                if _squash(correction.original) not in haystack:
                    raise ValueError(
                        f"grammar_corrections[{index}] {correction.original!r}: not quoted verbatim from the transcript"
                    )

        try:
            evaluation = call_json(
                self.llm,
                speaking_prompts.system_prompt(),
                speaking_prompts.user_prompt(prompt_text),
                SpeakingEvaluation,
                lambda problem: speaking_prompts.retry_prompt(prompt_text, problem),
                self.max_retries,
                audio=audio,
                check=check,
            )
        except genai_errors.ClientError as exc:
            # A 400 means Gemini could not take the recording (corrupt, truncated, or a format it refuses).
            # The speaker can fix that by recording again, so say so instead of failing with a 500.
            if exc.code == 400:
                raise AppError(
                    422, "AUDIO_UNREADABLE", "We could not read this recording. Please record again."
                ) from exc
            raise

        if not evaluation.transcript.strip():
            raise AppError(
                422, "NO_SPEECH_DETECTED", "We couldn't hear any speech in the recording. Please record again."
            )

        evaluation = _without_no_ops(evaluation)
        marks = _to_placed_marks(evaluation, placed)
        criteria = evaluation.criteria
        return GradedSpeech(
            evaluation=evaluation,
            marks=marks,
            overall_band=overall_band(
                [criteria.fluency.score, criteria.pronunciation.score, criteria.vocabulary.score, criteria.grammar.score]
            ),
            word_count=count_words(evaluation.transcript),
            filler_count=sum(1 for mark in marks if mark.kind is MarkKind.FILLER),
        )


def build_speaking_coach(settings: Settings) -> SpeakingCoach:
    if not settings.gemini_api_key:
        raise AppError(503, "AI_NOT_CONFIGURED", "GEMINI_API_KEY is not set")
    client = genai.Client(api_key=settings.gemini_api_key)
    return SpeakingCoach(GeminiLlm(client, settings.gemini_model, schema=SpeakingEvaluation))
