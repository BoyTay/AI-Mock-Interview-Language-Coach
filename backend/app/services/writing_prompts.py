import random
from dataclasses import dataclass

from app.schemas.english import SubmissionType

# task type -> (min words, max words or None, suggested minutes)
TASK_LIMITS: dict[SubmissionType, tuple[int, int | None, int]] = {
    SubmissionType.IELTS_TASK2: (250, None, 40),
    SubmissionType.TECH_STANDUP: (80, 120, 5),
}


@dataclass(frozen=True)
class WritingPrompt:
    id: str
    task_type: SubmissionType
    topic: str
    prompt: str


def _task2(number: int, topic: str, prompt: str) -> WritingPrompt:
    return WritingPrompt(f"task2-{number:02d}", SubmissionType.IELTS_TASK2, topic, prompt)


def _standup(number: int, prompt: str) -> WritingPrompt:
    return WritingPrompt(f"standup-{number:02d}", SubmissionType.TECH_STANDUP, "standup", prompt)


PROMPTS: list[WritingPrompt] = [
    _task2(1, "technology", "Some people believe that artificial intelligence will replace most human jobs in the near future. To what extent do you agree or disagree?"),
    _task2(2, "technology", "Social media has changed the way people communicate. Do the advantages of this development outweigh the disadvantages?"),
    _task2(3, "technology", "Many companies now allow employees to work from home using digital tools. Discuss the advantages and disadvantages of this trend."),
    _task2(4, "technology", "Some people think that children should learn to code at primary school. To what extent do you agree or disagree?"),
    _task2(5, "technology", "As more services move online, some people argue that cash will soon disappear. Is this a positive or negative development?"),
    _task2(6, "technology", "Automation and robots are used more and more in factories and offices. What problems does this cause, and what solutions can you suggest?"),
    _task2(7, "technology", "Some people say that the growing use of smartphones makes people less sociable. Do you agree or disagree?"),
    _task2(8, "education", "Some people believe that university education should be free for everyone. Others think students should pay for it. Discuss both views and give your own opinion."),
    _task2(9, "education", "Online courses are becoming a popular alternative to classroom learning. Do the benefits of online education outweigh the drawbacks?"),
    _task2(10, "education", "Some people think schools should focus on practical skills rather than academic subjects. To what extent do you agree or disagree?"),
    _task2(11, "education", "Many students now use digital devices instead of books and paper in class. Is this a positive or negative development?"),
    _task2(12, "education", "Some people believe that learning a foreign language is essential for career success. To what extent do you agree or disagree?"),
    _standup(1, "Write your daily standup update: what you finished yesterday, what you will work on today, and any blocker you have."),
    _standup(2, "You fixed a production bug yesterday. Write a standup update that explains the cause, the fix, and what you will do to prevent it."),
    _standup(3, "Your task is delayed because another team has not finished their API. Write a standup update that explains the blocker and asks for help."),
    _standup(4, "You spent the day reviewing pull requests and pairing with a new teammate. Write a short standup update about it and your plan for today."),
    _standup(5, "You are about to release a new feature. Write a standup update that covers testing progress, remaining risks, and the release plan."),
]


def pick_prompt(task_type: SubmissionType) -> WritingPrompt:
    return random.choice([p for p in PROMPTS if p.task_type == task_type])
