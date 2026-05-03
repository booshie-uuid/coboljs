---
name: Named imports for classes are accepted; namespace imports for free-function modules only
description: STYLE.md "do not import functions directly" applies to free-function modules; importing classes with named imports is the established pattern
type: feedback
---

STYLE.md says "Do not import module functions or variables directly" and requires `import * as Namespace from "..."`. However, the codebase consistently uses named imports for class-exporting modules:

```js
import { Editor } from "./modules/editor.js";
import { Console } from "./modules/console.js";
import { DataItem } from "../data-item.js";
```

And namespace imports for free-function modules:
```js
import * as Keywords from "./keywords.js";
import * as Cobol from "./modules/cobol.js";
import * as Pic from "./pic.js";
import * as Arithmetic from "./parser/arithmetic.js";
```

This interpretation — STYLE.md's rule targets free functions, not classes — is consistent throughout the codebase and has not been challenged in any prior review. Apply this same interpretation in future reviews.

**Why:** classes are used with `new ClassName()` which already provides namespace-like clarity; the rule's purpose (avoid confusion about which module a function came from) is met for classes by the `new` keyword.
