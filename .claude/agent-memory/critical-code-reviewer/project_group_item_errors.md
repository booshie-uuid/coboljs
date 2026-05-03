---
name: DataItem group-item errors use plain Error not CobolRuntimeError
description: assign() and getNumeric() on group items throw plain Error, which surfaces as INTERNAL ERROR in the UI instead of a clean runtime error message
type: project
---

`data-item.js` `DataItem.assign()` (line ~62) and `DataItem.getNumeric()` (line ~110) throw `new Error(...)` (not `CobolRuntimeError`) when called on group items. When these errors propagate through `cobol.js`, they hit the generic handler:
```js
consoleHandle.writeError(`! INTERNAL ERROR: ${error.message}`);
throw error;  // re-thrown to devtools
```
...instead of the clean `! RUNTIME ERROR LINE N: msg` path.

This is a known inconsistency as of the V0.14.0 review (2026-05-03). Not yet fixed. The correct fix is to use `CobolRuntimeError(this.line, ...)` in both places.

**How to apply:** flag in future reviews if the group-item error type is changed or if similar plain-Error throws appear in DataItem. Also watch for tests that assume INTERNAL ERROR output when they should get RUNTIME ERROR.
