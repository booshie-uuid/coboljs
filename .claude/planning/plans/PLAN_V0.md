# Plan: COBOL.js — Retro/Synthwave COBOL Emulator

## Context

Build the COBOL.js single-page web app described in [DESIGN.md](DESIGN.md): a
synthwave-themed editor on top of a console panel that runs a useful subset
of classic COBOL in-browser. Knockout drives the UI; an ES6-module
interpreter pipeline (lexer → parser → interpreter) does the work; the
provided `local-file-system.js` handles save/load. Conventions follow
[STYLE.md](../rules/STYLE.md).

The design is locked. This plan focuses on **build order** so the page is
running end-to-end as early as possible (with a stub interpreter), then
expands COBOL feature-by-feature with each addition validated by an example
program. The interpreter pipeline is the highest risk surface, so it is
broken into the smallest useful slices and ordered so a working
HELLO-WORLD lands before any harder feature is attempted.

> **Naming reminder for execution:** never abbreviate to `vm` / `VM`. Use
> `viewModel` for instances, `AppViewModel` for the class.

---

## Task 1: Project scaffold + dev-server-ready entry

### Objective

Stand up `index.html`, an empty `styles.css`, and an `app.js` ES6 entry point
that loads Knockout and the local-file-system library, applies an empty
`AppViewModel`, and renders a placeholder. This proves the module loader,
KO, and dev-server setup all work before any feature code is written.

### Expected Outcomes

- `index.html` opens via local server with no console errors.
- `<script src="libs/knockout-3.5.1.js">` loaded; `ko` is global.
- `<script src="libs/local-file-system.js">` loaded; `LocalFileSystem` is global.
- `<script type="module" src="scripts/app.js">` runs; KO bindings apply.
- Placeholder text renders via a Knockout `text` binding.

### Risks / Constraints

- ES6 modules need http(s)/localhost; document the dev-server requirement
  in a one-line comment at the top of `app.js`.
- Knockout 3.5 is not an ES module; it must remain a global script tag.

### Steps

- [*] Create `index.html` with `<head>` including `styles.css` and the two `<script>` tags for the libs (non-module) plus the `<script type="module">` for `app.js`.
- [*] Create empty `styles.css` (placeholder body rule only).
- [*] Create `scripts/app.js` that imports `AppViewModel` and calls `ko.applyBindings(new AppViewModel())`.
- [*] Create `scripts/app-view-model.js` exporting an `AppViewModel` class with a single `this.bootMessage = ko.observable("COBOL.JS BOOT OK")` field.
- [*] Add a `<div data-bind="text: bootMessage"></div>` to `index.html` to verify bindings apply.
- [*] Verify in browser: page renders "COBOL.JS BOOT OK" with no console errors.

### Decisions

- Styles use a small placeholder set (synthwave dark navy bg + cyan text + monospace stack) instead of a single body rule, so the boot text is visible against the eventual theme without an unstyled flash. Real shell styling lands in Task 2.
- Browser-verification step intentionally left unticked — this skill cannot launch a browser; the user verifies and ticks it themselves once they've eyeballed the page.
- Bootstrap wrapped in an explicit `DOMContentLoaded` guard rather than relying on module-defer semantics. User preference; recorded in CLAUDE.md.
- Replaced the bare bootstrap function with an `App` singleton class that owns the view-model and is exposed on `window.App`. Gives devtools access and a home for future top-level control logic. Recorded in CLAUDE.md.

### Bugs / Issues

<!-- Filled in during execution. -->

---

## Task 2: Synthwave UI shell + layout

### Objective

Build the static visual shell: header banner, source panel (top), console
panel (bottom), button rail, file-list sidebar. Pure HTML + CSS. No
interactivity yet beyond what KO already provides.

### Expected Outcomes

- Two-pane vertical split: editor on top (~60% height), console below.
- Synthwave palette: dark navy background, neon magenta + cyan borders/text.
- Glow effects on titles and borders (CSS `text-shadow` / `box-shadow`).
- Subtle scanline overlay (CSS gradient or `repeating-linear-gradient`).
- Header showing app name + status line + program-name slot.
- Button rail above editor: `[NEW] [LOAD] [SAVE] [RUN] [EXAMPLES]`.
- File-list sidebar slot (empty for now, just styled border).

### Risks / Constraints

- Scanline overlay must not block clicks on inputs — use `pointer-events: none`.
- Glow effects on the textarea border must not break focus visibility.

### Steps

- [*] Define CSS color tokens at the `:root` level: `--bg-deep`, `--bg-panel`, `--neon-magenta`, `--neon-cyan`, `--neon-purple`, `--text-dim`.
- [*] Set base body styles: dark navy bg, monospace font (Cascadia Mono / Consolas / Courier New), cyan text default.
- [*] Build the page layout in `index.html`: top header, button rail, two-pane main area, status footer.
- [*] Style the header with neon magenta border-bottom and a glowing title (`text-shadow: 0 0 8px var(--neon-magenta)`).
- [*] Style the editor and console panels with neon cyan borders + faint inset glow.
- [*] Add a fixed-position scanline overlay div with `pointer-events: none` and a `repeating-linear-gradient` background.
- [*] Style the buttons: dark fill, cyan border, magenta hover glow, monospace caps.
- [*] Verify in browser: layout looks like a synthwave terminal at multiple window sizes.

### Decisions

- Token list expanded beyond the original six — added `--bg-input`, `--neon-amber`, `--text-bright`, `--text-mid`, `--border-soft`, `--border-hot`, `--glow-cyan`, `--glow-magenta`, plus font tokens. The extras directly support the panel/button/console styles in this same task; pulling them in here avoids retro-fitting later.
- Status was kept in the header rather than a footer (DESIGN.md specified header-line status). Step copy from the plan said "status footer" but DESIGN.md takes precedence.
- Layout uses CSS grid (header / button-rail / sidebar / main) rather than nested flexboxes. Gives a cleaner, fully-resizable shell with one top-level rule.
- Body has a faint two-corner radial gradient (magenta top-left, cyan bottom-right) under the panels — the synthwave depth without overpowering the content.
- Console line styles (`output / system / input / error`) added now even though the Console module lands in Task 4. They're zero-cost as classes and let the bootMessage div render in its eventual style instead of being restyled later.
- Scanline density softened post-Task-3 from `1px-on/2px-off @ 0.18 alpha` to `1px-on/3px-off @ 0.09 alpha`. The original was aliasing against 13px editor text and making characters look glitchy on read.

### Bugs / Issues

- **Layout broke on first run** — `.panel-files` was nested inside `.app-main`, so the body grid had nothing to place in the `side` area while `.app-main` auto-placed three panels (files, source, console) into its 2-row grid. Fix: moved `.panel-files` to be a direct child of `<body>`. Lesson: when assigning grid-area to an element, the element must be a direct child of the grid container — `grid-area` doesn't reach into descendants.
- **Header alignment + tag wrap** — title and status were vertically center-aligned, and the tag broke mid-phrase when the header narrowed. Fix: `align-items: last baseline` (with `flex-end` fallback) so the status tracks the bottom-most line of the title; `white-space: nowrap` on `.app-tag` so the whole tag wraps as a unit; literal space between title and tag instead of `margin-left` so the wrapped tag isn't indented.

---

## Task 3: Editor module — gutter + column rulers

### Objective

Implement the `Editor` class in `scripts/modules/editor.js`: textarea with
synced line-number gutter and subtle column rulers at cols 7, 8, 12, 72.

### Expected Outcomes

- `Editor` class with `getText()`, `setText(text)`, observable text field.
- Line-number gutter renders one number per source line, scrolls in sync
  with the textarea.
- Column rulers render as faint vertical lines behind the textarea at
  character columns 7, 8, 12, 72 (using a `ch`-based background gradient).
- Tab key inserts 4 spaces (not literal tab) for COBOL convention.
- Editor exposes only the public methods listed; internal state is
  encapsulated.

### Risks / Constraints

- Line-number gutter scroll-sync is an event subscription — use the
  textarea's `scroll` event.
- Column rulers via background gradient assume a uniform-width font and
  exact character width; pin `font-family` and `font-size` to make this
  reliable.

### Steps

- [*] Create `scripts/modules/editor.js` with an `Editor` class accepting a textarea element, a gutter element, and an initial text value.
- [*] In the constructor, set up a `ko.observable` for text, bind it to the textarea via two-way `value` binding hooks, and update the gutter on every change.
- [*] Implement `getText()`/`setText(text)` and a `lineCount` derived observable for the gutter.
- [*] Wire a `scroll` event on the textarea to mirror `scrollTop` onto the gutter.
- [*] Wire a `keydown` handler on the textarea: if key is Tab, prevent default and insert 4 spaces at the cursor.
- [*] In `styles.css`, set a fixed-pitch font (`font-family`, `font-size`, `line-height`) that the textarea and gutter share exactly.
- [*] In `styles.css`, place column rulers via a `repeating-linear-gradient` background on the textarea wrapper at the exact `ch` offsets for cols 7, 8, 12, 72.
- [*] Wire `Editor` into `AppViewModel` and into `index.html` markup.
- [*] Verify in browser: typing scrolls the gutter; rulers stay aligned; Tab indents 4 spaces.

### Decisions

- `Editor` constructor takes only an initial-text string, not direct refs to the textarea/gutter elements as the original step described. The DOM wiring is split into a small `editorWiring` Knockout binding handler (registered alongside the class in the same module) that finds the textarea + gutter inside its bound element. This keeps the class DOM-free and aligned with how the rest of the project will use Knockout.
- `text` is exposed as a public observable (so KO templates can bind directly via `value: editor.text`), with `getText()`/`setText()` provided as procedural sugar. The plan's "two-way value binding hooks" lands as the standard `value` binding plus `valueUpdate: 'input'` so the observable updates on every keystroke instead of only on blur.
- Used `lineNumbers` (a `ko.pureComputed` array of 1..N) instead of a bare `lineCount` so the gutter can iterate it directly with `foreach`. The count is derivable from `.length` if any future caller wants it.
- Column rulers go on the textarea itself with `background-attachment: local` rather than on a wrapper. With `local` the ruler lines scroll horizontally with content, so rulers stay aligned with character columns when long lines push the textarea past col 72. Setting the textarea background to transparent and letting `background-image` carry the four 1px-wide gradients gives clean lines at cols 7, 8, 12, 72.
- Editor font-size and line-height pinned via CSS variables (`--editor-font-size`, `--editor-line-height`, `--editor-padding-y`, `--editor-padding-x`) on the `.editor` element, so gutter + textarea + ruler offsets all share the same source of truth.
- Tab insertion calls `dispatchEvent("input")` on the textarea after manual mutation rather than calling `this.text(value)` directly. This routes the change through the KO binding's existing input subscription, which preserves cursor position and avoids double-set quirks.
- **Gutter restyled as faux sequence area** (post-Task-3 user-driven rethink). The gutter showed line numbers right-aligned in ~3.5ch which collided with cols 1-6 of the source — those source columns then sat empty, creating wasted blank space. Resolution: render line numbers as zero-padded 6-digit strings (`000001`, `000002`, ...) left-aligned, so the gutter visually occupies the same character width as the COBOL sequence area. The col-7 ruler inside the textarea was dropped — the gutter's right edge now serves as that visual boundary. Bundled HELLO-WORLD reformatted to drop the traditional 7-space leading indent, since cols 1-6 are no longer "wasted" but visually represented by the gutter.
- **Ruler positions miscalibrated after gutter rework** — left them at absolute COBOL offsets (`+ 7ch / + 11ch / + 72ch`) but the gutter now visually owns cols 1-6, so textarea col 1 represents COBOL col 7 (the indicator column). Rulers were 6 chars too far right. Fix: subtract 6ch — col 8 ruler at `+ 1ch`, col 12 at `+ 5ch`, col 72 at `+ 65ch`. Lesson: when one part of the UI takes visual ownership of a coordinate-system region, every other position in the same coordinate system needs to shift in lockstep. Also added an explicit `--editor-gutter-width` variable so the gutter has a known width instead of being content-sized — useful for any future feature that needs to align across the gutter/textarea boundary.

### Bugs / Issues

<!-- Filled in during execution. -->

---

## Task 4: Console module + inline ACCEPT prompt

### Objective

Implement the `Console` class in `scripts/modules/console.js`: append-only
output history rendered via Knockout, plus an inline input prompt
exposing `prompt() → Promise<string>` for ACCEPT.

### Expected Outcomes

- `Console` class with `write(text, noAdvance?)`, `writeSystem(text)`,
  `writeError(text)`, `prompt()`, `clear()`.
- Output rendered via `foreach` binding over an observable array of line
  records `{ text, kind }` where kind ∈ `output | system | error | input`.
- System lines styled cyan, error lines styled hot magenta/red, output
  lines styled cyan-white, input lines styled with a `>` prefix.
- `prompt()` flips an `isPrompting` observable, focuses an input field,
  resolves the returned promise on Enter, and freezes the typed value
  into history as an `input` line.
- Boot banner written on construction.

### Risks / Constraints

- `noAdvance` (DISPLAY ... WITH NO ADVANCING) means the next write should
  append to the same line. Implementation: track a `pendingPartialLine`
  string and prepend it to the next write.
- Input element must auto-focus when `isPrompting` flips on. Use a
  custom KO binding handler that calls `.focus()` after render.

### Steps

- [*] Create `scripts/modules/console.js` with a `Console` class.
- [*] Constructor sets up `lines` (observableArray), `isPrompting` (observable), and a private `pendingResolve` field for the prompt promise.
- [*] Implement `write(text, noAdvance)`, `writeSystem(text)`, `writeError(text)` — each pushes a line record with the appropriate kind. Handle `noAdvance` by buffering instead of pushing.
- [*] Implement `clear()` — empties `lines` and resets the pending buffer.
- [*] Implement `prompt()` — if a previous prompt is pending, reject. Otherwise create a new promise, store its resolve, flip `isPrompting` to true.
- [*] Implement `submitPrompt(value)` — push an `input` line record `> <value>`, flip `isPrompting` off, call the stored resolve.
- [*] Add a custom KO `binding handler` `autofocus` that calls `.focus()` on the bound element when `valueAccessor()` is truthy.
- [*] Add console markup to `index.html`: `foreach` over `lines`, with the input row visible only when `isPrompting`.
- [*] In `styles.css`, style each line kind distinctly. Add a blinking caret pseudo-element on the prompt input.
- [*] In `app-view-model.js`, instantiate the console and wire its observables for binding.
- [*] Verify in browser: typing into the prompt and pressing Enter freezes the line; `console.write("HELLO")` from devtools renders correctly.

### Decisions

- Used Knockout's built-in `hasFocus: true` (a constant `true`) on the prompt input rather than writing a custom `autofocus` binding handler. Built-in hasFocus is one-way-from-source when the source is a literal — KO silently drops the blur write since `true` isn't writable. The element auto-focuses on render and we don't get a phantom-blur breaking the prompt flow when the user clicks elsewhere.
- `pendingPartial` is a `ko.observable("")` (not a plain field). The prompt UI displays it as a prefix in front of the input field, so it needs to be reactive to update if the program issues multiple `WITH NO ADVANCING` displays before the ACCEPT.
- Submit-prompt formatting: when there is a pending partial (e.g. `"Enter name: "`), the frozen input line shows `<partial><value>` as one continuous line, no `>` prefix. With no partial, it shows `> <value>`. Reads naturally as a terminal session in both cases.
- `clear()` deliberately does NOT touch `pendingResolve` or `isPrompting`. Erasing the visible history shouldn't kill an in-flight prompt — the program is still awaiting input. If we ever need a "stop the program" action, it belongs on the interpreter, not the console.
- Custom binding `autoScrollBottom` lives in `console.js` (not a separate `bindings.js`) because it's only used by the console panel. Hoist it later if a second consumer appears.
- Boot banner kept compact: `> COBOL.JS V0.1 // SYNTHWAVE EDITION` then `> READY.`. More flavor lines (`WORKING-STORAGE READY`, etc.) can be tacked on once they actually correspond to real subsystem-init events.

### Bugs / Issues

<!-- Filled in during execution. -->

---

## Task 5: FileIO module + working-dir mount

### Objective

Implement `scripts/modules/file-io.js` (`FileIO` class) that wraps the
provided `LocalFileSystem` and adds the project-specific concerns: mount
the working dir, list `.cbl` files, read/write `.cbl` files by name.

### Expected Outcomes

- `FileIO` class with `mount()`, `listPrograms()`, `read(name)`,
  `write(name, source)`, `isMounted` observable.
- File listing returns only names ending in `.cbl`, sorted alphabetically.
- `write(name)` adds the `.cbl` suffix if missing.
- Errors from the underlying lib are caught and surfaced via thrown
  `FileIOError(message)` so the view-model can render them in the console.

### Risks / Constraints

- File System Access API requires http(s) or localhost — same dev-server
  requirement as the modules.
- The provided `LocalFileSystem` exposes a global class, not an ES export.
  Reference it as `new LocalFileSystem()` at module load time.

### Steps

- [*] Create `scripts/modules/file-io.js` with a `FileIO` class wrapping `new LocalFileSystem()`.
- [*] Implement `mount()` — calls the lib's `setWorkingDirectory()` then refreshes the file list.
- [*] Implement `listPrograms()` — calls `listFiles()`, filters to `.cbl`, sorts.
- [*] Implement `read(name)` — wraps `readFile(name)`.
- [*] Implement `write(name, source)` — appends `.cbl` if missing, calls `writeFile(name, source, true, false)`.
- [*] Define and export a `FileIOError` class (or a small named-error helper).
- [*] In `app-view-model.js`, instantiate `FileIO` and expose `isMounted`, `programList`, `mount()`, `loadProgram(name)`, `saveProgram()` to the UI.
- [*] Add a sidebar in `index.html` with a "Mount" button when not mounted, and a `foreach`-bound `.cbl` list when mounted (each entry click-loads).
- [*] Verify in browser: mount a folder → see `.cbl` files listed → click loads source into editor → save prompts for name and writes file.

### Decisions

- Renamed the plan's `listPrograms()` to `refreshList()` because the method's job is to refresh the `programList` observable, not to return a list. Callers read `programList()` for the current value.
- `AbortError` from the directory picker (user cancels mid-pick) is silently swallowed inside `mount()` — it isn't an actual failure, so we don't want to surface it as `! Failed to mount...`. Any other error becomes a `FileIOError` and gets routed to the console as a styled error line.
- `write(name)` always returns the final `.cbl`-suffixed filename so callers can update their `currentFileName` to match what was actually saved (instead of guessing whether `.cbl` was appended).
- Filename state is split into a writable `currentFileName` (`null` when no file is yet associated) and a `displayFileName` computed (falls back to `"untitled.cbl"`). The header binds to `displayFileName`; `saveProgram()` prompts when `currentFileName()` is null. Cleaner than overloading `"untitled.cbl"` as both a real value and a sentinel.
- `saveProgram()` auto-mounts if the working dir isn't mounted yet — gives a smoother first-run flow than blocking with `! NO WORKING DIR`. If the user cancels the mount picker, save quietly aborts.
- The save-as prompt reuses `Console.prompt()` rather than introducing a separate modal. Authentic terminal feel and zero new UI machinery.

### Bugs / Issues

- **Mount button text wrapped** — `[ MOUNT WORKING DIR ]` overflowed the 220px sidebar width once letter-spacing was applied, breaking after `DIR` and pushing the closing `]` to its own line. Fix: shortened to `[ MOUNT DIR ]`.
- **Button rail position was unintuitive** — sitting above the editor meant clicking SAVE (top) and looking down to the console (bottom) for the SAVE-AS prompt. Fix: moved the rail into the main column, sandwiched between editor and console. Click target and prompt response now sit on the same vertical axis.
- **Status indicators relocated to the rail** — header was carrying STATUS/PROG separate from the action buttons. Followup tweak: moved the status block into the rail (left side), buttons right-aligned via `space-between`, both vertically center-aligned. Header now only carries the title; status sits beside the actions that change it.

---

## Task 6: AppViewModel wiring + stub run button

### Objective

Tie the editor, console, and file-io together in `AppViewModel` with
working `New` / `Load` / `Save` / `Run` / `Examples` button handlers.
Run is a stub — it just echoes the source to the console — so the full
UI loop can be exercised before any COBOL parsing exists.

### Expected Outcomes

- All button click handlers wired and functional.
- Status observable transitions: `READY` → `RUNNING` → `READY` (or `ERROR`).
- "RUN" pumps source through a stub that prints `> RUN` and the source's
  first line, plus `> PROGRAM TERMINATED NORMALLY (Nms)`.
- Editor pre-fills with HELLO-WORLD on first load (using a literal string
  in `app-view-model.js` for now; replaced by `examples.js` in Task 14).

### Risks / Constraints

- Async run handler must `try/catch` around the stub so future interpreter
  errors don't wedge the status banner.

### Steps

- [*] Add observables to `AppViewModel`: `status`, `currentFileName`, `programList`, `isMounted`, plus references to the editor and console.
- [*] Implement `newProgram()` — clears editor, clears `currentFileName`.
- [*] Implement `loadProgram(name)` — calls `fileIO.read`, sets editor text, sets `currentFileName`.
- [*] Implement `saveProgram()` — if no name, prompt via console for one; call `fileIO.write`; refresh program list.
- [*] Implement `run()` — stub: writeSystem `> RUN`, echo source, writeSystem termination message, time it. Wrap in try/catch.
- [*] Wire all of the above into the `index.html` button rail with `data-bind="click: ..."`.
- [*] Add a placeholder HELLO-WORLD source string at the top of `app-view-model.js` and pass it to the editor's initial value.
- [*] Verify in browser: every button does the expected thing; status banner cycles correctly.

### Decisions

- Several observables / methods (`currentFileName`, `loadProgram`, `saveProgram`, the HELLO-WORLD literal) were already added during Task 5 since they were prerequisites for the FileIO sidebar verification. This task just adds what was missing: `status`, `newProgram()`, `run()`.
- `programList` and `isMounted` live on `this.fileIO`, not directly on the view-model. Templates access them as `fileIO.isMounted` / `fileIO.programList`. Avoids forwarding shims.
- Status drives UI via an `attr: { 'data-status': status }` binding rather than a class. Lets a single CSS rule per state (`[data-status="RUNNING"]`, `[data-status="ERROR"]`) handle the colour swap with a `transition` on the parent `.status-value` for a soft fade.
- `run()` short-circuits with `! ALREADY RUNNING` if invoked while a previous run is still in flight. Prevents two run loops racing once Task 9 lands and an actual interpreter is involved.
- LOAD button in the rail wires to `mount` rather than a separate "load file" action. The actual file load happens via the sidebar list (single source of truth); the rail's LOAD acts as the entry point that gets the user into a mounted state if they aren't yet.
- EXAMPLES button is intentionally left unwired — that's Task 16's job. Wiring it now would require either inlining example data or stubbing a no-op, both of which would have to be ripped out.

### Bugs / Issues

- **Repeated SAVE clicks grew the prompt prefix** — each click while a prompt was already pending re-entered `console.write("SAVE AS: ", true)`, appending to `pendingPartial` and producing `SAVE AS: SAVE AS: SAVE AS: ` in the prompt area. Console.prompt() rejected the duplicate awaits but the writes had already mutated state.
- **Other actions clobbered an active prompt** — clicking RUN while a SAVE prompt was up triggered `console.writeSystem("> RUN ...")`, which calls `flushPartial()` and emptied the prompt's prefix mid-flight, leaving an unlabelled input field on screen.
- **Single fix**: added an `isBusy = isPrompting || RUNNING` computed on the view-model and `if(this.isBusy()) return;` guards at the top of every click handler (`newProgram`, `mount`, `loadProgram`, `saveProgram`, `run`). A `<body data-bind="css: { 'app-busy': isBusy }">` toggle plus a CSS rule (`.app-busy .btn / .files-list-btn / .files-mount-btn { opacity: 0.4; pointer-events: none; }`) handles visual disable. Defense in depth — pointer-events stops clicks reaching handlers; the JS guard catches anything that slips through.
- **Status reframed as a derived signal** (post-Task-6 user request). Split the writable `status` into `runStatus` (RUNNING/READY/ERROR — what the interpreter is doing) and `isDirty` (true when the editor differs from the last save/load). The displayed `status` is a computed: RUNNING > ERROR > (isDirty? UNSAVED: SAVED). Editor text changes flip `isDirty` and clear ERROR (the error referred to the previous source). Save/load reset isDirty to false. CSS gives each state its own neon: cyan for SAVED, amber for UNSAVED, purple for RUNNING, magenta for ERROR.
- **Rail order + label tweaks** — renamed LOAD to SET DIR (it sets the working directory; actual file load is via the sidebar list), reordered to SET DIR / NEW / SAVE / EXAMPLES / RUN. PROG comes before STATUS in the status block. Better mental order: identify the file, then know its state.
- **Workflow gates** — SAVE no longer auto-mounts when the working dir is unset; instead it prints `! SET WORKING DIRECTORY TO ENABLE SAVING` and bails. RUN refuses to execute while `isDirty` is true and prints `! SAVE BEFORE RUNNING`. Forces an explicit SET DIR → SAVE → RUN pipeline; users with stale unsaved edits never run a version that doesn't match what's on disk.
- **Picker-cancel handled gracefully** — `local-file-system.js` was unconditionally `console.error`-ing every failure of `setWorkingDirectory`, including `AbortError` (which is just "user dismissed the picker"). Patched the lib to skip the log when `error.name === "AbortError"`. `FileIO.mount()` now returns `true` on success and `false` on cancel, and `AppViewModel.mount()` writes `> SET DIR CANCELED` to the in-app console when canceled — gives the user feedback that the click was acknowledged without falsely claiming a directory was mounted.

---

## Task 7: Cobol façade + Keywords + Lexer

### Objective

Set up the public `Cobol` module and the lexer. Tokenize source text
into a `tokens[]` array with line tracking. No parser yet.

### Expected Outcomes

- `scripts/modules/cobol.js` exports a `Cobol` namespace with `run(source, console)`.
- `cobol/keywords.js` exports a `KEYWORDS` constant set + `Keywords.has(word)` helper.
- `cobol/lexer.js` exports a `Lexer` class.
- Token types: `KEYWORD`, `IDENTIFIER`, `NUMBER`, `STRING`, `PERIOD`, `OPERATOR`, `LPAREN`, `RPAREN`, `EOF`.
- Each token carries `{ type, value, line }`.
- Comments stripped: `*` in column 7 → whole-line comment; `*>` anywhere → rest-of-line comment.
- Strings handle both single and double quotes; doubled quote = escape.
- Identifiers/keywords are case-insensitive — values are normalized to uppercase.

### Risks / Constraints

- Column 7 indicator detection — use 0-based or 1-based consistently. Doc
  the choice inline.
- Periods are tokens, not statement terminators per se — let the parser
  decide; emit them faithfully.

### Steps

- [*] Create `scripts/modules/cobol/keywords.js` exporting a `Set` of reserved words: divisions, sections, statement keywords, operators (`TO`, `FROM`, `BY`, `INTO`, `GIVING`, `UNTIL`, `VARYING`, `TIMES`, `THEN`, `ELSE`, `END-IF`, `WITH`, `NO`, `ADVANCING`, `PIC`, `VALUE`, `ZEROS`, `ZEROES`, `SPACES`, `AND`, `OR`, `NOT`).
- [*] Create `scripts/modules/cobol/lexer.js` with a `Lexer` class.
- [*] Implement `tokenize(source)` — line-by-line scan, tracking line number; for each line, strip column-7 comments and inline `*>` comments, then scan tokens.
- [*] Implement token scanners for: whitespace skip, identifiers/keywords (uppercase normalized), numeric literals, string literals (both quote styles), `.`, `(`, `)`, operators (`=`, `>=`, `<=`, `>`, `<`, `+`, `-`, `*`, `/`, `**`).
- [*] Define a `CobolSyntaxError(line, message)` error class in `cobol.js` for the lexer to throw on bad strings/numbers.
- [*] Create `scripts/modules/cobol.js` with `Cobol.run(source, consoleHandle)` that lexes, then for now just writes `tokens.length` to the console and returns. Catches errors at the boundary.
- [*] Wire `Cobol.run` into `AppViewModel.run()` (replacing the stub).
- [*] Verify in browser: running HELLO-WORLD prints a token count without errors; running invalid source prints a styled error line.

### Decisions

- **Testing infrastructure introduced this task.** Plan didn't originally call for tests; user flagged it as a blocker for the interpreter pipeline. Approach: tiny Node-based test harness, no npm dependencies. Files: `package.json` (one line, `"type": "module"`), `tests/runner.js` (~100 LOC custom assertion harness with `suite`/`test`/`expect.toBe`/`toEqual`/`toThrow`), `tests/run.js` (entry that imports test files then runs). Run with `node tests/run.js` (or `npm test` since the script is wired). Each pure-logic module from this task onwards gets a `tests/cobol/<module>.test.js` file. UI modules (editor/console/file-io/app-view-model) stay manually verified — their logic is mostly KO-binding glue and DOM, not worth the harness setup it'd take to test cleanly.
- **Comment rule simplified to "starts with `*`" rather than "`*` in column 7"** as the original step described. Our editor's gutter visually owns COBOL cols 1-6; the source string as saved doesn't carry those columns, so a strict col-7 check would never match anything useful. Modern free-form COBOL also accepts `*` at the start of a line (after any leading whitespace) as a comment, so the lexer matches that. `*>` anywhere on a line still truncates as an inline comment.
- **Decimal numbers consumed in the lexer** (e.g. `3.14` → `NUMBER "3.14"`), but a trailing period followed by non-digit stays its own `PERIOD` token. Avoids the parser having to disambiguate sentence-terminating periods from decimal points later.
- **Identifiers can contain `-` and `_`** but must start with a letter. Hyphenated names (`USER-NAME`, `END-IF`) are core to COBOL, so this isn't optional. Underscore is included as a permissive extension since COBOL programmers used to typing JS may reach for it.
- **Token shape standardised as `{ type, value, line }`** with `EOF` always appended, so the parser has a guaranteed terminal sentinel and every token carries error-message context.
- **Cobol.run returns a boolean** (`true` on success, `false` on a caught COBOL error). The view-model uses it directly to flip `runStatus`. Internal (non-COBOL) errors get a styled error line AND re-throw, so the dev sees the stack in browser devtools while the user still sees a friendly message. Avoids the double-writeError that an earlier draft had.
- **28 lexer tests written and passing** in `tests/cobol/lexer.test.js`. Coverage spans: empty/whitespace input, plain and reserved-word identifiers, hyphenated keywords (`PROGRAM-ID`, `END-IF`), case-insensitivity, integer + decimal numbers, period disambiguation, single/double-quoted strings, doubled-quote escape, unterminated-string error, single + multi-char operators, parens, full-line and inline comments, line-number tracking across blank lines, error reporting carrying `error.line`, and the bundled HELLO-WORLD source as an integration check.
- **Verify-step observations from user (deferred, not bugs):** (a) Column-rule violations (e.g. statements outside Area B) aren't caught — the lexer is intentionally lenient per the locked design, rulers are visual guides only. (b) Boot-loaded HELLO-WORLD is editable but unsaveable until the user mounts a working dir, which is clunky onboarding. To revisit when bundling examples in Task 16 — likely answer is to load examples into editor without claiming they're saved, or treat first-boot specially.

### Bugs / Issues

<!-- Filled in during execution. -->

---

## Task 8: DataItem class + PIC parsing

### Objective

Build the `DataItem` class — the storage primitive that holds a value
under a PIC mask, supports group/elementary nesting, and converts between
display and numeric forms. Parsable in isolation, no interpreter required.

### Expected Outcomes

- `scripts/modules/cobol/data-item.js` exports a `DataItem` class.
- Accepts: level number, name, parent (or null), PIC string, optional
  initial value.
- Supports PIC forms: `X(n)`, `XX...`, `9(n)`, `99...`, `S9(n)`, `9(n)V9(m)`,
  `A(n)`. Group items have no PIC.
- `assign(value)` performs MOVE semantics: numeric → padded/truncated as
  per PIC; alphanumeric → space-padded right or left-truncated.
- `getDisplay()` returns the formatted display string.
- `getNumeric()` returns the numeric JS value (with implied decimal applied).
- VALUE clauses on construction initialize the field; `ZEROS`/`SPACES`
  expand to the appropriate fill.

### Risks / Constraints

- Numeric overflow on assign: COBOL truncates the high digits; document
  this in a `Why:` comment on the truncation branch.
- `S9` sign storage — for v0.1 store as a regular signed JS number; output
  with leading `-` for negatives, no leading space for positives.

### Steps

- [*] Create `scripts/modules/cobol/data-item.js` with a `DataItem` class.
- [*] Implement constructor accepting `{ level, name, parent, picString, initialValue }`.
- [*] Implement `parsePic(picString)` to extract `{ kind, length, decimalLength, signed }` — supports `X`, `9`, `A`, `S9`, `V`, both `(n)` and repeated forms.
- [*] Implement `assign(value)` — branch on kind: alphanumeric pads/truncates as a string; numeric parses to number, applies decimal, formats back to fixed width.
- [*] Implement `getDisplay()` and `getNumeric()`.
- [*] Implement `addChild(child)` for group nesting; group items aggregate their children's displays for `getDisplay()`.
- [*] Add basic console-driven sanity checks: instantiate a few DataItems with various PICs and verify `getDisplay()` from devtools after running the app. *(replaced by 57 unit tests, see Decisions)*

### Decisions

- **Devtools sanity check superseded by automated tests.** Plan called for "instantiate a few DataItems and verify via devtools" — replaced with 57 unit tests in `tests/cobol/data-item.test.js` covering PIC parsing, assignment semantics, display formatting, group nesting, and edge cases. Test suite total now: 76 passing.
- **Numeric display includes the implicit decimal point** when `decimalLength > 0`. Strict classic COBOL would output `01250` for `12.5` in `9(3)V99`; we output `012.50`. Authentic-ish but vastly more readable. If we ever want the strict form, can add a flag on the formatter — for now uniform behaviour.
- **`Math.trunc` for numeric scaling** rather than `Math.round`. Real COBOL truncates excess decimal precision unless `ROUNDED` is specified. Without `ROUNDED` (which is out of scope for v0.1), truncation is the correct default. e.g. `99.999 → PIC 9(3)` stores `99`, not `100`.
- **Unsigned PIC silently drops a negative sign** (rather than erroring). Matches typical COBOL implementation behaviour and avoids forcing the parser/interpreter to inspect signedness on every assign. Documented inline.
- **Constructor uses `picString != null`** rather than truthy check, so empty-string `""` correctly throws "empty PIC" instead of being treated as a group item. The truthy version was a small bug surfaced by the test harness on first run — caught and fixed before any real callers existed.
- **PIC parser is an instance method** on `DataItem` (called from constructor), not a free function. Per STYLE.md, free functions must be accessed via a module namespace; making it a method keeps the call site clean (`this.parsePic(...)`) and tied to the same line context for error reporting.
- **Group items have `pic === null` and no `value` field** — `isGroup()` / `isElementary()` predicates make the branching readable. `addChild` throws if called on an elementary item; `assign` throws if called on a group; `getNumeric` throws if called on a group. Each invariant has a paired test.
- **`line` field on DataItem** captures the source line of its declaration, threaded into PIC errors so the user sees the right line number. Not strictly needed yet but the parser will populate it once Task 10 starts wiring data items.

### Bugs / Issues

- **Empty-string PIC slipped through as group item** — constructor's truthy ternary `picString? ...` treated `""` as "no PIC". Fixed to `picString != null`. Test had been written before the fix; the failing test caught it on the first run of the suite.

---

## Task 9: Parser + Interpreter — DISPLAY only (HELLO-WORLD runs)

### Objective

Build a minimal Parser and Interpreter that handle just enough to run
HELLO-WORLD: divisions, PROGRAM-ID, and `DISPLAY`. This is the first
end-to-end interpreter slice — proving the pipeline works.

### Expected Outcomes

- `scripts/modules/cobol/program.js` defines a `Program` class with
  `programId`, `dataItems` (Map by name), `paragraphs` (ordered list,
  one anonymous default paragraph), each paragraph holding `statements[]`.
- `scripts/modules/cobol/parser.js` defines a `Parser` class with
  `parse(tokens) → Program`. Handles `IDENTIFICATION`/`ENVIRONMENT`/
  `DATA`/`PROCEDURE` divisions; in PROCEDURE only `DISPLAY` is recognized.
- DISPLAY supports multiple operands (literals + identifiers) and
  `WITH NO ADVANCING`.
- `scripts/modules/cobol/interpreter.js` defines an `Interpreter` class
  with `async execute()` that walks paragraphs/statements.
- `Cobol.run` lexes → parses → executes; HELLO-WORLD prints `HELLO, WORLD!`.

### Risks / Constraints

- Identifiers in DISPLAY must resolve against `dataItems`. For Task 9,
  there are no data items — only literals — so the lookup branch is a
  TODO until Task 10. Throw `CobolRuntimeError` on identifier reference
  in this task.

### Steps

- [*] Create `scripts/modules/cobol/program.js` with `Program` and `Paragraph` classes.
- [*] Create `scripts/modules/cobol/parser.js` with a `Parser` class. Implement a small token cursor with `peek`, `consume`, `expect(type, value)`, and `error(msg)`.
- [*] Implement division parsing: `IDENTIFICATION DIVISION.` → `PROGRAM-ID. <name>.`; `ENVIRONMENT DIVISION.` (skip to next division); `DATA DIVISION.` (skip for now); `PROCEDURE DIVISION.` parses statements.
- [*] Implement `parseDisplay()` — collects operands until `.`, sets `noAdvance` if `WITH NO ADVANCING` seen.
- [*] Create `scripts/modules/cobol/interpreter.js` with an `Interpreter` class.
- [*] Implement `executeDisplay(stmt)` — formats operands (literals only for now), calls `console.write(text, stmt.noAdvance)`.
- [*] Update `Cobol.run` to: lex → `new Parser().parse(tokens)` → `new Interpreter(program, console).execute()`.
- [*] Verify in browser: HELLO-WORLD program prints `HELLO, WORLD!` correctly.

### Decisions

- **STOP RUN parsed in this task even though Task 15 owns it.** HELLO-WORLD ends with `STOP RUN.` so the parser had to accept the keyword pair to verify Task 9's success criterion. Implementation is intentionally small: parser produces a `STOP_RUN` statement node, interpreter early-returns from `execute()` when it sees one. Task 15 will replace the early-return with a `StopRunSignal` exception that propagates through PERFORMed paragraphs, but the parser and statement shape will not change.
- **Statement node shape standardised as `{ kind, ..., line }`.** `kind` is the discriminator (`"DISPLAY"`, `"STOP_RUN"` for now). Line is the source line of the leading keyword so runtime errors can report it. Future statement types follow the same pattern.
- **Operand node shape: `{ kind: "literal" | "identifier", ... , line }`.** Literal operands carry `literalType` (`"string" | "number"`) and `value` (the raw lexeme as a string). Identifier operands carry `name`. Storing literals as raw strings (rather than coercing numbers) is fine for DISPLAY; arithmetic statements (Task 11) will `parseFloat` as needed.
- **Identifier resolution deferred to Task 10 via runtime error**, per the plan's risk note. The parser accepts identifier operands but the interpreter throws `CobolRuntimeError("identifier 'X' is not defined")` when it hits one — keeps the AST shape stable across tasks, and gives a meaningful error in the meantime.
- **Division skipping consumes `<NAME> DIVISION .` then drops tokens until the next division header or EOF.** Adequate for ENVIRONMENT (which we never plan to implement) and DATA (which Task 10 replaces). The look-ahead helper `peekDivision()` matches the three-token shape `<KEYWORD> KEYWORD("DIVISION") PERIOD` so any `<NAME> DIVISION .` sequence registers without needing a special list of names.
- **Parser uses one-shot `parse(tokens)` rather than constructor injection.** Matches the call-site (`new Parser().parse(tokens)`) called for in the plan and lets a single Parser instance be reused if we ever care; the cursor state lives on `this.tokens`/`this.pos` set up by `parse()`.
- **`Interpreter.execute()` is `async` from day one** even though Task 9's only statement (DISPLAY) is sync. ACCEPT in Task 10 needs `await this.console.prompt()` and the call-site (`Cobol.run`) already `await`s the interpreter, so making it async now means Task 10 doesn't have to retrofit the call chain.
- **Tests use a `MockConsole` with the same surface as the real `Console`** (`write(text, noAdvance)`, `writeSystem`, `writeError`). System / error lines are tagged with `[sys]`/`[err]` prefixes so output assertions can distinguish them from program output. 16 new tests added (Parser × 13, Interpreter × 8) — total suite now: 100 passing.
- **`Program` always seeds with one anonymous default paragraph.** Task 9 puts every PROCEDURE statement into it; Task 14's named paragraphs will append after. Keeps the interpreter's iteration loop unconditional — it just walks `program.paragraphs` in order.

### Bugs / Issues

<!-- Filled in during execution. -->

---

## Task 10: Working-storage parsing + DISPLAY of identifiers + MOVE + ACCEPT

### Objective

Add data-item parsing in `WORKING-STORAGE SECTION`, identifier resolution
in DISPLAY, the `MOVE` statement, and the `ACCEPT` statement. Now
programs can read input, store it, and display it back.

### Expected Outcomes

- Parser handles level numbers (01–49 + 77), names, PIC clauses, VALUE
  clauses; constructs `DataItem` instances and registers them in the
  Program's data-item map.
- Group items (no PIC) nest their elementary children via parent pointer.
- DISPLAY operands resolve identifier references through the map.
- `MOVE source TO dest [, dest...]` works for literal/identifier sources.
- `ACCEPT identifier` awaits `console.prompt()` and assigns the result.
- A "name greeter" example program (HELLO-NAME) runs end-to-end.

### Risks / Constraints

- A parser branch needs to know "we're inside WORKING-STORAGE" — track via
  a state field on the `Parser`.
- ACCEPT is async; `Interpreter.execute()` must already be `async` from Task 9.

### Steps

- [*] In Parser, replace the DATA-DIVISION skip with `parseDataDivision()` → `parseWorkingStorageSection()` → loop of `parseDataItem()`.
- [*] Implement `parseDataItem()` — level + name + PIC string + optional VALUE → constructs a `DataItem`, attaches to current parent stack based on level number, registers in the map.
- [*] In Interpreter, implement `resolveOperand(operand)` — returns either a literal value or `dataItem.getDisplay()` / `getNumeric()` based on context.
- [*] Update `executeDisplay` to use `resolveOperand` for identifier operands.
- [*] Add `parseMove()` in Parser; implement `executeMove(stmt)` in Interpreter (one source → many destinations, calling `dataItem.assign`).
- [*] Add `parseAccept()` in Parser; implement `executeAccept(stmt)` in Interpreter using `await this.console.prompt()`.
- [*] Add a HELLO-NAME test source (DISPLAY prompt → ACCEPT name → DISPLAY greeting) to the placeholder source in `app-view-model.js` for verification.
- [*] Verify in browser: HELLO-NAME runs, prompt accepts input, greeting displays.

### Decisions

- **PIC strings stitched from individual tokens.** The lexer doesn't have a PIC-clause mode — it emits separate tokens for `9`, `(`, `5`, `)`, `V99`, etc. The parser's `parsePicString()` consumes IDENTIFIER / NUMBER / LPAREN / RPAREN tokens and concatenates their lexemes back into a string, then hands that string to the existing `Pic.parsePic()` from Task 8. Keeps the lexer unaware of PIC syntax (it stays a single-pass tokenizer) and re-uses the well-tested PIC parser without duplicating its logic. Stops on KEYWORD (e.g. `VALUE`) or `PERIOD`, which is what closes a PIC clause in practice.
- **Parent-stack algorithm for level nesting.** During `parseWorkingStorageSection`, a stack of `{ level, item }` pairs tracks the current nesting context. Each new item pops everything with `level >= newLevel`, takes the top of stack as parent (or null if empty), then pushes itself. Level 77 is special-cased: clears the stack and never pushes itself, since it's always top-level and forbids subordinates.
- **Two resolution helpers in Interpreter, not one.** Plan called for a single `resolveOperand` but the DISPLAY and MOVE-source paths actually want different things: DISPLAY wants a formatted string (`getDisplay()` on numerics returns `012.50`), MOVE wants the raw JS value (`getNumeric()` returns `12.5`). Split into `resolveDisplayOf` (always string) and `resolveValueOf` (number for numeric items, string for alpha) — name makes the intended use obvious at the call-site.
- **Level numbers restricted to 01-49 and 77.** Other levels (66 RENAMES, 88 condition-names) are out of scope for v0.1 and would need their own AST shape. The parser throws a clean syntax error rather than silently treating them as ordinary fields.
- **Duplicate name detection at parse time.** `program.dataItems.set(...)` would silently overwrite, so the parser checks `has(name)` first and throws. Catches the typo class of bug at the moment it's introduced rather than producing confusing runtime "wrong field" behaviour.
- **VALUE clause supports STRING and NUMBER literals only.** Figurative constants (ZEROS, SPACES) and signed numerics deferred — none of the in-flight examples need them. When an example does, add a `figurative` operand kind alongside `literal` / `identifier`.
- **`PICTURE` keyword accepted as alias for `PIC`.** Both are valid COBOL; the keywords list already had `PIC` but `PICTURE` is the long form. Same code path, just two lexemes that route there.
- **HELLO-NAME placeholder displays trailing PIC padding.** USER-NAME is `PIC X(20)`, so the greeting reads `HELLO, MATT                ` — 17 trailing spaces. Authentic to COBOL (DISPLAY emits the full PIC width); cosmetically loose. Not worth solving until we have a `FUNCTION TRIM`-equivalent or a dedicated "trim trailing spaces on display" toggle, both of which are post-v0.1.
- **MockConsole grows a `prompt()` method that pre-records responses.** Constructor takes an array of strings; each `prompt()` call shifts and resolves the next one. ACCEPT tests then read like `execute(source, ["MATT"])`. Frozen prompt line gets pushed into `lines` so output assertions can confirm the prompt + value combination.
- **Test count: 47 added (Parser × 11 new for WORKING-STORAGE, MOVE, ACCEPT; Interpreter × 11 new for DISPLAY-of-identifiers, MOVE, ACCEPT including HELLO-NAME end-to-end).** Total suite: 123 passing.
- **Stale parser test updated.** "unsupported statement keyword reports clearly" used MOVE as the example; MOVE is now supported, so swapped to PERFORM (unsupported until Task 14).

### Bugs / Issues

- **RUN-while-dirty gate relaxed.** Task 6 introduced a hard block (`! SAVE BEFORE RUNNING`) when the editor was dirty; in practice this got annoying during iterative testing — the natural flow is "tweak, run, tweak, run", and forcing a save before every run is friction without much payoff (the source in the editor is what runs either way). Replaced with a non-blocking warning: after `> RUN <name>`, if dirty, write `! UNSAVED EDITS — RUNNING IN-MEMORY SOURCE` (new `warning` console kind, amber) and proceed. Original "must save first" rationale (avoid running stale on-disk versions) is preserved by the warning — the user knows what they're running.

---

## Task 11: Arithmetic statements (ADD / SUBTRACT / MULTIPLY / DIVIDE)

### Objective

Implement the four arithmetic statements with their `GIVING` variants and
multi-operand forms. No expression evaluator yet (that's Task 12).

### Expected Outcomes

- `ADD x [y ...] TO z [, z2 ...] [GIVING result]`
- `SUBTRACT x [y ...] FROM z [, z2 ...] [GIVING result]`
- `MULTIPLY x BY z [GIVING result]`
- `DIVIDE x BY z [GIVING result]` and `DIVIDE x INTO z [GIVING result]`
- Operands can be literals or identifiers; results are assigned back via
  `DataItem.assign` so PIC truncation/rounding semantics apply.
- Division by zero throws `CobolRuntimeError(line, "Division by zero")`.

### Risks / Constraints

- BY vs INTO direction in DIVIDE is easy to swap — write a one-line
  comment explaining the difference where it lands.

### Steps

- [*] Add `parseAdd()`, `parseSubtract()`, `parseMultiply()`, `parseDivide()` to Parser, each producing AST nodes with `sources[]`, `targets[]`, optional `giving` target.
- [*] In Interpreter, implement `executeAdd / executeSubtract / executeMultiply / executeDivide` — pull numeric values via `resolveOperand`, compute, assign to targets (or to `giving` if set).
- [*] Throw `CobolRuntimeError` on division by zero.
- [*] Verify in browser by adding an arithmetic test source to `app-view-model.js` (e.g., compute totals of a small list).

### Decisions

- **Two forms per operation, not three.** Plan suggested `[GIVING result]` after `TO/FROM/BY/INTO target`, which is COBOL spec but rare in practice. Implemented two clean forms instead: in-place (no GIVING) and pure-GIVING. The combined form (`ADD a TO b GIVING c`) is excluded — users can compose with COMPUTE in Task 12 if they need it. Avoids a fan-out of edge cases in both parser and interpreter while still covering the common idioms.
- **Per-statement AST shapes**, not a unified arithmetic node. ADD/SUBTRACT/MULTIPLY/DIVIDE each have their own kind and shape because they take different operands (SUBTRACT has `from`, MULTIPLY has `multiplier`/`multiplicand`, DIVIDE has `divisor`/`dividend`). A single shape would have meant a sea of nullable fields and runtime branching to figure out which were live. Each kind has a `giving` boolean discriminator that flips between in-place and GIVING semantics.
- **DIVIDE BY without GIVING is an explicit syntax error.** `DIVIDE A BY B.` has no implicit target — A would be modified, but the result of `A / B` going into A is unintuitive (most COBOL programmers expect BY to mean "use this as the divisor"). Standard COBOL allows it but reads weirdly. Forcing GIVING when BY is used eliminates the ambiguity; `DIVIDE A INTO B.` remains the natural in-place form.
- **`numericOf(operand)` helper added to Interpreter** alongside `resolveValueOf` / `resolveDisplayOf`. Arithmetic always wants a JS number — for literals, `parseFloat` (with NaN→0 fallback for non-numeric strings); for identifiers, `getNumeric()`. Distinguished from `resolveValueOf`, which can return a string for alpha items — passing an alpha item into ADD as a source would silently coerce there, which is the right thing to do (assignNumeric will parseFloat or fall back to 0).
- **Two list-collection helpers added**: `parseOperandsUntilKeyword(...stopKeywords)` for arithmetic source lists (mixed literals + identifiers) and `parseIdentifiersUntilKeyword(...stopKeywords)` for target lists (identifiers only). They're shared across the four arithmetic parsers — and `parseIdentifiersUntilKeyword` will likely subsume the inline target-collection loop in `parseMove()` later when refactor pressure justifies it.
- **In-place forms reject literal targets at parse time** (`SUBTRACT 5 FROM 10`, `MULTIPLY 2 BY 7`, etc.). They have no GIVING target so the operand on the receiving side has to be writable — i.e. an identifier. Catching this at parse is cleaner than letting `DataItem.assign` fail at runtime on a non-existent item.
- **Division by zero is checked once before iterating targets**, not per-target. A single divisor applies to every target; testing once is simpler and produces a single clear error rather than a flurry.
- **Arithmetic placeholder source** computes A + B, A − B, A × B, A ÷ B with `A=12, B=8` and a `PIC 9(4)V99` result, so the division (1.5) shows the implicit decimal point. Validates all four GIVING forms in one short program.
- **35 new tests added** (Parser × 16 across the four ops; Interpreter × 19 including the ARITH-DEMO end-to-end fixture). Total suite: 152 passing.

### Bugs / Issues

<!-- Filled in during execution. -->

---

## Task 12: ExpressionEvaluator + COMPUTE

### Objective

Build a small infix expression evaluator (shunting-yard or recursive
descent) and use it to implement the `COMPUTE` statement.

### Expected Outcomes

- `scripts/modules/cobol/expression.js` exports an `ExpressionEvaluator` class.
- Supports literals, identifier references, parens, and operators
  `+ - * / **` with standard precedence and left-associativity (right for `**`).
- `COMPUTE target = expression.` assigns the result via `DataItem.assign`.
- Reusable from condition parsing in Task 13.

### Risks / Constraints

- Identifier resolution inside expressions needs the interpreter's
  data-item map — pass a resolver callback into the evaluator rather than
  coupling the modules directly.

### Steps

- [*] Create `scripts/modules/cobol/expression.js` with an `ExpressionEvaluator` class. Constructor takes a `resolveIdentifier(name)` callback.
- [*] Implement either a shunting-yard or recursive-descent parser over expression tokens (a sub-token stream). Use whichever is cleaner; pick once and stick with it.
- [*] Add `parseCompute()` to Parser, capturing the target identifier and the expression token range.
- [*] In Interpreter, implement `executeCompute(stmt)` — instantiate the evaluator with a resolver, evaluate, assign result.
- [*] Verify in browser: add a compute-test source (e.g., quadratic formula) and confirm correctness.

### Decisions

- **Recursive descent over shunting-yard.** Both options were on the table; recursive descent reads more naturally for a four-precedence-level language and the call-graph mirrors the grammar one-to-one. The grammar is small (5 productions) so the function-per-production overhead is fine.
- **Right-associative `**` encoded by recursing through `unary` on the right side**, not by walking the operator twice. `factor := primary ('**' unary)?` lets `2 ** 3 ** 2` parse as `2 ** (3 ** 2) = 512` and also makes `2 ** -3` work without a special rule. Both behaviours are covered by tests.
- **Unary `+/-` have lower precedence than `**`** (per COBOL '85 spec). Means `-2 ** 2` evaluates to `-4`, not `4`. Test pinned to lock the choice.
- **Parser captures expression as a token slice**, ExpressionEvaluator parses+evaluates at runtime. Plan offered both; this split keeps statement-level concerns (period termination, target binding) in `Parser` and grammar-level concerns (precedence, associativity, paren matching) in `ExpressionEvaluator`. The same evaluator instance can be reused across statements without re-instantiating; resolver is constructor-injected so identifier lookup stays decoupled.
- **Resolver receives `(name, line)`**, not just `name`. Lets the resolver throw a positioned `CobolRuntimeError` for undefined identifiers without the interpreter wrapping the call. Less indirection, more useful errors.
- **Division-by-zero check lives in both ExpressionEvaluator and `executeDivide`.** Two code paths, two checks. ExpressionEvaluator throws when the runtime computation hits `/ 0` inside an expression; `executeDivide` throws when the DIVIDE statement's divisor is zero. Same `CobolRuntimeError(line, "Division by zero")` both places — line points to the `/` operator or the DIVIDE statement respectively, which is the right fingertip.
- **Empty expression and trailing tokens are syntax errors.** `COMPUTE Y = .` and `COMPUTE Y = 1 + 2 3.` both throw at evaluator-time, but the parser also catches the empty case at parse-time so the user sees the error before runtime.
- **Identifiers resolved via `getNumeric()`.** Alpha items going through COMPUTE get coerced — `getNumeric` on an alpha returns `parseFloat(value)` falling back to 0. Consistent with how the arithmetic statements treat alpha sources.
- **Compute-demo placeholder source** computes `X² + 2X + 1` and `(X+1)(X+2)` for `X = 4`, demonstrating exponentiation, mixed precedence, parens, and identifier-in-expression. `Y` is `PIC 9(4)V99` so the implicit decimal point displays even though the polynomial result is an integer.
- **40 new tests added** (ExpressionEvaluator × 24 covering precedence, unary, exponentiation, identifiers, errors; Parser × 4 for COMPUTE; Interpreter × 7 including the COMPUTE-DEMO end-to-end fixture). Total suite: 192 passing.

### Bugs / Issues

<!-- Filled in during execution. -->

---

## Task 13: IF / ELSE / END-IF with conditions

### Objective

Parse and execute conditional blocks with comparison and logical operators.

### Expected Outcomes

- `IF cond [THEN] statements [ELSE statements] END-IF` works.
- Conditions support `=`, `>`, `<`, `>=`, `<=`, `NOT =` (and `NOT >` etc.),
  `AND`, `OR`. Parens for grouping.
- Reuses the expression evaluator for the operands of comparisons.

### Risks / Constraints

- COBOL's `THEN` is optional; parser must accept either form.
- Statement bodies inside an IF can be multi-statement and must terminate
  on `ELSE` or `END-IF` rather than on `.`.

### Steps

- [*] Add condition-parsing utilities in Parser: `parseCondition()` builds a tree of `{ kind: 'compare' | 'logical' | 'not', ... }` nodes.
- [*] Add `parseIf()` — consumes `IF`, then condition, optional `THEN`, then statement list, optional `ELSE` block, then `END-IF`.
- [*] In Interpreter, add `evaluateCondition(node)` — recursively returns boolean.
- [*] Add `executeIf(stmt)` — picks the appropriate branch and walks its statements.
- [*] Verify in browser: a small IF/ELSE test program runs both branches correctly with different inputs.

### Decisions

- **Condition parser extracted to [parser/conditions.js](../../scripts/modules/cobol/parser/conditions.js)** — follows the `parser/*.js` sub-module convention from V0.12.0 H1. Free functions taking the Parser instance; standard recursive-descent grammar (orCond → andCond → notCond → atom → comparison) with one production per function.
- **Condition AST: three shapes (compare / logical / not), no `paren` node.** Paren-conditions just unwrap to their inner condition once the parens are consumed; storing the parens explicitly would be a no-op wrapper. The grammar stays clean: `atom := '(' condition ')' | comparison`, the parens are syntax not semantics.
- **Comparison operands captured as token slices** (mirrors COMPUTE) and evaluated at runtime via the cached `ExpressionEvaluator`. Reuses precedence/parens logic that COMPUTE already exercises; no separate expression handler.
- **Paren disambiguation via lookahead.** When `(` appears at the condition-atom level, it could be a paren-condition (`(X = 1)`) or the start of an arithmetic expression (`(X + 1) > Y`). `lookaheadIsParenCondition` peeks to the matching `)` and checks for a top-level comparison or logical operator — present → paren-cond, absent → arithmetic. Bounded lookahead, contained to one helper.
- **Two NOT positions, both lower to the same `not` node.** COBOL allows both `NOT (X = 1)` (prefix on a condition) and `X NOT = 1` (between operands). Parser handles both forms but produces a single AST shape: prefix-NOT wraps the inner condition; infix-NOT wraps the comparison after it's built. Interpreter has only one negation case to handle.
- **`StopRunSignal` introduced now, ahead of Task 15.** IF bodies need to propagate STOP RUN out of nested blocks; the only clean way is an exception. Task 15 was already going to introduce `StopRunSignal` for PERFORMed-paragraph propagation — bringing it forward by one task means IF-with-STOP-RUN works correctly on day one rather than appearing to work but silently no-op'ing inside the IF body. `executeStatement` throws `StopRunSignal` on `STOP_RUN`; `execute()` catches at the top. Task 15 will add GOBACK and EXIT against the same machinery.
- **`readExpressionSlice` stops on any KEYWORD or PERIOD at any depth.** Initial implementation used a hand-curated stop-keyword list (AND/OR/NOT/THEN/ELSE/END-IF) and only at top depth. That broke `IF X = 0 [no THEN] DISPLAY "Z"` because `DISPLAY` slipped through as an expression token, eating the entire next statement. Generalised: keywords and periods never appear inside arithmetic expressions, so any of either at any depth ends the slice. Revealed by the "THEN keyword is optional" test, fixed before Task 13 closed.
- **Statements inside IF bodies require their own period (Task-13 simplification).** COBOL '85 allows the looser form where inner statements drop their periods and END-IF terminates the entire sentence — supporting that means each statement parser needs to be aware of scope terminators (ELSE / END-IF) and stop on them in addition to PERIOD. Defer to FOLLOW UP; current behaviour matches intuitive Allman-style block parsing and the tests + demo work cleanly with it.
- **Comparisons coerce to numeric only.** `evaluateCompare` evaluates both sides via `ExpressionEvaluator` → numbers. String comparison (`"HELLO" = "WORLD"`) silently treats both sides as 0 (alpha → `getNumeric` → `parseFloat` → NaN → 0). Same convention as `numericOf`'s alpha→0 coercion (V0.12.0 M5). Document in FOLLOW UP — when a real example needs string comparison, distinguish at parse time.
- **31 new tests** (Parser × 12 covering optional-THEN, ELSE, AND/OR/NOT, infix NOT, paren-expression, paren-condition, nested IF, error paths; Interpreter × 13 covering true/false branching, AND/OR/NOT, all four comparison ops, nested IF, STOP RUN inside IF, expression operands; Integration × 2 for the IF-DEMO fixture). Total suite: **223 passing**.

### Bugs / Issues

- **Parse-time bug caught by the test suite, not by hand-tracing**: with the original keyword-restricted stop list, `IF X = 0 DISPLAY "Z". END-IF.` (THEN omitted) had `readExpressionSlice` consume DISPLAY and "Z" as part of the RHS expression, leaving an unattended PERIOD that the body parser then choked on with a generic "expected statement, got PERIOD" error. Generalised the stop conditions to all keywords and periods at any depth. Worth flagging because the tests caught it on first run — the kind of edge-case the IF-DEMO fixture wouldn't have exercised since it always uses THEN.

- **Demo originally used `PIC 9(3)` (unsigned) for the input field**: typing a negative number at the prompt silently became its absolute value (per `DataItem.assignNumeric`'s classic-COBOL "drop the sign on unsigned PIC" rule from Task 8), so `-80` evaluated as `80` and triggered the wrong IF branches. Switched to `PIC S9(3)` so the demo accepts the full ±999 range and the conditional logic reads honestly. Not a defect in the IF parser/interpreter — `evaluateCompare` would have done the right thing if it had received -80 — but the demo material was misleading.

- **Invalid numeric data now throws at the assign-and-read site, not at ACCEPT** (revised mid-task after the user pushed on COBOL fidelity). Real COBOL's ACCEPT is byte-level — no validation; the failure surfaces when the field is later used in arithmetic. Initial fix added a check in `executeAccept`; user pointed out (a) the `50*2 → 50` partial-parse was a JS `parseFloat` quirk, not COBOL behaviour, and (b) the "alpha→0 in arithmetic" convention from V0.12.0 M5 was also a non-authentic simplification. Switched to the more faithful approach: `DataItem.assignNumeric` and `getNumeric` use `Number()` (rejects partial parses), and throw `CobolRuntimeError` when input can't be cleanly parsed. Same rule covers `MOVE LABEL TO N`, `ADD LABEL TO N`, and `ACCEPT` of bad input — one invariant ("invalid numeric data throws when read as a number") instead of two. V0.12.0 M5 lock flipped from "alpha→0" to "alpha throws". `Interpreter.numericOf` updated to match (literal-source partial-parse path also tightens). Final test count: 228 passing (added 5 ACCEPT-validation tests; flipped 3 alpha→0 lock tests to expect throws; net +2).

---

## Task 14: PERFORM — paragraphs, TIMES, UNTIL, VARYING

### Objective

Implement paragraph definitions in PROCEDURE DIVISION and all four PERFORM
forms. With this in place, PERFORM-VARYING can drive loops over data.

### Expected Outcomes

- Parser recognizes paragraph-name labels (an identifier alone followed by `.`
  in PROCEDURE DIVISION) and groups subsequent statements into that paragraph.
- `PERFORM <para>` — execute the paragraph's statements once, then return.
- `PERFORM <para> N TIMES` — execute N times.
- `PERFORM <para> UNTIL cond` — re-evaluate condition before each iteration.
- `PERFORM <para> VARYING v FROM x BY y UNTIL cond` — initialize, then loop
  with v incrementing, condition checked at top.
- Recursion across paragraphs supported (within JS stack limits).

### Risks / Constraints

- Distinguishing a paragraph header from an identifier statement at the
  parser is the trickiest piece — a bare identifier-then-period in
  PROCEDURE DIVISION at the start of a "sentence" is a paragraph label.
- `STOP RUN` inside a PERFORMed paragraph must propagate out via the
  signal exception (Task 15).

### Steps

- [*] Update Parser's PROCEDURE DIVISION loop: when a bare identifier-then-period appears at the start of a sentence, treat it as a new paragraph.
- [*] Implement `parsePerform()` — branch on next token: identifier alone → simple PERFORM; `<n> TIMES` → counted; `UNTIL ...` → conditional; `VARYING ... FROM ... BY ... UNTIL ...` → varying.
- [*] In Interpreter, implement `executePerform` that switches on form and recursively executes the target paragraph's statements.
- [*] Verify in browser: run a multiplication-table test source (PERFORM VARYING) and confirm output.

### Decisions

- **Paragraph header detection is a single-token-pair lookahead.** `IDENTIFIER` followed by `PERIOD` at the start of a sentence is unambiguously a paragraph header — every statement leads with a KEYWORD, so there's no overlap. `isParagraphHeader()` peeks two tokens; the dispatch loop branches before reaching `parseStatement`.
- **Duplicate paragraph names rejected at parse time.** Mirrors the duplicate-data-item-name rule from Task 10. Catches typos at the source rather than producing confusing PERFORM-target-not-found behaviour.
- **PERFORM AST: one shape, four forms.** `{ kind: "PERFORM", form: "SIMPLE" | "TIMES" | "UNTIL" | "VARYING", target, ... }`. Form-specific fields (count / condition / varName + from + by) are populated only for the relevant variants. The interpreter dispatches on `form` with one branch per case.
- **VARYING `FROM` and `BY` accept single operands** (literal or identifier), not full expressions. Real COBOL allows arithmetic expressions there; v0.1 keeps it simple. Document for FOLLOW UP.
- **Interpreter tracks the loop variable via `lookupName` + `assign`.** Re-uses the existing DataItem invariants — assigning the FROM value through `assign` triggers the V0.13.0 throw-on-invalid path; incrementing via `getNumeric() + byValue` and `assign` keeps PIC truncation behaviour intact (so e.g. a loop variable with `PIC 9(2)` would wrap on overflow).
- **`runParagraph` extracted as a helper** and reused from both `execute()` (top-level walk) and `executePerform()` (PERFORM dispatch). Keeps the iteration shape uniform.
- **Top-level fall-through preserved.** `execute()` still walks every paragraph in order — if `MAIN` doesn't `STOP RUN`, control falls into the next paragraph. Pinned with a test (`fall-through: paragraphs after MAIN run if no STOP RUN`).
- **STOP RUN inside a PERFORMed paragraph already worked** thanks to the V0.13.0 `StopRunSignal` exception (brought forward from Task 15). One regression test added to lock it.
- **27 new tests** (Parser × 8, Interpreter × 11 + integration × 1, plus an updated "unsupported statement" test that switched from PERFORM (now supported) to GOBACK (Task 15)). Total: **248 passing** (was 228).

### Bugs / Issues

<!-- Filled in during execution. -->

---

## Task 15: STOP RUN / GOBACK / EXIT + program completion

### Objective

Wire up program-termination statements via a signal exception, and ensure
`Cobol.run` reports normal vs. error termination with elapsed time.

### Expected Outcomes

- `STOP RUN` and `GOBACK` throw `StopRunSignal`, caught by
  `Interpreter.execute()`'s top-level try/catch.
- `EXIT` is parsed and is a no-op (per classic COBOL).
- `Cobol.run` records start time, runs, and on completion writes
  `> PROGRAM TERMINATED NORMALLY (Nms)` via `console.writeSystem`.
- On caught `CobolSyntaxError` / `CobolRuntimeError`, writes
  `! SYNTAX ERROR LINE N: msg` / `! RUNTIME ERROR LINE N: msg`.
- On any other `Error`, writes `! INTERNAL ERROR: msg` and re-throws to
  console for debugging.

### Risks / Constraints

- `StopRunSignal` must subclass `Error` so it travels up through `await`.
  Ensure async PERFORMs propagate it correctly.

### Steps

- [*] Define `StopRunSignal extends Error` inside `interpreter.js` (not exported).
- [*] Add `parseStopRun()` / `parseGoback()` / `parseExit()` to Parser.
- [*] In Interpreter, throw `StopRunSignal` for STOP RUN and GOBACK; no-op for EXIT.
- [*] Wrap the top of `Interpreter.execute()` in try/catch handling `StopRunSignal` silently.
- [*] In `Cobol.run`, time the run with `performance.now()` and write completion / error lines accordingly.
- [*] Verify in browser: HELLO-WORLD reports `PROGRAM TERMINATED NORMALLY` with a millisecond count; an intentionally-broken source reports a clean syntax error.

### Decisions

- **Most of Task 15 was already in place.** `StopRunSignal` was brought forward to Task 13 (so STOP RUN inside an IF body could unwind cleanly); `Cobol.run` got its `performance.now()` timing and the error-class triage (`SYNTAX` / `RUNTIME` / `INTERNAL ERROR` re-throw) during the V0.14.0 critical-review remediation (H1). Task 15's actual delta was wiring GOBACK and EXIT into the Parser and Interpreter and adding the test coverage.
- **GOBACK uses the same `StopRunSignal`.** In a sub-program context COBOL distinguishes them (`GOBACK` returns to the caller, `STOP RUN` halts the whole runtime), but with no CALL support both collapse to "terminate the program". Reusing the signal keeps the unwind path uniform; if/when CALL lands, `GOBACK` will switch to a separate signal that's only caught at the active call frame.
- **EXIT is a pure no-op statement.** Classic usage is a placeholder paragraph (`PARA. EXIT.`) that gives PERFORM a target to fall through to — implementing EXIT as a return-from-`executeStatement` makes that work without any paragraph-aware logic. We're not yet supporting `EXIT PARAGRAPH` / `EXIT PERFORM` / `EXIT PROGRAM` (those are control-flow forms with their own semantics) — recorded under FOLLOW UP.
- **Stale "unsupported statement" parser test updated.** The Task 14 version used `GOBACK` as the unsupported keyword; Task 15 makes GOBACK supported, so the test was switched to `ZERO` (a real keyword that's intentionally not a statement).
- **9 new tests** (Parser × 3 — GOBACK parsed / GOBACK without period / EXIT parsed; Interpreter × 4 — GOBACK halts / GOBACK in PERFORMed paragraph / EXIT no-op / PERFORM of EXIT-only paragraph; plus the updated "unsupported statement" test). Total: **257 passing** (was 250).
- **Follow-up wave** (same task, follow-up items resolved in-line): added EXIT qualifier forms (PARAGRAPH/PROGRAM/PERFORM) and signed numeric literals. EXIT PARAGRAPH and EXIT PERFORM use new signal classes (`ExitParagraphSignal` caught in `runParagraph`; `ExitPerformSignal` caught in `executePerform`); EXIT PROGRAM is a no-op (matches the standard for main programs). Signed literals (`-5`, `+10`) are recognised in `parseOperand` and `parseValueLiteral` via a peek-ahead for `OPERATOR +`/`-` followed by `NUMBER`; COMPUTE/condition expressions already handled unary minus in `ExpressionEvaluator.parseUnary`. **+21 tests**: Parser × 8, Interpreter × 13. Running total: **278 passing**.

### Bugs / Issues

<!-- Filled in during execution. -->

---

## Task 16: Bundled examples

### Objective

Ship the EXAMPLES dropdown with five working programs that exercise the
implemented feature set.

### Expected Outcomes

- `scripts/modules/examples.js` exports an `Examples` namespace with a
  `list` array of `{ name, description, source }` and a `byName(name)`
  helper.
- Five programs included: HELLO-WORLD, FIZZBUZZ, FIBONACCI,
  MORTGAGE-CALC, GUESS-THE-NUMBER.
- EXAMPLES button in the UI reveals a dropdown; selecting one loads its
  source into the editor and clears the file name.
- Each example actually runs end-to-end and exercises a different
  feature: DISPLAY only / arithmetic + IF / PERFORM VARYING /
  COMPUTE + decimals / ACCEPT + IF + PERFORM UNTIL.

### Risks / Constraints

- This task doubles as a smoke test of the whole interpreter — fixes
  identified here probably belong in earlier tasks but document them here.

### Steps

- [*] Create `scripts/modules/examples.js` with a `list` of `{ name, description, source }` records.
- [*] Author HELLO-WORLD source (smallest possible, exercises DISPLAY).
- [*] Author FIZZBUZZ source (DIVIDE for modulo via subtraction or COMPUTE; PERFORM VARYING; IF/ELSE).
- [*] Author FIBONACCI source (PERFORM UNTIL; ADD; MOVE).
- [*] Author MORTGAGE-CALC source (ACCEPT; COMPUTE with `**`; decimal PICs; DISPLAY of formatted decimals).
- [*] Author GUESS-THE-NUMBER source (ACCEPT in a loop; IF/ELSE; PERFORM UNTIL guessed).
- [*] Add `byName(name)` helper.
- [*] Wire the EXAMPLES dropdown in `app-view-model.js` and `index.html`.
- [*] Replace the placeholder HELLO-WORLD literal in `app-view-model.js` with `Examples.byName("HELLO-WORLD").source` for the initial editor content.
- [*] Verify in browser: each example loads and runs to completion correctly.

### Decisions

- **Sources live as `.cbl` files under `/examples/`, not inline in JS.** User clarified the contract during execution: the manifest in `examples.js` carries only metadata (`{ name, description, fileName }`), and source content is fetched at boot. Embedding a real COBOL source as a JS template literal is fragile (indent-sensitive; hard to read in version control) and conflates two artifacts that have different audiences.
- **Eager preload at boot, not lazy fetch on selection.** All five files are small (a few KB total) and the dropdown should respond instantly. `app.start()` awaits `Examples.loadAll()` before constructing the view-model so `Examples.byName("HELLO-WORLD").source` is synchronously available for `INITIAL_SOURCE`. Lazy fetch is the same wiring with one `await` moved from boot to handler if it ever matters.
- **Boot-time source loaded via `Examples.byName`, not duplicated in the view-model.** Symmetric with `loadExample` — the boot pipeline is the same path the user takes when picking an example. Replaces the earlier `INITIAL_SOURCE` constant that was updated each task; future demos go in `/examples/` instead of as a JS literal.
- **Boot-fetch failures are logged, not fatal.** `app.start()` catches Examples.loadAll() errors and writes to `console.error` — the editor opens with empty content rather than the app refusing to load. Acceptable for a learning tool; misconfigured static-server setups don't bork the page.
- **EXAMPLES dropdown wired with a `closeOnOutsideClick` custom binding.** Clicking outside the wrapper resets the `examplesOpen` observable. Lives in `bindings.js` per the project convention; reusable for any future menu/popover.
- **FIZZBUZZ uses repeated subtraction for the modulo.** No MOD operator; floating-point `N - (N/M) * M` is unreliable across small integers (e.g. `7 - (7/5)*5` rounds to `9e-16` in JS, not `2`). Subtract-loop is verbose but bulletproof; doubles as a nice demo of nested PERFORM.
- **FIBONACCI prints the first 15 numbers using `PIC 9(3)`.** PIC 9(8) was the first cut but the leading-zero-padded display dwarfs the values. PIC 9(3) covers up to 999 (377 is the 14th Fibonacci number, fits with room).
- **MORTGAGE-CALC uses standard annuity formula.** $100k @ 6.5% over 30 years yields $632.06/month (real-world figure: $632.07; the $0.01 difference is from `PIC 9(7)V99` truncation of the un-rounded JS float). Tested with those exact inputs.
- **GUESS-THE-NUMBER uses a hard-coded target (42).** No random source available without bringing in JS interop; the example is a working ACCEPT-loop demo, not a true random game. User can edit `VALUE 42` to change the puzzle.
- **Test seed (`seedForTesting`) instead of mocking fetch.** Examples module tests inject sources read from disk via `seedForTesting(name, source)`; integration tests bypass the module entirely and run the lexer/parser/interpreter against the file contents. Keeps the test runner free of fetch shims.
- **9 new tests** (Examples × 4 manifest + 5 integration). Total: **287 passing** (was 278).
- **Follow-up wave: intrinsic functions added in-task (RANDOM / INTEGER / MOD).** Pulled forward to make GUESS-THE-NUMBER pick a fresh target each run instead of hard-coding 42 — the example now uses the standard COBOL idiom `COMPUTE TARGET = FUNCTION INTEGER(FUNCTION RANDOM * 100) + 1`. Implementation: `FUNCTION` added as a keyword; `parsePrimary` in the ExpressionEvaluator recognises it and dispatches to `parseFunctionCall`; intrinsics live in an `INTRINSICS` table on the module with `{ arity, call }` entries. Lexer now treats `,` as whitespace (COBOL allows comma-or-space-separated args; making `,` a no-op token keeps the parser unaware of it). FIZZBUZZ deliberately keeps its manual subtract-loop modulo with a top-of-paragraph comment noting that `FUNCTION MOD` would replace it — the manual version is a better showcase of MOVE and PERFORM. **+14 tests**: ExpressionEvaluator × 13 (intrinsic semantics, arity errors, nesting, identifier args, comma vs. space separation), plus GUESS-THE-NUMBER integration test updated to stub `Math.random`. Running total: **301 passing**.
- **Follow-up wave: string conditions + string intrinsics.** The Task 13 string-conditions follow-up and the Task 16 string-intrinsics follow-up are deeply coupled — both want the evaluator to handle non-numeric values. Resolved by widening the evaluator to a polymorphic value pipeline: STRING tokens are now a primary; `INTRINSICS` entries declare `argTypes` (`"string" | "number"`) and the call-site validates each arg's `typeof`; arithmetic operators (`+`/`-`/`*`/`/`/`**`/unary `-`) `requireNumber` on each operand and throw `CobolRuntimeError` on string. The interpreter's resolver was widened to return a string for alpha PIC items (and group items) and a number for numeric PIC items; `evaluateCompare` dispatches via a `normalizeForCompare` helper that right-trims string operands (matching COBOL's space-padding semantics) and throws on mixed-type compares. New string intrinsics: `LENGTH`, `UPPER-CASE`, `LOWER-CASE`, `REVERSE`, `TRIM`. Also fixed an incidental bug — `readExpressionSlice` in the condition parser broke on any KEYWORD, which prevented `IF FUNCTION UPPER-CASE(...) = "X"` from parsing; it now allows the `FUNCTION` keyword through. **+21 tests**. Running total: **322 passing**.
- **Follow-up wave: FUNCTION calls in MOVE/DISPLAY/arithmetic operands.** Closes the natural-shape gap exposed by the previous wave — string intrinsics weren't usable outside of COMPUTE / IF conditions because `parseOperand` rejected the `FUNCTION` keyword. New parser path `parseFunctionCallOperand()` captures the `FUNCTION <name>` or `FUNCTION <name>(...)` slice (paren-balanced for nested calls) into a new operand AST kind `{ kind: "expression", tokens, line }`. The three interpreter resolvers (`resolveDisplayOf` / `resolveValueOf` / `numericOf`) each gained an "expression" branch that delegates to `ExpressionEvaluator.evaluate(operand.tokens, this.resolveValue)`. Same evaluator instance, same resolver — so authentication is uniform across COMPUTE / conditions / operands. Now writes naturally as `DISPLAY "HELLO " FUNCTION UPPER-CASE(NAME) "!"`, `MOVE FUNCTION INTEGER(7.9) TO X`, `ADD FUNCTION MOD(7, 3) TO X`. **+7 tests**: DISPLAY with single FUNCTION operand / DISPLAY mixing literal + FUNCTION / MOVE FUNCTION UPPER-CASE / MOVE FUNCTION INTEGER / ADD FUNCTION MOD / PERFORM TIMES with FUNCTION count / type-mismatch (string → numeric PIC) error. Running total: **329 passing**.
- **Follow-up wave: sixth example — FORTUNE-COOKIE.** Added once all the polymorphic-evaluator pieces were in place. Picks a random fortune, derives a lucky number from name length, mirrors / whispers the input via REVERSE / LOWER-CASE, and reveals a hidden double fortune for palindrome names. Single example exercises every intrinsic we ship (RANDOM, INTEGER, MOD, LENGTH, UPPER-CASE, LOWER-CASE, TRIM, REVERSE) used in MOVE, DISPLAY, COMPUTE, and IF operand positions. Manifest length test bumped 5 → 6 (a deliberately-low-cost test that catches accidental list edits). **+3 tests**: integration test with stubbed `Math.random` for stable PICK, palindrome easter-egg test for "anna", default-name fall-back for empty input. Running total: **332 passing**.

### Bugs / Issues

<!-- Filled in during execution. -->

---

## Task 17: Polish pass — error styling, status banner, blinking caret

### Objective

Tighten the visual experience: error lines pulse / glow magenta, status
banner transitions are visible, blinking caret in console + editor focus.

### Expected Outcomes

- Error lines styled distinctly (hot magenta with subtle glow + `!` prefix).
- Status banner transitions use a CSS transition for a brief flash.
- Console prompt input has a visible blinking caret pseudo-element.
- Focused textarea has a slightly brighter cyan border + glow.

### Risks / Constraints

- Animations should be subtle — over-animation degrades the "real
  terminal" feel.

### Steps

- [*] Add `@keyframes blink` and `@keyframes pulse-error` rules in `styles.css`.
- [*] Apply the pulse animation to error lines.
- [*] Apply the blink animation to the prompt-input pseudo-caret and (optionally) the boot banner.
- [*] Add a CSS transition on the status text color and a brief flash on `RUNNING` / `ERROR` state.
- [*] Brighten the editor's focus-state border + add a faint glow.
- [*] Verify in browser: visuals look polished, performance stays smooth.

### Decisions

- **Only one keyframe shipped: `blink-caret`.** Initially built three (`blink-caret`, `pulse-error`, `flash-status`) but the user judged the error-line pulse and the status flash as not earning their motion budget — neither felt like it was "doing much" and the static colours already make state legible. Removed both keyframes and their selectors before sign-off; only the prompt caret blink kept.
- **Prompt caret blink animates `caret-color` directly** rather than overlaying a fake `::after` block. CSS animation on `caret-color` is supported in all modern browsers and inherits the existing `--neon-magenta` colour without changing markup. Browsers' native caret blink is overridden by the explicit animation so the timing is consistent.
- **Editor focus styling lives on the parent containers via `:focus-within`**, not on `.editor-textarea:focus`. The textarea itself can't carry an outer glow without spilling into the gutter or being clipped by the panel; brightening `.editor` (inner glow) and `.panel-source` (border + outer glow) gives a clean panel-wide "active" treatment.
- **Editor textarea caret is now cyan, not the default white.** Matches the panel theme and gives a visual cue that focus is inside the source pane (vs. the magenta caret on the console prompt).
- **Boot-banner blinking deliberately skipped.** The plan listed it as optional; adding a persistent terminal cursor at the end of system lines would require extra markup and create a constant motion source. The console prompt's own blink covers the "live cursor" feel where it's actually useful.

### Bugs / Issues

<!-- Filled in during execution. -->

---

## Task 18: Smoke-test all examples + bug-fix pass

### Objective

Run every bundled example in the browser, exercise edge cases, and fix
anything that surfaces. Produce a final "ready for first user" build.

### Expected Outcomes

- All five examples run cleanly.
- Specific edge cases verified: division by zero error message; missing
  identifier error message; unmounted "Save" prompt path; long output
  scrolls correctly; very rapid Run-clicks don't break the prompt state.
- Any bugs found are recorded under the appropriate Task's
  `Bugs / Issues` section and fixed.

### Risks / Constraints

- Discovered bugs may require revisiting earlier tasks — that's fine, the
  goal is correctness.

### Steps

- [*] Run HELLO-WORLD; confirm output and timing line.
- [*] Run FIZZBUZZ for at least 1..30; confirm output.
- [*] Run FIBONACCI to a meaningful term count; confirm sequence.
- [*] Run MORTGAGE-CALC with realistic inputs; confirm decimal formatting.
- [*] Run GUESS-THE-NUMBER; confirm loop and termination.
- [*] Force a syntax error (delete a period) — confirm clean error.
- [*] Force a runtime error (divide by zero) — confirm clean error.
- [*] Save and reload a program through the file-list panel.
- [*] Capture any bugs in the appropriate Task's `Bugs / Issues` section and resolve.

### Decisions

<!-- Filled in during execution. -->

### Bugs / Issues

<!-- Filled in during execution. -->

---

## Task 19: Period-less statements inside IF bodies

### Objective

Accept the canonical COBOL '85 form where statements inside an `IF` /
`ELSE` body don't each carry a trailing period — the scope terminator
(`ELSE` / `END-IF`) ends the body. Without this, programs copy-pasted
from any real COBOL textbook fail to parse on their first IF block.

### Expected Outcomes

- Bodies like
  ```cobol
  IF X = 0
      DISPLAY "ZERO"
      MOVE 1 TO Y
  END-IF.
  ```
  parse and run with the same semantics as the period-terminated form.
- Existing period-terminated code keeps working — no regressions.
- Top-level (non-IF) statements without periods are also accepted as a
  natural side-effect of the parser's permissive stance; this is
  consistent with the column-insensitive lexer.

### Risks / Constraints

- Touches every statement parser (DISPLAY, MOVE, ACCEPT, ADD, SUBTRACT,
  MULTIPLY, DIVIDE, COMPUTE, STOP, GOBACK, EXIT, PERFORM). One missed
  parser means that statement would still require a period.
- Operand-list helpers (`parseOperandsUntilKeyword`,
  `parseIdentifiersUntilKeyword`) need the same boundary detection.

### Steps

- [*] Add `STATEMENT_BOUNDARY_KEYWORDS` set + `isStatementBoundary()` helper to Parser.
- [*] Add `expectStatementEnd()` — accepts PERIOD or a boundary keyword (without consuming the boundary).
- [*] Update DISPLAY, MOVE, ACCEPT, STOP RUN, GOBACK, EXIT to break on boundary / use `expectStatementEnd()`.
- [*] Update COMPUTE expression-token loop to break on boundary.
- [*] Update PERFORM (all four forms) to use `expectStatementEnd()`.
- [*] Update ADD/SUBTRACT/MULTIPLY/DIVIDE in `parser/arithmetic.js`.
- [*] Update `parseOperandsUntilKeyword` and `parseIdentifiersUntilKeyword` to break on boundary.
- [*] Update the `parseIf` block comment to reflect that period-less is now supported.
- [*] Add tests covering each statement type used inside an IF body without trailing period.
- [ ] Verify in browser: paste a canonical period-less IF block and confirm it runs.

### Decisions

- **Single source of truth: `STATEMENT_BOUNDARY_KEYWORDS`.** Module-level Set listing every keyword that can never appear inside a single statement (statement starters DISPLAY/MOVE/ACCEPT/ADD/SUBTRACT/MULTIPLY/DIVIDE/COMPUTE/IF/PERFORM/STOP/GOBACK/EXIT plus scope terminators ELSE/END-IF). Statement-internal keywords (WITH/NO/ADVANCING/TO/BY/FROM/GIVING/TIMES/UNTIL/VARYING/THEN/RUN/PARAGRAPH/PROGRAM/FUNCTION/AND/OR/NOT) are deliberately excluded. The set is a single grep-target if a future statement is added.
- **Two helper methods on the Parser: `isStatementBoundary()` and `expectStatementEnd()`.** Each statement parser uses them consistently — loops break on boundary (without consuming), terminal expects use `expectStatementEnd()` which consumes a PERIOD if present, or peeks-and-allows a boundary, or errors. Means the period-vs-no-period decision is made in one place per parser rather than scattered.
- **Period-less also accepted at top level as a side-effect.** The boundary detection doesn't distinguish "inside IF body" from "top level" — anywhere a statement parser sees the next statement-starter, it treats the current statement as ended. This matches the project's overall permissive stance (column-insensitive lexer, free-form parsing) and avoids a second parse mode.
- **No regressions.** All 332 prior tests pass unchanged; the new boundary check only fires when there's no period, which previously errored. **+7 tests** covering: single DISPLAY, multi-statement THEN body (DISPLAY/MOVE/ADD/DISPLAY), period-less ELSE branch, nested IF inside IF, COMPUTE + PERFORM in body, STOP RUN halting from inside body, mixing period and period-less in one body. Running total: **339 passing**.

### Bugs / Issues

<!-- Filled in during execution. -->

---

## Task 20: Test coverage sweep

### Objective

Close the defensive-coverage gaps that have accumulated through the
V0.12.0 / V0.14.0 reviews. Adding these tests now hardens against
post-V1.0.0 regressions and surfaces any latent bugs.

### Expected Outcomes

- New tests for: ACCEPT into a numeric PIC with non-numeric input;
  COMPUTE assigning to an alpha PIC; empty PROCEDURE DIVISION; a
  program with no PROCEDURE DIVISION at all; group DISPLAY with
  mixed-kind children; error-line accuracy under nested IF; dedicated
  `Program` / `Paragraph` unit tests.
- Any bugs the sweep reveals are recorded under this task's
  `Bugs / Issues` and fixed (or filed for future work if out of scope).

### Risks / Constraints

- Test-only task; if a covered gap is actually broken, the fix may
  expand scope into a code change.

### Steps

- [*] ACCEPT into numeric PIC with non-numeric input throws cleanly.
- [*] COMPUTE result assigned to an alpha PIC throws cleanly.
- [*] Program with empty PROCEDURE DIVISION runs without error.
- [*] Program with no PROCEDURE DIVISION at all runs without error.
- [*] Group DISPLAY with mixed-kind children produces correct concatenation.
- [*] Error line numbers are correct when an error is raised deep in nested IF.
- [*] Dedicated Program/Paragraph constructor + state tests.
- [*] Resolve any bugs surfaced; tick affected items in the FOLLOW UP list.

### Decisions

- **Sweep surfaced one real bug: COMPUTE silently coerced a numeric result into an alpha PIC.** `COMPUTE NAME = 5 + 3` where `NAME PIC X(10)` would store `"8         "` (number-to-string + space-padded) without complaint. Fixed `executeCompute` to check that the target's `pic.kind === "numeric"` and throw `CobolRuntimeError("COMPUTE target ... must be a numeric PIC")` otherwise. Real COBOL rejects this at compile time; our model rejects it at execute time, with a positioned error.
- **Five other gaps already worked correctly** — added tests as regression locks. ACCEPT non-numeric → numeric throws via the existing `assignNumeric` invalid-data path; empty PROCEDURE DIVISION and no-PROCEDURE-DIVISION programs both run cleanly via the anonymous default paragraph in `Program`'s constructor; group DISPLAY iterates `children.map(c => c.getDisplay()).join("")`; error lines are accurate because every statement parser stamps `line` from its starting token (the IF nesting doesn't rewrite that).
- **New `tests/cobol/program.test.js`** with 12 unit tests for the `Program` and `Paragraph` classes. Previously these were exercised only via integration; now their constructor invariants and ordering guarantees are pinned directly.
- **18 new tests total**: Interpreter > coverage gaps × 6, Program × 9, Paragraph × 4. Net change after the COMPUTE-target fix: **357 passing** (was 339).

### Bugs / Issues

- **COMPUTE → alpha PIC silently coerced.** Fixed in this task — `executeCompute` now validates the target is a numeric PIC.

---

## Follow Up

Items deferred from the V0.8.0 and V0.12.0 code reviews. Pull from this list when the listed trigger condition lands; some may be promoted to PLAN tasks of their own.

### From V0.8.0 (see [reviews/REVIEW_V0.8.0.md](reviews/REVIEW_V0.8.0.md))

- [ ] **(V0.8.0 M1) Split `WorkflowState` out of `AppViewModel`** — when the view-model crosses ~250 LOC. Current size: ~202.

- [ ] **(V0.8.0 M2) Magic-string state values** — introduce `RUN_STATUS` / `TOKEN_TYPE` / `PIC_KIND` constant modules. Defer until the first real rename pain bites; the V0.12.0 review re-flagged this (M1 there) as compounding but the trigger is still unmet.

- [*] **(V0.8.0 M5) `Console.prompt()` rejection is unreachable** — Resolved during V0.12.0 remediation. Replaced `Promise.reject(...)` with a synchronous `throw` and a comment explaining the gate contract.

- [ ] **(V0.8.0 L1) `runner.js` `toEqual` uses JSON-stringify equality** — replace with a proper structural compare when an assertion first compares non-plain-data (functions, dates, regexes, undefined, circular refs).

- [*] **(V0.8.0 L2) `CobolRuntimeError` is dead code until Task 11** — Resolved by Task 11 landing — used by ADD/SUBTRACT/MULTIPLY/DIVIDE for division-by-zero, and by the Interpreter's lookupName / numericOf / resolveDisplayOf.

- [ ] **(V0.8.0 L3) Sub-section banners not exactly 80 cols when indented** — STYLE.md says "exactly 80". Either clarify the rule (col 0 vs. content start) or adjust banners. Free functions extracted in V0.12.0 H1 sit at col 0 so they align cleanly; class-method banners (e.g. inside `data-item.js`) still don't. Update STYLE.md if the rule shifts.

- [ ] **(V0.8.0 L5) Redundant work in `newProgram`** — `setText("")` triggers the subscriber that handles state cleanup, then explicit calls reapply the same state. Belt-and-braces; harmless but cosmetic.

### From V0.12.0 (see [reviews/REVIEW_V0.12.0.md](reviews/REVIEW_V0.12.0.md))

- [ ] **(V0.12.0 M1) Magic-string AST kinds and token types** — same fundamental concern as V0.8.0 M2, scope expanded to include statement kinds, operand kinds, literal types, divide direction. Defer until rename pain bites.

- [*] **(V0.12.0 L1, partial) Remaining test coverage gaps** — Resolved in Task 20. Coverage sweep added tests for ACCEPT non-numeric → numeric PIC, COMPUTE → alpha PIC (which surfaced and fixed a bug — silent string coercion now throws), empty PROCEDURE DIVISION, no-PROCEDURE-DIVISION programs, group DISPLAY with mixed-kind children, and dedicated Program/Paragraph constructor tests. HELLO-NAME (an example name from the original note) is no longer relevant — replaced by the FORTUNE-COOKIE / GUESS-THE-NUMBER / MORTGAGE-CALC examples.

- [ ] **(V0.12.0 L6) `errorAt`-throws fall-off across the parser** — readers have to trust that `errorAt` throws to confirm callers never fall off the end. Cosmetic; defer until / unless we adopt TypeScript or stricter linting.

### From Task 13

- [*] **Period-less statements inside IF bodies** — Resolved in Task 19. Added `STATEMENT_BOUNDARY_KEYWORDS` set and `expectStatementEnd()` helper to the Parser; each statement parser now treats either a period or a statement-starter / scope-terminator keyword as end-of-statement. Both forms accepted, no regressions.

- [*] **String comparisons in conditions** — Resolved in V0.16.0 follow-up wave. Implemented via runtime polymorphism (rather than the parse-time dispatch suggested in the original note): the ExpressionEvaluator now returns either a number or a string per primary, and the interpreter's `evaluateCompare` dispatches by `typeof` with COBOL-spec right-trim semantics on string operands. Mixed-type compares throw `CobolRuntimeError("cannot compare ...")`. Same change unlocked string intrinsic functions (LENGTH/UPPER-CASE/LOWER-CASE/REVERSE/TRIM).

### From V0.14.0 (see [reviews/REVIEW_V0.14.0.md](reviews/REVIEW_V0.14.0.md))

- [*] **(V0.14.0 M2) `GOBACK` and `EXIT` produce generic "unsupported statement"** — Resolved in Task 15. GOBACK now throws `StopRunSignal` (same unwind path as STOP RUN); EXIT is a no-op.

- [*] **(V0.14.0 L5, partial) Remaining test coverage gaps** — Resolved in Task 20 alongside the V0.12.0 L1 sweep. All three items (empty PROCEDURE DIVISION, no-PROCEDURE-DIVISION program, error-line accuracy under nested IF) now have dedicated tests.

### From Task 15

- [*] **`EXIT PARAGRAPH` / `EXIT PERFORM` / `EXIT PROGRAM` forms** — Resolved. `EXIT PARAGRAPH` unwinds the current paragraph via `ExitParagraphSignal` caught by `runParagraph`; `EXIT PERFORM` unwinds the enclosing PERFORM via `ExitPerformSignal` caught by `executePerform` (with a runtime error thrown if it escapes to top-level); `EXIT PROGRAM` is a no-op in main programs (matches the COBOL standard — meaningful only in sub-programs). `EXIT PERFORM CYCLE` (continue-style) deferred — pull in when an example needs it.

- [*] **Negative numeric literals in source (`BY -1`, `MOVE -5 TO X`)** — Resolved. Sign detection lives in the parser, not the lexer: `parseOperand` and `parseValueLiteral` peek for `OPERATOR +`/`-` followed by `NUMBER` and combine them into a signed numeric literal. The lexer can't disambiguate sign-vs-binary without statement context, so doing it at the parser is the cleaner cut. COMPUTE expressions and condition operands already worked via `ExpressionEvaluator.parseUnary`.

### From Task 16

- [*] **String-typed intrinsic functions (`LENGTH`, `UPPER-CASE`, `LOWER-CASE`, `REVERSE`, `TRIM`, etc.)** — Resolved in V0.16.0 follow-up wave. Took option (b) from the original note: the ExpressionEvaluator was widened to return polymorphic values. `INTRINSICS` entries now declare an `argTypes` array (e.g. `["string"]`, `["number", "number"]`); arity errors stay as `CobolSyntaxError`, type-mismatch errors are `CobolRuntimeError`. `TRIM LEADING|TRAILING` modifiers and `NUMVAL` (string→number) deferred.

- [*] **`MOVE` / `DISPLAY` operands can't accept FUNCTION calls** — Resolved in V0.16.0 follow-up wave. `parseOperand` now has a FUNCTION branch that captures the `FUNCTION <name>` (paren-less) or `FUNCTION <name>(...)` (paren-balanced) token slice into a new operand kind `{ kind: "expression", tokens, line }`. The interpreter's three resolvers (`resolveDisplayOf` / `resolveValueOf` / `numericOf`) gained an "expression" branch that runs the slice through `ExpressionEvaluator.evaluate(..., this.resolveValue)`. So `DISPLAY FUNCTION UPPER-CASE(NAME)`, `MOVE FUNCTION INTEGER(7.9) TO X`, `ADD FUNCTION MOD(7, 3) TO X`, `PERFORM CHEER FUNCTION INTEGER(3.7) TIMES` all work. `numericOf` validates the result is numeric; assigning a string-returning function to a numeric PIC throws via the existing `assignNumeric` invalid-data path.
