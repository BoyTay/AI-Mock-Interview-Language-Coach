# English Speaking screen design (issue #27)

**Intent:** the sidebar says "English Writing & Speaking" and the spec promises spoken-English analysis, but there is no Speaking screen. This issue designs it, as a mockup in `design/` like the other six screens, so the React work that follows has a reference. The screen is for practising a spoken Tech Daily Standup: one prompt, one recording, a language score and the mistakes to keep.

**Goals:**
- Mockup `design/Speaking.dc.html`: prompt, record, replay and re-record, transcript, band scores for Fluency, Pronunciation, Vocabulary and Grammar, mispronounced words and filler words marked in the transcript, speaking rate, Save to Flashcards.
- A Writing | Speaking switch on the `/english` page, drawn in both `Writing.dc.html` and `Speaking.dc.html`.
- Register the board in `design/canvas.json`; describe the screen in the README.

**Non-goals:** React code, backend endpoints, Gemini prompts (later issues); IELTS Speaking (Parts 1-3 need a preparation step and a different timer, out of scope for v1); a new sidebar item.

**Anti-goals:**
- Confusing it with the interview room's "Tech Daily Standup" session type. The room asks several questions and grades content (0-100); this screen is one prompt, one recording, and grades the English (band 0-9).
- Colour as the only signal for a marked word.
- Sending audio for grading before the user has had the chance to listen to it. (Listening is offered, not required: pressing Evaluate is the acceptance. *Claude's call.*)

**Constraints:**
- Same file format as the other boards: `<x-dc>` with `<helmet>`, `{{}}` bindings, `sc-if` / `sc-for`, a class with `this.state`. Files only render in the Claude Design canvas (`support.js` is not in the repo).
- Same design system: slate-950 page, slate-900 cards with slate-800 borders, indigo-600 accent; emerald / amber / rose for good / needs work / error; Inter for UI, JetBrains Mono for numbers. Reuse the classes already in `Writing.dc.html` (`.card`, `.btn-p`, `.btn-g`, `.btn-i`, `.bd.*`, `.seg`, `.tab`, `.cap`) and the recording look in `Interview.dc.html` (`.mic` with pulse rings, `.livedot`, the timer, the static 48-bar waveform player).
- Icons are inline Lucide SVG paths, as in every existing board (the project depends on `lucide-react`).
- What the API can feed later: the voice answer endpoint already returns `fluency_score`, `filler_words` and a free-text `pronunciation_notes`. Word-level pronunciation marks, Vocabulary and Grammar bands and the speaking rate are new data the design asks for.

**Approaches:**
1. *Chosen:* hand-write `Speaking.dc.html` in the existing format, copying the shell from `Writing.dc.html`, with a "Preview state" switcher like `SessionSetup.dc.html`. Consistent with the six boards and reviewable as a diff; needs the Design canvas to view.
2. Draw it in the Claude Design tool on claude.ai and bring it back: clickable link at once, but a conversion step and drift from the existing boards.
3. Skip the mockup and build React: the issue is a design issue; code comes after the design is accepted.

## Decisions taken in the conversation

- **Placement:** a Writing | Speaking segmented switch at the top of the English page. Each side has its own URL (`/english/writing`, `/english/speaking`); the sidebar keeps the single "English Writing & Speaking" item, active on both.
- **Task:** Tech Daily Standup only. No task-type switch on Speaking.
- **Scores:** IELTS-style bands 0-9 in steps of 0.5 for each criterion and an overall band, as on Writing.
- **Flow:** record, stop, listen back, then either record again or evaluate. One Gemini request per accepted recording.
- **Flashcards:** a "Save to Flashcards" button on each mistake, reusing the existing card types: grammar → `GRAMMAR_ERROR` (front: the sentence as said, back: the corrected sentence and why); mispronounced word or vocabulary upgrade → `VOCABULARY` (front: the word, back: how to say it or the better word, with a note). No new card type.

## The screen

App shell as on Writing (sidebar with "English Writing & Speaking" active, header titled "English Speaking Coach"). Under the header, the Writing | Speaking switch. Two columns at desktop, stacking to one below about 1000px, like Writing:

```
[ Writing | Speaking ]                               Preview state: [Ready][Recording][Recorded][Grading][Result][Mic blocked]
+-- Practice -------------------------+  +-- AI grading ---------------------------+
| Tech Daily Standup      1-2 min     |  | BAND 6.5   Overall band                  |
| Prompt text ........... [New prompt]|  |            one-line summary              |
|                                     |  |  Fluency 7.0  Pronunciation 6.0          |
|          ( mic )                    |  |  Vocabulary 6.5  Grammar 6.5             |
|          0:00 / 2:00                |  |  128 words/min   ·  6 fillers  ·  1:24   |
|  Press to start. Speak for 1-2 min. |  +------------------------------------------+
|                                     |  | [Transcript] [Mistakes 7]                |
| recorded: > ||||||||||||  1:24      |  |  transcript with marks + legend          |
|   [Record again]       [Evaluate]   |  |  selected mark -> explanation + Save     |
+-------------------------------------+  +------------------------------------------+
```

**Left column, Practice:**
- Task label "Tech Daily Standup" (no switch), suggested length "1-2 min", the prompt text, and "New prompt" as a ghost button. Sample prompts are spoken versions of the five Writing standup prompts ("Give your daily standup update: ...").
- Recorder, by state:
  - *Ready:* the large mic button (indigo, not red, until recording), timer `0:00 / 2:00`, one line of help. Primary action: Record.
  - *Recording:* red `.mic` with pulse rings, live timer, "Recording" label with live dot, a live waveform; Stop is the only action. 2:00 is the cap: recording stops itself there.
  - *Recorded:* the waveform player (play/pause, played portion, duration), "Record again" (ghost) and "Evaluate" (primary). Minimum length 0:30 (decided with the user): a shorter recording keeps Evaluate disabled with the hint "Speak for at least 0:30". The preview shows this with a short sample recording.
  - *Grading:* recorder locked, player still playable; Evaluate shows a busy state.
  - *Result:* the player stays with "Record again" (ghost); no Evaluate, since this recording is already graded. *Claude's call.*
  - *Mic blocked:* inline message under the mic: the browser blocked the microphone, how to allow it, and "Try again".
  - Two more error messages, shown inline in the Recorded state after a failed Evaluate, with the recording kept: "We could not hear any speech" (re-record) and "We could not read this recording" (re-record or try again). Rate limit: "Too many requests, try again in N seconds", recording kept.

- *Second try (Claude's calls):* "Record again" from Result keeps the graded result on the right, labelled "Previous result", until a new Evaluate replaces it. "New prompt" is disabled while Recording and Grading; when an unsent recording or a result is on screen it asks inline first ("Discard this recording?" Discard / Cancel), then clears both columns back to Ready.

**Right column, AI grading:**
- *Before a result* (Ready, Recording, Recorded): an empty state explaining what will appear: four bands, speaking rate, marked transcript, mistakes to save.
- *Grading:* skeleton blocks in the shape of the result (score block, four score rows, transcript lines), with `aria-busy`.
- *Result:*
  - Overall band tile (same as Writing's BAND tile, colour by band), a one-line summary, and change vs the previous standup recording ("+0.5 vs your last recording").
  - Four criteria as large numbers with their names in a 2x2 grid, each with one short note. No filled-track bars (decision from the taste skill; Writing keeps its bars).
  - A stats row: speaking rate in words per minute with a verdict ("in range" for about 110-160 wpm, otherwise "a bit slow" / "a bit fast"), filler count, duration.
  - Tabs:
    - *Transcript:* the transcript with marks. Mispronounced words: wavy underline in rose plus a small "pron." tag on hover/selection; filler words: struck through in muted slate with a "filler" tag. A legend above shows both marks. Selecting a mark opens the explanation panel below the text (like Writing's selected-error panel): for pronunciation, the word, how it should sound (simple respelling, e.g. "ar-KI-tek-cher") and a note; for a filler, how many times it was used and what to do instead.
    - *Mistakes:* the list to keep. Grammar items (as said → corrected, why), pronunciation items (word, how to say it), vocabulary upgrades (word used → better word for a standup). Each row has "Save to Flashcards" with idle / saving / saved / failed-retry states (Writing's mockup only draws idle and saved; draw all four here). Fillers are not in this list and have no Save button: there is no card type for them.

**Preview state switcher** (top right, as on Session Setup): Ready, Recording, Recorded, Grading, Result, Mic blocked. Error variants of Evaluate (no speech, unreadable, rate limit) are shown from the Recorded state by a second small control or by cycling a sample error; builder's choice.

**Writing.dc.html change:** add the same Writing | Speaking switch above its content, Writing active, linking to `Speaking.dc.html`. Nothing else on Writing changes.

**canvas.json:** add `Speaking.dc.html` as a board next to Writing (x after Profile's 7600 + 1520 = 9120, y 0, w 1440, h about 1500, title "English Speaking Coach", `expand: fill`, `is_interactive: true`) and add it to `order` after `Writing.dc.html`.

**README:** add a row to the screens table and change the "6 screens" sentence; note that the Speaking design needs word-level pronunciation, Vocabulary / Grammar bands and speaking rate from the backend.

**Copy rules:** English UI copy like the other boards; no em-dashes; plain labels; sample data must look real (a believable standup about a bug fix, realistic fillers "um", "like", "you know", mispronounced words common for Vietnamese speakers such as "architecture", "deployed", "issue").

**Accessibility:** mic button has an accessible name that changes with state ("Start recording" / "Stop recording"); timer has `role="timer"`; marks are buttons with a label naming the mark type; tab pattern as on Writing; result announced via `aria-live="polite"`; pulse rings and live waveform still under `prefers-reduced-motion`.

**Left to the builder:** exact spacing and copy; band colour thresholds (follow Writing); how the error variants are reached in the preview; sample transcript content within the rules above.
