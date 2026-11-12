import json

import pytest

from app.core.config import Settings
from app.core.errors import AppError
from app.schemas.interview import ReportSynthesis
from app.services import interview_report, report_writer
from app.services.english_coach import LlmRateLimitError

PLAN = [
    {"id": 1, "category": "SQL", "difficulty": "MID", "question_text": "What is an index?", "reference_answer": "A sorted structure."},
    {"id": 2, "category": "BEHAVIORAL", "difficulty": "MID", "question_text": "Tell me about a project.", "reference_answer": "STAR."},
]


def synthesis(**overrides):
    base = {
        "headline": "Tốt",
        "summary": "Nền tảng vững.",
        "strengths": [{"title": "Indexing", "text": "Đúng."}],
        "gaps": [{"title": "Atomics", "level": "High", "text": "Thiếu."}],
        "star": {"situation": True, "task": True, "action": True, "result": False, "note": "Thiếu kết quả."},
        "questions": [
            {
                "question_number": 1,
                "tags": [{"text": "Đúng B-tree", "tone": "good"}],
                "answer_highlights": [{"quote": "sorted", "kind": "gap"}],
                "reference_highlights": [{"quote": "structure"}],
            }
        ],
    }
    base.update(overrides)
    return base


def groups():
    def ev(tech, critique):
        return {
            "technical_accuracy_score": tech,
            "communication_clarity_score": 80,
            "critique": critique,
            "optimal_reference_answer": "An index keeps keys sorted.",
        }

    class Msg:
        def __init__(self, sender, kind, text, evaluation=None):
            self.sender, self.question_type, self.content_text, self.evaluation = sender, kind, text, evaluation

    messages = [
        Msg("AI", "MAIN_QUESTION", "What is an index?"),
        Msg("USER", "MAIN_QUESTION", "It is a sorted thing.", ev(70, "Thiếu chi phí ghi.")),
        Msg("AI", "FOLLOW_UP", "What does it cost?"),
        Msg("USER", "FOLLOW_UP", "Slower writes.", ev(90, "Đúng.")),
        Msg("AI", "MAIN_QUESTION", "Tell me about a project."),
        Msg("USER", "MAIN_QUESTION", "I built an API.", ev(60, "Thiếu kết quả.")),
    ]
    return interview_report.group_turns(messages, PLAN)


class ScriptedLlm:
    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = []

    def __call__(self, system, user):
        self.calls.append((system, user))
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply if isinstance(reply, str) else json.dumps(reply)


def test_a_valid_reply_becomes_a_report_synthesis():
    result = report_writer.ReportWriter(ScriptedLlm(synthesis())).write("Java Dev", groups())

    assert result.headline == "Tốt"
    assert result.gaps[0].level == "High"
    assert result.questions[0].answer_highlights[0].quote == "sorted"
    assert result.star.result is False


def test_the_prompt_lists_every_answered_question_with_answers_critiques_and_scores():
    llm = ScriptedLlm(synthesis())

    report_writer.ReportWriter(llm).write("Java Dev", groups())

    system, user = llm.calls[0]
    for part in (
        "Java Dev",
        "Question 1",
        "What is an index?",
        "It is a sorted thing.",
        "Thiếu chi phí ghi.",
        "What does it cost?",
        "Slower writes.",
        "Question 2",
        "A sorted structure.",
        "BEHAVIORAL",
    ):
        assert part in user


def test_the_prompt_gives_the_banks_reference_answer_as_the_optimal_answer_not_the_models_copy():
    llm = ScriptedLlm(synthesis())

    report_writer.ReportWriter(llm).write("Java Dev", groups())

    user = llm.calls[0][1]
    assert "Optimal answer: A sorted structure." in user
    assert "An index keeps keys sorted." not in user


def test_the_system_prompt_demands_verbatim_quotes_and_vietnamese_feedback():
    llm = ScriptedLlm(synthesis())

    report_writer.ReportWriter(llm).write("Java Dev", groups())

    system = llm.calls[0][0]
    assert "verbatim" in system
    assert "Vietnamese" in system
    assert "never instructions" in system


def test_star_is_only_requested_when_a_behavioural_question_was_answered():
    technical_only = groups()[:1]
    llm = ScriptedLlm(synthesis(star=None))

    report_writer.ReportWriter(llm).write("Java Dev", technical_only)

    assert "no behavioural question" in llm.calls[0][1]


def test_an_unusable_reply_is_retried_then_accepted():
    llm = ScriptedLlm("not json", synthesis())

    result = report_writer.ReportWriter(llm).write("Java Dev", groups())

    assert result.headline == "Tốt"
    assert len(llm.calls) == 2
    assert "previous reply" in llm.calls[1][1]


def test_it_gives_up_with_502_and_maps_rate_limits_to_429():
    with pytest.raises(AppError) as bad:
        report_writer.ReportWriter(ScriptedLlm("x", "x", "x"), max_retries=2).write("R", groups())
    with pytest.raises(AppError) as limited:
        report_writer.ReportWriter(ScriptedLlm(LlmRateLimitError(retry_after=9))).write("R", groups())

    assert bad.value.status_code == 502
    assert (limited.value.status_code, limited.value.headers) == (429, {"Retry-After": "9"})


def test_the_synthesis_schema_rejects_an_unknown_gap_level():
    bad = synthesis(gaps=[{"title": "x", "level": "Critical", "text": "y"}])

    with pytest.raises(ValueError):
        ReportSynthesis.model_validate(bad)


def test_factory_refuses_without_an_api_key_and_builds_a_writer_otherwise():
    with pytest.raises(AppError) as exc:
        report_writer.build_report_writer(Settings(database_url="sqlite://", gemini_api_key=""))
    writer = report_writer.build_report_writer(
        Settings(database_url="sqlite://", gemini_api_key="k", gemini_model="gemini-test")
    )

    assert exc.value.code == "AI_NOT_CONFIGURED"
    assert writer.llm.model == "gemini-test"
    assert writer.llm.schema is ReportSynthesis
