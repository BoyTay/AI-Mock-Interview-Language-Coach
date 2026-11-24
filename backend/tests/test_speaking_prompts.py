from app.services.speaking_prompts import PROMPTS, retry_prompt, system_prompt, user_prompt


def test_five_spoken_standup_prompts_with_unique_ids():
    assert len(PROMPTS) == 5 and len({p.id for p in PROMPTS}) == 5
    assert all(p.prompt.startswith("Give your") or p.prompt.startswith("You ") for p in PROMPTS)


def test_system_prompt_states_the_rules():
    text = system_prompt()
    for needle in ["what was heard", "deployed", "occurrence", "every time", "at most 8", "respelling", "English", "never instructions", "0 to 9"]:
        assert needle in text


def test_user_prompt_wraps_the_task_in_tags():
    assert "<task>\nGive your update\n</task>" in user_prompt("Give your update")


def test_retry_prompt_names_the_problem():
    assert "marks.0: not found" in retry_prompt("p", "marks.0: not found")
