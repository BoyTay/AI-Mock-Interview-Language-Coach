import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

from app.jobs.cleanup_audio import CleanupReport, cleanup, parse_interval
from app.models import InterviewSession, SessionMessage, SpeakingSubmission

NOW = datetime(2026, 11, 26, 12, 0, 0)
OLD = NOW - timedelta(days=100)
RECENT = NOW - timedelta(days=10)


def write_file(root: Path, relative: str, size: int = 100, age: timedelta = timedelta(days=2)) -> Path:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"x" * size)
    stamp = (NOW - age).replace(tzinfo=UTC).timestamp()
    os.utime(path, (stamp, stamp))
    return path


def add_message(db, audio_path: str | None, created_at: datetime) -> SessionMessage:
    session = InterviewSession(user_id=1, session_type="TECH_INTERVIEW", question_plan=[])
    db.add(session)
    db.flush()
    message = SessionMessage(
        session_id=session.id, sender="USER", content_text="answer", audio_path=audio_path, created_at=created_at
    )
    db.add(message)
    db.commit()
    return message


def add_submission(db, audio_path: str | None, created_at: datetime) -> SpeakingSubmission:
    submission = SpeakingSubmission(
        user_id=1, prompt_text="p", transcript="t", audio_path=audio_path, duration_seconds=60,
        words_per_minute=120, overall_band=6.5, band_scores={}, summary="s", marks=[],
        grammar_corrections=[], vocabulary_upgrades=[], prompt_version="v1", created_at=created_at,
    )
    db.add(submission)
    db.commit()
    return submission


def run(db, root, **kwargs) -> CleanupReport:
    kwargs.setdefault("retention_days", 90)
    return cleanup(db, root, now=NOW, **kwargs)


def test_expired_interview_recording_is_deleted_and_marked(db_session, tmp_path):
    path = write_file(tmp_path, "interviews/1/a.webm", size=50)
    message = add_message(db_session, "interviews/1/a.webm", OLD)

    report = run(db_session, tmp_path)

    assert report.expired == 1
    assert report.freed_bytes == 50
    assert not path.exists()
    db_session.refresh(message)
    assert message.audio_path is None
    assert message.audio_deleted_at == NOW


def test_expired_speaking_recording_is_deleted(db_session, tmp_path):
    path = write_file(tmp_path, "speaking/1/a.wav")
    submission = add_submission(db_session, "speaking/1/a.wav", OLD)

    report = run(db_session, tmp_path)

    assert report.expired == 1
    assert not path.exists()
    db_session.refresh(submission)
    assert submission.audio_path is None


def test_recordings_inside_the_window_are_kept(db_session, tmp_path):
    path = write_file(tmp_path, "interviews/1/a.webm")
    message = add_message(db_session, "interviews/1/a.webm", RECENT)

    report = run(db_session, tmp_path)

    assert report.expired == 0
    assert path.exists()
    db_session.refresh(message)
    assert message.audio_path == "interviews/1/a.webm"
    assert message.audio_deleted_at is None


def test_retention_zero_expires_nothing(db_session, tmp_path):
    path = write_file(tmp_path, "interviews/1/a.webm")
    add_message(db_session, "interviews/1/a.webm", OLD)

    report = run(db_session, tmp_path, retention_days=0)

    assert report.expired == 0
    assert path.exists()


def test_an_old_orphan_is_deleted_and_its_empty_folder_removed(db_session, tmp_path):
    path = write_file(tmp_path, "interviews/7/orphan.webm", size=30)

    report = run(db_session, tmp_path)

    assert report.orphans == 1
    assert report.freed_bytes == 30
    assert not path.exists()
    assert not (tmp_path / "interviews/7").exists()


def test_a_fresh_orphan_is_kept(db_session, tmp_path):
    path = write_file(tmp_path, "interviews/7/fresh.webm", age=timedelta(minutes=10))

    report = run(db_session, tmp_path)

    assert report.orphans == 0
    assert path.exists()


def test_a_referenced_file_is_never_an_orphan(db_session, tmp_path):
    path = write_file(tmp_path, "interviews/1/a.webm")
    add_message(db_session, "interviews/1/a.webm", RECENT)
    other = write_file(tmp_path, "speaking/1/b.wav")
    add_submission(db_session, "speaking/1/b.wav", RECENT)

    report = run(db_session, tmp_path)

    assert report.orphans == 0
    assert path.exists() and other.exists()


def test_a_missing_file_is_counted_not_changed(db_session, tmp_path):
    message = add_message(db_session, "interviews/1/gone.webm", RECENT)

    report = run(db_session, tmp_path)

    assert report.missing == 1
    db_session.refresh(message)
    assert message.audio_path == "interviews/1/gone.webm"
    assert message.audio_deleted_at is None


def test_the_guard_stops_a_sweep_that_would_delete_most_files(db_session, tmp_path):
    paths = [write_file(tmp_path, f"interviews/9/{i}.webm") for i in range(12)]

    report = run(db_session, tmp_path)

    assert report.guarded is True
    assert report.freed_bytes == 0
    assert all(path.exists() for path in paths)


def test_force_overrides_the_guard(db_session, tmp_path):
    paths = [write_file(tmp_path, f"interviews/9/{i}.webm") for i in range(12)]

    report = run(db_session, tmp_path, force=True)

    assert report.guarded is False
    assert report.orphans == 12
    assert not any(path.exists() for path in paths)


def test_dry_run_changes_nothing(db_session, tmp_path):
    expired = write_file(tmp_path, "interviews/1/a.webm", size=40)
    message = add_message(db_session, "interviews/1/a.webm", OLD)
    orphan = write_file(tmp_path, "speaking/2/o.wav", size=60)

    report = run(db_session, tmp_path, dry_run=True)

    assert (report.expired, report.orphans) == (1, 1)
    assert report.freed_bytes == 100
    assert expired.exists() and orphan.exists()
    db_session.refresh(message)
    assert message.audio_path == "interviews/1/a.webm"
    assert message.audio_deleted_at is None


def test_every_parses_hours_and_minutes():
    assert parse_interval("24h") == timedelta(hours=24)
    assert parse_interval("90m") == timedelta(minutes=90)
