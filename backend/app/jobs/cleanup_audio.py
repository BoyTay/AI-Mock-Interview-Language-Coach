"""Delete recordings older than the retention period and sweep files no row refers to.

Run once: `python -m app.jobs.cleanup_audio [--dry-run] [--force]`; repeatedly: `--every 24h`.
"""
import argparse
import logging
import re
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.errors import AppError
from app.models import SessionMessage, SpeakingSubmission
from app.services.audio_store import AudioStore

logger = logging.getLogger(__name__)

AUDIO_FOLDERS = ("interviews", "speaking")
# The sweep refuses to run when it would delete more than half of the files on disk and more than this many.
GUARD_MIN_FILES = 10
COMMIT_BATCH = 100


@dataclass
class CleanupReport:
    expired: int = 0
    orphans: int = 0
    missing: int = 0
    freed_bytes: int = 0
    guarded: bool = False


def _normalise(path: str) -> str:
    return path.replace("\\", "/").lstrip("/")


def _remove_empty_folder(root: Path, relative: str) -> None:
    """Remove the recording's folder when it is empty; the top-level `interviews` / `speaking` stay."""
    folder = (root / relative).parent
    if folder.parent == root or folder == root:
        return
    try:
        folder.rmdir()
    except OSError:
        pass  # not empty, or already gone


def _recording_rows(db: Session) -> list:
    """Every row that holds a recording path, messages and speaking submissions alike."""
    rows: list = []
    for model in (SessionMessage, SpeakingSubmission):
        rows.extend(db.scalars(select(model).where(model.audio_path.is_not(None))))
    return rows


def _files_on_disk(root: Path) -> dict[str, Path]:
    found: dict[str, Path] = {}
    for folder in AUDIO_FOLDERS:
        base = root / folder
        if base.is_dir():
            for path in base.rglob("*"):
                if path.is_file():
                    found[path.relative_to(root).as_posix()] = path
    return found


def cleanup(
    db: Session,
    root: Path,
    *,
    retention_days: int,
    now: datetime,
    dry_run: bool = False,
    force: bool = False,
    orphan_grace: timedelta = timedelta(hours=1),
) -> CleanupReport:
    """`now` is a naive UTC datetime, like the `created_at` values read from the database."""
    root = Path(root)
    store = AudioStore(root)
    report = CleanupReport()
    verb = "would delete" if dry_run else "deleted"

    # 1. Expire recordings past the retention period. A file that cannot be deleted is logged and skipped,
    # so one bad file never stops the run or blocks the other rows.
    expiring: set[tuple[type, int]] = set()
    if retention_days > 0:
        cutoff = now - timedelta(days=retention_days)
        pending = 0
        for row in _recording_rows(db):
            if row.created_at is None or row.created_at >= cutoff:
                continue
            relative = _normalise(row.audio_path)
            size = 0  # stays 0 when the file is already gone; the row still expires
            try:
                size = store.open_path(relative).stat().st_size
            except (AppError, OSError):
                pass
            if not dry_run:
                try:
                    store.delete(relative)
                except OSError:
                    logger.exception("could not delete expired recording %s; leaving its row alone", relative)
                    continue
                _remove_empty_folder(root, relative)
                row.audio_path = None
                if isinstance(row, SessionMessage):
                    row.audio_deleted_at = now
                pending += 1
                if pending >= COMMIT_BATCH:
                    db.commit()
                    pending = 0
            report.expired += 1
            report.freed_bytes += size
            expiring.add((type(row), row.id))
            logger.info("%s expired recording %s (%d bytes)", verb, relative, size)
        if pending:
            db.commit()

    # 2. Sweep files that no row refers to.
    rows = _recording_rows(db)
    referenced = {_normalise(row.audio_path) for row in rows}
    on_disk = _files_on_disk(root)
    grace_cutoff = now - orphan_grace
    orphan_files: dict[str, tuple[Path, int]] = {}
    for relative, path in on_disk.items():
        if relative in referenced:
            continue
        try:
            info = path.stat()
        except OSError:
            continue  # vanished since the listing
        if datetime.fromtimestamp(info.st_mtime, UTC).replace(tzinfo=None) < grace_cutoff:
            orphan_files[relative] = (path, info.st_size)
    if len(orphan_files) > len(on_disk) / 2 and len(orphan_files) > GUARD_MIN_FILES and not force:
        report.guarded = True
        report.orphans = len(orphan_files)
        logger.error(
            "orphan sweep refused: %d of %d files look orphaned (use --force to delete them)",
            len(orphan_files), len(on_disk),
        )
    else:
        for relative, (path, size) in orphan_files.items():
            if not dry_run:
                try:
                    path.unlink(missing_ok=True)
                except OSError:
                    logger.exception("could not delete orphan %s", relative)
                    continue
                _remove_empty_folder(root, relative)
            report.orphans += 1
            report.freed_bytes += size
            logger.info("%s orphan %s (%d bytes)", verb, relative, size)

    # 3. Rows whose file is gone: count and log, change nothing.
    for row in rows:
        if (type(row), row.id) in expiring:
            continue
        relative = _normalise(row.audio_path)
        if relative not in on_disk:
            report.missing += 1
            logger.warning("recording %s is referenced but missing on disk", relative)

    return report


def parse_interval(text: str) -> timedelta:
    """`24h` or `90m`."""
    match = re.fullmatch(r"(\d+)([hm])", text.strip())
    if not match or int(match.group(1)) == 0:
        raise ValueError(f"Not an interval like 24h or 90m: {text!r}")
    amount = int(match.group(1))
    return timedelta(hours=amount) if match.group(2) == "h" else timedelta(minutes=amount)


def _format_bytes(size: int) -> str:
    return f"{size / (1024 * 1024):.1f} MB"


def _run_once(dry_run: bool, force: bool) -> CleanupReport:
    settings = get_settings()
    with SessionLocal() as db:
        report = cleanup(
            db,
            Path(settings.upload_dir),
            retention_days=settings.audio_retention_days,
            now=datetime.now(UTC).replace(tzinfo=None),
            dry_run=dry_run,
            force=force,
        )
    logger.info(
        "expired=%d orphans=%d missing=%d freed=%s%s",
        report.expired, report.orphans, report.missing, _format_bytes(report.freed_bytes),
        " guarded=True" if report.guarded else "",
    )
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Delete expired and orphaned audio recordings.")
    parser.add_argument("--dry-run", action="store_true", help="count what would be deleted, change nothing")
    parser.add_argument("--force", action="store_true", help="let the orphan sweep delete most of the files")
    parser.add_argument("--every", type=parse_interval, metavar="24h", help="repeat forever at this interval (Nh or Nm)")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO)

    if args.every is None:
        _run_once(args.dry_run, args.force)
        return 0
    while True:
        try:
            _run_once(args.dry_run, args.force)
        except Exception:
            logger.exception("cleanup run failed; trying again in %s", args.every)
        time.sleep(args.every.total_seconds())


if __name__ == "__main__":
    raise SystemExit(main())
