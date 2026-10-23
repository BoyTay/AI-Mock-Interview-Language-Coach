# Four Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the five placeholder pages' bodies for Dashboard, Interview, Writing and Flashcards with the designed screens (mock data only), built from a small set of reusable components.

**Architecture:** Shared presentational components live in `src/components/common/`. Each screen is a page in `src/pages/` composed of small components in `src/components/<screen>/`. All sample data lives in `src/mocks/<screen>.js` as plain exports so a later issue can swap each for an API call without touching components. Pure logic (timers, word count, tone from score, SM-2-free flashcard queue) is isolated in hooks/utils and unit tested; screens are tested through user behavior with Testing Library.

**Tech Stack:** React 18, Tailwind 3.4 + the dark tokens from `src/index.css`, shadcn `Button`, Lucide, Recharts 2.15 (new), Vitest + Testing Library (existing).

**Spec:** GitHub issue #5 and the four reference files `design/Main.dc.html`, `design/Interview.dc.html`, `design/Writing.dc.html`, `design/Flashcards.dc.html` (markup, copy, colors and the `<script>` data blocks). `README.md` "Design System". The `.dc.html` files only open in the Claude Design canvas; read them as source text.

## Global Constraints

- JavaScript/JSX only, dark mode only, use Tailwind classes and tokens (no new hard-coded hex outside `index.css` unless a value has no Tailwind equivalent, e.g. `#0b1224`, `#0d1c26`, `#0b1a17` panel tints from the design).
- Tone classes (badge, pills, highlights), exactly as in the designs: `g` emerald (text `emerald-400`, bg `emerald-500/12`, border `emerald-500/30`), `a` amber (`amber-400`, `amber-500/12`, `amber-500/30`), `r` rose (`rose-400`, `rose-500/12`, `rose-500/30`), `i` indigo (`indigo-300`, `indigo-500/14`, `indigo-500/35`), `s` sky (`sky-300`, `sky-400/12`, `sky-400/32`).
- Score tone: score ≥ 80 → `g`, ≥ 60 → `a`, else `r` (interview and dashboard scores out of 100). Band color for writing: band ≥ 7 `emerald-500`, ≥ 6 `amber-500`, else `rose-500`.
- Copy and sample numbers are taken verbatim from the design files; do not invent replacements.
- Layouts must use `flex-wrap`/`min-w-0` as the designs do, so there is no horizontal page scroll at 360px. Max content widths: Dashboard 1280px, Interview 1360px, Writing 1440px, Flashcards 720px.
- Every animation (waveform bars, mic pulse, live dot, card flip, chevron/width transitions) is disabled under `prefers-reduced-motion` (Tailwind `motion-reduce:` variant or a media query in `index.css`).
- Charts and any purely visual element need a text alternative (`role="img"` + `aria-label`) that states the data.
- Run npm inside the container: `docker compose exec -T frontend npm test`. After installing a package run `docker compose restart frontend`.
- The search box, notification dropdown and "New session" behavior are out of scope; only the visible controls named in the tasks are built. Buttons that need a backend (Download PDF, Retake, Add to Flashcards, Save to Flashcards, Evaluate with AI, Send answer) render but do nothing, except where a task says otherwise.

## Review Focus

- Word count of an empty or whitespace-only essay is `0` (not `1`, not `NaN`) and shows the amber (`< 250`) style. Pinned in Task 7.
- The writing countdown stops at `00:00` and never goes negative; the interview timers stop ticking after unmount (no state update on an unmounted component). Pinned in Task 2.
- Flashcard rating buttons stay disabled until the card is flipped; rating the last card shows the completion state and Restart returns to card 1 face-up. Pinned in Task 10.
- In the interview report only one question is open at a time and clicking the open one closes it (all closed is a valid state). Pinned in Task 6.
- In Error Correction, the first error is preselected and exactly one error is selected at a time; the explanation panel always shows the selected error. Pinned in Task 8.
- Charts do not crash when the container has zero width (jsdom) and have a text alternative. Pinned in Task 4.

---

### Task 1: Shared components

**Files:**
- Create: `frontend/src/components/common/{Card,Badge,Caption,ScoreRing,ProgressSegments,Accordion}.jsx`, `frontend/src/components/common/common.test.jsx`, `frontend/src/utils/tone.js`, `frontend/src/utils/tone.test.js`

**Interfaces:**
- Produces:
  - `scoreTone(score: number): 'g'|'a'|'r'` and `bandColor(band: number): string` (returns the Tailwind color name `'emerald'|'amber'|'rose'`) in `@/utils/tone`.
  - `Card({ className?, children })` — `rounded-xl border border-slate-800 bg-slate-900`.
  - `Badge({ tone: 'g'|'a'|'r'|'i'|'s', className?, children })` — pill, 26px high, mono 12px; tone classes from Global Constraints.
  - `Caption({ children })` — mono 11px uppercase `tracking-[.08em] text-slate-400` (the design's `.cap`).
  - `ScoreRing({ value: number, max?: number /*100*/, size?: number /*140*/, tone?: 'g'|'a'|'r', label?: string })` — SVG ring r=58 stroke 10 with centered mono value and `/ max`; `role="img"` `aria-label={label ?? \`${value} out of ${max}\`}`.
  - `ProgressSegments({ total: number, answered: number, label?: string })` — grid of `total` 6px bars: first `answered` are `indigo-600`, the next one `indigo-300`, the rest `slate-700`; `aria-label` as given.
  - `Accordion({ id: string, open: boolean, onToggle: () => void, header: ReactNode, children })` — header is a full-width `<button aria-expanded aria-controls={id+'-panel'}>` with a rotating chevron (rotation transition respects reduced motion); panel `id={id+'-panel'}` rendered only when `open`.

- [ ] **Step 1: Write failing tests** `tone.test.js`: `scoreTone(80)==='g'`, `scoreTone(79)==='a'`, `scoreTone(60)==='a'`, `scoreTone(59)==='r'`; `bandColor(7)==='emerald'`, `bandColor(6.5)==='amber'`, `bandColor(5.5)==='rose'`. `common.test.jsx`: `Badge tone="g"` has class containing `text-emerald-400`; `ScoreRing value={82}` exposes `role="img"` named `82 out of 100`; `ProgressSegments total={6} answered={2}` renders 6 children with exactly 2 `bg-indigo-600`, 1 `bg-indigo-300`, 3 `bg-slate-700`; `Accordion` closed shows no panel and `aria-expanded="false"`, open shows panel and `aria-expanded="true"`, clicking calls `onToggle` once.
- [ ] **Step 2: Run, expect FAIL** (modules missing).
- [ ] **Step 3: Implement** the files. Ring arc length = `2πr × value/max` via `strokeDasharray`.
- [ ] **Step 4: Run all tests, expect PASS.**
- [ ] **Step 5: Commit** `"Add shared Card, Badge, Caption, ScoreRing, ProgressSegments and Accordion"`

### Task 2: Timer hook and time utils

**Files:**
- Create: `frontend/src/hooks/useTimer.js`, `frontend/src/hooks/useTimer.test.js`, `frontend/src/utils/time.js`, `frontend/src/utils/time.test.js`

**Interfaces:**
- Produces: `formatMmSs(totalSeconds: number): string` (`768` → `'12:48'`, `0` → `'00:00'`, negative clamps to `'00:00'`); `useTimer({ start: number, direction?: 'up'|'down' /*'up'*/, running?: boolean /*true*/ }): number` — returns the current seconds, ticks once per second, `'down'` stops at 0, interval cleared on unmount or when `running` is false.

- [ ] **Step 1: Failing tests** with `vi.useFakeTimers()` and `renderHook`: up from 768 is 770 after 2000ms; down from 2 is 0 after 5000ms (never negative); `running:false` stays at start; after `unmount()` advancing timers causes no error and `vi.getTimerCount()` is 0. `formatMmSs` cases above.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `formatMmSs` and `useTimer` (`setInterval` in an effect, cleanup returns `clearInterval`).
- [ ] **Step 4: Run all tests, expect PASS.**
- [ ] **Step 5: Commit** `"Add useTimer hook and time formatting"`

### Task 3: Dashboard metrics and recent sessions

**Files:**
- Create: `frontend/src/mocks/dashboard.js`, `frontend/src/components/dashboard/{MetricCards,RecentSessions}.jsx`, `frontend/src/components/dashboard/dashboard.test.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: `Card`, `Badge`, `scoreTone` from Task 1.
- Produces: `@/mocks/dashboard` exports `metrics` (the four cards: `Total Mock Sessions 48 / +6 sessions vs last week`, `Avg Technical Score 76 /100 / +4.2 pts vs last week`, `Estimated English Band 6.5 IELTS` with progress 72% and `Target band 7.0`, `Due Flashcards Today 23 cards` with link `Start review →` to `/flashcards`), `recentSessions` (the six rows from `design/Main.dc.html` lines 371-376: `type`, `typeKey` ('t'|'e'|'s'), `topic`, `score`, `tone`, `date`), `radar` (`labels`, `current [72,85,68,74,62]`, `target 80`) and `weekly` (`tech [58,62,65,64,70,74,76,81]`, `english [52,55,58,63,62,67,70,72]`). Components: `MetricCards()`, `RecentSessions({ rows })`. `Dashboard` page renders `PageHeader` (title/description unchanged), `MetricCards`, the charts slot (Task 4), `RecentSessions`.

- [ ] **Step 1: Failing tests** `dashboard.test.jsx` (in `MemoryRouter`): the four metric titles and values `48`, `76`, `6.5`, `23` are present; the `Start review →` link has `href="/flashcards"`; the table has 6 body rows and column headers `Session type`, `Topic / Role`, `Score`, `Date`, `Action`; the row `Java Backend · Concurrency` shows `62 / 100` in an amber badge (class contains `text-amber-400`) and `Band 5.5` row in rose.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** mocks (copy values from `design/Main.dc.html` lines 166-222 and 371-376) and components; table inside `overflow-x-auto` with `min-w-[760px]` as in the design; `View Feedback` button per row.
- [ ] **Step 4: Run all tests, expect PASS.**
- [ ] **Step 5: Commit** `"Add Dashboard metric cards and recent sessions table"`

### Task 4: Dashboard charts

**Files:**
- Create: `frontend/src/components/dashboard/{CompetencyRadar,ScoreProgression}.jsx`, `frontend/src/components/dashboard/charts.test.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`, `frontend/package.json`

**Interfaces:**
- Consumes: `radar`, `weekly` from `@/mocks/dashboard`; `Card`.
- Produces: `CompetencyRadar({ labels, current, target })` and `ScoreProgression({ tech, english })`, each a `Card` with the design's heading/subtitle/legend and the chart inside a `role="img"` element whose `aria-label` states the data: radar `"Radar chart. Backend Architecture 72, Database and SQL 85, Problem Solving 68, English Fluency 74, Grammar and Vocab 62, out of 100."`, line `"Line chart of weekly scores. Technical interviews rose from 58 to 81 over eight weeks. English writing rose from 52 to 72."` (strings from the design). Colors: current/tech `#818cf8`, target dashed `#94a3b8`, english `#34d399`.

- [ ] **Step 1: Install** `recharts@2.15.0`.
- [ ] **Step 2: Failing tests**: both charts render without throwing in jsdom; each has `getByRole('img', { name: ... })` with the exact strings above; legend texts `Current`, `Target (80)`, `Technical Interviews`, `English Writing` are present; headings `Competency radar` and `Weekly score progression` present.
- [ ] **Step 3: Run, expect FAIL.**
- [ ] **Step 4: Implement** with Recharts `ResponsiveContainer` (fixed height 262/240), `RadarChart` (two `Radar`: target no fill dashed, current fill `rgba(99,102,241,.28)`), `LineChart` (two `Line`, y domain 40–100, ticks 40/60/80/100, x labels W1–W8, mono 11px axis text). Add both to `Dashboard` in the design's two-column wrap (`flex-1 basis-[360px]` and `flex-[1.6] basis-[460px]`).
- [ ] **Step 5: Run all tests and `npm run build`, expect PASS / exit 0.**
- [ ] **Step 6: Commit** `"Add Dashboard radar and weekly progression charts"`

### Task 5: Interview room

**Files:**
- Create: `frontend/src/mocks/interview.js`, `frontend/src/components/interview/{SessionBar,InterviewerCard,QuestionCard,HintAccordion,Transcript,AnswerDock}.jsx`, `frontend/src/components/interview/Waveform.jsx`, `frontend/src/components/interview/room.test.jsx`
- Modify: `frontend/src/pages/InterviewRoom.jsx`, `frontend/src/index.css`

**Interfaces:**
- Consumes: `Card`, `Badge`, `Caption`, `ProgressSegments`, `Accordion`, `useTimer`, `formatMmSs`.
- Produces: `@/mocks/interview` exports `session` (`role 'Java/Python Backend Intern'`, `questionNumber 3`, `total 6`, `topic 'Database Indexing'`, `elapsedStart 768`), `question` (text of the Q3 follow-up from `design/Interview.dc.html` line 260, `chips ['SQL','Aggregation','Composite index']`, `hint ['WHERE created_at >= …','GROUP BY user_id','SUM(total)','ORDER BY … LIMIT 3','Index column order']`), `transcript` (the five bubbles lines 302-341 with `from 'ai'|'user'`, `text`, `meta`), and `reportQuestions` (Task 6). `Waveform({ bars?: number /*32*/, tone?: 'indigo'|'rose' })` decorative (`aria-hidden`), bars animate with a `wave` keyframe defined in `index.css` and are static under reduced motion. `AnswerDock({ initialMode?: 'voice'|'text' })` — a `role="group"` named `Answer mode` with buttons `Voice` / `Text & Code` (`aria-pressed`); Voice shows the recording timer (`useTimer` from 42 up, `role="timer"`), a `Stop recording` mic button, waveform, `Re-record`, `Send answer`; Text & Code shows a `Type your answer` textarea, an optional SQL code textarea toggled by a `Code block` button (default on, `aria-pressed`) and `Send answer`. `HintAccordion({ concepts })` toggles `Show Hint / Key Concepts` ↔ `Hide Hint / Key Concepts`. `InterviewRoom` page renders the room view (the report view is added in Task 6) under `max-w-[1360px]`, left column `flex-[4_1_380px]`, right column `flex-[6_1_480px]`.

- [ ] **Step 1: Failing tests** `room.test.jsx`: `Question 3 of 6` and `Java/Python Backend Intern` shown; segments have 2 answered; elapsed timer starts at `12:48` (fake timers advance 2s → `12:50`); the hint toggle is collapsed by default (`aria-expanded="false"`, chips hidden), clicking reveals `Index column order` and relabels to `Hide Hint / Key Concepts`; the dock starts in Voice with `Stop recording` visible, clicking `Text & Code` shows the textarea named `Type your answer` and the `Code block` toggle is pressed with a `Code snippet` textarea, clicking it hides the code textarea; transcript has 5 messages in order and the last one is marked as awaiting the user's answer.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Add `@keyframes wave`, `pulse-ring` and `blink` to `index.css` inside `@media (prefers-reduced-motion: no-preference)`.
- [ ] **Step 4: Run all tests, expect PASS.**
- [ ] **Step 5: Commit** `"Add Interview room screen"`

### Task 6: Interview evaluation report

**Files:**
- Create: `frontend/src/components/interview/{ReportSummary,QuestionBreakdown}.jsx`, `frontend/src/components/interview/report.test.jsx`
- Modify: `frontend/src/mocks/interview.js`, `frontend/src/pages/InterviewRoom.jsx`

**Interfaces:**
- Consumes: `ScoreRing`, `Badge`, `Accordion`, `scoreTone`; the room view from Task 5.
- Produces: `reportQuestions` (the six objects from `design/Interview.dc.html` lines 601-624: `n`, `title`, `topic`, `sc`, `dur`, `tags[{text,tone}]`, `user[{t,h}]`, `ref[{t,h}]`) plus `report` (`overall 82`, `headline 'Strong performance'`, `summary`, `delta '+6 vs your 76 average'`, `star` with `S,T,A` good and `R` needs work and `78%`, `strengths` ×3, `gaps` ×3 with `High|Medium`). `QuestionBreakdown({ questions })` owns the open-index state (initial `3`, i.e. Q4 open, as in the design; `-1` means all closed). `ReportSummary({ report })`. `InterviewRoom` has a `role="group"` named `Preview state` with buttons `Active Interview Room` and `Post-Interview Evaluation Report` (`aria-pressed`) switching between the two views with `useState('room')`. Highlight classes for answer fragments: `r` rose, `a` amber, `g` emerald, `c` mono code.

- [ ] **Step 1: Failing tests**: switching to the report shows heading `Interview Evaluation Report`, a score ring `82 out of 100`, `STAR method compliance` with `78%`, three strengths and three gaps (`Race conditions & atomics` has a `High` badge); six `Question-by-question` accordion headers with score badges (`66 / 100` rose-or-amber per `scoreTone`: it is amber); Q4 is open initially (`aria-expanded="true"`, its panel shows `Optimal Reference Answer`); opening Q2 closes Q4 (only one `aria-expanded="true"`); clicking the open Q2 header closes it (zero open); `Add to Mistake Flashcards` button exists inside an open panel.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** both components and the view switch; the recorded-answer player is visual only (static waveform from a small deterministic path generator in the component).
- [ ] **Step 4: Run all tests, expect PASS.**
- [ ] **Step 5: Commit** `"Add Interview evaluation report with question breakdown"`

### Task 7: Writing editor

**Files:**
- Create: `frontend/src/mocks/writing.js`, `frontend/src/utils/text.js`, `frontend/src/utils/text.test.js`, `frontend/src/components/writing/{EditorPanel,TaskSwitch}.jsx`, `frontend/src/components/writing/editor.test.jsx`
- Modify: `frontend/src/pages/WritingCoach.jsx`

**Interfaces:**
- Consumes: `Card`, `Accordion`, `useTimer`, `formatMmSs`.
- Produces: `countWords(text: string): number` in `@/utils/text` (whitespace-split, `0` for empty/whitespace-only); `@/mocks/writing` exports `prompts` (`ielts`, `standup`: `[text, note]` from `design/Writing.dc.html` lines 392-395), `segments` (the array from lines 316-344 with strings, `null` paragraph breaks and error objects `{id,w,f,k,title,why}`), `essayFromSegments(segments): string` (originals joined, `null` → blank line), `criteria` (`Task Response 7.0`, `Coherence & Cohesion 7.5`, `Lexical Resource 6.5`, `Grammatical Range & Accuracy 6.5`), `vocab` (6 entries lines 375-380), `overall {band 7.0, delta '+0.5 vs your previous essay'}`. `TaskSwitch({ value, onChange })` group `Task type` with `IELTS Writing Task 2` / `Tech Daily Standup`. `EditorPanel({ task, essay, onEssayChange })` shows the countdown (starts at `17*60+42`, `'down'`, text `of 40:00`), collapsible `Prompt topic` (open by default), the `Your essay` textarea, `{n} words` + `min 250`, `Draft saved` and an `Evaluate with AI` button. The word count is green (`text-emerald-400`) when `n >= 250`, else amber (`text-amber-400`).

- [ ] **Step 1: Failing tests**: `countWords('')===0`, `countWords('   \n ')===0`, `countWords(' a  b\nc ')===3`. Editor: initial essay (the mock) shows its real count and green style when ≥ 250; clearing the textarea shows `0 words` in amber; typing five words shows `5 words`; the countdown shows `17:42` and `17:41` after 1s; switching task to `Tech Daily Standup` swaps the prompt text and keeps the essay; the prompt accordion collapses and expands.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Page layout: `flex flex-wrap gap-5`, editor column `flex-1 basis-[460px]`; the grading column is added in Task 8.
- [ ] **Step 4: Run all tests, expect PASS.**
- [ ] **Step 5: Commit** `"Add Writing editor with timer, word count and prompt"`

### Task 8: Writing grading panel

**Files:**
- Create: `frontend/src/components/writing/{BandSummary,ErrorCorrection,VocabularyUpgrader,FeedbackTabs}.jsx`, `frontend/src/components/writing/grading.test.jsx`
- Modify: `frontend/src/pages/WritingCoach.jsx`

**Interfaces:**
- Consumes: `segments`, `criteria`, `vocab`, `overall` from `@/mocks/writing`; `Card`, `Badge`, `bandColor`.
- Produces: `BandSummary({ overall, criteria })` — band box (`7.0`, emerald), `Overall Band Score`, and four bars whose width is `band/9*100 %` and color from `bandColor`. `ErrorCorrection({ segments })` renders text spans and one `<button>` per error (strikethrough wrong + bold green fix); owns `selected` state (initial = first error id); the detail panel (`aria-live="polite"`) shows kind badge (`Grammar` rose / `Vocabulary` sky), title, `wrong → fix`, explanation and a `+ Save to Flashcards` button; the selected error button has class `ring-2`/outline and `aria-pressed="true"`. `VocabularyUpgrader({ vocab })` — cards with basic word, C1 and C2 alternatives (`C1` indigo badge, `C2` sky badge), example, and a save button toggling `+ Save to Flashcards` → `Saved to Flashcards` (emerald, `aria-pressed`); saved state is per card. `FeedbackTabs` — `role="tablist"` with tabs `Interactive Error Correction` (count badge `10`) and `Vocabulary Upgrader` (`6`), `aria-selected`, default tab is errors.

- [ ] **Step 1: Failing tests**: `Overall Band Score` and `7.0`; the four criteria with their bands; the lowest-band bars (`6.5`) use amber and `7.5` emerald (check inline style/class); error tab shows 10 error buttons, the first has `aria-pressed="true"` and the panel shows its title `Comparative form`; clicking the 4th error makes only it pressed and the panel title becomes `Subject-verb agreement` with the right explanation; switching to Vocabulary shows 6 cards, saving one flips only that card to `Saved to Flashcards`, and returning to the errors tab and back keeps it saved.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** and mount in the right column (`flex-1 basis-[460px]`).
- [ ] **Step 4: Run all tests, expect PASS.**
- [ ] **Step 5: Commit** `"Add Writing grading panel with error correction and vocabulary upgrader"`

### Task 9: Flashcards queue logic

**Files:**
- Create: `frontend/src/mocks/flashcards.js`, `frontend/src/hooks/useReviewSession.js`, `frontend/src/hooks/useReviewSession.test.js`

**Interfaces:**
- Produces: `deck` — the five cards from `design/Flashcards.dc.html` lines 234-255 (`tag`, `tagTone`, `frontCap`, `source`, `front`, `backCap`, `back`, `why`); `useReviewSession({ deck, total?: number /*15*/, startAt?: number /*4*/ }): { n, card, flipped, finished, doneCount, progressPct, flip(): void, rate(): void, restart(): void }` where `n` is the 1-based card number, `card = deck[(n - 1 + 3) % deck.length]` (as in the design), `flip` toggles, `rate` advances `n` and resets `flipped`, `finished = n > total`, `doneCount = min(n - 1, total)`, `progressPct = round(doneCount/total*100)`, `restart` sets `n = 1`, `flipped = false`. Rating is a no-op while not flipped.

- [ ] **Step 1: Failing tests** (`renderHook` + `act`): initial `n=4`, `flipped=false`, `doneCount=3`, `progressPct=20`; `rate()` before `flip()` does nothing; `flip()` then `rate()` → `n=5`, `flipped=false`; reaching `n=16` gives `finished=true`, `doneCount=15`, `progressPct=100`; `restart()` → `n=1`, `finished=false`, `flipped=false`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** the hook and copy the deck.
- [ ] **Step 4: Run all tests, expect PASS.**
- [ ] **Step 5: Commit** `"Add flashcard review session hook and mock deck"`

### Task 10: Flashcards screen

**Files:**
- Create: `frontend/src/components/flashcards/{FlipCard,RatingButtons,SessionComplete}.jsx`, `frontend/src/components/flashcards/flashcards.test.jsx`
- Modify: `frontend/src/pages/Flashcards.jsx`, `frontend/src/index.css`

**Interfaces:**
- Consumes: `useReviewSession`, `deck`, `Badge`, `Card`.
- Produces: `FlipCard({ card, flipped, onFlip })` — a `<button aria-pressed={flipped} aria-label="Flashcard. Press to flip between question and answer.">` containing the front and back faces; CSS classes `flip-scene`, `flip-card`, `flip-face` in `index.css` (perspective 1400px, `preserve-3d`, `rotateY(180deg)`, `backface-visibility:hidden`, `.6s` transition removed under reduced motion); the card is 360px high. `RatingButtons({ disabled, onRate })` — `Again`, `Hard`, `Good`, `Easy` with hints `<10m`, `1d`, `3d`, `7d`, and the prompt text `Flip the card to rate your recall` / `How well did you remember it?` (hints stay fixed for now; SM-2 intervals arrive with the SM-2 issue). `SessionComplete({ onRestart })` shows `Session complete`, `You reviewed all 15 cards due today. Cards you rated Again will return in under 10 minutes.` and `Restart session`. The page header row shows `Mistake Flashcards` and an indigo `Active recall · SM-2` badge; the progress line shows `Card {n} of 15 due today`, the tag badge, and a `role="progressbar"` with `aria-valuenow={doneCount}`.

- [ ] **Step 1: Failing tests**: initial text `Card 4 of 15 due today`, progressbar `aria-valuenow="3"`; rating buttons are disabled and the prompt says `Flip the card to rate your recall`; clicking the card enables the buttons and changes the prompt; rating moves to `Card 5 of 15 due today` with buttons disabled again; after rating through card 15 the `Session complete` panel appears, the card and rating buttons are gone and the label reads `15 of 15 reviewed`; `Restart session` returns to `Card 1 of 15 due today`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run all tests, expect PASS.**
- [ ] **Step 5: Commit** `"Add Flashcards screen with flip card and rating"`

### Task 11: Visual and responsive pass

**Files:**
- Modify: whichever component a finding touches; `README.md` (status line)

- [ ] **Step 1: Full suite and build** — `docker compose exec -T frontend npm test` all pass; `npm run build` exits 0.
- [ ] **Step 2: Restart dev server** — `docker compose restart frontend`.
- [ ] **Step 3: Screenshots** with headless Chrome at `1440x1300` and `360x900` for `/`, `/interview` (room and report), `/english` (both tabs), `/flashcards` (front, back, complete); compare to the design files; fix overflow, shrinking icons, clipped text.
- [ ] **Step 4: Reduced motion** — confirm the keyframe/transition rules sit inside `prefers-reduced-motion: no-preference` or use `motion-reduce:` utilities (`grep` for `@keyframes` and `transition`).
- [ ] **Step 5: README** — update the status line to say the four screens exist with mock data.
- [ ] **Step 6: Commit** `"Polish responsive layout and update README"` (one commit per fix if several).

---

## Self-review notes

- **Issue #5 coverage:** Dashboard cards/radar/line/table (3-4), Interview room 40/60 + report with the two states switched by state (5-6), Writing editor/timer/word count/two tabs (7-8), Flashcards 3D flip, four rating buttons, completion (9-10), reusable `Card`, `Badge`, `ScoreRing`, `ProgressSegments`, `Accordion` (1), reduced motion (Global Constraints, 5, 10, 11), mock data separated in `src/mocks` (3, 5, 6, 7, 9).
- **Not in scope:** search box, Download PDF, real audio, real grading, SM-2 intervals on the rating buttons, API wiring (later issues).
- **Types:** `scoreTone`, `bandColor`, `useTimer`, `formatMmSs`, `countWords`, `useReviewSession` are defined before the tasks that consume them; mock export names are fixed in the producing task.
