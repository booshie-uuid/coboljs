# CLAUDE.md — Project Notes & Feedback

Cross-task learnings and explicit user preferences. Refine, reorganise, or
delete entries as needed — the goal is keeping this useful, not preserving
every word.

---

## Workflow

### No manual line breaks in markdown files

Markdown is rendered — wrapping is the renderer's job. Don't insert
hard line breaks at ~80 columns inside paragraphs. Let prose flow as
one logical line per paragraph; separate paragraphs with blank lines.
Code blocks and tables are exempt.

### Bump `VERSION` in scripts/app.js after each task lands

Format: `V{plan}_{task}_{publish}`. `plan` stays `0` until the project ships its first complete product. `task` tracks the most recently completed task in `PLAN.md` (currently we're at `V0_8_0`). `publish` resets to `0` on any change.

The constant lives at the top of `scripts/app.js` and propagates from there: `App` reads `VERSION` into `this.version`, passes it to `AppViewModel`, which uses it for both the header tag (`data-bind="text: '// ' + version"`) and the boot banner (`> COBOL.JS ${this.version} ...`). One source of truth — never duplicate the literal.

Bump the constant as part of closing out each task, after the verify step is ticked.

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

### COBOL source snippets in tests live in tests/data/

Multi-line COBOL fixtures (`HELLO-WORLD`, `FIZZBUZZ`, etc.) live as `.cbl`
files under `tests/data/`. Load them via the `loadFixture(name)` helper
exported from `tests/runner.js`:

```js
import { loadFixture } from "../runner.js";

const source = loadFixture("hello-world.cbl");
```

**Why:** indent-sensitive template literals look like a formatting bug and
are easy to break with a careless re-format. Files are immune to that.



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

### KO custom binding handlers live in `bindings.js`

All `ko.bindingHandlers.*` registrations live in
`scripts/modules/bindings.js`. The companion module (e.g. `editor.js`)
leaves a one-line comment pointing at it but does no `ko.*` mutation
itself.

**Why:** ko-mutating modules are import-side-effecting — they crash on
import in any environment without a `ko` global (Node tests, future
worker contexts). Centralising registration keeps the modules
import-pure and the binding handlers discoverable in one place.

### Shared error classes live in their own module

Project errors (`CobolSyntaxError`, `CobolRuntimeError`, etc.) live in
`scripts/modules/cobol/errors.js`. The public façade (`cobol.js`)
re-exports them so external consumers don't need to know the submodule
layout, but submodules import from `errors.js` directly.

**Why:** putting errors in the façade creates import cycles
(`cobol.js` → `cobol/lexer.js` → `cobol.js` for the error class).
ES6 module loaders handle cycles, but each new submodule deepens the
graph and value initialisation order becomes fragile.

### Prefer derived state over flag-and-subscriber

When a piece of state can be derived from existing observables, write a
`ko.pureComputed` over those observables instead of an `observable` +
manual subscriber that mutates it.

```js
// avoid
this.isDirty = ko.observable(false);
this.editor.text.subscribe(() => this.isDirty(true));
async saveProgram() { ...; this.isDirty(false); }

// prefer
this.lastSavedText = ko.observable(null);
this.isDirty = ko.pureComputed(() => this.editor.text() !== this.lastSavedText());
async saveProgram() { ...; this.lastSavedText(currentText); }
```

**Why:** the flag form depends on synchronous subscriber order and
imperative state-flipping in every handler that affects it. The derived
form is data-driven, can't be desynchronised, and surfaces bonus
correctness (in this case: reverting edits to the saved baseline
correctly flips status back to SAVED).

### App-specific text out of generic UI widgets

Generic widgets (`Console`, `Editor`, future panels) carry no
app-specific strings — banner text, version numbers, branding all live
on the view-model or app and get passed in / written through public
methods. The widget is reusable; the app owns its own voice.

**Why:** decouples reusable bits from project messaging. Also avoids
stale-text bugs (the boot banner's `V0.1` lived in `Console` and didn't
update when the header bumped to `0.6.0`).
