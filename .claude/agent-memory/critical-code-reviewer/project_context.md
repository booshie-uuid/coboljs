---
name: coboljs project and user context
description: Core facts about the coboljs project, its conventions, and the review cadence
type: project
---

coboljs is a synthwave/cyberpunk COBOL-in-browser emulator. Knockout.js drives the UI; a custom ES6-module pipeline (Lexer → Parser → Interpreter) runs COBOL source. LocalFileSystem (provided lib) handles save/load.

Key conventions (from CLAUDE.md and STYLE.md):
- Named imports for classes are accepted; `import * as Namespace` is required for free-function modules (Keywords, Pic, Cobol, Arithmetic, Conditions, DataDivision)
- Parser sub-grammars go in `cobol/parser/*.js` as free functions taking the Parser instance
- All KO binding handlers live in `scripts/modules/bindings.js` (import-side-effect-free rule)
- Error classes live in `cobol/errors.js`; `cobol.js` re-exports them for external consumers
- `pureComputed` over flag-and-subscriber for derived state
- No `vm`/`VM` abbreviation for view-models — always `viewModel` or `AppViewModel`
- Test runner has only `toBe`, `toEqual`, `toThrow` — no `.toBeDefined`, no `.not.*`
- Multi-line COBOL fixtures go in `tests/data/*.cbl`, loaded via `loadFixture()`
- VERSION bumped in `scripts/app.js` after each task closes; currently V0_14_0 (Task 14 done)

**Why:** the review cadence is every ~3-4 tasks; previous audits (V0.8.0, V0.12.0) both found H-severity issues. The V0.12.0 audit produced a major parser decomposition (H1) and a tautological assertion fix (H2). Review scope is always the since-last-review delta plus all deliverable code.
