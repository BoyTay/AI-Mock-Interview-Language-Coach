# Read Questions Aloud Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The AI Interviewer reads each question aloud with the browser's English voice once the user opts in, shows "Speaking" with a moving waveform meanwhile, and offers mute and replay (issue #26).

**Architecture:** A `useSpeech` hook wraps `speechSynthesis` (voice choice, speaking state, stop on unmount). The room owns the read-aloud preference (localStorage) and decides when to speak or stop; `InterviewerCard` only renders state and controls from props.

**Tech Stack:** React 18, Tailwind, Vitest + Testing Library, Web Speech API.

**Spec:** `docs/superpowers/specs/2026-11-22-read-questions-aloud-design.md`

## Global Constraints

- Web Speech API only; no backend change, no new dependency.
- Voice order: `en-US`, then `en-GB`, then any `en-*` (case-insensitive, `-` or `_`). No English voice or no `speechSynthesis` → `supported === false` → no prompt, no controls.
- Preference key `devcoach.readAloud`, values `'on'` / `'off'`; missing or unreadable → `null` (not asked yet). Every storage access in try/catch.
- Copy (English, like the room): prompt `Read questions aloud?`, buttons `Read aloud` / `Keep silent`; toggle `aria-label="Read questions aloud"` with `aria-pressed`; button `Replay question`; badge `Speaking`.
- Only questions are read (main and follow-up), never feedback.
- Reading stops when: recording starts, an answer is sent, the toggle turns off, the room unmounts.
- Waveform in the card animates only while speaking; reduced motion keeps it static (existing `motion-safe:`).

## Review Focus

1. Voices load late (`getVoices()` empty, then `voiceschanged`): `supported` becomes true and an opted-in user hears the current question. (Task 1 and Task 4 tests.)
2. The browser refuses or fails an utterance (`onerror`, e.g. `not-allowed` after a refresh): `speaking` returns to false and the card says "Waiting for you". (Task 1 test.)
3. An older utterance ending after a newer one started must not clear `speaking`. (Task 1 test.)
4. Storage blocked (private mode): loading gives `null`, saving does not throw, the room still works. (Task 1 test.)
5. Recording starts while the question is being read: reading stops so the mic does not capture it. (Task 3 and Task 4 tests.)

---

### Task 1: Speech helpers and `useSpeech`

**Files:**
- Create: `frontend/src/utils/speech.js`, test `frontend/src/utils/speech.test.js`
- Create: `frontend/src/hooks/useSpeech.js`, test `frontend/src/hooks/useSpeech.test.js`
- Create: `frontend/src/test/fakeSpeech.js` (test helper, used again in Task 4)

**Interfaces:**
- Produces:
  - `pickEnglishVoice(voices: SpeechSynthesisVoice[]) -> SpeechSynthesisVoice | null`
  - `READ_ALOUD_KEY = 'devcoach.readAloud'`; `loadReadAloud() -> 'on' | 'off' | null`; `saveReadAloud(value: 'on' | 'off') -> void`
  - `useSpeech() -> { supported: boolean, speaking: boolean, speak(text: string): void, stop(): void }` — `speak` cancels anything playing, then speaks one `SpeechSynthesisUtterance` with the picked voice and its `lang`; `onstart` sets `speaking` true; `onend`/`onerror` set it false only for the latest utterance; `stop()` cancels and sets false; unmount cancels; listens to `voiceschanged` (add/removeEventListener) to recompute `supported`. With `supported` false, `speak` does nothing.
  - `installFakeSpeech({ voices = [{ lang: 'en-US', name: 'US' }] } = {}) -> fake` in `src/test/fakeSpeech.js`: stubs `window.speechSynthesis` (`getVoices`, `speak`, `cancel`, add/removeEventListener) and `window.SpeechSynthesisUtterance` (plain class keeping `text`, `voice`, `lang`, handlers). `fake.spoken` (utterances in order), `fake.cancel` (a `vi.fn`), `fake.start()` / `fake.end()` / `fake.fail(error)` fire the handlers of the last spoken utterance (wrapped in `act`), `fake.setVoices(list)` replaces voices and fires `voiceschanged`. Uses `vi.stubGlobal`; tests call `vi.unstubAllGlobals()` in `afterEach`.

- [ ] **Step 1: Write failing tests.**
  - `speech.test.js`: `pickEnglishVoice` returns the `en-US` voice from `[fr-FR, en-GB, en-US]`; returns `en-GB` from `[fr-FR, en-GB, en-AU]`; returns `en_AU` from `[vi-VN, en_AU]`; returns `null` from `[vi-VN]` and `[]`. `loadReadAloud()` is `null` when unset, `'on'` after `saveReadAloud('on')`, `null` for a stored `'maybe'`; with `localStorage.getItem`/`setItem` spied to throw, `loadReadAloud()` is `null` and `saveReadAloud('on')` does not throw.
  - `useSpeech.test.js` (`renderHook`):
    - `is unsupported without speechSynthesis` (stub `speechSynthesis` undefined) → `supported` false; `speak('x')` speaks nothing.
    - `is unsupported without an English voice` (voices `[vi-VN]`) → false.
    - `becomes supported when voices arrive later` (voices `[]`, then `fake.setVoices([en-US])`) → true.
    - `speaks with the English voice and reports speaking until the end` → `fake.spoken[0].text === 'What is an index?'`, `voice.lang === 'en-US'`, `lang === 'en-US'`; `speaking` false → `fake.start()` → true → `fake.end()` → false.
    - `a refused utterance ends speaking` → `start()` then `fail('not-allowed')` → false.
    - `speaking again cancels the previous utterance and its late end is ignored` → speak A, start, speak B, start; `fake.cancel` called; fire A's `onend` directly → still true.
    - `stop cancels and ends speaking`; `unmount cancels`.
- [ ] **Step 2: Run** `npx vitest run src/utils/speech.test.js src/hooks/useSpeech.test.js` — FAIL (modules missing).
- [ ] **Step 3: Implement** per Interfaces.
- [ ] **Step 4: Run** the same — PASS.
- [ ] **Step 5: Commit** "Add a speech hook that reads text with an English browser voice".

### Task 2: Interviewer card speaks

**Files:**
- Modify: `frontend/src/components/interview/Waveform.jsx`, test `Waveform.test.jsx`
- Modify: `frontend/src/components/interview/InterviewerCard.jsx`, test `frontend/src/components/interview/InterviewerCard.test.jsx` (create)

**Interfaces:**
- Produces:
  - `Waveform({ ..., active = true })` — decorative mode only: `active={false}` renders the same bars without the `animate-` class (static).
  - `InterviewerCard({ state, speechSupported = false, readAloud = null, onReadAloudChange, onReplay, canReplay = false })`; `state` is `'waiting' | 'thinking' | 'speaking' | 'done'`. `speaking` → badge tone `g`, label `Speaking`, pulsing dot. The waveform is `active` only when `state === 'speaking'`. When `speechSupported`: `readAloud === null` shows the prompt (`onReadAloudChange('on')` / `('off')`); otherwise the toggle (`aria-pressed={readAloud === 'on'}`, click → `onReadAloudChange(readAloud === 'on' ? 'off' : 'on')`, icons `Volume2` / `VolumeX`) and `Replay question` (`RotateCcw` icon, disabled unless `canReplay`, click → `onReplay()`). Not supported: none of these.

- [ ] **Step 1: Write failing tests.**
  - Waveform: `an inactive decorative waveform keeps its bars but does not move` (`bars={4} active={false}` → 4 bars, no `animate-` class).
  - InterviewerCard: `speaking shows the Speaking badge and moves the waveform`; `waiting keeps the waveform still`; `without speech support there is no prompt and no controls`; `first time it asks, and each answer reports the choice` (`Read aloud` → `onReadAloudChange('on')`, `Keep silent` → `'off'`); `once chosen it shows the toggle and replay instead of the prompt` (`readAloud='on'` → toggle `aria-pressed="true"`; click → `'off'`; `Replay question` → `onReplay`); `replay is disabled without a question` (`canReplay={false}`).
- [ ] **Step 2: Run** `npx vitest run src/components/interview/Waveform.test.jsx src/components/interview/InterviewerCard.test.jsx` — new tests FAIL.
- [ ] **Step 3: Implement.** Prompt and controls sit in one row under the waveform; the prompt is text plus two small buttons styled after `ghostButton`/`primaryButton` from `./buttonStyles`.
- [ ] **Step 4: Run** the same — PASS.
- [ ] **Step 5: Commit** "Let the interviewer card show speaking, ask to read aloud, mute and replay".

### Task 3: Recording tells the room it started

**Files:**
- Modify: `frontend/src/components/interview/VoiceDock.jsx`, `AnswerDock.jsx`; test `AnswerDock.test.jsx`

**Interfaces:**
- Produces: `AnswerDock({ ..., onRecordStart })` passes it to `VoiceDock({ ..., onRecordStart })`, which calls `onRecordStart?.()` before `start()` (mic button) and before the restart in `recordAgain`.

- [ ] **Step 1: Write failing test** in `AnswerDock.test.jsx`, following how that file already fakes the recorder: `starting a recording tells the room first` — Voice tab, click `Start recording` → `onRecordStart` called once.
- [ ] **Step 2: Run** `npx vitest run src/components/interview/AnswerDock.test.jsx` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** "Let the answer dock say when recording starts".

### Task 4: The room reads questions

**Files:**
- Modify: `frontend/src/pages/InterviewRoom.jsx`, test `InterviewRoom.test.jsx`

**Interfaces:**
- Consumes: `useSpeech`, `loadReadAloud`/`saveReadAloud` (Task 1); `InterviewerCard` props (Task 2); `AnswerDock onRecordStart` (Task 3); `installFakeSpeech` (Task 1).

Behaviour: `readAloud` state initialised from `loadReadAloud()`; `onReadAloudChange(v)` saves and sets it, and `'off'` stops reading. An effect keyed on `current?.message_id`, `readAloud` and `speech.supported` speaks `current.text` when `readAloud === 'on'` and supported. `onSend` stops reading before submitting; `onRecordStart` stops reading; `onReplay` speaks `current.text`. Card state: `done` if complete, else `thinking` while sending, else `speaking` while `speech.speaking`, else `waiting`.

- [ ] **Step 1: Write failing tests** (`installFakeSpeech()` in `beforeEach`, `localStorage.clear()`, `vi.unstubAllGlobals()` in `afterEach`):
  - `the first visit asks before reading and reads nothing yet` → prompt visible, `fake.spoken` empty.
  - `choosing Read aloud reads the current question and remembers it` → spoken `'What is an index?'`; `localStorage['devcoach.readAloud'] === 'on'`; after `fake.start()` the card shows `Speaking`.
  - `Keep silent reads nothing and is remembered` → `'off'`, nothing spoken, toggle shown not pressed.
  - `with reading on, the next question is read after an answer` → saved `'on'`; send an answer (mock `submitAnswer` resolving a next question `'How do you pick columns?'`); last spoken text is that question; `fake.cancel` was called when sending.
  - `muting stops reading and later questions stay silent`.
  - `replay reads the question again even when muted`.
  - `starting a recording stops the reading` → `'on'`, Voice tab, `Start recording` → `fake.cancel` called (fake the recorder as `AnswerDock.test.jsx` does, or mock `@/hooks/useAudioRecorder`).
  - `voices that arrive late still read the question` → voices `[]`, saved `'on'`, then `fake.setVoices([en-US])` → spoken.
  - `without an English voice the room is text only` → voices `[vi-VN]` → no prompt, no `Replay question`.
- [ ] **Step 2: Run** `npx vitest run src/pages/InterviewRoom.test.jsx` — new tests FAIL; existing room tests must still pass (they run without speech support unless the fake is installed — install it only in the new `describe` block).
- [ ] **Step 3: Implement** per Behaviour.
- [ ] **Step 4: Run** `npx vitest run` (only the known `ModeSwitch.test.jsx` failure may remain) and `npm run build`.
- [ ] **Step 5: Commit** "Read each question aloud in the interview room once the user opts in".

### Task 5: Check in a browser

- [ ] Run the frontend dev server against a throwaway mock of `POST /interviews/{id}/answer` (or a seeded `sessionStorage` session) and confirm in Chrome: prompt on first visit, Read aloud speaks and shows Speaking with moving bars that stop at the end, next question is read, mute and replay work, starting a recording cuts the reading, a refresh with reading on does not crash (Replay works after a click). Note voices available and what was not checked (Firefox, Safari).
