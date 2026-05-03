---
name: Stale task-reference comments are a recurring pattern
description: Comments that say "as of Task N" or "Task N's job" go stale as tasks complete and should be flagged in each review
type: feedback
---

The codebase uses "Task N" references heavily in comments to explain deferred behavior or future plans. As tasks complete, these comments become stale:

- `program.js`: "populated from Task 10" / "named-paragraph parsing arrives in Task 14" — both tasks have now landed (V0.14.0)
- `parser.js`: "Supported surface as of Task 13" — omits PERFORM which landed in Task 14
- `interpreter.js`: "Task 15) unwind via StopRunSignal" — Task 15 is still open, this one is still accurate
- `expression.js`: "important once PERFORM-VARYING (Task 14)" — Task 14 has landed; this is now a fait accompli, not a future concern

**Why:** comments explaining why something exists ("this is done for Task X") are worthwhile as planning notes during development but should be cleaned up once the tasks land.

**How to apply:** in each review, check for task-reference comments against PLAN.md to identify which tasks have completed. Flag stale forward-references.
