# Audio upload limits and cleanup design (issue #29)

**Intent:** spoken answers (interview room) and spoken standups (English Speaking) are stored as files in the `audio_uploads` volume. Issue #29 asks to harden that path: limit size, length and format, refuse forged files, keep random file names, clean up orphaned and expired files on a schedule, and confirm recordings survive a container restart. The point is a server that cannot be filled or fooled by uploads, and a disk that does not grow forever, without breaking what users see.

## What already exists (keep as is)

- 10 MB cap: `Content-Length` checked before the form is parsed, then counted while reading (`app/api/audio_upload.py`, `app/services/audio_store.py`).
- Type judged from magic bytes (webm / mp4 / ogg / wav), never from the file name or `Content-Type`.
- File names are `uuid4` hex; folders are built by the server (`interviews/<session_id>`, `speaking/<user_id>`); reads refuse paths that leave the upload root.
- `audio_uploads` is a named volume mounted at `/app/uploads`.

## Goals

1. **Measure the real length on the server** with `ffprobe` and enforce it: Speaking 30-125 s, interview voice answers at most 185 s (the recorder stops itself at 180 s). Speaking's words per minute uses the measured length.
2. **Refuse files that only look like audio:** a file whose first bytes pass the magic-byte check but that `ffprobe` cannot read is rejected before Gemini is called.
3. **Expire old recordings:** files older than `AUDIO_RETENTION_DAYS` (default 90; 0 keeps them forever) are deleted, the row's `audio_path` is cleared, and the interview report shows "This recording was deleted after 90 days." instead of a broken player.
4. **Remove orphans:** files under the upload root that no row points to, older than 1 hour, are deleted.
5. **Run the cleanup daily** from a `cleanup` service in `docker-compose.yml`; the same job can be run by hand with `--dry-run`.
6. **Confirm persistence:** a recording survives `docker compose restart` and `docker compose down` / `up`; the README says `docker compose down -v` deletes all recordings.

## Non-goals

- Changing the 10 MB cap, the accepted formats, or the file-name scheme.
- Transcoding or compressing stored audio.
- A UI to delete recordings by hand, or per-user quotas.
- Cleaning anything other than audio (CV PDFs are not stored).

## Anti-goals

- Deleting a file a row still needs before its retention period ends (the orphan sweep must not race an upload in progress: hence the 1 hour grace).
- A cached interview report that shows a player which then fails with a generic "Recording unavailable" for an expired file.
- Calling Gemini (cost and 15-30 s) for a file the server could have rejected itself.

## Approaches (decided with the user)

**What "expired" means: B, chosen.** Delete files older than N days (default 90, configurable), clear `audio_path`, tell the user in the report. Rejected: A, never expire and only remove orphans (simplest, disk grows about 1 MB per answer); C, keep the latest N sessions per type (count-based, harder to explain).

**How the server measures length: A, chosen.** `ffprobe` from ffmpeg in the backend image. It reads all four formats including Chrome's webm, whose header has no duration, and it catches forged files. Cost: about 80-100 MB on the image; unit tests use a fake probe. Rejected: B, hand-written parsers per format (about 200 lines to maintain, webm is hard, no forgery check); C, no real measurement (does not meet the issue).

**How the cleanup is scheduled: A, chosen.** A `cleanup` service in `docker-compose.yml`, same image as the backend, runs the job every 24 hours. Rejected: B, a background task inside the FastAPI process (runs again on every `--reload`, and once per worker); C, a host scheduler (Windows Task Scheduler or cron) set up by hand on each machine.

## Design

### Measuring and checking uploads

- `app/services/audio_probe.py`: `probe_duration(path_or_bytes) -> float` runs `ffprobe -v error` on the bytes (via a temporary file or stdin) with a 10 s timeout.
  - Duration: `format=duration` when present; otherwise the end time of the last audio packet (`-show_entries packet=pts_time,duration_time`), because Chrome's MediaRecorder webm has no duration in its header.
  - `ffprobe` exits non-zero, times out, or finds no audio stream: the file is unreadable.
  - `ffprobe` not installed: raise so the request fails with 503 `AUDIO_PROBE_UNAVAILABLE` (a deployment fault, not the user's).
- Called right after the magic-byte check (`read_audio_field`), before Gemini, by both voice routes. Injected as a FastAPI dependency so tests swap in a fake.
- New errors (English messages, shown as-is by the clients):
  - 422 `AUDIO_UNREADABLE` "We could not read this recording. Please record again." (same code the Gemini 400 path already uses).
  - 422 `AUDIO_TOO_SHORT` "This recording is shorter than 30 seconds. Please record a longer answer." (Speaking only).
  - 422 `AUDIO_TOO_LONG` "This recording is longer than the limit of N:NN. Please record a shorter answer."
- Limits on the measured length, as new constants (`MIN_SECONDS` / `MAX_SECONDS` = 30 / 120 stay as they are, since the prompts endpoint sends them to the UI as recorder limits):
  - Speaking: at least 29 s and at most 125 s. *Claude's call:* the UI enables Evaluate when its timer reaches 0:30, and a MediaRecorder file can measure a few hundred milliseconds less than that timer, so the server allows one second of slack at the bottom rather than rejecting a recording the UI allowed. The 125 s top already gives 5 s of slack over the 2:00 cap.
  - Interview: at most 185 s (recorder cap 180 s).
  - The messages name the user-facing limits ("shorter than 30 seconds", "longer than the limit of 2:00" / "3:00"), not the slack.
- Speaking: `duration_seconds` from the client becomes optional and is ignored; the stored `duration_seconds` and `words_per_minute` use the measured length, rounded to whole seconds. The frontend keeps sending it; nothing breaks for old clients.

### Retention and expiry

- Setting `audio_retention_days: int = 90` (`AUDIO_RETENTION_DAYS`); 0 disables expiry. Add it to `.env.example`.
- Migration `0006` (and `scripts/init_db.sql`):
  - `session_messages.audio_deleted_at TIMESTAMP NULL`.
  - `speaking_submissions.audio_path` becomes nullable.
- Expiry deletes the file, sets `audio_path = NULL`, and for interview messages sets `audio_deleted_at = now()`.
- `GET /interviews/{id}/answers/{message_id}/audio`: when `audio_deleted_at` is set, answer 410 `AUDIO_EXPIRED` "This recording was deleted after N days." (N from the setting). Cached reports keep their `audio_message_id`, so the report endpoint and its stored JSON do not change.
- **Error copy in the clients** (*Claude's call*):
  - Speaking (`describeSpeakingError`): `AUDIO_TOO_SHORT` and `AUDIO_TOO_LONG` show the server's `error.message` followed by "Your recording is kept."; `AUDIO_UNREADABLE` keeps its existing copy; 503 `AUDIO_PROBE_UNAVAILABLE` gets its own message, "The server cannot check recordings right now. Please try again later. Your recording is kept.", instead of the AI-unavailable one.
  - Interview (`describeInterviewError`): 422 with `AUDIO_TOO_LONG` or `AUDIO_UNREADABLE` shows the server's `error.message`; 503 `AUDIO_PROBE_UNAVAILABLE` gets the same message as Speaking without the last sentence. Tests for both.
- Frontend `AudioPlayer`: a 410 shows the server's message (read from the blob error body) in place of the player, with no Retry button. Other errors keep today's "Recording unavailable. Retry".
- Speaking keeps no playback UI for stored files, so a cleared `audio_path` needs no UI.

### The cleanup job

`python -m app.jobs.cleanup_audio [--dry-run] [--every 24h]`

1. **Expire:** rows with `audio_path` set and `created_at` older than the retention period (interview messages and speaking submissions): delete the file (missing file is fine), clear the row, commit in batches.
2. **Orphans:** walk `interviews/` and `speaking/` under the upload root; a file whose relative path no row references and whose modification time is older than 1 hour is deleted. Empty folders left behind are removed.
   - **Safety guard** (*Claude's call*): if the sweep would delete more than half of the files on disk and more than 10 files, it deletes nothing, logs an error naming the counts, and the run continues with the other steps. This protects against the job pointing at an empty, wrong or freshly reset database (`pgdata` wiped while `audio_uploads` survives, a changed `POSTGRES_DB`, a restore in progress), where every recording would look orphaned. `--force` overrides it for a deliberate clean-up. The expiry step needs no guard: it only touches rows that exist and are past the retention period.
3. **Missing files:** rows that point at a file that does not exist are logged, not changed.
4. Logs one line per action and a summary (`expired=3 orphans=1 missing=0 freed=4.2 MB`). `--dry-run` logs the same without deleting or writing.
5. `--every 24h` loops: run, then sleep; a failed run is logged and the loop continues.

### Compose and persistence

- Backend `Dockerfile`: `apt-get install -y --no-install-recommends ffmpeg`.
- New service `cleanup`: `build: ./backend`, `command: python -m app.jobs.cleanup_audio --every 24h`, same `env_file`, `DATABASE_URL`, `./backend:/app` and `audio_uploads:/app/uploads` mounts, `depends_on: db (healthy)`, `restart: unless-stopped`, no ports.
- Persistence check (manual, recorded in the PR): upload a recording, `docker compose restart backend`, then `down` / `up`, and fetch it each time. README: recordings live in the `audio_uploads` volume; `docker compose down -v` deletes them; how to run the cleanup by hand and with `--dry-run`; the retention setting.

### Tests

- Probe: fake-probe unit tests for each branch (format duration, packet fallback, non-zero exit, timeout, no audio stream, missing binary); one real-`ffprobe` test on a generated WAV, skipped when `ffprobe` is not on PATH.
- Routes: too short / too long / unreadable / probe unavailable for Speaking, too long / unreadable for interview; Gemini not called and nothing stored in each case; Speaking stores the measured duration and wpm.
- Audio endpoint: 410 `AUDIO_EXPIRED` with the retention days in the message.
- Cleanup safety guard: a sweep that would remove more than half of the files (and more than 10) deletes nothing and logs an error; `--force` deletes them.
- Error copy: Speaking and interview messages for the new codes, including `AUDIO_PROBE_UNAVAILABLE`.
- Cleanup: expiry (file gone, row cleared, `audio_deleted_at` set, rows inside the window untouched, retention 0 does nothing), orphan sweep (old orphan deleted, fresh orphan kept, referenced file kept, empty folder removed), missing file logged, `--dry-run` changes nothing.
- Frontend: `AudioPlayer` shows the 410 message without Retry.

## Left to the builder

Module names inside `app/jobs/`; whether the probe reads from a temp file or stdin; batch size; exact log format; how the loop parses `24h`; test file layout.
