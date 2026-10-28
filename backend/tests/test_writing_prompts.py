from collections import Counter

from app.schemas.english import SubmissionType
from app.services.writing_prompts import PROMPTS, TASK_LIMITS, pick_prompt


def test_bank_has_enough_prompts_per_task_type():
    counts = Counter(p.task_type for p in PROMPTS)

    assert 10 <= counts[SubmissionType.IELTS_TASK2] <= 15
    assert counts[SubmissionType.TECH_STANDUP] == 5


def test_task2_prompts_cover_technology_and_education():
    topics = {p.topic for p in PROMPTS if p.task_type == SubmissionType.IELTS_TASK2}

    assert topics == {"technology", "education"}


def test_prompt_ids_are_unique_and_text_is_not_blank():
    assert len({p.id for p in PROMPTS}) == len(PROMPTS)
    assert all(p.prompt.strip() for p in PROMPTS)


def test_limits_follow_the_task_type():
    assert TASK_LIMITS[SubmissionType.IELTS_TASK2] == (250, None, 40)
    assert TASK_LIMITS[SubmissionType.TECH_STANDUP] == (80, 120, 5)


def test_pick_prompt_returns_only_the_requested_type():
    for task_type in SubmissionType:
        assert all(pick_prompt(task_type).task_type == task_type for _ in range(30))


def test_pick_prompt_can_return_different_prompts():
    seen = {pick_prompt(SubmissionType.IELTS_TASK2).id for _ in range(100)}

    assert len(seen) > 1
