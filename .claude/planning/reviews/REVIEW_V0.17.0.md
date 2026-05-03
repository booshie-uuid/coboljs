# Code Review — V0.17.0 (final pre-release pass)
Date: 2026-05-03

Full-project critical pass at `VERSION = "V0_17_0"`. Scope: all deliverable code in `scripts/`, `tests/`, `index.html`, `styles.css`, `examples/*.cbl`. Out of scope: `libs/`. Context drawn from `.claude/CLAUDE.md`, `.claude/rules/STYLE.md`, `.claude/planning/DESIGN.md`, prior reviews (V0.8.0, V0.12.0, V0.14.0). All findings from prior reviews confirmed remediated; none re-raised here. Commits reviewed: `772efc6` (STOP RUN/GOBACK/EXIT) → `89a038a` (DUNGEON-DICE), plus uncommitted working-tree changes. Suite: 364 tests, 0 failures.

---

## High-impact

- [*] **(H1) `clearConsole` has no `isBusy()` guard — the console can be cleared mid-execution**
  `scripts/app-view-model.js:74`
  Every other action method (`toggleExamples`, `loadExample`, `newProgram`, `run`, `mount`, `loadProgram`, `saveProgram`) starts with `if(this.isBusy()) { return; }`. `clearConsole` is assigned as a plain arrow function with no guard at all. `console.clear()` removes all output lines and resets `pendingPartial` but does not touch `isPrompting` or `pendingResolve` — so if the user clicks `[ CLEAR ]` while the program is mid-`ACCEPT`, the preceding output disappears but the prompt remains active and the resolver is still live. That part is recoverable. The bigger problem: during a running program that hasn't yet reached `ACCEPT`, the user can clear output while `runStatus` is `"RUNNING"`, erasing the `> RUN` banner and any DISPLAY output already written. This is inconsistent with every other action's busy-gate discipline.
  **Suggested fix:** add `if(this.isBusy()) { return; }` as the first line of `clearConsole`, or convert it to a proper method so the guard is visible and can be extended like the others.

---

## Medium

- [*] **(M1) Dead-code closing-RPAREN guard in `parseFunctionCall` is unreachable**
  `scripts/modules/cobol/expression.js:243-249`
  The `while(this.peek()?.type !== "RPAREN")` loop at line 237 only exits when the peeked token is exactly RPAREN. Immediately after the loop, lines 243-248 re-check `if(!closing || closing.type !== "RPAREN")` — a condition that can never be true in normal parsing. The `!closing` branch requires `peek()` to return `undefined` (cursor past end of array), which cannot happen because `parseExpression()` inside the loop would have thrown first on a missing primary. The `closing.type !== "RPAREN"` branch is structurally impossible: we just left the loop because peek was RPAREN.
  The dead guard creates a misleading reading: a reader believes the function can detect an unclosed-paren error here, but it cannot. The real unclosed-paren error surfaces elsewhere via `"unexpected end of expression"`, not this message.
  **Suggested fix:** remove lines 243-249 entirely. If a guard against the `null` case is desired for safety, add a `peek()?.type === "EOF"` check inside the while loop: `if(!this.peek() || this.peek().type === "EOF") { throw new CobolSyntaxError(..., "unterminated FUNCTION arguments"); }`.

- [*] **(M2) `VERSION` comment in `app.js` contains two inaccuracies**
  `scripts/app.js:13-15`
  The three-line comment reads:
  ```
  // Format: V{plan}_{task}_{publish}.
  // {task} tracks progress against current plan and resets to 0 with each new plan.
  // {release} is reset to 0 when {task} changes.
  ```
  Line 14 says `{task} ... resets to 0 with each new plan` — this describes `{plan}`, not `{task}`. The field that resets to 0 with a new plan is `{plan}` (it's always been 0 because v1 hasn't shipped). Line 15 uses `{release}` but CLAUDE.md names the field `{publish}`. The inconsistency between the two names for the same field within the project's own documentation is confusing.
  **Suggested fix:** rewrite to match CLAUDE.md's precise language: `// {plan} stays 0 until the project ships its first complete product. {task} tracks the most recently completed task. {publish} resets to 0 on any change.`

- [*] **(M3) `parseFunctionCall` multi-arg loop relies on comma-as-whitespace without documenting the dependency**
  `scripts/modules/cobol/expression.js:237-241`
  `FUNCTION MOD(7, 3)` works because the Lexer treats `,` as whitespace (`lexer.js:48`) and drops it, turning the token stream into `FUNCTION MOD ( 7 3 )`. The while loop then calls `parseExpression()` twice, consuming `7` then `3`. This is correct, but the two concerns (lexer normalises commas; expression parser reads space-separated args) are silently coupled. The expression test at line 134 even documents `"commas optional"` but does not explain why. If the lexer's comma-handling is ever changed, or if someone writes a `parseFunctionCall` variant that doesn't share this assumption, the arg parsing silently breaks.
  **Suggested fix:** add an inline comment at the while loop: `// Commas are lexed as whitespace (lexer.js), so args arrive as adjacent token runs.`

---

## Low / cosmetic

- [*] **(L1) `Math.pow` in `data-item.js` was not migrated to `**` with the V0.12.0 expression.js fix**
  `scripts/modules/cobol/data-item.js:130-131`
  `expression.js` was migrated to `left ** right` in V0.12.0 (L4). `data-item.js:formatNumeric` still calls `Math.pow(10, total)` and `Math.pow(10, this.pic.decimalLength)`. Inconsistency between the two files on the same operation.
  **Suggested fix:** replace with `10 ** total` and `10 ** this.pic.decimalLength`.

- [*] **(L2) `clearConsole` is the only action not following the `bind` + method pattern**
  `scripts/app-view-model.js:74`
  Every other action is a class method bound in the constructor block. `clearConsole` is an arrow function assigned inline with no corresponding method body. Aside from the missing `isBusy` guard (H1), the inconsistency makes it harder to add logic to `clearConsole` later — it's not visible in the method list of the class.
  **Suggested fix:** extract to a method and bind it like the others:
  ```js
  this.clearConsole = this.clearConsole.bind(this);
  // ...
  clearConsole() { if(this.isBusy()) { return; } this.console.clear(); }
  ```

- [ ] **(L3) `loadAll` idempotency logic caches the Promise but not a resolved flag; a rejection can't be retried**
  `scripts/modules/examples.js:30-31`
  `loadAll` caches `loadPromise` so a second call returns the same promise. If the first call rejects (network error at boot), `loadPromise` is set to the rejected promise. Any subsequent call to `loadAll` returns the same rejected promise — there is no retry path. `app.js` catches and logs the error, continuing with empty examples. But if `loadAll` is ever called again (e.g. via a hypothetical "reload" button), it will silently return the old rejected promise rather than re-fetching.
  This is not a correctness bug at V0.17.0 since `loadAll` is only called once in `app.start()`. Flag for future robustness when more triggers for `loadAll` are added.
  **Suggested fix:** clear `loadPromise` on rejection so a retry path is possible: add `.catch(err => { loadPromise = null; throw err; })` inside `loadAll`.

- [ ] **(L4) `examples.test.js` MockConsole lacks the `isBusy` method the real `Console` exposes**
  `tests/examples.test.js:43`
  The test's `MockConsole` implements `isPrompting()` returning `false`. The real `Console` does not have an `isBusy` method (that lives on `AppViewModel`), so this is not a missing method — but `isPrompting()` is defined to always return `false` even though the mock's `prompt()` is async and in theory could be in-flight during test execution. This is fine for the current synchronous-style test harness, but it differs from `interpreter.test.js`'s `MockConsole` which does not implement `isPrompting` at all. Two different mock shapes in two test files for what is logically the same role will diverge further over time.
  **Suggested fix:** document (even with a single comment) which console contract the mock is satisfying, or consolidate the two `MockConsole` implementations into a shared helper in `tests/runner.js` or a shared `tests/mocks.js`.

- [*] **(L5) `conditions.js` header comment mentions `EVALUATE` as a future consumer but `EVALUATE` is explicitly out of scope in DESIGN.md**
  `scripts/modules/cobol/parser/conditions.js:5`
  The header comment reads `// Builds a condition tree for IF / EVALUATE / PERFORM-UNTIL.` DESIGN.md lists `EVALUATE` under "Out of scope (v0.1)". Forward-tense comments naming out-of-scope features were exactly the pattern M1/L1 of the V0.14.0 review cleaned up. `EVALUATE` may land post-v1, but listing it alongside `IF` and `PERFORM-UNTIL` (both implemented) implies it is already supported.
  **Suggested fix:** drop `EVALUATE` from the comment, or append a parenthetical: `// (EVALUATE is out of scope in v0.1)`.

- [*] **(L6) `STATEMENT_BOUNDARY_KEYWORDS` comment is slightly misleading about `STOP`**
  `scripts/modules/cobol/parser.js:35-36`
  The comment reads: `// Statement-internal keywords (WITH, NO, ADVANCING, TO, BY, FROM, GIVING, TIMES, UNTIL, VARYING, THEN, RUN, PARAGRAPH, PROGRAM, FUNCTION, AND, OR, NOT, RANDOM-named functions etc.) are deliberately excluded.` `RUN` is listed as a "statement-internal keyword" here. That is true of `STOP RUN` — `RUN` is internal to that statement. But `STOP` itself is in the boundary set while `RUN` is not. The comment doesn't explain this split, which will confuse a reader trying to understand why `STOP` is a boundary keyword but `RUN` is not. `STOP RUN` relies on `STOP` being the boundary trigger, with `RUN` parsed as the second token inside `parseStopRun`. This is correct and clever, but the comment should make it explicit.
  **Suggested fix:** amend the comment: `// RUN is deliberately excluded because STOP acts as the boundary; parseStopRun then consumes RUN as a fixed second token.`

---

## Things working well (preserve)

- **Signal-class architecture for control flow is clean and well-tested.** `StopRunSignal`, `ExitParagraphSignal`, `ExitPerformSignal` are all non-exported, single-responsibility exception classes. The test suite covers all EXIT forms including the boundary condition (EXIT PERFORM at top level → CobolRuntimeError). This is the right approach and the tests actually verify the semantics.

- **`examples.js` module is well-structured.** `MANIFEST` as the single source of truth, `seedForTesting` as an explicit test-only injection point, `loadAll`'s promise-caching for performance — all solid. The `byName` two-stage lookup (manifest first, then sources map) correctly handles the not-found vs not-yet-loaded cases distinctly.

- **`DUNGEON-DICE` is an effective showcase.** The example exercises group items, signed PICs, nested IF/ELSE without periods, PERFORM UNTIL with compound conditions, and all string/numeric intrinsics. The test coverage in `examples.test.js` is thorough: 9 tests covering happy path, escape success, escape failure, bad input, YES/NO variants, empty name. The `Math.random` stubbing pattern is consistent and correct.

- **`expression.js`'s `INTRINSICS` table is a clean, declarative design.** `argTypes` array + `call` function in one object keeps arity validation and dispatch co-located. The `requireNumber` helper extracted for the arithmetic operators is the right level of extraction. Type errors are `CobolRuntimeError` (runtime data problem), arity/unknown-function errors are `CobolSyntaxError` (program-time problem) — the distinction is correct.

- **No tautological assertions, no `vm`/`VM` naming, no import-side-effecting modules, no named imports from free-function modules.** All conventions from STYLE.md and CLAUDE.md are consistently followed across the new code landed since V0.14.0.

- **Parser decomposition has held.** `parser.js` is 659 LOC — within head-size. `conditions.js` (209 LOC) and `arithmetic.js` (204 LOC) followed the established sub-grammar pattern cleanly. The new STOP RUN / GOBACK / EXIT parsers were correctly added directly to `parser.js` (small, ~10 LOC each) rather than extracted unnecessarily.

- **`pureComputed` pattern is consistently applied** across `isDirty`, `status`, `isBusy`, `displayFileName`. No flag-and-subscriber anti-pattern introduced in the new examples-related state (`examplesOpen` is a plain observable because it has no derivation — correct).

---

## Decisions (to record during remediation)

- **H1 + L2 fixed together.** Single change in `app-view-model.js`: `clearConsole` is now a regular method with the same `if(this.isBusy()) { return; }` opener as every other action, and is `bind`-stamped in the constructor block alongside the others. Both the user-visible bug (clearing wipes a running program's output) and the structural inconsistency disappear in one edit.
- **M1 simplified rather than guarded.** The dead RPAREN check was removed entirely along with the inner empty-args check — the resulting while loop handles `FUNCTION RANDOM()`, single-arg, and multi-arg cases uniformly. Net deletion of ~10 lines for the same behaviour. The infinite-loop concern that could justify keeping the guard is impossible: `parseExpression` throws on EOF, so any malformed `FUNCTION FOO(...` fails inside the loop, not after it.
- **M2 + project-wide alignment.** The comment had two issues — line 14 described plan-level resets in task's voice, and line 15 used `{release}` while CLAUDE.md said `{publish}`. The user had already chosen `{release}` as the canonical name in app.js; CLAUDE.md was updated to match (`{plan}_{task}_{release}` everywhere) and the app.js comment rewritten to mirror CLAUDE.md's structure exactly.
- **M3 inline rather than top-of-function.** The comma-as-whitespace coupling note went directly above the `if(this.peek()?.type === "LPAREN")` block — it's the line a future author would be reading when the question "why does this only handle whitespace-separated args?" arises.
- **L1 trivial migration.** `Math.pow(10, n)` → `10 ** n` × 2 in `formatNumeric`. Same semantics, matches `expression.js`'s convention.
- **L5 dropped without replacement.** `EVALUATE` was a forward-tense reference that DESIGN.md explicitly excludes from v0.1. Removed rather than parenthesised — if EVALUATE ever lands, the comment can be re-extended at that time.
- **L6 amended in place.** Added a one-sentence note that STOP is the boundary, RUN is consumed by `parseStopRun` as a fixed second token. Keeps the relevant context next to the set definition rather than leaving the reader to grep.
- **L3 deferred.** No consumer hits the rejected-promise path (only one `loadAll` call site exists, and it's already wrapped in try/catch). Recorded as a forward-looking note for when a "reload examples" trigger or similar second consumer lands.
- **L4 deferred.** Test mock consolidation is moderate scope and the divergence is currently tolerable. Worth doing if a third test file ends up needing a console mock; not worth disturbing two working files for.
- **All 364 tests still pass after every step.**
