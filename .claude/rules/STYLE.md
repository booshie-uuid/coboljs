# Coding Style Guide

Conventions for `.js` and compatible language files in this repository.

## File Structure

Large overloaded files should be avoided in favor of structured files that each relate to a specific set of responsibilities and expose a minimal, focused public surface.

While the decision to add a new file should be done thoughtfully, the cost of mixing concerns in one giant file is code that is hard to read, hard to maintain, and is riddled with technical debt.

### Decomposition

Create a new file when any of the following is true:

- **The code could plausibly be reused.** Even before a second consumer exists, code with the potential to be reused should go in its own file. Extract a reusable widget or capability the moment the design suggests a second consumer might exist. Pulling apart the code later when it already has multiple consumers will be far more expensive then the overhead of an additional file.

- **The code owns state that no one else should touch.** Privacy boundaries are important to prevent unexpected side effects as complexity and scope grows. State that holds invariants — caches, lookup tables, singleton settings — or that is sensitive to change should be properly encapsulated. All access then has to flow through a deliberate public API that enforces the contract you actually want to govern how the data is used.

- **Abstraction would minimise the impact of change.** If you can encapsulate a capability in a way that consumers of that capability can be isolated from changes in the underlying data, events, or API calls the capability is dependent on, your code will be significantly easier to maintain and you will be able to respond to changes faster.

- **The file has grown too large to hold in your head.** If you can't keep a working model of a file in your head, the file is almost certainly doing too much. You don't need to be able to internalise what every line of code does or know exactly where it is within a file, but you should be able to develop a strong intuition based on a single read through of a file. A multi-thousand-line file with UI construction, refresh orchestration, event dispatch, and who knows whatelse is resistant to refactoring and hard to maintain because no one can hold all of it in mind at once.

DO NOT create a new file if:

- It would have a significant performance impact.
- It doesn't make sense in the context of the work that is being done or the language being used (e.g. having a seperate CSS file for each visual element does not make sense unless you are using a framework that 'compiles' the CSS).

### Modules vs Classes (Javascript)

ES6 modules should be used to help manage dependencies, however ES6 classes must be used (within modules) to encapsulate any complex, state-driven logic.

```js
class Player
{
  constructor(playerId)
  {
    this.playerX = spawnX;
    this.playerY = spawnY;

    // …

  }

  movePosition(direction, velocity)
  {
    // …

    this.playerX += direction.x * velocity.x;
    this.playerY += direction.y * velocity.y;

    // ...
  }

  // …
}

export { Player };
```

Non-trivial data structures that warrant dedicated helper functions should also be encapsulated as classes, however they should always accept a simple JSON form of the data via the constructure, and a method to retrieve a simple JSON form of the data.



Common helper functions — operations that do not require local state — and invariant data can be exposed directly via the module, however you must always access these via an appropriated named module object:

```js
import * as Module from "./modules/module.js";

Module.function1()
Module.function2()
```

Do not import module functions or variables directly.

### Module Aggregation and Sub-Modules 

Take advantage of module aggregation and sub-modules to help keep the project organised. This approach is great not only for allowing further decomposition of complex modules/classes, but also for keeping data structures close to the logic that deals with them:

```
scripts/
  app.js
  app-view-model.js
  modules/
    canvas.js
    shapes.js
    shapes/
      circle.js
      square.js
      triangle.js
```

### Naming conventions

| Kind | Shape | Example |
|---|---|---|
| File Names | `kebab-case` | `event-capture.js`, `list-panel.js` |
| Class Names / Module Objects | `PascalCase` | `EventCapture`, `ListPanel` |
| Functions / Methods | `camelCase` | `notify()`, `calculateWeight()` |
| Variables / Scoped Constants | `camelCase` | `let hideOlder = false`, `const gravity = 9.2` |
| Global Constants | `UPPER_SNAKE` | `ROW_HEIGHT`, `NOTIFY_INTERVAL` |
| Class Fields / Properties | `this.field` | `this.playerX`, `this.speed` |

`PascalCase` is reserved for modules and class names. Functions and values are always `camelCase`. Avoid useless and unreliable decoration of names (e.g. "_fieldName") in favour of explicit origin: `this.fieldName` or `MyModule.functionName()`.

If these naming conventions strongly conflict with the standards and requirements of a language you are using, then seek clarification from the user on the best way to proceed.

### Clear but sensible naming

When naming functions and values, ensure the reader will be able understand the purpose at a glance, but avoid being needlessly verbose.

```js
// Good
let isBuildingValid = true;

// OK — prefered if the context of what is being validated is already clear
let isValid = true;

// Avoid
let isBuildingHeightAndWidthValid = true;

```

When writing blocks of code that would greatly benefit from shorter value names, embrace them if it will ultimately enhance readability.

```js
const gap = this.buildingSpacing;
const startX = lastBuilding.posX = lastBuilding.width;
const startY = this.groundY;

const width = currentBuilding.width;
const height = currentBuilding.height;
let   x = 0;
let   y = 0;

x = startX + gap + width;
y = startY - height;

// clamping etc...

currentBuilding.posX = x;
currentBuilding.posY = y;
```

---

## Whitespace & Visual Layout

We should organise our code logically into paragraphs that are visually separated from their neighbours, in the same way we organise our ideas in to paragraphs when writing. This allows the reader to easily identify related code/ideas without re-reading.

Our primary focus is maximising readability through consistency in structural formatting and strategic use of whitespace.

---

### 1. Braces and Parentheses

#### Braces (Allman Style)

We use the Allman style for all standard control structures, classes, and methods. The opening brace `{` must appear on a new line following the control statement, indented to the same level.

**Why**: This aligns the braces vertically, making the scope of a block immediately obvious at a glance.

```js
// correct
if(isValid)
{
    DoWork();
}

// avoid
if(isValid) {
    DoWork();
}
```

### Keyword Spacing (Parentheses)

When using control flow keywords (e.g., if, while, for, switch), there should be no space between the keyword and the opening parenthesis.

- **Correct**: if(condition)
- **Avoid**: if (condition)

### Compact Forms, closures, and other exemptions

While structural clarity is our priority, we must recognize that strict adherence to the Allman style can sometimes lead to "vertical bloat" in functional programming contexts.

Use your best judgment when dealing with small closures, simple lambdas, or high-order functions. If a block is trivial (e.g., a single-line transformation), a compact, single-line form is preferred to maintain the flow of the surrounding logic.

**Guideline**: If the closure contains more than one statement or exceeds 80 characters, revert to the standard Allman style.

```js
// Correct use of compact form for clarity
const squares = numbers.map(x => x * x);

// Correct use of judgment for slightly larger closures
const processed = items.map(item => {
    return item.isValid ? item.value : null;
});

// Use allman style for complex logic within a closure
list.forEach(item =>
{
    const result = PerformComplexCalculation(item);
    LogResult(result);
});
```
These guidelines also apply to simple control blocks:

```js
// Correct use of compact form for clarity
if(condition != true) { return; }

// uUse allman style when control block contains more than one statement
if(condition != true)
{
    console.log('something happened');

    return;
}
```
### 2. Logical paragraphs separated by blank lines

Inside a function, group related ideas and statements that 'do one thing together' in to paragraphs, with a blank line between each paragraph. A paragraph with one line is fine when the line is load-bearing — early returns, key state mutations, the function's primary side-effect.

This doesn't just apply to the top-level logic in a function, but also to logic within if-blocks, for-blocks, and so forth.

```js
const tableTop = table.getTop()
const rowTop = row.getTop()
const rowBottom = row.getBottom()

if(!tableTop || !rowTop || !rowBottom) { return; }

padding = padding || this.rowGap;

let y = tableTop - rowTop
let h = rowTop - rowBottom
```

---

### 3. Variable declarations are their own paragraph

A run of variable or constant declarations is a paragraph in its own right. When the next chunk of code tests, validates, or otherwise operates on them, put a blank line between the declarations and that logic.

The exception: a single declaration paired tightly with something like a simple clamp or normalisation that mutates *that same variable* reads as one unit and may stay together with no blank line.

```js
// OK: single declaration + immediate clamp on the same variable
let tableTop = table.getTop();
    tableTop = (tableTop < minTop)? minTop: tableTop;

// Avoid: declarations followed by logic with no break
const tableTop = table.getTop()
const rowTop = row.getTop()
const rowBottom = row.getBottom()
if(!tableTop || !rowTop || !rowBottom) { return; }

// Prefer: blank line before the logic paragraph
const tableTop = table.getTop()
const rowTop = row.getTop()
const rowBottom = row.getBottom()

if(!tableTop || !rowTop || !rowBottom) { return; }

// Avoid: multiple declarations + clamp on only one of them
const tableTop = table.getTop()
const rowTop = row.getTop()
const rowBottom = row.getBottom()
tableTop = (tableTop < minTop)? minTop: tableTop;

// Prefer: blank line first
const tableTop = table.getTop()
const rowTop = row.getTop()
const rowBottom = row.getBottom()

tableTop = (tableTop < minTop)? minTop: tableTop;
```

---

## Comments

Comments exist to add information that isn't obvious from the code itself. The code shows *what*, comments should explain *why* (a constraint, a quirk, a non-obvious decision). But you should only feel the need to explain *why* if it is not obvious from the code.

A comment is only worth keeping if removing it would leave a future reader with a question they can't answer by reading the code alone. Any comment that can be removed without confuse anyone should be deleted.

### Worthwhile Comments

- Bug workarounds, API quirks, version-dependent behaviour.
- Non-obvious design decisions (why X over Y).
- Contracts the code can't enforce on its own.
- External context (a 3rd party event firing twice, a race condition, a load order dependency).

### Worthless Comments

- Restating the function signature ("Returns the value of X").
- Narrating obvious code ("Loops over each item").
- Lead-in sentences that summarise the very next line.
- Pointers to "the recent X change" which rot fast and are already covered by the commit history.

```js
// Avoid: restates what the table name and contents already convey
// All texture asset paths used by the addon. Centralised so a future
// skin override is a one-line change.
const UI_TEXTURES = { ... }

// Prefer: drop the comment entirely
const UI_TEXTURES = { ... }

// Good: external context that isn't visible from the code
// blizzard returns an empty `cstr` for single-step achievements; the
// achievement-level `description` field is the human-readable label.
function getAchievementHeader(achievementId) { ... }
```

### Concise inline commments beat lengthy exposition

When a comment explains something specific to a particular line or block of code, place it at that line. Lengthy exposition at the top of a function that bundles several unrelated WHYs is harder to understand than the same facts placed inline at their respective points.

A top-of-function comment is fine for an invariant that genuinely spans the whole function. It is wrong for a collection of unrelated point-comments to be dressed up as a header.

```js
// Avoid: lenghty exposition at top of function that mixes unrelated WHYs
// First refresh after load is treated as a baseline so we do not fire
// for every existing tracked item. Items hidden by the zone filter
// still get marked expanded, and the scroll pin silently no-ops since
// they will not be in activeRows.
function detectAndShowNewlyTracked(currentKeys)
{
    // ...
}

// Prefer: each WHY at the line or block of code it explains
function detectAndShowNewlyTracked(currentKeys)
{
    if(!previousTrackedKeys)
    {
        // First refresh after load: capture baseline silently so we
        // do not fire for every already-tracked item. 
        previousTrackedKeys = currentKeys

        return
    }

    // Mark expanded even if the zone filter is hiding this item.
    expandedKeys[key] = true

    // Hidden-by-filter items have no matching row in activeRows, so
    // ApplyPendingScroll naturally no-ops for them.
    if(lastNewKey) { ... }

}
```

### Dividers in tables

Short labels grouping entries inside a table or list aren't really comments — they're visual aids. Use **Title Case** for short headers.

```js
const UI_COLORS = {
    // Row Backgrounds
    superTrackBg = { 1.0,  0.82, 0.0,  0.12 },
    completedBg  = { 0.12, 0.35, 0.15, 0.45 },

    // Progress Bar
    barBg        = { 0.22, 0.22, 0.24, 0.95 },
    
    // ...
}
```

---

### Section headers

Section headers should be used to help break up large files and keep them easy to navigate.

Section headers should be a three line banner padded to exactly 80 columns. There should be two blank lines above the banner (an extra blank line beyond the usual single blank between top-level declarations) and one blank line below it before the first declaration in the section.

Section names should be CAPITLISED.

```js


/******************************************************************************/
/* SECTION                                                                    */
/******************************************************************************/

function firstThingInSection()
```

The two blank lines above are the rule that distinguishes a section break from an ordinary declaration break. A reader scrolling the file sees the extra space before they see the banner itself.

---

### Sub-Section Headers

Sub-Sectiom headers should follow similar rules to section headers, but used to break up the code within a section in to logical groupings.

Sub-Section headers should be a single line banners padded to exactly 80 columns. There should only be a single blank link about to banner.

Sub-Section names should be CAPITLISED.

```js

/* SUB-SECTION ****************************************************************/

function firstThingInSubSection()
```