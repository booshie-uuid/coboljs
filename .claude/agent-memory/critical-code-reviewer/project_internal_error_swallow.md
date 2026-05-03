---
name: AppViewModel.run() silently swallows re-thrown internal errors
description: Cobol.run() re-throws internal JS errors for dev visibility, but AppViewModel.run() catch block catches and doesn't re-throw, defeating the intent
type: project
---

`cobol.js` `run()` function: on an unexpected JS error (not CobolSyntaxError/CobolRuntimeError), it writes `! INTERNAL ERROR: msg` to the console then re-throws the error. The comment says "Re-throw so the dev still sees the stack in browser devtools."

However, `app-view-model.js` `run()` method's catch block:
```js
catch(error)
{
    this.runStatus("ERROR");
}
```
...catches the re-thrown error and does NOT re-throw it. The stack trace is lost. The developer will not see it in devtools unless they happen to have a breakpoint. The stated design intent ("dev still sees the stack") is not achieved.

**Why this matters:** if a bug causes an internal JS error during program execution, the developer sees `! INTERNAL ERROR: [message]` in the UI console but has no stack trace to debug with.

**How to apply:** flag this in reviews as a correctness gap between stated intent and actual behavior. The fix is to add `throw error` at the end of the `AppViewModel.run()` catch block.
