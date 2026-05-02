# Code Review — V0.12.0
Date: 2026-05-02

Findings from a critical pass over the Tasks 9–12 codebase: Parser, Interpreter, ExpressionEvaluator, Program/Paragraph, plus tests. Severity tags: H (high), M (medium), L (low). Tick items as they're addressed; record notes inline with each item.

---

## High-impact

- [*] **(H1) `parser.js` is 712 LOC and mixes five concerns** — Resolved. Extracted the four arithmetic parsers to `scripts/modules/cobol/parser/arithmetic.js` (205 LOC) and the DATA-DIVISION/WORKING-STORAGE/data-item parsers to `scripts/modules/cobol/parser/data-division.js` (158 LOC). `parser.js` is now 386 LOC (-46%) and contains: cursor + helpers, statement dispatch, IDENTIFICATION/PROCEDURE division entries, and the small statement parsers (DISPLAY, MOVE, ACCEPT, COMPUTE, STOP RUN). Extracted bits are free functions taking the Parser as their first argument and accessed via `import * as Arithmetic` / `import * as DataDivision` per STYLE.md namespace rule. No test changes needed — public Parser API is unchanged.

- [*] **(H2) `expect(item).toBe(item)` is a tautological no-op assertion** — Resolved. Replaced with `expect(item !== undefined).toBe(true)` at [parser.test.js:75](tests/cobol/parser.test.js#L75). Grepped the suite for the same `expect(X).toBe(X)` pattern across all test files — no other instances.

## Medium

- [ ] **(M1) Magic-string AST kinds and token types compound across the codebase**
      V0.8.0 M2 deferred this when it was three run-status values and a handful of token types; eight statement kinds, two operand kinds, two literal types, two divide directions, and a `giving` flag have piled on since. Renames now require coordinated edits across `parser.js` (produces them), `interpreter.js` (dispatches on them), `expression.js` (token-type checks), and the four test files. Greppable today; not scalable.
      **Fix when convenient:** introduce `STATEMENT_KIND`, `OPERAND_KIND`, `LITERAL_TYPE`, `TOKEN_TYPE`, `PIC_KIND` constant modules accessed via namespace per STYLE.md ("Common helper functions … exposed directly via the module"). The DIVIDE direction stays a string — only two values, only one consumer. The bigger value is the `OPERAND_KIND` and `TOKEN_TYPE` ones since they appear in 6+ files.

- [*] **(M2) Token-formatted error messages duplicated 9× and misformat EOF** — Resolved. Added `Parser.errorExpected(token, want)` which handles the `value: null` case (renders `got EOF` instead of `got EOF "null"`). The 8 inline sites in `parser.js` collapsed to single-line `errorExpected` calls; the existing `expect()` helper now delegates to the same path. The 1 site in `expression.js` is inlined with the same null-handling logic — it's the only error-formatting site in that file, so a helper would be over-abstraction.

- [*] **(M3) `executeCompute` allocates a new `ExpressionEvaluator` and resolver lambda per call** — Resolved. `ExpressionEvaluator` now takes the resolver per `evaluate(tokens, resolver)` call instead of via constructor; the cursor/resolver state is reset on each call. `Interpreter` constructs one shared evaluator (`this.evaluator`) and binds the resolver once (`this.resolveNumeric = (name, line) => this.lookupName(name, line).getNumeric()`). `executeCompute` shrinks to one line of dispatch; PERFORM-VARYING in Task 14 will reuse the same instance for free. Updated `expression.test.js`'s helper to match the new API; suite stays green.

- [*] **(M4) `lookupItem(operand)` called with a synthetic operand-shaped object** — Resolved. Split into `lookupName(name, line)` (does the actual lookup) and `lookupItem(operand)` (thin shim: `return this.lookupName(operand.name, operand.line)`). Pairs with M3 — the bound resolver in the Interpreter constructor now reads `(name, line) => this.lookupName(name, line).getNumeric()` with no synthetic operand.

- [*] **(M5) `numericOf` silently coerces non-numeric strings to 0** — Resolved (test-locking only; throw-vs-zero policy deferred). Added `Interpreter > ADD > alphanumeric source treated as 0` test fixing the current behaviour. The throw-policy decision deferred to when we have more examples to inform the call (likely Task 16). The behaviour is now intentional and tested rather than incidental.

## Low / cosmetic

- [*] **(L1) Test coverage gaps** — Partially resolved. Added five tests this pass: `Interpreter > SUBTRACT > in-place applies to multiple targets`, `Interpreter > MULTIPLY > in-place applies to multiple targets`, `Interpreter > DIVIDE > INTO in-place applies to multiple targets`, `Interpreter > ADD > alphanumeric source treated as 0` (the M5 lock), and `Parser > division skipping > non-WORKING-STORAGE sections inside DATA DIVISION are skipped`. Remaining gaps in the original list (ACCEPT into numeric with non-numeric input, COMPUTE assigning to alpha PIC, empty PROCEDURE, no-PROCEDURE program, group DISPLAY with mixed children, HELLO-NAME with empty input, dedicated Program/Paragraph tests) deferred to PLAN.md FOLLOW UP — none are blocking for Tasks 13+.
      - **`numericOf` alpha → 0 coercion** (M5).
      - **ACCEPT into a numeric PIC with non-numeric input** — `assignNumeric("hello")` falls back to 0; behaviour locked nowhere.
      - **COMPUTE assigning to alpha PIC** — happens via `DataItem.assign`; `String(numericResult)` then space-padded. Untested.
      - **Empty PROCEDURE DIVISION** — `PROCEDURE DIVISION.` alone. Should parse and execute as a no-op. Untested.
      - **Program with no PROCEDURE DIVISION at all** — currently the parser allows this (the entry block is `if(this.peekDivision() === "PROCEDURE")`). Untested.
      - **Group `DISPLAY` with mixed-kind children** — current group test has only alphanumeric children. A numeric-then-alpha mix would catch padding/formatting interactions.
      - **HELLO-NAME with empty input** — `assignAlpha("")` pads to 20 spaces. Reasonable behaviour to lock.
      - **`Program` / `Paragraph` direct tests** — both classes are 5-line POJOs but `addParagraph`/`currentParagraph` are only exercised indirectly.

- [ ] **(L2) `parseDataItem` pushes to parent stack and constructs the DataItem before the duplicate-name check**
      [`parser.js:172-181`](scripts/modules/cobol/parser.js#L172-L181). Order is: clear/pop stack → construct DataItem (which calls `parent.addChild(this)` in the DataItem constructor — see [data-item.js:33](scripts/modules/cobol/data-item.js#L33)) → push to stack → only THEN check for duplicate name → throw.
      Currently the throw kills parsing, so the half-pushed stack and the stray child never matter. Footgun if we ever add an error-recovery mode (e.g. "report all parse errors before bailing") — the parent's children array would have a phantom entry.
      **Fix:** move `if(program.dataItems.has(name)) { errorAt(...); }` to right after extracting the name (before the PIC/VALUE loop even, since neither depends on the name's uniqueness).
      **Resolved:** duplicate-name check now runs immediately after extracting the name, before any DataItem construction. Carried into the extracted [parser/data-division.js:62-67](scripts/modules/cobol/parser/data-division.js#L62-L67).

- [*] **(L3) `parsePicString` mixes `t.value` and hardcoded `"("` / `")"`** — Resolved. All four branches collapsed to a single `pic += parser.consume().value` loop in [parser/data-division.js:114-128](scripts/modules/cobol/parser/data-division.js#L114-L128). Function shrank from ~30 LOC to ~12 LOC. PIC_TOKEN_TYPES set hoisted as a function-scoped constant.

- [*] **(L4) `Math.pow(left, right)` in `expression.js`** — Resolved. Switched to `left ** right` at [expression.js:110](scripts/modules/cobol/expression.js#L110). Mirrors the lexed `**` token visually.

- [*] **(L5) `MockConsole` in `interpreter.test.js` lacks `writeWarning`** — Resolved. Added `writeWarning(text) { this.lines.push("[warn] " + text); }` to MockConsole at [interpreter.test.js:34-36](tests/cobol/interpreter.test.js#L34-L36). Symmetry restored.

- [ ] **(L6) `parseValueLiteral` has unreachable fall-off after `errorAt`**
      [`parser.js:218-228`](scripts/modules/cobol/parser.js#L218-L228). `errorAt` always throws, so the function never falls off the end. JS doesn't care, but the function's apparent contract is "returns a value or throws", and a reader has to verify `errorAt` throws to confirm. Same pattern in `parseStatement`'s default branch ([parser.js:268](scripts/modules/cobol/parser.js#L268)) and `parseOperand`'s tail ([parser.js:638](scripts/modules/cobol/parser.js#L638)). Either annotate `errorAt` with a JSDoc `@returns {never}` so static-analysis tools and readers know, or have callers explicitly `return` the error result for parallel structure: `return this.errorAt(...)` (errorAt returning a never-type lets that compile cleanly).
      **Deferred:** consistent across the parser; not worth churning to JSDoc-annotate `errorAt`. Re-evaluate if we introduce TypeScript or stricter linting.

---

## Things working well (preserve)

- **`ExpressionEvaluator` is genuinely clean.** Recursive-descent grammar, one production per method, comments map directly to the grammar in the file header. Reads top-to-bottom like the spec.
- **Per-statement AST shapes** (vs. a unified arithmetic node) keeps each `executeXxx` linear and obvious. The `giving: bool` discriminator inside each kind is the right level of polymorphism for now.
- **Two resolution helpers in the Interpreter** (`resolveDisplayOf` / `resolveValueOf` / `numericOf`) — naming makes the intended use unambiguous at the call-site. Worth keeping the three even though `resolveValueOf` is only called from `executeMove` currently.
- **Test fixtures in `tests/data/*.cbl`** stay paying off — three fixtures now (HELLO-WORLD, HELLO-NAME, ARITH-DEMO, COMPUTE-DEMO), each covers an end-to-end scenario clearly without the indent-fragile template-string smell.
- **Parent-stack algorithm in `parseDataItem`** is concise and reads naturally despite handling the level-77 special case. The "pop while top.level >= newLevel" idiom is the standard one.
- **PIC-string token stitching** keeps the Lexer pure (no PIC-clause mode) and reuses the proven `Pic.parsePic` from Task 8. Sound design choice.
- **`STOP RUN` interpretation as early-return** is the right Task-9-vintage call — STOP_RUN parsing landed alongside DISPLAY without prematurely introducing the exception machinery that Task 15 needs.
- **CLAUDE.md `/PLAN.md` Decisions blocks** continue to capture rationale. The Task-9-through-12 entries read like proper design archaeology — the "why this shape, not that" answers are findable without re-reading the diff.
- **192 passing tests, all green throughout.** Suite ran clean after every file touch. Test split (lexer/pic/data-item/expression/parser/interpreter) gives a useful failure-locality signal — if `expression.test.js` goes red, it's not the parser's fault.

---

## Decisions

Recorded during the remediation pass. Items not listed here either tracked back into the items above or were deferred to PLAN.md → Follow Up.

- **Triage rule applied**: H1, H2 done now (H1 was the largest single maintainability win and would only get worse with Tasks 13/14 landing); M2, M3, M4, M5 done (cheap, contained, address concrete read-clarity or allocation concerns); L2, L3, L4, L5 done (all touched files I was already editing for higher-priority items, so zero marginal cost). Brought forward V0.8.0 M5 (Console.prompt unreachable rejection) — trivial change while in the file. Deferred M1 (magic strings) once again — same trigger condition, still unmet; L6 (errorAt unreachable fall-off) — pattern is consistent and cosmetic; L1 partial — the high-value gaps (multi-target arith, alpha→0 lock, FILE SECTION skip) closed, the rest are speculative or low-risk.

- **Parser split: free functions over prototype mixin**: extracted arithmetic and data-division parsers as free functions taking the Parser instance as their first argument (`Arithmetic.parseAdd(parser)`), accessed via namespaced module imports per STYLE.md. Considered Object.assign-on-prototype to keep `this.parseX` call-sites identical, but the explicit `parser.peek()` / `parser.expect()` reads — although slightly noisier — make the dependency boundary visible. Each extracted file is now a standalone unit that could in principle be tested in isolation if we wanted. Trade-off accepted: ~5% wordier inside the extracted functions for clean module boundaries.

- **`errorExpected` extracted on Parser; inlined in expression.js**: the parser had 8 sites duplicating the `got X "Y"` formatting; extracting to a method removed the duplication and fixed the EOF-`null` rendering in one shot. The single site in expression.js was inlined with the same null-handling logic — not worth a helper for one call.

- **ExpressionEvaluator: per-call resolver, single shared instance**: switched `evaluator.evaluate(tokens)` (with constructor-bound resolver) to `evaluator.evaluate(tokens, resolver)`. Lets the Interpreter cache one evaluator instance and bind the resolver method once in its constructor. Concrete win arrives once PERFORM-VARYING (Task 14) loops over COMPUTE statements; the API change is forced cheaply now rather than later.

- **`numericOf` alpha→0 locked, throw-policy deferred**: added a test that pins the current behaviour. The bigger question — should arithmetic on an alphanumeric source error rather than coerce — is reopenable when more example COBOL programs land in Task 16 and the trade-off has real evidence behind it. Lock-then-decide beats decide-then-lock when the right answer is unclear.

- **Console.prompt() rejection turned into a throw**: V0.8.0 M5 said "either replace with a synchronous throw … or remove the gate." Picked throw — re-entry would be a real programming error (the caller is supposed to gate via `isBusy`), so a hard fail is the right signal. Added a comment explaining the contract.

- **Tests held green throughout**: each remediation step ended with `node tests/run.js` clean. 192 passing pre-pass → 197 post-pass (5 new tests added during M5/L1). Total project test count: 197.

- **Total parser LOC: 386 (was 712)**: arithmetic 205, data-division 158. Overall file count up by 2; head-size budget per file restored. Adding IF (Task 13) at ~150 LOC will land in `parser/conditions.js` or stay as small statement parsers in `parser.js`, depending on shape — split rule will be easier to apply now that the precedent exists.
