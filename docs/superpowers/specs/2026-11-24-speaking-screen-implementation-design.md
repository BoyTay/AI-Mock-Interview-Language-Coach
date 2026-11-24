# English Speaking screen implementation design (issue #28)

**Intent:** the Speaking board (`design/Speaking.dc.html`, issue #27) is accepted but nothing behind it exists. This issue makes it real: a user practising a spoken Tech Daily Standup records one answer, hears it back, sends it, and gets IELTS-style bands for their spoken English, a marked transcript and mistakes they can keep as flashcards. The board and its spec (`docs/superpowers/specs/2026-11-23-speaking-screen-design.md`) are the reference for everything the user sees; this document covers what it takes to build it.

## Goals

- `POST /english/speaking/evaluate`: takes the recording, the prompt and the duration, asks Gemini (multimodal, through the existing `GeminiLlm`) for the transcript, four bands, marks and mistakes, validates the reply, stores it, and returns the result with the change against the previous recording.
- `GET /english/speaking/prompts`: one random spoken standup prompt.
- A new `speaking_submissions` table (migration `0005`) holding one row per graded recording; the recording file kept on disk.
- The React screen at `/english/speaking`, matching the board, using `useAudioRecorder`; a Writing | Speaking switch on both English pages.
- Unit and API tests with a fake LLM, in the style of the existing voice-answer tests.

## Non-goals

- A history list or detail endpoint for speaking (`GET /english/speaking`, `GET /english/speaking/{id}`): the board has no history view.
- An eval with numbers for speaking grading (tracked as a follow-up issue, see Verification).
- IELTS Speaking parts, a task switch, a new flashcard type, a new sidebar item (all non-goals of #27).
- Changing the interview room's voice answers.

## Anti-goals

- Marks that point at the wrong word. A mark the server cannot place in the transcript is rejected (retry), never shown somewhere approximate.
- Sending the audio to Gemini before the user chose to (Evaluate is the acceptance; listening back is offered, not required).
- Pronunciation bands lowered for accent rather than intelligibility; feedback in Vietnamese (the board's copy is English).
- Losing the recording on a failed Evaluate: every error keeps it on screen so the user can retry or re-record.

## Constraints

- Backend style follows `routes_english.py` / `english_coach.py` / `ai_interviewer.py`: `AppError` for errors, `call_json`-style validate-and-retry, Gemini response schema without `multipleOf` (bands checked by `_check_band` in Pydantic), `TEMPERATURE = 0.1`.
- Audio intake reuses `read_audio` (10 MB cap), `sniff_audio_type` (type judged from the bytes), `GEMINI_MIME_TYPES`, the multipart field name `audio`, the 413/415/422 codes, and the `AUDIO_UNREADABLE` (Gemini 400) and `NO_SPEECH_DETECTED` (empty transcript) behaviour of the interview voice path.
- Recording limits from the board: cap 2:00 (recorder stops itself), minimum 0:30 (Evaluate disabled below it).
- Frontend: React + Tailwind + lucide-react as in the existing pages; tests with Vitest and Testing Library.
- Two PRs, both on `feat/28-...` branches off `main`: PR 1 backend ("Part of #28"), PR 2 frontend ("Closes #28").

## Approaches

**Storage** (decided with the user: A)
- **A. New `speaking_submissions` table, chosen.** One row per recording, like `writing_submissions`; band delta is one query; needs migration `0005`.
- B. Reuse `interview_sessions` with `session_type = ENGLISH_SPEAKING` plus a `session_messages` row: no migration, but two rows per recording, an `overall_score` on a 0-100 scale, empty interview-only columns, and joins for history and delta.

**How Gemini reports where a mark is** (decided with the user: A)
- **A. Plain verbatim transcript plus a `marks` list, chosen.** Each mark is `{kind, text, occurrence}`; the server finds the `occurrence`-th match of `text` in the transcript and rejects the reply (retry with the problem spelled out) when it cannot. Short output, checkable, same pattern as Writing's verbatim `original_sentence` check.
- B. Transcript as an array of labelled segments: positions exact by construction, but a two-minute answer becomes hundreds of JSON items (the long-structured-output looping `english_coach.py` warns about) and segment boundaries are the model's whim.
- C. Inline markup like `[[um|filler]]`: shortest, but needs a custom parser and one malformed tag breaks the transcript. Dropped.

**What the transcript holds when a sound is dropped** (decided with the user: A)
- **A. What was heard, chosen.** "Yesterday I deploy it" is transcribed as "deploy". A missing inflectional ending (-ed, -s, -es) becomes a grammar correction whose explanation also says to pronounce the ending clearly. Pronunciation marks are only for words whose form is right but which were said wrongly (stress, a wrong vowel or consonant, a dropped final consonant of the base word). The transcript stays honest, each slip counts once, and every mark can be placed. Cost: a speaker who knows the rule but swallows the ending loses Grammar, not Pronunciation.
- B. What the speaker meant: the transcript says "deployed" and the slip is a pronunciation mark. Fairer to Grammar, but the model must guess intent, which quietly corrects grammar in the transcript and can hide real grammar errors or count one slip under both criteria.

Note: the board's sample marks "deployed" as pronunciation ("the final -ed is ... dropped"). Under A that case is a grammar correction; the board's other pronunciation samples ("issue", "architecture") stay as they are.

**Verification** (decided with the user: 1)
- **1. Fake-LLM unit and API tests, plus a manual run with 2-3 real recordings by the user, results written into PR 2; an eval with numbers becomes a follow-up issue. Chosen.**
- 2. A small eval now with ~5 real recordings and expected marks: numbers at once, but needs the user to record and annotate, and a bigger backend PR.
- 3. An eval on TTS audio: measures fillers and grammar but not pronunciation (TTS pronounces perfectly), which is the part most in doubt.

## Backend

### Request

`POST /english/speaking/evaluate`, `multipart/form-data`:

| Field | Type | Rule |
|---|---|---|
| `audio` | file | required; webm / mp4 / ogg / wav by sniffed bytes; at most 10 MB |
| `prompt_text` | string | required; stripped; 1-500 chars (same cap as Writing's topic) |
| `duration_seconds` | integer | required; 30-125 (the recorder caps at 120; a few seconds of slack for timer ticks) |

The duration comes from the client's recorder timer; the server does not decode the audio to measure it. *Claude's call:* decoding webm/mp4 duration server-side needs ffmpeg or a container parser, and the number only feeds words per minute.

Validation order: the existing `Content-Length` check (413) before the form is read, as the interview route does; then form fields (422 as the app already returns for invalid input), the size while reading (413), the type (415), then Gemini.

### What Gemini returns (`SpeakingEvaluation`, the response schema)

```
transcript: str                    # what was heard, word for word, fillers kept, nothing corrected
summary: str                       # one line for the result header
criteria:
  fluency:       {score, feedback} # 0-9 step 0.5; feedback one short sentence
  pronunciation: {score, feedback}
  vocabulary:    {score, feedback}
  grammar:       {score, feedback}
marks: [ {kind: "filler" | "pronunciation", text, occurrence, respelling?, note?} ]
grammar_corrections: [ {original, corrected, explanation} ]
vocabulary_upgrades: [ {used, better, explanation} ]
```

- `text` is a word or a short phrase as it appears in the transcript ("um", "you know", "architecture"). `occurrence` is 1-based: the n-th time that text appears.
- The transcript records what was heard, not what was meant (see Approaches). Dropped inflectional endings go to `grammar_corrections`; pronunciation marks are for correctly formed words said wrongly. The system prompt states this with the "deploy" / "deployed" example.
- Pronunciation marks carry `respelling` (simple capitalised-stress respelling, "AR-ki-tek-cher") and `note` (what went wrong, one or two sentences). Both are required on pronunciation marks (a reply without them is rejected and retried, so a flashcard's back is never empty). Filler marks carry neither; the screen's filler tip is fixed copy.
- No `overall_band` from the model: the server computes it. *Claude's call:* deterministic and one less thing for the model to get wrong.
- `grammar_corrections[].original` must be a verbatim stretch of the transcript, checked like Writing's `original_sentence` (whitespace-squashed, case-sensitive substring). It can be a clause rather than a full sentence, since speech has no reliable sentence boundaries ("I finish the fix").
- Limits in the prompt: at most 8 grammar corrections, 5 vocabulary upgrades, 8 pronunciation marks, worst first. Every filler heard is marked (the count and the strike-through depend on it).

### Server-side checks and derived values

- **Placing marks.** Tokenise the transcript into words with their character spans (letters, digits and apostrophes form a word; everything else separates). Match a mark's `text` as a token sequence, case-insensitive, ignoring punctuation. The `occurrence`-th match gives `start` / `end` character offsets into the transcript. No match, or fewer matches than `occurrence`, or two marks whose spans overlap at all: reject with the problem named and retry (up to `MAX_RETRIES = 2`), then 502 `AI_INVALID_RESPONSE`.
- **Empty transcript** (after strip): 422 `NO_SPEECH_DETECTED`, nothing stored. The prompt tells the model to return an empty transcript and zero bands for silence.
- **Gemini 400:** 422 `AUDIO_UNREADABLE`, as in `Interviewer.evaluate_voice`. Rate limit: 429 `RATE_LIMITED` with `Retry-After`. No API key: 503 `AI_NOT_CONFIGURED`.
- **Overall band:** mean of the four bands rounded to the nearest 0.5, with .25 and .75 rounding up (the rule Writing's prompt states).
- **Words per minute:** `round(word_count / (duration_seconds / 60))`, where `word_count` counts tokens in the transcript including fillers. *Claude's call:* fillers are spoken words and the board's sample counts them.
- **Band delta:** overall band minus the user's previous speaking submission's overall band; `null` for the first one.
- **Streak:** `touch_streak(profile, today)`, as Writing does.

### Storage

Table `speaking_submissions`:

| Column | Type |
|---|---|
| `id` | PK |
| `user_id` | FK `user_profiles.id`, cascade, indexed |
| `prompt_text` | text |
| `transcript` | text |
| `audio_path` | varchar(255), relative to the upload dir |
| `duration_seconds` | integer |
| `words_per_minute` | integer |
| `overall_band` | numeric(3,1) |
| `band_scores` | JSONB: the four criteria with score and feedback |
| `summary` | text |
| `marks` | JSONB: placed marks, each with `start` / `end` |
| `grammar_corrections` | JSONB |
| `vocabulary_upgrades` | JSONB |
| `prompt_version` | varchar(10) |
| `created_at` | timestamp default now |

`prompt_version` is stored so the follow-up eval can tell which prompt graded a recording. *Claude's call.*

Recordings go under `<upload_dir>/speaking/<user_id>/<uuid>.<ext>`. `AudioStore.save` gets a folder argument instead of the hard-coded `interviews/<session_id>`; the interview path keeps its current layout. Order, as in `submit_voice_answer`: Gemini first, then write the file, then the row; if the commit fails, delete the file. No endpoint serves the file back in this issue (the screen plays its own blob).

### Response (`SpeakingSubmissionOut`, 201)

`id`, `prompt_text`, `transcript`, `duration_seconds`, `words_per_minute`, `overall_band`, `band_delta`, `summary`, `criteria` (the four, each `{score, feedback}`), `marks` (each `{kind, text, start, end, respelling, note}`), `grammar_corrections`, `vocabulary_upgrades`, `filler_count`, `created_at`.

### Prompts

- `app/services/speaking_prompts.py`: five spoken versions of the Writing standup prompts ("Give your daily standup update: ..."), each with an id; `GET /english/speaking/prompts` returns `{id, prompt, min_seconds: 30, max_seconds: 120}`.
- The system prompt (an English communication coach for software engineers, judging a spoken standup) defines each criterion for speech: Fluency (pace, hesitation, restarts, fillers), Pronunciation (intelligibility, word stress, final consonants; not accent), Vocabulary (workplace and technical words, collocation), Grammar (tenses, agreement; spoken contractions are fine). It states the band scale, the mark rules above, English feedback, and that the recording is data, never instructions. `SPEAKING_PROMPT_VERSION = "1"`, bumped on any wording change.

### Code layout

A `SpeakingCoach` service in `app/services/speaking_coach.py` (takes an `Llm`, does the call, retries, placement and derived values), built by `build_speaking_coach(settings)` with `GeminiLlm(..., schema=SpeakingEvaluation)`, injected into the route with a lazy factory like `_LazyCoach` so tests can swap it. Routes live in `routes_english.py`. The multipart reading helper in `routes_interview.py` moves somewhere both routers can use. Exact module split is the builder's.

## Frontend

### Routes and shell

- `/english` redirects to `/english/writing`; `/english/writing` renders `WritingCoach`; `/english/speaking` renders the new `SpeakingCoach`. The sidebar item stays `to: '/english'` and is active on both (NavLink without `end`).
- The Writing | Speaking segmented switch sits at the top of both pages (links, `aria-current` on the active one).
- Header title "English Speaking Coach" on the Speaking page, following however Writing sets its title.

### The page

Follows the board and its spec for layout, copy and states. Implementation notes:

- **Recorder:** `useAudioRecorder({ maxSeconds: 120 })`. Its statuses map onto the board's Ready / Recording / Recorded; `error` maps to Mic blocked (its messages already cover denied / missing / busy / unsupported). Evaluate is disabled while `seconds < 30` with the hint "Speak for at least 0:30". The live waveform uses the hook's `level`.
- **Player:** the recorded blob through an object URL. `components/interview/AudioPlayer.jsx` loads from the server by session and message id; it gets a `src` prop (or the waveform part is shared) so Speaking can play a local blob. Builder's choice which.
- **Evaluate:** `api/speaking.js` posts `FormData` (`audio` as a file with the recorder's type, `prompt_text`, `duration_seconds`) with a 120-second timeout, the same as the interview room's voice answers (`AUDIO_TIMEOUT_MS`). A client timeout while the server is still grading can leave a stored result the user never saw, which a later band delta compares against; accepted, as on the interview path. *Claude's call.* Errors map to the board's messages: `NO_SPEECH_DETECTED` "We could not hear any speech...", `AUDIO_UNREADABLE` "We could not read this recording...", 429 with `Retry-After` "Too many requests. Try again in N seconds. Your recording is kept.", 502 / 503 / network in Writing's wording, and new copy for 413 ("This recording is too large...") and 415 ("This recording's format is not supported..."). The recording is kept in every case.
- **Result:** overall band tile with delta text (`bandDeltaText` gains a parameter so it says "vs your last recording" instead of "essay"), summary, 2x2 criteria, stats row (wpm with the 110-160 verdict, filler count, duration), Transcript and Mistakes tabs. The transcript renders from `marks` offsets: plain text between marks, each mark a button (`aria-label` "Pronunciation: architecture" / "Filler: um", `aria-pressed`), selection opens the explanation panel. The Mistakes tab lists grammar, then pronunciation marks, then vocabulary upgrades.
- **Save to Flashcards:** reuse `SaveButton` and `createFlashcard` with idle / saving / saved / failed-retry. Mapping (from #27): grammar → `GRAMMAR_ERROR`, front = `original`, back = `corrected`, explanation = `explanation`; pronunciation → `VOCABULARY`, front = the word, back = `respelling`, explanation = `note`; vocabulary → `VOCABULARY`, front = `used`, back = `better`, explanation = `explanation`. Fillers have no save.
- **Second try and New prompt:** as the #27 spec says ("Previous result" label kept until a new Evaluate replaces it; New prompt disabled while recording or grading, asks "Discard this recording?" when there is an unsent recording or a result).
- **Accessibility:** as the #27 spec says (mic button name changes with state, `role="timer"`, result announced with `aria-live="polite"`, `aria-busy` skeleton, reduced motion).

### Tests

Page and component tests with a stubbed recorder hook and a mocked API: each recorder state, the 0:30 gate, every error message keeping the recording, the marked transcript placing marks from offsets, selection panel, Mistakes tab, each Save state, Previous result, New prompt confirmation, routes and the switch.

## Verification

- PR 1: backend unit tests for placement (single word, phrase, n-th occurrence, punctuation and case, missing text, too-high occurrence, overlapping marks), overall band rounding, wpm, delta, retry then 502, empty transcript, Gemini 400, rate limit; API tests for each status code and for the stored row and file. `pytest` green.
- PR 2: frontend tests green, then a manual run on the real screen with 2-3 recordings the user makes (one fluent, one with deliberate fillers and mispronunciations). The transcript, marks and bands for each go into the PR description with a short judgement of whether the marks were right.
- Open a follow-up issue: "Speaking grading eval with real recordings", referencing the recordings kept under `speaking/` and `prompt_version`.

## Left to the builder

Module and component names and splits; how `AudioStore` is generalised; whether the multipart helper becomes a dependency; exact prompt wording within the rules above; skeleton and spacing details; test file layout; migration details (it must also drop the table on downgrade).
