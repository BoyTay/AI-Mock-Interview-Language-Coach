"""Scores every sample essay with the real model and prints AI band against reference band.

    docker compose exec backend python -m evals.run_writing_eval
    docker compose exec backend python -m evals.run_writing_eval --only w01-band-5.0 --out evals/results/run.txt

Needs GEMINI_API_KEY. Each essay is one request (more if a reply is rejected and retried).
"""
import argparse
import os
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "sqlite://")  # Settings requires it; this script never touches the database

from google import genai  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.services import english_prompts  # noqa: E402
from app.services.english_coach import GeminiLlm  # noqa: E402
from evals.report import format_report  # noqa: E402
from evals.runner import DEFAULT_DELAY_SECONDS, run_samples  # noqa: E402
from evals.samples import SAMPLES  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", nargs="+", metavar="ID", help="run only these sample ids")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY_SECONDS, help="seconds between essays")
    parser.add_argument("--out", type=Path, help="also write the report to this file")
    args = parser.parse_args()

    settings = get_settings()
    if not settings.gemini_api_key:
        raise SystemExit("GEMINI_API_KEY is not set")

    samples = [s for s in SAMPLES if not args.only or s.id in args.only]
    if not samples:
        raise SystemExit(f"No sample matches {args.only}. Ids: {', '.join(s.id for s in SAMPLES)}")

    llm = GeminiLlm(genai.Client(api_key=settings.gemini_api_key), settings.gemini_model)
    header = f"Prompt version {english_prompts.PROMPT_VERSION} | model {settings.gemini_model} | {len(samples)} essays"
    print(header, flush=True)
    results = run_samples(samples, llm, delay=args.delay)
    report = f"{header}\n\n{format_report(results)}"
    print(report)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(report + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
