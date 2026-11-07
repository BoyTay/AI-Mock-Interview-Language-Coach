"""Checks that retrieval fits the job description, using the real question bank and Gemini.

    docker compose exec backend python -m evals.run_rag_eval

Needs GEMINI_API_KEY and a seeded question_bank (scripts/seed_questions.py). Two embedding
calls, one per scenario. Exits non-zero if a scenario fails, so it can gate a prompt or
ranking change.
"""
import sys
from dataclasses import dataclass
from collections.abc import Callable

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.services.rag_service import RetrievedQuestion, build_rag_service

JAVA_JD = """Java Backend Developer. Design and build REST APIs with Spring Boot, work with
PostgreSQL and write efficient SQL, apply OOP and design patterns, and keep services reliable.
Experience with JPA/Hibernate, JVM tuning and microservices is a plus."""

REACT_JD = """Frontend Developer. Build responsive user interfaces with React, hooks and state
management, call REST APIs from the browser, and keep components fast and accessible.
Experience with JavaScript, rendering performance and testing UI is a plus."""


@dataclass(frozen=True)
class Scenario:
    name: str
    role: str
    jd: str
    needed: int  # of the picked questions, at least this many must satisfy `fits`
    fits: Callable[[RetrievedQuestion], bool]
    expectation: str


SCENARIOS = [
    Scenario(
        "Java Backend JD",
        "Java Backend Developer",
        JAVA_JD,
        3,
        lambda q: q.category in {"JAVA", "SQL"} or "API" in q.question_text,
        "mostly Java, SQL and API questions",
    ),
    Scenario(
        "React JD",
        "Frontend Developer",
        REACT_JD,
        3,
        lambda q: q.category == "REACT",
        "mostly React (frontend) questions",
    ),
]


def main() -> int:
    service = build_rag_service(get_settings())
    failed = 0
    with SessionLocal() as session:
        for sc in SCENARIOS:
            picks = service.retrieve(session, target_role=sc.role, job_description=sc.jd, cv_text=None)
            fitting = sum(sc.fits(q) for q in picks)
            ok = fitting >= sc.needed
            failed += not ok
            print(f"\n{sc.name}: {'PASS' if ok else 'FAIL'} ({fitting}/{len(picks)} fit; need {sc.needed}; {sc.expectation})")
            for q in picks:
                mark = "*" if sc.fits(q) else " "
                print(f"  {mark} {q.category:<14}{q.difficulty:<7}dist={q.distance:.3f} kw={q.keyword_score:.3f}  {q.question_text[:70]}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
