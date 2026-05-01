# Design: COBOL.js — Retro/Synthwave COBOL Emulator
Date: 2026-05-01

## Summary

A single-page web app that lets the user write COBOL in a styled editor at the
top and run it to see output in a console below. Knockout drives the UI, an
ES6-module interpreter runs the program in-browser, and the bundled
`local-file-system.js` library handles save/load against a user-mounted
working directory. Visual style: synthwave / cyberpunk — dark navy with neon
magenta + cyan, faint glow, blinking cursor.

## Architecture

Single-page app served from a local web server (modules + File System Access
API both require http(s)/localhost). Four cooperating concerns, each behind
its own module:

1. **Editor** — owns source text, line numbers, column rulers (cols 7, 8, 12,
   72). State only.
2. **Console** — bottom panel; owns output history and the inline input prompt
   for ACCEPT. Public surface: `write(text, noAdvance)`,
   `writeSystem(text)`, `writeError(text)`, `prompt() → Promise<string>`,
   `clear()`.
3. **FileIO** — wraps the provided `LocalFileSystem`. Owns the directory
   handle, lists `.cbl` files, reads/writes by name.
4. **COBOL runtime** — pure logic. Takes source + a console handle, runs to
   completion or error. Async because ACCEPT awaits a Promise.

`AppViewModel` (Knockout) wires these together. The runtime never touches the
DOM; it writes through the console handle, which Knockout-bound observables
render. Dependency direction: `app-view-model → editor / console / file-io
/ cobol`. `cobol` depends only on its own sub-modules.

**Naming:** view-model instances are spelled out as `viewModel` everywhere in
this project — never `vm` / `VM` (collides with "virtual machine").

## Components

```
coboljs/
  index.html
  styles.css
  libs/
    knockout-3.5.1.js          (provided)
    local-file-system.js       (provided)
  scripts/
    app.js                     entry point; creates viewModel, applies KO bindings
    app-view-model.js          KO observables, button handlers, wiring
    modules/
      editor.js                Editor class — source text, cursor, tab handling
      console.js               Console class — output buffer, inline prompt
      file-io.js               FileIO class — wraps LocalFileSystem, .cbl listing
      examples.js              EXAMPLES table — name → source text
      cobol.js                 public Cobol module — Cobol.run(source, console)
      cobol/
        lexer.js               Lexer class — tokenize source
        parser.js              Parser class — tokens → Program AST
        program.js             Program class — divisions, paragraphs, data items
        data-item.js           DataItem class — PIC mask, value, group/elementary
        expression.js          ExpressionEvaluator — COMPUTE / IF condition arith
        interpreter.js         Interpreter class — async walk of AST
        keywords.js            KEYWORDS table — reserved word set
```

Module boundaries justified by STYLE.md: stateful pipeline passes
(Lexer/Parser/Interpreter) and concept owners (Editor/Console/FileIO/DataItem)
are classes. Invariant data (`EXAMPLES`, `KEYWORDS`) lives as module-level
constants and is accessed via `Examples.list` / `Keywords.has(...)`. The
public façade is `Cobol.run(source, console)` — anything outside `cobol/`
calls only that.

The runtime → console contract is:
- `console.write(text, noAdvance?)`
- `console.writeSystem(text)` — for `> RUN`, `> READY`, etc.
- `console.writeError(text)` — for error styling
- `console.prompt() → Promise<string>`

That is the full I/O surface; the interpreter is decoupled from KO/DOM.

## Data Flow

**Boot:** `app.js` instantiates `Editor`, `Console`, `FileIO`, then
`AppViewModel`, then `ko.applyBindings(viewModel)`. Console writes a boot
banner. Editor pre-fills with `HELLO-WORLD` from `examples.js`. File-list
panel shows `[ MOUNT WORKING DIR ]` until user mounts.

**Run flow** (RUN clicked):
```
viewModel.run()
  → source = editor.getText()
  → console.writeSystem("> RUN " + programId)
  → await Cobol.run(source, consoleHandle)
       Lexer.tokenize(source)              → tokens[]
       Parser.parse(tokens)                → Program {dataItems, paragraphs}
       new Interpreter(program, console).execute()
            walks paragraphs/statements; each:
              DISPLAY  → console.write(formatted)
              ACCEPT   → value = await console.prompt(); dataItem.assign(value)
              MOVE/ADD/etc → mutate dataItems via DataItem.assign()
              IF/PERFORM → recursive walks via async functions
              STOP RUN  → throw StopRunSignal (caught by execute())
  → console.writeSystem("> PROGRAM TERMINATED NORMALLY (Nms)")
```

**Inline prompt:** `Console.prompt()` flips an `isPrompting` observable to
true. The view shows an input field with focus; on Enter, the resolver fires
the awaiting Promise, the input line is "frozen" into the output history,
`isPrompting` flips back to false. Multiple sequential ACCEPTs await each in
turn.

**File flow:**
- Mount → `fileIO.mount()` → `LocalFileSystem.setWorkingDirectory()`, refresh list.
- Load `<name>` → `fileIO.read(name)` → `editor.setText(text)`, status updates.
- Save → if no name yet, prompt for one in console; `fileIO.write(name, source)`; refresh list.

## Error Handling

- `CobolSyntaxError(line, msg)` — Lexer/Parser. Caught at `Cobol.run()`
  boundary, printed as `! SYNTAX ERROR LINE 12: <msg>` in error style.
- `CobolRuntimeError(line, msg)` — Interpreter. Same boundary handling.
- `StopRunSignal` — internal control-flow exception for `STOP RUN`/`GOBACK`,
  caught silently by the top-level execute loop.
- Unexpected JS errors are caught at the boundary and printed as
  `! INTERNAL ERROR: <message>` so the UI never wedges.
- Status banner switches to `STATUS: ERROR` until next RUN.

## COBOL Feature Scope (locked v0.1)

**Divisions:** `IDENTIFICATION DIVISION` (with `PROGRAM-ID`),
`ENVIRONMENT DIVISION` (parsed and ignored), `DATA DIVISION` with
`WORKING-STORAGE SECTION`, `PROCEDURE DIVISION`.

**Data items:** levels 01–49 + 77; PIC `X(n)`, `9(n)`, `S9(n)`, `9(n)V9(m)`,
`A(n)`; `VALUE 'literal' | 123 | ZEROS | SPACES`.

**Statements:**
- `DISPLAY` (multi-operand, `WITH NO ADVANCING`)
- `ACCEPT` (single var)
- `MOVE` (multi-destination)
- `ADD … TO …` / `ADD … TO … GIVING …`
- `SUBTRACT … FROM …` (+GIVING)
- `MULTIPLY … BY …` (+GIVING)
- `DIVIDE … BY/INTO …` (+GIVING)
- `COMPUTE var = expr` (`+ - * / **`, parens)
- `IF cond [THEN] … [ELSE …] END-IF` with `=`, `>`, `<`, `>=`, `<=`, `NOT =`,
  `AND`, `OR`
- `PERFORM <para>`, `PERFORM <para> N TIMES`, `PERFORM <para> UNTIL cond`,
  `PERFORM <para> VARYING v FROM x BY y UNTIL cond`
- `STOP RUN`, `GOBACK`, `EXIT`

**Lexical:** case-insensitive keywords/identifiers; `*` in col 7 starts a
comment line; `*>` starts an inline comment; periods terminate sentences
(permissive between simple statements); strings in single or double quotes;
column rules are advisory (rulers in the editor) — not enforced.

**Out of scope (v0.1):** STRING, UNSTRING, INSPECT, OCCURS tables, EVALUATE,
file I/O (READ/WRITE), SEARCH, COPY, REDEFINES, condition names (88 levels).

## UI Choices

- **Aesthetic:** synthwave / cyberpunk — dark navy bg, neon magenta + cyan
  borders, glowing headers, pulsing magenta cursor. Less literal-retro than
  phosphor green; more punchy.
- **Editor:** plain `<textarea>` with line-number gutter that scrolls in sync,
  plus subtle column rulers at cols 7, 8, 12, 72 (the classic COBOL areas).
- **ACCEPT input:** inline prompt at the bottom of the console — input field
  auto-focuses, Enter submits, line freezes into output history.
- **File mgmt:** Mount working dir once; file list panel shows all `.cbl`
  files; click to load, save prompts for name if untitled.
- **Examples:** EXAMPLES dropdown loads bundled programs (HELLO-WORLD,
  FIZZBUZZ, FIBONACCI, MORTGAGE-CALC, GUESS-THE-NUMBER) into the editor.

## Open Questions

None — design locked. Implementation plan to follow.
