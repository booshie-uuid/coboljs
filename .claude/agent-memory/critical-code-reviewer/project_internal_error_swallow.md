---
name: AppViewModel.run() internal error visibility — RESOLVED in V0.14.0
description: Was: AppViewModel.run() catch() didn't surface the stack to devtools. Fixed — now calls console.error(error) before setting runStatus.
type: project
---

RESOLVED. `app-view-model.js` `run()` catch block now calls `console.error(error)` before `this.runStatus("ERROR")`. This surfaces the stack to devtools without propagating the rejection. Confirmed in V0.17.0 review at app-view-model.js lines 138-141.

**Why:** was flagged as H1 in V0.14.0 review; the re-throw from cobol.js was being silently caught with no stack logged.
