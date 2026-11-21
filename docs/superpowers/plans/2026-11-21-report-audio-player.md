# Report Audio Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the interview report, every spoken answer gets a player: play/pause, seek, speed 1x/1.25x/1.5x, a waveform drawn from the real recording, position/duration, keyboard support (issue #25).

**Architecture:** The report's turns carry `audio_message_id`. A React `AudioPlayer` fetches the recording once as a Blob through the axios client, plays it from an object URL in a hidden `<audio>`, and decodes the same bytes with Web Audio for 48 peaks and the true duration.

**Tech Stack:** FastAPI + Pydantic (backend), React 18 + Tailwind + Vitest/Testing Library (frontend), Web Audio `OfflineAudioContext.decodeAudioData`.

**Spec:** `docs/superpowers/specs/2026-11-21-report-audio-player-design.md`

## Global Constraints

- `TurnOut.audio_message_id: int | None = None` — optional, so reports stored before this change still validate.
- Playback URL: `GET /interviews/{session_id}/answers/{message_id}/audio`.
- Waveform: 48 bars; played bars `#818cf8` (indigo-400), the rest `#475569` (slate-600); SVG `viewBox="0 0 240 32"` as in `design/Interview.dc.html`.
- Speeds cycle exactly `1 → 1.25 → 1.5 → 1`, shown as `1x`, `1.25x`, `1.5x`.
- Keys on the waveform slider: ←/→ ±5 s, Home → 0, End → duration.
- Time readout uses `formatMmSs` from `@/utils/time` (`00:12 / 01:05`).
- UI copy in English (as the rest of the report); README additions in Vietnamese.
- No new npm or pip dependencies.

## Review Focus

1. MediaRecorder webm reports `audio.duration === Infinity`: the readout and slider max must use the decoded duration, never show `Infinity`/`NaN`. (Task 3 test.)
2. Closing the question (unmount) while playing: audio pauses and the object URL is revoked. (Task 3 test.)
3. Starting a second player pauses the first one. (Task 3 test.)
4. Playback reaching the end: button goes back to "Play recording". (Task 3 test.)
5. A report stored before this change (no `audio_message_id`) or a typed answer: no player, nothing fetched. (Tasks 1 and 4 tests.)

---

### Task 1: Report turns carry the recording's message id

**Files:**
- Modify: `backend/app/schemas/interview.py` (`TurnOut`)
- Modify: `backend/app/services/interview_report.py` (`TurnRecord`, `group_turns`, `TurnOut(...)` in `_question_report`)
- Test: `backend/tests/test_interview_report_api.py`
- Modify: `README.md` (one line next to the playback URL, Vietnamese)

**Interfaces:**
- Produces: report JSON `questions[].turns[].audio_message_id: int | null`; it is the id accepted by the playback endpoint.

- [ ] **Step 1: Write failing tests** (reuse the `answer_voice`, `webm_bytes` helpers and the `audio_store` fixture the way `test_interview_voice_api.py` does):
  - `test_a_spoken_answer_in_the_report_points_at_its_recording`: start, `answer_voice(client, sid, webm_bytes(b"x"))`, finish; `turn = report["questions"][0]["turns"][0]`; `turn["audio_message_id"]` is an int and `client.get(f"/api/v1/interviews/{sid}/answers/{turn['audio_message_id']}/audio")` is 200 with the uploaded bytes.
  - `test_a_typed_answer_has_no_recording_in_the_report`: `turns[0]["audio_message_id"] is None`.
  - `test_a_report_stored_before_recordings_existed_still_loads`: finish a typed session, remove `"audio_message_id"` from every turn of `session.feedback_summary` in the DB (reassign the dict and commit), `GET /report` is 200 and the turn's `audio_message_id` is `None`.
- [ ] **Step 2: Run** `pytest tests/test_interview_report_api.py -v` — the first two FAIL (`KeyError`/missing key).
- [ ] **Step 3: Implement.** `TurnRecord.audio_message_id: int | None = None`, set in `group_turns` to `message.id if message.audio_path else None`; pass it into `TurnOut`.
- [ ] **Step 4: Run** `pytest -q` — all green.
- [ ] **Step 5: README** — under the playback URL line, say the report gives `audio_message_id` per turn (null for typed answers and for reports created before this change).
- [ ] **Step 6: Commit** "Point each spoken turn in the report at its recording".

### Task 2: Audio fetch and waveform helpers

**Files:**
- Modify: `frontend/src/api/interview.js`, test `frontend/src/api/interview.test.js`
- Create: `frontend/src/utils/waveform.js`, test `frontend/src/utils/waveform.test.js`

**Interfaces:**
- Produces:
  - `fetchAnswerAudio(sessionId: number, messageId: number, { signal } = {}) -> Promise<Blob>` — `api.get('/interviews/{sid}/answers/{mid}/audio', { responseType: 'blob', signal })`, returns `data`.
  - `computePeaks(channels: Float32Array[], bars: number) -> number[]` — `bars` values in `[0, 1]`: per bucket the max absolute sample across channels, divided by the loudest bucket; all zeros when silent or empty.
  - `decodePeaks(blob: Blob, bars: number) -> Promise<{ peaks: number[], duration: number }>` — `new OfflineAudioContext(1, 1, 44100).decodeAudioData(await blob.arrayBuffer())`, then `computePeaks` over every channel; rejects if decoding fails or Web Audio is missing.
  - `nextSpeed(rate: number) -> number` — `1 → 1.25 → 1.5 → 1`; any other value → `1`.
  - `WAVE_BARS = 48`.

- [ ] **Step 1: Write failing tests.**
  - `fetchAnswerAudio`: mocks `api.get` the way existing tests in `interview.test.js` do; asserts URL `/interviews/7/answers/42/audio`, `responseType: 'blob'`, and the returned value is the response `data`.
  - `computePeaks([Float32Array.of(0, 0.5, 0, -1)], 2)` → `[0.5, 1]`.
  - Two channels: `computePeaks([Float32Array.of(0.2, 0), Float32Array.of(0, -0.4)], 2)` → `[0.5, 1]`.
  - Silence `computePeaks([new Float32Array(8)], 4)` → `[0, 0, 0, 0]`; empty `computePeaks([new Float32Array(0)], 3)` → `[0, 0, 0]`.
  - Fewer samples than bars: `computePeaks([Float32Array.of(1, 0.5)], 4)` has length 4, no `NaN`.
  - `nextSpeed`: `1→1.25`, `1.25→1.5`, `1.5→1`, `2→1`.
  - `decodePeaks` with a stubbed global `OfflineAudioContext` whose `decodeAudioData` resolves `{ duration: 3.2, numberOfChannels: 1, getChannelData: () => Float32Array.of(0, 1) }` → `{ duration: 3.2, peaks: [0, 1] }` for `bars = 2`; with no `OfflineAudioContext` it rejects.
- [ ] **Step 2: Run** `npx vitest run src/api/interview.test.js src/utils/waveform.test.js` — FAIL.
- [ ] **Step 3: Implement** as in Interfaces. Bucket `i` covers samples `[floor(i*n/bars), max(start+1, floor((i+1)*n/bars)))` clamped to `n`.
- [ ] **Step 4: Run** the same command — PASS.
- [ ] **Step 5: Commit** "Fetch recordings and turn their samples into waveform peaks".

### Task 3: AudioPlayer component

**Files:**
- Create: `frontend/src/components/interview/AudioPlayer.jsx`, test `frontend/src/components/interview/AudioPlayer.test.jsx`

**Interfaces:**
- Consumes: `fetchAnswerAudio`, `decodePeaks`, `nextSpeed`, `WAVE_BARS` (Task 2); `formatMmSs`.
- Produces: `AudioPlayer({ sessionId: number, messageId: number, label?: string /* default 'Recording' */ })`.

Behaviour:
- Mount: fetch the Blob (abort on unmount), `URL.createObjectURL` it as the `<audio>` src (no `controls`, `preload="metadata"`), and `decodePeaks` it. While loading: a `role="status"` "Loading recording…", disabled Play button, flat bars.
- Fetch fails: text "Recording unavailable" and a "Try again" button that refetches. Decode fails: still playable, flat bars, duration from `audio.duration` when finite.
- Duration = decoded duration, else `audio.duration` when finite, else unknown (slider `aria-disabled="true"`, readout `--:--`).
- Play button: `aria-label` "Play recording" / "Pause recording"; icon `Play`/`Pause` from lucide-react; indigo filled circle as in the design.
- Waveform: a `div role="slider" tabIndex=0 aria-label={`${label} position`} aria-valuemin=0 aria-valuemax={round(duration)} aria-valuenow={round(current)} aria-valuetext="00:12 of 01:05"`, containing the 48-bar SVG (bar height from peak, minimum 2 px so silence is a line). Pointer down/move on it seeks to the pointer's fraction of the width (use `setPointerCapture`). Keys per Global Constraints, clamped to `[0, duration]`, `preventDefault` on handled keys. Visible focus ring (`focus-visible:ring-2 ring-indigo-400`).
- Readout `formatMmSs(current) / formatMmSs(duration)` in mono 12 px.
- Speed button: text `1x` etc., `aria-label={`Playback speed ${speed}x`}`, sets `audio.playbackRate`.
- While playing, update `current` every animation frame from `audio.currentTime`; on `pause`/`ended` stop the loop; `ended` → Play state.
- One at a time: a module-level `let playing = null`; on play, pause the previous element if it is a different one.
- Unmount: pause, `URL.revokeObjectURL`.

- [ ] **Step 1: Write failing tests.** Mock `@/api/interview` (`fetchAnswerAudio`) and `@/utils/waveform` (`decodePeaks`; keep the real `nextSpeed`, `WAVE_BARS`); stub `URL.createObjectURL`/`revokeObjectURL`; spy on `HTMLMediaElement.prototype.play` (resolve, then `dispatchEvent(new Event('play'))`) and `.pause` (dispatch `pause`).
  - `test: fetches the recording for its session and message and enables Play` (`fetchAnswerAudio` called with `(7, 42, expect.objectContaining({ signal }))`; Play enabled after load).
  - `shows the decoded duration even when the element reports Infinity` (decode → `{ duration: 65, peaks }`; readout `00:00 / 01:05`).
  - `play toggles to pause and back` (click Play → `play` called, button now "Pause recording"; click → `pause` called).
  - `arrow keys seek five seconds and Home/End jump` (focus slider; `{ArrowRight}` → `audio.currentTime === 5`; `{End}` → 65; `{ArrowRight}` stays 65; `{Home}` → 0; `{ArrowLeft}` stays 0).
  - `the speed button cycles 1x, 1.25x, 1.5x and sets the playback rate`.
  - `clicking the waveform seeks to that point` (stub `getBoundingClientRect` → `{ left: 0, width: 200 }`; pointer down at `clientX: 50` → `currentTime === 16.25`).
  - `ending playback shows Play again` (dispatch `ended`).
  - `starting a second player pauses the first`.
  - `unmounting pauses and frees the recording` (`revokeObjectURL` called with the created URL).
  - `a failed download says the recording is unavailable and can be retried` (first call rejects, second resolves; Try again → Play enabled).
  - `a recording that cannot be decoded is still playable` (decode rejects; Play enabled; slider not disabled when `audio.duration` is stubbed finite via `Object.defineProperty`).
- [ ] **Step 2: Run** `npx vitest run src/components/interview/AudioPlayer.test.jsx` — FAIL (module missing).
- [ ] **Step 3: Implement** per Behaviour.
- [ ] **Step 4: Run** it again — PASS; then `npx vitest run` — all green.
- [ ] **Step 5: Commit** "Add the recorded-answer player: real waveform, seek, speed, keyboard".

### Task 4: Players in the report

**Files:**
- Modify: `frontend/src/components/interview/QuestionBreakdown.jsx`, `frontend/src/pages/InterviewReport.jsx`
- Test: `frontend/src/pages/InterviewReport.test.jsx`

**Interfaces:**
- Consumes: `AudioPlayer` (Task 3); `turn.audio_message_id` (Task 1).
- Produces: `QuestionBreakdown({ sessionId, questions })`; `InterviewReport` passes `report.session_id`.

- [ ] **Step 1: Write failing tests** (mock `fetchAnswerAudio` to resolve a Blob and `decodePeaks` to resolve `{ duration: 10, peaks: [] }`, as in Task 3):
  - `a spoken answer gets a player under "Your recorded answer"`: set `turns[0].audio_message_id = 42` on the open (weakest) question; the caption "Your recorded answer" and a "Play recording" button are in that panel; `fetchAnswerAudio` called with `(7, 42, …)`.
  - `a spoken follow-up gets its own player`: second turn with `audio_message_id: 43` → a slider named `Follow-up 1 position` inside the "Follow-up exchange" section.
  - `typed answers and older reports show no player and fetch nothing`: the existing `REPORT` (no field) → no "Play recording" button, `fetchAnswerAudio` not called.
- [ ] **Step 2: Run** `npx vitest run src/pages/InterviewReport.test.jsx` — new tests FAIL.
- [ ] **Step 3: Implement.** In the open panel, before "AI critique": when `q.turns[0].audio_message_id` is set, a `Caption` "Your recorded answer" and `<AudioPlayer sessionId messageId label="Your answer" />`. In `FollowUps`, when a turn has `audio_message_id`, an `AudioPlayer` with `label={`Follow-up ${i + 1}`}` under its answer.
- [ ] **Step 4: Run** `npx vitest run` and `npm run build` — green, build succeeds.
- [ ] **Step 5: Commit** "Show the recorded-answer players in the report".

### Task 5: Check in a browser

- [ ] **Step 1:** Run the stack (`docker compose up`), start an interview, send one voice answer through the API (`curl -F audio=@sample.webm …/answer`), finish, open `/interview/{id}/report`.
- [ ] **Step 2:** Confirm: waveform shape matches the recording, duration is finite, play/pause, click-seek, ←/→/Home/End, speed cycling, a second player pauses the first, collapsing stops playback. Report what was and was not checked (e.g. Safari mp4 not tried).
