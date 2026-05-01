# CLAUDE.md — Project Notes & Feedback

Cross-task learnings and explicit user preferences. Append; don't rewrite.

---

## Workflow

### Tick the final verify step before starting the next task

Each task in `.claude/planning/PLAN.md` ends with a "Verify in browser: ..."
step. The `execute-plan` skill leaves it for the user to confirm, but I
should tick it (`- [*]`) the moment the user signs off the task — *before*
opening the next task's first step. Otherwise the plan record falsely shows
prior tasks as incomplete.

User confirmation of the form "looks good", "proceed", "ship it", "looks
ok let's move on" all count as the sign-off — at that point go back and
tick the trailing verify step in place, then proceed.


## Conventions

### App singleton owns top-level orchestration

`scripts/app.js` defines a small `App` class, instantiates a single instance,
exposes it on `window.App`, and runs `app.start()` from the bootstrap. The
view-model and any future cross-cutting control logic (lifecycle, global
shortcuts, top-level coordination) live as fields/methods on that singleton.

```js
class App
{
    constructor() { this.viewModel = null; }
    start()       { this.viewModel = new AppViewModel(); ko.applyBindings(this.viewModel); }
}

const app = new App();
window.App = app;
```

**Why:** keeps `viewModel` reachable from devtools and from any control
logic that lands later, without scattering globals or introducing a
per-module side-channel. STYLE.md: state-driven entry points should be
classes; singleton-instance access via a PascalCase name (`App`).

### Bootstrap entry points use a DOM-ready guard

Even when an entry script is loaded as `type="module"` (and is therefore
implicitly deferred), wrap the bootstrap in an explicit DOM-ready check:

```js
function bootstrap()
{
    // ... build viewModel, applyBindings, etc.
}

if(document.readyState === "loading")
{
    document.addEventListener("DOMContentLoaded", bootstrap);
}
else
{
    bootstrap();
}
```

**Why:** the user prefers explicit safety here over relying on module-defer
semantics — reads more clearly, never breaks if the script tag placement
changes, and costs nothing. Apply to every top-level entry point this
project gains (e.g. if a worker or secondary page is added later).

### Naming — never use `vm` / `VM` for view-models

See [memory feedback file](../../../../.claude/projects/d--Workspace-Projects-coboljs/memory/feedback_naming_view_model.md).
Spell out `viewModel` (instances) and `AppViewModel` (class). The
abbreviation collides with "virtual machine" — actively confusing in an
emulator project.
