# Code Review — V0.8.0
Date: 2026-05-02

Findings from a critical pass over the Tasks 1-8 codebase. Severity tags:
H (high), M (medium), L (low). Tick items as they're addressed; record
notes inline with each item.

---

## High-impact

- [*] **(H1) Cyclic imports between `cobol.js` and `cobol/*.js`** — Resolved. `scripts/modules/cobol/errors.js` now owns `CobolSyntaxError` / `CobolRuntimeError`; `lexer.js` and `data-item.js` import from there. `cobol.js` re-exports the errors as part of its public façade for any consumer that doesn't want to know about the submodule layout.
      `cobol.js` defines `CobolSyntaxError` + imports `Lexer` from
      `cobol/lexer.js`. `lexer.js` and `data-item.js` both import
      `CobolSyntaxError` back from `cobol.js`. Each new submodule
      (parser, interpreter, expression) will deepen the cycle.
      **Fix:** extract errors to `scripts/modules/cobol/errors.js`.
      `cobol.js` becomes a thin façade re-exporting them; submodules
      import from `errors.js` directly.

- [*] **(H2) UI modules register Knockout bindings at module load — un-testable in Node** — Resolved. Both binding handlers (`editorWiring`, `autoScrollBottom`) now live in `scripts/modules/bindings.js`, which is imported once from `app.js`. `editor.js` and `console.js` are now import-side-effect-free (they leave a one-line companion comment pointing at bindings.js). They could now be imported in Node tests without a `ko` stub if we ever want to.
      `editor.js:54` and `console.js:111` mutate `ko.bindingHandlers` at
      module top level. Importing either in Node throws because `ko` is
      undefined. As tests scope grows we may want to test more than the
      pure-logic modules.
      **Fix:** move binding registrations into `scripts/modules/bindings.js`
      imported only by `app.js`. Editor.js / console.js become side-effect-
      free imports.

- [*] **(H3) `DataItem.parsePic` is 95 lines and tightly coupled to an instance** — Resolved. Extracted to `scripts/modules/cobol/pic.js` as `parsePic(picString, line)`. DataItem dropped from 250 → 156 LOC. Tests split: 19 PIC tests now in `tests/cobol/pic.test.js` (including a line-context test); DataItem tests focus on assignment/display/group nesting. Total tests now 77.
      `data-item.js:152-245`. Only reason it lives on `DataItem` is to
      access `this.line` for error reporting.
      **Fix:** extract to `scripts/modules/cobol/pic.js` as
      `parsePic(picString, line)`. Shrinks DataItem from ~250 → ~155 LOC.
      About half of `data-item.test.js` is really PIC tests — they
      migrate to a new `pic.test.js` alongside the new module.

## Medium

- [ ] **(M1) `AppViewModel` is starting to do a lot — flag for split**
      Currently ~187 LOC. If Tasks 16+ add example loading, status timing,
      and run history, this hits ~300 LOC and stops fitting in the head.
      **Fix when ~250 LOC:** lift workflow state (`currentFileName`,
      `runStatus`, `isDirty`, `status`, `isBusy`, the `editor.text`
      subscription) into a `WorkflowState` class. View-model becomes thin
      coordinator.

- [ ] **(M2) Magic-string state values scattered**
      `"READY"` / `"RUNNING"` / `"ERROR"`, token types
      (`"KEYWORD"`, `"IDENTIFIER"`, ...), PIC kinds (`"alphanumeric"`,
      `"numeric"`, `"alphabetic"`) — string literals across JS, CSS, and
      docs. Renames will require multi-format greps.
      **Fix:** introduce `RUN_STATUS`, `TOKEN_TYPE`, `PIC_KIND` constant
      modules. Invariant data per STYLE.md, accessed via namespace.

- [*] **(M3) `loadProgram` relies on synchronous KO subscription order** — Resolved. Replaced the implicit "set, fire subscriber, then override" pattern with a derived computed: `isDirty = pureComputed(() => editor.text() !== lastSavedText())`. `lastSavedText` is updated by `loadProgram` (to the loaded source), `saveProgram` (to the just-saved source), and `newProgram` (to `null`, so any non-null text counts as dirty). No more order-dependent flag flips. Bonus: reverting edits to the saved baseline now correctly flips status back to SAVED.
      `app-view-model.js:135-137`. Works because Knockout fires
      subscriptions synchronously during `text(...)`. Brittle if KO ever
      changes or we adopt rate-limited observables.
      **Fix:** make the dirty flip unambiguous. Either pass a
      "don't mark dirty" flag to `editor.setText`, or set `isDirty(false)`
      after a microtask.

- [*] **(M4) Stale boot banner + hard-coded app messaging in `Console`** — Resolved. Banner write moved to `AppViewModel` constructor. Console is now a generic terminal widget with no app-specific text. Version number dropped from the banner — the header shows it and was the source of the stale-text bug.
      `console.js:18-19` writes `V0.1` while `index.html` shows `VER 0.6.0`.
      Console also knows the app's name, which it conceptually shouldn't.
      **Fix:** move banner write to `App.start()` / view-model. Console
      becomes a generic terminal widget with no app-specific text.

- [ ] **(M5) `Console.prompt()` rejection is unreachable**
      The only caller is gated by `isBusy`, which already includes
      `isPrompting`. The `Promise.reject(...)` branch is dead defensive
      code.
      **Fix:** pick a discipline. Either replace with a synchronous throw
      (matches reality), or remove the gate and rely on caller `isBusy`
      checks.

## Low / cosmetic

- [ ] **(L1) `runner.js` `toEqual` uses `JSON.stringify` equality**
      Sloppy deep-equal. Functions, undefined, dates, regex, circular
      refs all break. Fine until it isn't. Replace with a small
      structural compare when the first non-plain-data assertion bites.

- [ ] **(L2) `CobolRuntimeError` is dead until Task 11**
      Defined and exported but never thrown yet. Accepted; just flagged
      for the audit record.

- [ ] **(L3) Sub-section banners not exactly 80 cols when indented inside a class**
      STYLE.md says exactly 80. Class-method banners (e.g.
      `data-item.js:56`) sit at 4-space indent, so the visible padding
      falls short of col 80.
      **Fix:** clarify whether the column count is from col 0 or from
      content start, then adjust banners to match. Or update STYLE.md.

- [*] **(L4) `line: 0` default in `DataItem`** — Resolved. Default is now `line: null`. `parsePic` accepts `line = null` too. Errors created with `line === null` will surface as `LINE null:` in `cobol.js`'s formatter, which is unambiguous (a real line number can never be null).
      `data-item.js:10`. `0` is a magic sentinel for "no line known".
      `null` is more honest and avoids "line 0" appearing in error
      messages.

- [ ] **(L5) Redundant work in `newProgram`**
      `app-view-model.js:77-80`. `setText("")` already triggers the
      subscriber that sets `isDirty(true)` and clears `ERROR`. Then we
      explicitly call `isDirty(true)` and `runStatus("READY")` again.
      Either trust the subscription or document the belt-and-braces with
      a comment.

## Naming

- [*] **(N1) Single-letter locals `s` and `k` in `parsePic`** — Resolved. `s` → `chars`. Outer `kind` → `picKind` (the function's accumulating result); inner `k` becomes `kind` (the kind of the current char). Reads naturally now: `if(picKind && picKind !== kind)`.
      `s` is the uppercased PIC string — used 5+ times for indexing
      (`s[i]`, `s.indexOf(...)`, `s.substring(...)`). Not dense math;
      the `gap`/`startX` STYLE.md exemption doesn't apply. Rename to
      `chars`.
      `k` is a code smell: it only exists to dodge a name collision
      with the outer `kind` variable. Two different concepts wear the
      same name (decided-kind across the whole PIC vs. kind for the
      current char). Rename outer `kind` → `picKind`; inner becomes
      `kind`. Reads: `if(picKind && picKind !== kind) { throw ... }`.
      Falls naturally under the same change as H3 (parsePic extraction).

---

## Things working well (preserve)

- Allman braces, no-space-before-paren, naming consistency.
- `viewModel` never abbreviated to `vm`.
- Section/sub-section banners aid navigation despite L3.
- Whitespace paragraphs read like prose.
- Comments mostly explain *why* — minimal cruft.
- Error context (line numbers) threaded cleanly to user-facing messages.
- `PLAN.md` Decisions blocks are a useful design archaeology record.
- Test coverage on lexer + DataItem is thorough (76 cases).

---

## Decisions

Recorded during the remediation pass. Items not listed here either tracked back into the items above or were deferred to PLAN.md → Follow Up.

- **Triage rule applied**: H1, H2, H3 done now (small surgical changes that prevent compounding fragility as Tasks 9–15 land); M3, M4, L4, N1 done now (cheap, contained, address real read-clarity issues); M1, M2, M5, L1, L2, L3, L5 deferred to PLAN.md → Follow Up under named trigger conditions. Wanted to avoid widening the diff for items that are cosmetic now and may not even survive the next few tasks.

- **Errors in their own module, not the façade**: created `cobol/errors.js` and made `cobol.js` re-export. Submodules import from `errors.js` directly. Cycle resolved without forcing every consumer outside `cobol/` to know the submodule layout.

- **Bindings consolidated, not stubbed**: chose to extract `bindings.js` rather than wrap registrations in `if(typeof ko !== "undefined")`. Centralisation is easier to maintain and means each binding handler is discoverable from one file. Tradeoff: app.js now imports bindings.js solely for its side effect — flagged this in the new STYLE.md "module side effects" section as the legitimate pattern (bootstrap modules carry the side effects deliberately).

- **`isDirty` from data, not flags**: the M3 fix turned out to be a clean win. The original implementation had `isDirty(true)` written by a subscriber and `isDirty(false)` written by save/load handlers — order-dependent. The replacement (`isDirty = pureComputed(() => editor.text() !== lastSavedText())`) is purely derived and incidentally fixes a real edge case I hadn't even considered: reverting edits to the saved baseline now correctly flips status back to SAVED. Recorded as a CLAUDE.md convention.

- **Boot banner moved out of `Console`** (M4) — the version number was dropped from the banner entirely rather than centralising it as a `VERSION` constant. Header already shows the version; duplicating it just creates two places to keep in sync, as the stale `V0.1` proved. If we ever want it back, define a constant once and use it in both spots.

- **`addChild` keeps `CobolSyntaxError`, `assign`/`getNumeric` invariant violations stay plain `Error`**: the distinction is "could a malformed source file trigger this?" If yes (level numbers nesting under elementary), it's a `CobolSyntaxError` and gets routed to the user's console. If no (programmer bug calling `assign` on a group), it's a plain `Error` — should never happen in normal use.

- **Renamed `s` and `kind` rather than living with the shadow**: H3 + N1 fell together because extracting `parsePic` to a free function let me rename without touching DataItem. Outer became `picKind`, inner reclaimed `kind`. Promoted to a STYLE.md rule.

- **`line: null` over `line: 0`**: L4. Errors thrown without a known line now carry `error.line === null`; cobol.js's formatter will need to handle `LINE null:` later, but that's a small follow-up tied to wherever the parser ends up using these.

- **STYLE.md additions accepted**: three new rules added (single-letter shadow-dodge smell, `null` over magic defaults, modules should be import-side-effect-free). Each codifies a lesson from this remediation pass.

- **CLAUDE.md additions**: four KO/project-specific patterns recorded (bindings central, errors in own module, derived state over flag+subscriber, app text out of generic widgets). Plus the "no manual MD line breaks" rule from the user.

- **Tests held at 77 passing throughout**: each remediation step ended with `node tests/run.js` green. PIC tests grew from being a sub-suite inside `data-item.test.js` (18 tests) to a dedicated `pic.test.js` (19 tests, including a line-context check). DataItem tests focused down to assignment / display / nesting concerns.

- **Total project LOC: 2534** (excluding `.claude/` and `libs/`). Up from ~1148 at end of Task 6 — most of the growth is the test harness and the new tests, which is healthy.
