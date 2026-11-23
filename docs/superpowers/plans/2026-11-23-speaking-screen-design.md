# English Speaking Screen Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `design/Speaking.dc.html` mockup for issue #27, link it from Writing with a Writing | Speaking switch, register it in `canvas.json` and describe it in the README.

**Architecture:** One new Design-canvas board in the same `<x-dc>` format as the six existing boards: static markup with `{{}}` bindings, `sc-if` / `sc-for`, and a `class Component extends DCLogic` whose `renderVals()` derives everything from `this.state`. A "Preview state" switcher (as in `SessionSetup.dc.html`) drives which state is drawn. No React, no backend.

**Tech Stack:** HTML/CSS in the Claude Design `.dc.html` format; inline Lucide SVG icons; Python 3 (standard library) for structural checks.

**Spec:** `docs/superpowers/specs/2026-11-23-speaking-screen-design.md`

## Global Constraints

- Colours: page `#020617`, card `#0f172a` with border `#1e293b`, accent `#4f46e5` (hover `#4338ca`); good `#34d399`, needs work `#fbbf24`, error `#fb7185`. Inter for UI, JetBrains Mono for numbers.
- Reuse existing classes, copied verbatim into the new board's `<style>`: from `Writing.dc.html` `.sb*`, `.nav*`, `.seg*`, `.icobtn`, `.btn-p`, `.btn-g`, `.btn-i(.done)`, `.bd.*`, `.card`, `.cap`, `.tab*`; from `SessionSetup.dc.html` `.vt*`; from `Interview.dc.html` `.wave*`, `.mic*`, `.livedot`, keyframes `wv`, `pl`, `bl` and the `prefers-reduced-motion` rule at line 64.
- No em-dash or en-dash characters anywhere in the new or edited boards.
- Band colour thresholds as Writing: 7.0 and up `#34d399`, 6.0 and up `#fbbf24`, below `#fb7185`.
- Recording cap 2:00; minimum 0:30 (shorter keeps Evaluate disabled with the hint "Speak for at least 0:30").
- Speaking rate "in range" for 110-160 words per minute, else "a bit slow" / "a bit fast".
- Sample data: a believable spoken standup about a bug fix; fillers "um", "like", "you know"; mispronounced "architecture", "deployed", "issue" with respellings such as "AR-ki-tek-cher".
- Icons are inline Lucide SVG paths with `aria-hidden="true"` beside visible text.

## Review Focus

1. Preview state switching from Result back to Ready must clear the right column to the empty state, not leave a stale result (test: Task 3 check asserts the empty-state copy is bound to a `noResult` flag that is true for ready/recording/recorded/short/blocked).
2. A recording shorter than 0:30 must show Evaluate disabled, not just greyed (test: Task 2 check asserts `disabled="{{evalDisabled}}"` on the Evaluate button).
3. Marked words must be distinguishable without colour (test: Task 3 check asserts the `.mk-pron` rule uses `text-decoration-style:wavy` and `.mk-fill` uses `line-through`, and the mark's `aria-label` carries the tag "pron." / "filler").
4. Narrow widths: the two columns must wrap to one (test: Task 2 check asserts both sections use `flex:1 1 460px;min-width:0` like Writing).
5. Reduced motion must stop the pulse rings and live waveform (test: Task 1 check asserts the copied `prefers-reduced-motion` rule is present).

---

### Task 1: Board shell, switch and preview switcher

**Files:**
- Create: `design/Speaking.dc.html`

**Interfaces:**
- Produces: state keys `view` (`'ready' | 'recording' | 'recorded' | 'short' | 'grading' | 'result' | 'blocked'`), `evalErr` (`null | 'nospeech' | 'unreadable' | 'ratelimit'`), `tab` (`'transcript' | 'mistakes'`), `sel` (index of selected mark), `saved` (map mistake id → `'idle' | 'saving' | 'saved' | 'failed'`), `confirmNew` (bool), `hasPrev` (bool), `collapsed` (bool). Task 2 and 3 add bindings to the same `renderVals()`.

- [ ] **Step 1: Copy the shell.** Copy `Writing.dc.html` lines 1-160 (head, helmet styles, sidebar, header) into the new file; change `<title>` and the header title to "English Speaking Coach"; keep the sidebar's "English Writing & Speaking" link `nav on`. Add the class rules listed in Global Constraints that Writing lacks (`.vt*`, `.wave*`, `.mic*`, `.livedot`, keyframes, reduced-motion rule). Script tag: `data-props='{"$preview":{"width":1440,"height":1500}}'`.

- [ ] **Step 2: Add the header preview switcher** (markup as `SessionSetup.dc.html:169-177`) with buttons Ready, Recording, Recorded, Short, Grading, Result, Mic blocked, each `aria-pressed` bound and calling `go(view)`. Next to it a second small `.vt` group "Evaluate error" with None / No speech / Unreadable / Rate limit, setting `evalErr` (shown only when `view` is `recorded`).

- [ ] **Step 3: Add the Writing | Speaking switch** under the header, before the two columns: `role="group" aria-label="English practice"`, two `<a class="seg">` links, Writing → `Writing.dc.html`, Speaking `on` with `aria-current="page"`.

- [ ] **Step 4: Check structure**

Run (from repo root):
```bash
python - <<'EOF'
import html.parser, re, pathlib
p = pathlib.Path("design/Speaking.dc.html"); s = p.read_text(encoding="utf-8")
assert "—" not in s and "–" not in s, "dash found"
for need in ["English Speaking Coach", 'aria-label="Preview state"', 'href="Writing.dc.html"', "prefers-reduced-motion", ".mic{", ".vt{", "class Component extends DCLogic"]:
    assert need in s, need
class P(html.parser.HTMLParser):
    def __init__(s): super().__init__(); s.stack=[]
    def handle_starttag(s,t,a):
        if t not in ("meta","link","br","img","input","path","rect","circle","line","polyline","polygon"): s.stack.append(t)
    def handle_endtag(s,t):
        if t in ("meta","link","br","img","input","path","rect","circle","line","polyline","polygon"): return
        assert s.stack and s.stack[-1]==t, f"mismatched </{t}> after {s.stack[-3:]}"; s.stack.pop()
P().feed(s); print("ok")
EOF
```
Expected: `ok`. Save this snippet as the shared check; Tasks 2-3 append their own asserts.

- [ ] **Step 5: Commit** `git add design/Speaking.dc.html && git commit -m "Start the Speaking board: shell, practice switch and preview states"`

### Task 2: Left column, Practice

**Files:**
- Modify: `design/Speaking.dc.html`

**Interfaces:**
- Consumes: state keys from Task 1.
- Produces: `renderVals()` bindings `isReady`, `isRecording`, `hasRecording` (recorded/short/grading/result), `evalDisabled` (short or grading), `canEvaluate` (recorded or short), `showRecordAgain` (recorded/short/result), `newDisabled` (recording or grading), `micLabel` ("Start recording" / "Stop recording").

Mark the column start with `<!-- LEFT: PRACTICE -->` and Task 3's with `<!-- RIGHT: GRADING -->` (the Task 3 check splits on it).

- [ ] **Step 1: Prompt card.** `<section aria-label="Practice" style="flex:1 1 460px;min-width:0;...">`. Card with `bd s` "Tech Daily Standup", "1-2 min" in mono, the prompt text, and "New prompt" `.btn-g` with `disabled="{{newDisabled}}"`. When `confirmNew` is set, an inline row "Discard this recording?" with Discard (`.btn-g`, rose text) and Cancel. Prompt copy: "Give your daily standup update: what you finished yesterday, what you will work on today, and any blocker you have."

- [ ] **Step 2: Recorder.** Centered mic button: indigo (`#4f46e5`, no rings) when Ready, `.mic` red with rings while Recording, hidden once there is a recording. `aria-label="{{micLabel}}"`. Timer `role="timer"`: `0:00 / 2:00` ready, `0:47 / 2:00` recording; under it the help line ("Press to start. Speak for 1-2 minutes.") or, while recording, `.livedot` + "Recording" and a `.wave rose` of 32 bars.

- [ ] **Step 3: Recorded block.** Player copied from `Interview.dc.html:521-531` (play button, played/rest wave paths, `0:00 / 1:24`, use `0:00 / 0:18` in Short). Actions row: "Record again" `.btn-g` (when `showRecordAgain`) and "Evaluate" `.btn-p` with `disabled="{{evalDisabled}}"`, shown when `canEvaluate` or grading; in Grading it reads "Evaluating..." with `aria-busy="true"`. Short shows the hint "Speak for at least 0:30" in amber under the actions.

- [ ] **Step 4: Error messages.** Mic blocked: inline rose-bordered panel under the mic: "Microphone access is blocked", "Allow the microphone in your browser's site settings, then try again.", "Try again" `.btn-g`; mic disabled. Evaluate errors (Recorded + `evalErr`), rose panel above the actions, recording kept: nospeech "We could not hear any speech. Record again closer to the microphone."; unreadable "We could not read this recording. Try again, or record again."; ratelimit "Too many requests. Try again in 42 seconds." Each panel `role="alert"`.

- [ ] **Step 5: Check.** Append to the Task 1 check and run:
```python
for need in ['aria-label="Practice"', 'disabled="{{evalDisabled}}"', 'aria-label="{{micLabel}}"', 'role="timer"', "Speak for at least 0:30", "Microphone access is blocked", "We could not hear any speech", "We could not read this recording", "Too many requests", "Discard this recording?", "flex:1 1 460px;min-width:0"]:
    assert need in s, need
```
Expected: `ok`.

- [ ] **Step 6: Commit** `git commit -am "Draw the Speaking practice column: recorder states, errors, minimum length"`

### Task 3: Right column, AI grading

**Files:**
- Modify: `design/Speaking.dc.html`

**Interfaces:**
- Consumes: Task 1 state keys; Task 2 bindings.
- Produces: bindings `noResult` (ready/recording/recorded/short/blocked and not `hasPrev`), `isGrading`, `showResult` (result, or `hasPrev` in recording/recorded/short), `prevLabel` (bool, `hasPrev` and view is not result), `criteria` (4 items `{name, band, color, note}`), `segs` (transcript segments `{t}` or `{w, kind:'pron'|'fill', tag, sel, pick}`), `cur` (selected mark detail), `mistakes` (items `{id, kind:'Grammar'|'Pronunciation'|'Vocabulary', kTone, from, to, why, state, label, save}`).

- [ ] **Step 1: Empty state** (`noResult`): card with a short heading "Your feedback will appear here" and one line listing four bands, speaking rate, marked transcript, mistakes to save. Lucide `mic` icon in an indigo-tinted tile.

- [ ] **Step 2: Skeleton** (`isGrading`): `aria-busy="true"` card with slate-800 blocks shaped like the band tile, four criteria cells in a 2x2 grid, and five transcript lines; no spinner.

- [ ] **Step 3: Result header** (`showResult`): Writing's BAND tile with overall `6.5` (amber), "Overall band" + summary "Clear update and steady pace. Some word stress and past-tense endings slip.", "+0.5 vs your last recording". When `prevLabel`, a `bd` "Previous result" above the tile. 2x2 grid of criteria as large mono numbers with name and one-line note: Fluency 7.0, Pronunciation 6.0, Vocabulary 6.5, Grammar 6.5. No bars. Stats row: "128 words/min" + `bd g` "in range", "6 fillers", "1:24".

- [ ] **Step 4: Tabs.** `role="tablist"` with Transcript and "Mistakes" + `bd r` count 7, as Writing's tab markup.
  - Transcript: legend line showing both marks; paragraph built from `segs`; marks are `<button class="mk mk-{{kind}} {{sel}}" aria-label="{{tag}}: {{w}}">` with the word; the small mono tag ("pron." / "filler") shows on hover and on the selected mark (spec), the legend names both. CSS: `.mk-pron{text-decoration:underline wavy #fb7185;text-underline-offset:4px}`, `.mk-fill{text-decoration:line-through;color:#94a3b8}`. Selected-mark panel (`aria-live="polite"`) as Writing's: pronunciation shows word, respelling, note, and "Save to Flashcards"; filler shows "Used 4 times" and a tip, no Save.
  - Mistakes: rows grouped by kind with `bd` tone, from → to, why, and a Save button per row; draw one row in each of idle (`.btn-i` "Save to Flashcards"), saving ("Saving...", disabled), saved (`.btn-i done` "Saved"), failed (rose text "Could not save" + "Retry").

- [ ] **Step 5: Check.** Append and run:
```python
for need in ["Your feedback will appear here", 'aria-busy="true"', "Previous result", "words/min", 'role="tablist"', "text-decoration:underline wavy", "line-through", 'aria-live="polite"', "Saving...", "Could not save", "{{noResult}}"]:
    assert need in s, need
assert 'aria-label="{{tag}}: {{w}}"' in s and "'pron.'" in s and "'filler'" in s
assert s.count("flex:1 1 460px;min-width:0") >= 2, "both columns must wrap"
assert "background:#1e293b;overflow:hidden" not in s.split("<!-- RIGHT")[1], "filled-track bar found"
```
Expected: `ok`.

- [ ] **Step 6: Commit** `git commit -am "Draw the Speaking grading column: empty, grading, result, marked transcript, mistakes"`

### Task 4: Link from Writing, register the board, README

**Files:**
- Modify: `design/Writing.dc.html` (above the editor/grading row, after the `</header>` near line 160)
- Modify: `design/canvas.json`
- Modify: `README.md` (screens table and the "6 màn" sentence)

- [ ] **Step 1: Writing switch.** Insert the same Writing | Speaking group as Task 1 Step 3, Writing `on` with `aria-current="page"`, Speaking → `Speaking.dc.html`. Nothing else on Writing changes.

- [ ] **Step 2: canvas.json.** Add board `"Speaking.dc.html":{"x":9120,"y":0,"w":1440,"h":1500,"title":"English Speaking Coach","expand":"fill","is_interactive":true}`; insert `"Speaking.dc.html"` into `order` right after `"Writing.dc.html"`.

- [ ] **Step 3: README.** Add a table row after English Writing Coach: `| English Speaking Coach | design/Speaking.dc.html | Luyện nói Tech Daily Standup: thu âm 0:30-2:00, nghe lại hoặc thu lại, chấm band Fluency / Pronunciation / Vocabulary / Grammar, tốc độ nói và từ đệm, transcript đánh dấu từ phát âm sai và từ đệm, lưu lỗi vào Flashcards; nút chuyển Writing / Speaking |`. Change "Tất cả 6 màn" to "Tất cả 7 màn". Add one line under the table: the Speaking design needs word-level pronunciation marks, Vocabulary and Grammar bands and speaking rate, which the voice API does not return yet (it returns `fluency_score`, `filler_words`, `pronunciation_notes`).

- [ ] **Step 4: Check**
```bash
python - <<'EOF'
import json, pathlib
c = json.loads(pathlib.Path("design/canvas.json").read_text(encoding="utf-8"))
assert c["boards"]["Speaking.dc.html"]["x"] == 9120
o = c["order"]; assert o[o.index("Writing.dc.html")+1] == "Speaking.dc.html"
for f in o: assert pathlib.Path("design", f).exists(), f
w = pathlib.Path("design/Writing.dc.html").read_text(encoding="utf-8")
assert 'href="Speaking.dc.html"' in w and "—" not in w and "–" not in w
r = pathlib.Path("README.md").read_text(encoding="utf-8")
assert "design/Speaking.dc.html" in r and "Tất cả 7 màn" in r
print("ok")
EOF
```
Expected: `ok`. Also re-run the Speaking check from Task 3.

- [ ] **Step 5: Commit** `git add design README.md && git commit -m "Link Writing and Speaking, register the Speaking board, describe it in the README"`
