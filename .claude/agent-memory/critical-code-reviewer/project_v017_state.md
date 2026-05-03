---
name: coboljs V0.17.0 project state
description: Key architectural decisions and known gaps as of V0.17.0 (final pre-release pass, 2026-05-03)
type: project
---

As of V0.17.0 (2026-05-03), 364 tests passing.

**What landed since V0.14.0:**
- STOP RUN / GOBACK / EXIT with full signal-class unwind architecture (StopRunSignal, ExitParagraphSignal, ExitPerformSignal)
- Numeric intrinsics (RANDOM, INTEGER, MOD) and string intrinsics (LENGTH, UPPER-CASE, LOWER-CASE, REVERSE, TRIM) in ExpressionEvaluator
- Period-less statements inside IF bodies (STATEMENT_BOUNDARY_KEYWORDS mechanism)
- Examples module (examples.js) — 7 bundled .cbl files, fetch-on-boot, seedForTesting for unit tests
- DUNGEON-DICE as the largest demo example
- UI polish: EXAMPLES dropdown, [ CLEAR ] button, focus-within styling

**Known open gap (H1 from V0.17.0 review):**
`clearConsole` in AppViewModel has no `isBusy()` guard — user can clear console output mid-execution. Not critical but inconsistent with all other action methods.

**Dead code flagged (M1):**
`parseFunctionCall` in expression.js has an unreachable closing-RPAREN guard after the while loop (lines 243-248). The while loop only exits on RPAREN, so the guard can never fire.

**Why:** apply these as fixes before V1_0_0 ships.
**How to apply:** check these two issues first when opening the V1 polish pass.
