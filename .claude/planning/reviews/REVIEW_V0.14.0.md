# Code Review — V0.14.0 (full project pass)
Date: 2026-05-03

Findings from a full-project critical pass at `VERSION = "V0_14_0"` (Task 14 / PERFORM landed; Tasks 15–16 still open). Scope: all deliverable code in `scripts/`, `tests/`, `index.html`, `styles/`. Out of scope: `libs/`. Context drawn from `.claude/CLAUDE.md`, `.claude/rules/STYLE.md`, `.claude/planning/DESIGN.md`, `.claude/planning/PLAN.md`, prior reviews. Severity tags: H (high), M (medium), L (low). Tick items as they're addressed; record notes inline with each item.

---

## High-impact

- [*] **(H1) `AppViewModel.run()` swallows the re-thrown internal error, defeating the documented design intent** — Resolved. Added `console.error(error)` in the catch block before `runStatus("ERROR")` — surfaces the stack to devtools without propagating the rejection. Chose this over `throw error;` to avoid an unhandled-rejection warning when an internal error fires.

- [*] **(H2) `DataItem.assign()` and `DataItem.getNumeric()` on group items throw plain `Error`, not `CobolRuntimeError`** — Resolved. Both sites now throw `CobolRuntimeError(this.line, ...)` so a `MOVE` / `ACCEPT` / arithmetic into a group-item target surfaces through the user-facing `! RUNTIME ERROR LINE N:` channel rather than leaking to the INTERNAL ERROR path. Existing data-item tests continued to pass (they used `.toThrow(messagePattern)` which doesn't check the error class). Added a new interpreter-level test (`Interpreter > MOVE > MOVE to a group-item target throws CobolRuntimeError`) to lock the correct error channel end-to-end.

## Medium

- [*] **(M1) Stale task-reference comments in module headers** — Resolved. Single sweep across `parser.js`, `program.js`, `expression.js`, `interpreter.js`, and `app-view-model.js` rewriting forward-tense / task-tagged commentary to factual present-tense. PERFORM added to parser.js's supported-surface list. Rolled L1, L2, L3 into the same pass.

- [ ] **(M2) `GOBACK` and `EXIT` are reserved keywords but produce a generic "unsupported statement" error** — Deferred. This is literally the next task (Task 15: STOP RUN / GOBACK / EXIT). Adding an interim "not yet implemented" message would be scaffolding ripped out within the next session. Logged in PLAN.md FOLLOW UP for visibility.

- [*] **(M3) `parseAdd` captures `next = parser.peek()` far from its only use** — Resolved. Dropped the variable; `errorExpected(parser.peek(), ...)` inline at the error branch.

- [*] **(M4) `saveProgram` accepts whitespace-only filenames** — Resolved. `name = (await this.console.prompt()).trim();` so the empty-check rejects whitespace too. One-line change.

## Low / cosmetic

- [*] **(L1) Stale forward-tense comments outside the M1 module headers** — Resolved as part of the M1 sweep.

- [*] **(L2) `INITIAL_SOURCE` placeholder + comment drift in `app-view-model.js`** — Resolved. Comment loosened to "Updated each task to demo the latest feature; will be replaced by an Examples lookup in Task 16." Now describes the actual workflow rather than naming a specific source.

- [*] **(L3) `parseIf` "Task 13 v0.1" framing reads as provisional** — Resolved. Dropped the version tag; comment now states the period-required rule and references the PLAN.md Follow Up entry by name ("Period-less statements inside IF bodies").

- [*] **(L4) EXAMPLES button in `index.html` is unwired with no `disabled` attribute** — Resolved. Added `disabled` to the button. Renders greyed-out per the existing `.btn:disabled` styling so the unwired intent is visually obvious.

- [*] **(L5, partial) Test coverage gaps** — Two added this pass:
      - **MOVE to a group-item target throws CobolRuntimeError** — locks the correct error channel for H2; new test under `Interpreter > MOVE`.
      - **PERFORM-VARYING with identifier FROM and BY operands** — exercises the identifier branch in `numericOf` for VARYING; new test under `Interpreter > PERFORM`.

      Remaining gaps deferred to PLAN.md FOLLOW UP — empty PROCEDURE DIVISION, program with no PROCEDURE, error-line accuracy under nested IF. None blocking.

---

## Things working well (preserve)

- **Parser decomposition from V0.12.0 has held.** `parser.js` is ~525 LOC after Task 14's PERFORM addition — near the head-size threshold but manageable. `arithmetic.js`, `data-division.js`, `conditions.js` (Task 13) all follow the established sub-grammar pattern. If IF-ELSE-IF chains or EVALUATE land in future tasks, a `control-flow.js` extraction would be the natural next move.
- **`StopRunSignal` is correctly scoped** as a non-exported class in `interpreter.js`; propagation through PERFORMed paragraphs and IF bodies works correctly and is locked by tests.
- **`pureComputed` derived-state pattern is consistently applied** across `isDirty`, `status`, `isBusy`, `displayFileName` in `AppViewModel` — exactly what CLAUDE.md requires.
- **No tautological assertions found.** The V0.12.0 H2 instance has been fully resolved and the replacement `expect(item !== undefined).toBe(true)` pattern is correctly used across the suite.
- **No `vm`/`VM` naming violations, no import-side-effecting modules, no parser sub-grammar in the wrong file.**
- **Error/runtime classification is mostly clean** — the H2 finding is the one notable exception.
- **`FileIOError` correctly lives with `FileIO` in `file-io.js`** rather than in the COBOL `errors.js`. Right call — it's an app-layer error, not an interpreter one.

---

## Summary

Project is in solid shape for its stage. Two genuine correctness bugs (H1: silent error swallow defeats devtools-visibility intent; H2: group-item errors surface as INTERNAL ERROR) are both small fixes. The stale-comment problem (M1 + L1) is cosmetic but pervasive enough to merit a single sweep alongside the next task close-out. 248 tests passing; coverage is strong on happy paths, with the standing L5 gaps mostly defensive. Architecture, naming, and style discipline are all holding up well across the 14 tasks landed so far.

---

## Decisions

Recorded during the remediation pass.

- **All H and M items addressed except M2 (deferred to its native task)**. M2 is GOBACK/EXIT — literally Task 15. Adding interim "not yet implemented" error scaffolding would be ripped out within the next session. Logged in PLAN.md FOLLOW UP for visibility.
- **All L items addressed** except L5's defensive coverage gaps (logged for follow-up). L1, L2, L3 rolled into the M1 sweep — single coordinated comment cleanup rather than fragmented edits.
- **H1 fix: `console.error(error)` over `throw error;`**. Both achieve the goal of surfacing the stack to devtools, but the throw form produces an unhandled-rejection warning that some host environments treat as a hard failure. `console.error` logs cleanly without other side effects.
- **H2 fix touched 2 sites in `data-item.js`** (assign-to-group, getNumeric-from-group). Both now throw `CobolRuntimeError(this.line, ...)`. The `addChild` branch already used `CobolSyntaxError` (V0.8.0 decision: source-file-malformed → syntax error; runtime-data-invalid → runtime error). H2's two sites are runtime concerns (a program tries to use a group item as a leaf), so `CobolRuntimeError` is the right class.
- **Existing data-item tests continued to pass after the H2 swap** because they used `.toThrow(messagePattern)` (substring match on message), not error-class assertions. Added a fresh interpreter-level test that does check the class to lock the correct channel end-to-end.
- **M3 turned out to also explain a small structural improvement** — `errorExpected` taking `parser.peek()` directly reads more cohesively than capturing-then-using-via-variable, since the variable's lifespan was hard to track across the if/else branches.
- **Stats card redesigned at 524 wide native** during this pass — out of scope for the project review, but worth noting since the visual was renamed from a stretched 1080-wide downsample to a natively-rendered 524×932. Behaviour identical; visual fidelity at LinkedIn's display size markedly better.
- **Test count: 248 → 250 passing** (group-item MOVE + PERFORM-VARYING identifier FROM/BY).
