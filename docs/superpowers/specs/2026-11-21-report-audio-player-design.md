# Report audio player (issue #25)

**Intent:** in the interview report, let the candidate listen back to each spoken answer: play, pause, seek, speed 1x/1.25x/1.5x, a waveform drawn from the real recording, position and duration shown, all usable from the keyboard.

**Goals:** a player for every answer (main or follow-up) that was spoken. **Non-goals:** sending voice answers from the room (Voice tab "Send answer" is separate work), backfilling reports finished before this change, downloading the file. **Anti-goals:** a fake or decorative waveform; a player that cannot be used without a mouse.

**Constraints:**
- The report is stored as JSON when the interview finishes, so new fields must be optional; old reports simply show no player.
- Playback endpoint (from #24): `GET /interviews/{id}/answers/{message_id}/audio`, owner-checked.
- MediaRecorder webm often reports `duration = Infinity`, so the duration must come from decoding.

**Approaches:**
1. *Chosen:* report carries `audio_message_id` per turn; the player fetches the file once (axios, as a Blob), plays it from an object URL and decodes the same bytes with Web Audio for peaks and duration. One request, works if auth headers are added later.
2. `<audio src>` pointing at the endpoint plus a second fetch for the waveform: two downloads, and `src` cannot carry auth headers.
3. Compute peaks on the backend: needs an audio decoding dependency (ffmpeg) on the server for a purely visual feature.

**Design:**
- Backend: `TurnOut.audio_message_id: int | None = None`, set from the USER message when it has an `audio_path`.
- Frontend `AudioPlayer({ sessionId, messageId })`: loads when mounted (panels mount only when opened); Play/Pause button; waveform of 48 bars as a `role="slider"` (click/drag to seek, ←/→ ±5 s, Home/End); `m:ss / m:ss` readout; speed button cycling 1x → 1.25x → 1.5x; only one player plays at a time; pauses and frees the object URL on unmount.
- Placement: "Your recorded answer" at the top of an open question (first turn), and a smaller player inside each follow-up turn that was spoken.
- Errors: fetch fails → "Recording unavailable" with Try again; decode fails → still playable, flat waveform, duration from the element when finite.

**Left to the builder:** peak bucketing (max absolute sample per bar, normalised to the clip's loudest bar), smooth playhead updates while playing, exact styling following `design/Interview.dc.html`.
