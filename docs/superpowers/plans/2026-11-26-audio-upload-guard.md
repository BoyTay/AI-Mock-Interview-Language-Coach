# Audio Upload Limits and Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure every uploaded recording with `ffprobe` and enforce its length, expire recordings after `AUDIO_RETENTION_DAYS`, sweep orphaned files daily from a `cleanup` compose service, and tell the user when a recording was deleted.

**Architecture:** A small probe module wraps `ffprobe` and is injected into both voice routes as a FastAPI dependency, so tests use a fake. A `cleanup_audio` job module (expire, orphan sweep with a safety guard, dry run, loop) runs in its own compose service on the backend image. Migration 0006 adds `session_messages.audio_deleted_at` and makes `speaking_submissions.audio_path` nullable; the audio endpoint answers 410 for expired recordings and the player shows the message.

**Tech Stack:** FastAPI, SQLAlchemy 2, Alembic, pytest; ffmpeg's `ffprobe` (Debian package in `python:3.12-slim`); Docker Compose; React 18 + Vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-audio-upload-guard-design.md`

## Global Constraints

- Measured length limits: Speaking at least 29 s and at most 125 s; interview at most 185 s. `speaking_prompts.MIN_SECONDS` / `MAX_SECONDS` (30 / 120) do not change.
- Error bodies (English, exact):
  - 422 `AUDIO_UNREADABLE` "We could not read this recording. Please record again."
  - 422 `AUDIO_TOO_SHORT` "This recording is shorter than 30 seconds. Please record a longer answer."
  - 422 `AUDIO_TOO_LONG` "This recording is longer than the limit of 2:00. Please record a shorter answer." (Speaking) / "... limit of 3:00 ..." (interview)
  - 503 `AUDIO_PROBE_UNAVAILABLE` "The server cannot check recordings right now. Please try again later."
  - 410 `AUDIO_EXPIRED` "This recording was deleted after N days." (N = `audio_retention_days`)
- `AUDIO_RETENTION_DAYS` default 90; 0 disables expiry. Orphan grace period 1 hour. Guard: an orphan sweep that would delete more than half of the files on disk and more than 10 files deletes nothing unless `--force`.
- No Gemini call, no stored file and no row for any upload rejected by the probe.
- Backend tests: `cd backend && /c/Users/Admin/AppData/Local/Temp/claude/599bdacca99f21d2/114b0c47-ed52-41f3-9e46-79ca6b1b8ec2/scratchpad/venv/Scripts/python.exe -m pytest` (baseline on main: 447 passed, 9 skipped). The venv has no `ffprobe`; real-binary tests skip there and run in Docker. Frontend: `cd frontend && npm test` (baseline: all pass except the pre-existing `ModeSwitch.test.jsx` "clicking English Coach navigates" environment failure).
- Commit messages: imperative sentence like the repo history, then a blank line and a `Co-Authored-By:` trailer for the authoring model. Never commit `.agents/`, `.claude/`, `skills-lock.json`, `.superpowers/`.

## Review Focus

1. A recording stopped at exactly 0:30 that measures 29.6 s: accepted (Speaking minimum is 29 s). Pinned in Task 2.
2. A Chrome webm whose header has no duration: the packet fallback gives its length. Pinned in Task 1 (fake runner returning `N/A` for the format duration).
3. The cleanup pointed at a freshly reset database while `audio_uploads` still holds recordings: nothing is deleted. Pinned in Task 4 (guard test).
4. A file uploaded seconds before the sweep, whose row is not committed yet: kept. Pinned in Task 4 (fresh orphan test).
5. A report generated before expiry and cached in `feedback_summary`: its player shows "This recording was deleted after 90 days." with no Retry. Pinned in Tasks 3 and 6.

---

### Task 1: The probe

**Files:**
- Create: `backend/app/services/audio_probe.py`, `backend/tests/test_audio_probe.py`
- Modify: `backend/Dockerfile` (install ffmpeg)

**Interfaces:**
- Produces:
  - `class AudioUnreadable(Exception)`, `class AudioProbeUnavailable(Exception)`
  - `probe_duration(data: bytes, run: Callable[[list[str]], str] | None = None) -> float`: seconds. The bytes are written to a temporary file (deleted afterwards), because ffprobe cannot read an mp4 whose index sits at the end from a pipe. `run(args)` executes ffprobe on that path and returns stdout; the default runs `subprocess.run(args, capture_output=True, text=True, timeout=10, check=True)`. `FileNotFoundError` → `AudioProbeUnavailable`; non-zero exit or `TimeoutExpired` → `AudioUnreadable`.
  - Order: `ffprobe -v error -show_entries format=duration -of csv=p=0 <path>`; if the output is not a positive number (`N/A`, empty), `ffprobe -v error -select_streams a:0 -show_entries packet=pts_time,duration_time -of csv=p=0 <path>` and take the largest `pts_time + duration_time` (a missing duration counts as 0). No packets → `AudioUnreadable`.

- [ ] **Step 1: Tests** with a fake `run` (records the args, returns scripted outputs or raises); one test also checks the temporary file is gone afterwards:
  - `test_format_duration_is_used` ("84.120000\n" → 84.12, one call)
  - `test_webm_without_duration_falls_back_to_the_last_packet` (first call "N/A", second "0.000,0.020\n...\n83.980,0.020\n" → 84.0)
  - `test_no_audio_packets_is_unreadable`, `test_nonzero_exit_is_unreadable` (raise `CalledProcessError`), `test_timeout_is_unreadable`, `test_missing_binary_is_unavailable` (raise `FileNotFoundError`)
  - `test_real_ffprobe_measures_a_wav` marked `skipif(shutil.which("ffprobe") is None)`: a 2.5 s silent 16 kHz mono WAV built with the `wave` module measures within 0.05 s.
- [ ] **Step 2: Run** `pytest tests/test_audio_probe.py -v`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement**; add `RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*` to `backend/Dockerfile` before `pip install`.
- [ ] **Step 4: Run** the file (real test skipped locally). Expected: PASS.
- [ ] **Step 5: Commit** "Measure recordings with ffprobe".

### Task 2: Enforce length in both voice routes

**Files:**
- Modify: `backend/app/api/audio_upload.py`, `backend/app/api/routes_english.py`, `backend/app/api/routes_interview.py`, `backend/app/schemas/english.py` (`SpeakingEvaluateForm.duration_seconds` optional), `backend/app/services/speaking_prompts.py` (constants), `backend/tests/conftest.py`, `backend/tests/test_speaking_api.py`, `backend/tests/test_interview_voice_api.py`, `README.md` (API paragraphs)

**Interfaces:**
- Consumes: Task 1 `probe_duration`, `AudioUnreadable`, `AudioProbeUnavailable`.
- Produces in `app/api/audio_upload.py`:
  - `AudioProbe = Callable[[bytes], float]`; `get_audio_probe() -> AudioProbe` (returns `probe_duration`), a dependency both routes declare.
  - `measure(probe: AudioProbe, data: bytes, *, max_seconds: float, max_label: str, min_seconds: float | None = None) -> float`: maps the probe's exceptions to the 422 `AUDIO_UNREADABLE` / 503 `AUDIO_PROBE_UNAVAILABLE` AppErrors, then raises 422 `AUDIO_TOO_SHORT` / `AUDIO_TOO_LONG` (messages in Global Constraints; `max_label` is "2:00" or "3:00"). Runs in the threadpool (it blocks).
- Constants: `speaking_prompts.MIN_MEASURED_SECONDS = 29`, `MAX_MEASURED_SECONDS = 125`; `routes_interview.MAX_ANSWER_SECONDS = 185`.
- Speaking stores `duration_seconds = round(measured)` and computes wpm from it; the form field `duration_seconds` becomes `int | None = None` and is ignored; `_SPEAKING_BODY` drops it from `required` and says it is ignored.

- [ ] **Step 1: Tests.** `conftest.py`: an autouse-free fixture `probe(seconds=84.0)` overriding `get_audio_probe` with a fake whose return value or exception a test can set; make the `client` fixture install it with 84.0 by default so existing tests keep passing. Speaking (`test_speaking_api.py`):
  - replace `test_duration_bounds` with `@pytest.mark.parametrize("measured,status", [(28.9, 422), (29.0, 201), (29.6, 201), (120.4, 201), (125.0, 201), (125.1, 422)])`, asserting `error.code` `AUDIO_TOO_SHORT` / `AUDIO_TOO_LONG` on 422 and that the model was not called and nothing stored.
  - `test_measured_length_is_stored_and_used_for_wpm` (probe 96.4, client sends 84 → `duration_seconds` 96, wpm `round(16*60/96)` = 10).
  - `test_duration_field_is_optional` (no `duration_seconds` → 201).
  - `test_unreadable_audio_is_422_before_the_model` and `test_missing_ffprobe_is_503` (code `AUDIO_PROBE_UNAVAILABLE`), nothing stored, model not called.
  - Delete `test_non_numeric_duration_is_422` (field ignored now).
  Interview (`test_interview_voice_api.py`): `test_a_voice_answer_over_185_seconds_is_422` (185.1 → `AUDIO_TOO_LONG`, message contains "3:00", no message stored, model not called), `test_a_voice_answer_of_185_seconds_is_accepted`, `test_an_unreadable_voice_answer_is_422_before_the_model`.
- [ ] **Step 2: Run** both files. Expected: new tests FAIL.
- [ ] **Step 3: Implement.** Speaking: `open_form` → `_read_speaking_form` → `read_audio_field` → `await run_in_threadpool(measure, probe, data, min_seconds=MIN_MEASURED_SECONDS, max_seconds=MAX_MEASURED_SECONDS, max_label="2:00")` → submit with the measured value. Interview multipart branch: the same with `max_seconds=MAX_ANSWER_SECONDS, max_label="3:00"`.
- [ ] **Step 4: Run** `pytest`. Expected: all PASS.
- [ ] **Step 5:** README: in the Speaking and interview voice paragraphs, say the server measures the recording's length (Speaking 30 s to 2:00, interview up to 3:00, small slack), `duration_seconds` is optional and ignored, and the new error codes. Vietnamese, no em-dashes.
- [ ] **Step 6: Commit** "Check the real length of every recording before grading it".

### Task 3: Retention columns, setting and the 410

**Files:**
- Create: `backend/alembic/versions/0006_audio_retention.py`
- Modify: `backend/app/models/interview.py`, `backend/app/models/speaking.py`, `scripts/init_db.sql`, `backend/app/core/config.py`, `.env.example`, `backend/app/services/interview_service.py` (`get_answer_audio`), `backend/app/api/routes_interview.py` (pass retention days), `backend/tests/test_interview_voice_api.py`

**Interfaces:**
- Produces: `SessionMessage.audio_deleted_at: Mapped[datetime | None]`; `SpeakingSubmission.audio_path: Mapped[str | None]`; `Settings.audio_retention_days: int = 90`; `get_answer_audio(..., retention_days: int)` raises 410 `AUDIO_EXPIRED` "This recording was deleted after {retention_days} days." when `audio_deleted_at` is set (checked before the missing-path 404).
- Migration 0006 (`down_revision = "0005"`): `ALTER TABLE session_messages ADD COLUMN IF NOT EXISTS audio_deleted_at TIMESTAMP`; `ALTER TABLE speaking_submissions ALTER COLUMN audio_path DROP NOT NULL`; downgrade drops the column and restores NOT NULL. `init_db.sql` gets the same column and a nullable `audio_path`.

- [ ] **Step 1: Test** `test_an_expired_recording_answers_410_with_the_retention_days`: answer by voice, set `audio_deleted_at` and `audio_path = None` on the message, override settings with `audio_retention_days=30`, GET the audio → 410, code `AUDIO_EXPIRED`, message "This recording was deleted after 30 days.".
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the columns, migration, `init_db.sql`, setting (`.env.example`: `AUDIO_RETENTION_DAYS=90` with a comment: days to keep recordings, 0 keeps them forever), and the 410.
- [ ] **Step 4: Run** `pytest`. Expected: PASS.
- [ ] **Step 5: Commit** "Record when a recording expired and answer 410 for it".

### Task 4: The cleanup job

**Files:**
- Create: `backend/app/jobs/__init__.py`, `backend/app/jobs/cleanup_audio.py`, `backend/tests/test_cleanup_audio.py`

**Interfaces:**
- Consumes: Task 3 columns and setting; `AudioStore(root)`.
- Produces:
  - `@dataclass class CleanupReport: expired: int; orphans: int; missing: int; freed_bytes: int; guarded: bool`
  - `cleanup(db: Session, root: Path, *, retention_days: int, now: datetime, dry_run: bool = False, force: bool = False, orphan_grace: timedelta = timedelta(hours=1)) -> CleanupReport`
  - `main(argv: list[str] | None = None) -> int`: flags `--dry-run`, `--force`, `--every 24h` (accepts `Nh` / `Nm`); opens `SessionLocal()`, `root = Path(get_settings().upload_dir)`, logs one line per action and a summary line `expired=3 orphans=1 missing=0 freed=4.2 MB`; with `--every` it loops forever, logging and continuing after a failed run. `if __name__ == "__main__": raise SystemExit(main())`. Logging via `logging.basicConfig(level=INFO)` inside `main` only.
- Steps inside `cleanup`, in order: expire (skip when `retention_days == 0`; rows with `audio_path` set and `created_at < now - retention_days`; delete file, clear `audio_path`, set `audio_deleted_at = now` on messages; commit), orphans (files under `interviews/` and `speaking/` not referenced by any `audio_path`, mtime older than `now - orphan_grace`; guard: when `orphans > len(all_files) / 2 and orphans > 10` and not `force`, delete nothing and set `guarded=True`; remove empty folders), missing (rows whose file does not exist: count and log). `dry_run` counts everything and changes nothing.

- [ ] **Step 1: Tests** (use `db_session`, `tmp_path` as root; create rows with explicit `created_at`; set file mtimes with `os.utime`):
  - `test_expired_interview_recording_is_deleted_and_marked` (file gone, `audio_path` None, `audio_deleted_at == now`)
  - `test_expired_speaking_recording_is_deleted`
  - `test_recordings_inside_the_window_are_kept`
  - `test_retention_zero_expires_nothing`
  - `test_an_old_orphan_is_deleted_and_its_empty_folder_removed`
  - `test_a_fresh_orphan_is_kept` (mtime 10 minutes ago)
  - `test_a_referenced_file_is_never_an_orphan`
  - `test_a_missing_file_is_counted_not_changed`
  - `test_the_guard_stops_a_sweep_that_would_delete_most_files` (12 old unreferenced files, 0 rows → nothing deleted, `guarded` True)
  - `test_force_overrides_the_guard`
  - `test_dry_run_changes_nothing` (expired row and old orphan both present → counts reported, files and rows unchanged)
  - `test_every_parses_hours_and_minutes` for the loop's interval parser.
- [ ] **Step 2: Run** `pytest tests/test_cleanup_audio.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pytest`. Expected: PASS.
- [ ] **Step 5: Commit** "Add the audio cleanup job: expiry, orphan sweep with a guard, dry run".

### Task 5: Compose service and README

**Files:**
- Modify: `docker-compose.yml`, `README.md`

- [ ] **Step 1:** Add service `cleanup` as the spec's "Compose and persistence" section describes (`build: ./backend`, `container_name: devcoach_cleanup`, `command: python -m app.jobs.cleanup_audio --every 24h`, `env_file: .env`, the same `DATABASE_URL` environment line as `backend`, volumes `./backend:/app` and `audio_uploads:/app/uploads`, `depends_on: db: condition: service_healthy`, `restart: unless-stopped`).
- [ ] **Step 2:** `docker compose config --quiet` exits 0.
- [ ] **Step 3:** README (Vietnamese, no em-dashes): recordings live in the `audio_uploads` volume and survive `restart` and `down`/`up`, but `docker compose down -v` deletes them; `AUDIO_RETENTION_DAYS` (default 90, 0 keeps forever); the `cleanup` service runs daily; run by hand with `docker compose exec backend python -m app.jobs.cleanup_audio --dry-run`; the guard and `--force`.
- [ ] **Step 4: Commit** "Run the audio cleanup daily in its own compose service".

### Task 6: Frontend messages

**Files:**
- Modify: `frontend/src/api/speaking.js`, `frontend/src/api/speaking.test.js`, `frontend/src/api/interview.js`, `frontend/src/api/interview.test.js`, `frontend/src/components/interview/AudioPlayer.jsx`, `frontend/src/components/interview/AudioPlayer.test.jsx`

**Interfaces:**
- `describeSpeakingError`: 422 `AUDIO_TOO_SHORT` / `AUDIO_TOO_LONG` → `${response.data.error.message} Your recording is kept.`; 503 with code `AUDIO_PROBE_UNAVAILABLE` → "The server cannot check recordings right now. Please try again later. Your recording is kept." (before the generic 503 branch). `AUDIO_UNREADABLE` keeps its current copy.
- `describeInterviewError`: 422 with code `AUDIO_TOO_LONG` or `AUDIO_UNREADABLE` → the server's `error.message`; 503 `AUDIO_PROBE_UNAVAILABLE` → "The server cannot check recordings right now. Please try again later." (before the generic 503).
- `AudioPlayer`: when loading from the server fails with status 410, read the JSON message from the blob body (`await error.response.data.text()`, `JSON.parse`, `.error.message`; fall back to "This recording has been deleted.") and show it in place of the player, with no "Try again" button. New status value `expired`.

- [ ] **Step 1: Tests** for each mapping above (exact strings) and `AudioPlayer` `shows the expiry message without Try again` (mock `fetchAnswerAudio` rejecting with `{ response: { status: 410, data: new Blob([JSON.stringify({ error: { code: 'AUDIO_EXPIRED', message: 'This recording was deleted after 90 days.' } })]) } }`).
- [ ] **Step 2: Run** `npx vitest run speaking interview AudioPlayer`. Expected: new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` and `npm run build`. Expected: PASS except the known ModeSwitch failure; build succeeds.
- [ ] **Step 5: Commit** "Show the new recording errors and expired recordings in the UI".

### Task 7: Check it in Docker, open the PR

- [ ] **Step 1:** `docker compose up -d --build`; `docker compose exec backend alembic upgrade head`, then `downgrade -1` and `upgrade head`; `docker compose exec backend python -m pytest tests/test_audio_probe.py` runs the real-ffprobe test (not skipped).
- [ ] **Step 2:** Send the three TTS WAVs from the #28 live run (scratchpad `speak/`, 37 / 46 / 30 s) to Speaking: 201 with `duration_seconds` 37 / 46 / 30. Send a 20 s WAV (→ 422 `AUDIO_TOO_SHORT`) and a file of `b"RIFF....WAVE"` plus random bytes (→ 422 `AUDIO_UNREADABLE`, Gemini not called).
- [ ] **Step 3:** Persistence: note a stored recording's path, `docker compose restart backend`, then `docker compose down` and `up -d`; the file is still in the volume each time (`docker compose exec backend ls uploads/speaking/1`).
- [ ] **Step 4:** `docker compose exec backend python -m app.jobs.cleanup_audio --dry-run` prints a summary and changes nothing; `docker compose logs cleanup` shows the first run.
- [ ] **Step 5:** Ask the user before pushing; push `feat/29-audio-upload-guard`, `gh pr create --base main`, body with "Closes #29", what changed, test results, the Docker checks above, and the attribution line.
