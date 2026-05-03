---
name: DataItem group-item errors — RESOLVED in V0.14.0
description: Was: assign() and getNumeric() on group items threw plain Error. Fixed in V0.14.0 — both now throw CobolRuntimeError(this.line, ...).
type: project
---

RESOLVED. Both `DataItem.assign()` and `DataItem.getNumeric()` now throw `CobolRuntimeError(this.line, ...)` when called on group items. Confirmed in V0.17.0 review — the code at data-item.js lines 63 and 112 is correct. An interpreter-level test (`MOVE to a group-item target throws CobolRuntimeError`) was added to lock the channel.

**Why:** was flagged as H2 in V0.14.0 review; plain Error surfaced as INTERNAL ERROR in the UI instead of `! RUNTIME ERROR LINE N:`.
