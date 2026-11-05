"""Load scripts/data/questions.json into question_bank with Gemini embeddings.

Safe to re-run: questions already in the table (matched by a hash of question_text)
are skipped, so only new ones cost an embedding call.

    docker compose exec backend python /scripts/seed_questions.py [--file PATH] [--batch-size N]

Or from a host checkout: `cd backend && python ../scripts/seed_questions.py`.

Needs DATABASE_URL and GEMINI_API_KEY (set by compose in the container), and the
database migrated to head (`alembic upgrade head`).
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# `app` lives in ./backend on a host checkout and in the working directory (/app) in the container.
sys.path[:0] = [str(Path.cwd()), str(ROOT / "backend")]

from google import genai  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.services import question_seeder  # noqa: E402

DEFAULT_FILE = ROOT / "scripts" / "data" / "questions.json"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--file", type=Path, default=DEFAULT_FILE)
    parser.add_argument("--batch-size", type=int, default=50)
    args = parser.parse_args(argv)

    settings = get_settings()
    if not settings.gemini_api_key:
        print("GEMINI_API_KEY is not set.", file=sys.stderr)
        return 1

    questions = json.loads(args.file.read_text(encoding="utf-8"))
    embed = question_seeder.GeminiEmbedder(
        genai.Client(api_key=settings.gemini_api_key), settings.gemini_embedding_model
    )
    with SessionLocal() as session:
        result = question_seeder.seed(session, questions, embed, batch_size=args.batch_size)
        counts = question_seeder.category_counts(session)

    print(f"Inserted {result.inserted}, skipped {result.skipped} already present.")
    print("question_bank by category:")
    for category, count in counts.items():
        print(f"  {category:<14}{count}")
    print(f"  {'TOTAL':<14}{sum(counts.values())}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
