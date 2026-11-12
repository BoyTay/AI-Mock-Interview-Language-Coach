"""Scores every sample interview answer with the real model and checks the result.

    docker compose exec backend python -m evals.run_interview_eval
    docker compose exec backend python -m evals.run_interview_eval --only i08-false-claim-volatile --out evals/results/interview-run.txt

Needs GEMINI_API_KEY. Each answer is one request (more if a reply is rejected and retried).
The report ends with the model's own critique, follow-up and ideal answer for each sample:
read those, because the checks above them are keyword matches, not proof the content is right.
"""
import argparse
import os
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "sqlite://")  # Settings requires it; this script never touches the database

from google import genai  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.services import ai_interviewer  # noqa: E402
from app.services.english_coach import GeminiLlm  # noqa: E402
from app.schemas.interview import InterviewEvaluation  # noqa: E402
from evals.interview_checks import format_details, format_report  # noqa: E402
from evals.interview_runner import run_samples  # noqa: E402
from evals.interview_samples import SAMPLES  # noqa: E402
from evals.runner import DEFAULT_DELAY_SECONDS  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", nargs="+", metavar="ID", help="run only these sample ids")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY_SECONDS, help="seconds between answers")
    parser.add_argument("--out", type=Path, help="also write the report to this file")
    args = parser.parse_args()

    settings = get_settings()
    if not settings.gemini_api_key:
        raise SystemExit("GEMINI_API_KEY is not set")

    samples = [s for s in SAMPLES if not args.only or s.id in args.only]
    if not samples:
        raise SystemExit(f"No sample matches {args.only}. Ids: {', '.join(s.id for s in SAMPLES)}")

    llm = GeminiLlm(genai.Client(api_key=settings.gemini_api_key), settings.gemini_model, schema=InterviewEvaluation)
    header = f"Prompt version {ai_interviewer.PROMPT_VERSION} | model {settings.gemini_model} | {len(samples)} answers"
    print(header, flush=True)
    results = run_samples(samples, llm, delay=args.delay)
    report = f"{header}\n\n{format_report(results)}\n\n{format_details(results)}"
    print(report)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(report + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
