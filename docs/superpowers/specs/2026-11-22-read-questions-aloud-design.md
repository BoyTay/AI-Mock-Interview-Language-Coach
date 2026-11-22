# Read the AI's questions aloud (issue #26)

**Intent:** in the interview room the AI Interviewer reads each question aloud in English, so the session feels like a spoken interview. The card shows "Speaking" with a moving waveform while it reads; the user can mute and replay; nothing plays before the user agrees; browsers without an English voice keep today's text-only room.

**Goals:** auto-read new questions (main and follow-up) when the user has opted in; Replay; mute toggle; first-time consent prompt remembered per browser. **Non-goals:** Gemini TTS or any backend change; reading feedback/critique; voice or speed pickers. **Anti-goals:** sound before consent; the reading leaking into the user's own recording.

**Constraints:**
- Web Speech API (`speechSynthesis`) gives start/end/boundary events but no audio levels, so the waveform can only follow speaking/not speaking.
- Chrome refuses `speak()` without a user activation (e.g. after a refresh); that must fail quietly.
- Voices load asynchronously (`voiceschanged`).

**Approaches:**
1. *Chosen:* Web Speech wrapped in a `useSpeech` hook used by the room. No backend, no quota, instant; waveform not amplitude-true.
2. Gemini TTS through a new endpoint: better voice and a real waveform, but quota per question and latency; the issue lists it as a fallback.
3. An app-wide speech context: unnecessary while only the room speaks.

**Design:**
- `useSpeech()` → `{ supported, speaking, speak(text), stop() }`. Picks a voice by language: `en-US`, then `en-GB`, then any `en-*`; `supported` is false without `speechSynthesis` or without an English voice. Stops on unmount; a refused or failed utterance just ends `speaking`.
- Preference in `localStorage` (`on` / `off`, unset = not asked yet), wrapped in try/catch.
- Interviewer card: a `speaking` state (badge "Speaking" with live dot, as in the design); waveform animates only while speaking; when supported: first-time prompt "Read questions aloud?" [Read aloud] [Keep silent] (Read aloud saves `on` and reads the current question at once), a mute toggle, and "Replay question" (reads once even when muted).
- The room reads a question when it becomes current and the preference is `on`; it stops reading when recording starts, when an answer is sent, when the session ends, on mute and on leaving.
- Without support: no prompt, no controls.

**Left to the builder:** exact control styling following the card; how the stop-on-record signal travels from the Voice tab (a callback prop is fine).
