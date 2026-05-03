---
name: Inline COBOL source in interpreter tests is accepted, not a violation
description: CLAUDE.md says multi-line COBOL fixtures go in tests/data/. Interpreter.test.js has 65 inline programs. This is not a violation because the inline ones are short, not indent-sensitive multi-line fixtures.
type: feedback
---

CLAUDE.md says "Multi-line COBOL fixtures... live as .cbl files under tests/data/. Load them via loadFixture()". The interpreter.test.js file has ~65 inline COBOL programs as template literals.

These inline programs are:
1. Short (typically 8-12 lines)
2. Indented consistently (leading spaces for COBOL column alignment)
3. Re-formatted to work at any indentation level (they're indented with spaces relative to their template literal position, which the Lexer handles fine since it doesn't enforce column rules)

The `tests/data/` convention was established to avoid indent-sensitive multi-line programs breaking when reformatted. The inline tests in interpreter.test.js are short and the leading-space indentation is consistent throughout the file. The six `.cbl` fixture files are used for the full integration tests (HELLO-WORLD, HELLO-NAME, ARITH-DEMO, COMPUTE-DEMO, IF-DEMO, PERFORM-DEMO).

**How to apply:** don't flag interpreter.test.js inline COBOL programs as CLAUDE.md violations. Do flag any new fixture that is meaningfully complex or that would be brittle to indent changes.
