import { suite, test, expect, loadFixture } from "../runner.js";
import { Lexer } from "../../scripts/modules/cobol/lexer.js";
import { Parser } from "../../scripts/modules/cobol/parser.js";
import { Interpreter } from "../../scripts/modules/cobol/interpreter.js";
import { CobolRuntimeError } from "../../scripts/modules/cobol/errors.js";


/******************************************************************************/
/* MOCK CONSOLE                                                               */
/******************************************************************************/

class MockConsole
{
    constructor(promptResponses = [])
    {
        this.lines = [];
        this.partial = "";
        this.promptResponses = [...promptResponses];
    }

    write(text, noAdvance = false)
    {
        if(noAdvance)
        {
            this.partial += text;

            return;
        }

        this.lines.push(this.partial + text);
        this.partial = "";
    }

    writeSystem(text)  { this.lines.push("[sys] " + text); }
    writeWarning(text) { this.lines.push("[warn] " + text); }
    writeError(text)   { this.lines.push("[err] " + text); }

    prompt()
    {
        const value = this.promptResponses.shift() ?? "";
        const displayed = this.partial? (this.partial + value): ("> " + value);

        this.lines.push(displayed);
        this.partial = "";

        return Promise.resolve(value);
    }
}


function execute(source, promptResponses = [])
{
    const tokens = new Lexer().tokenize(source);
    const program = new Parser().parse(tokens);
    const consoleHandle = new MockConsole(promptResponses);

    return new Interpreter(program, consoleHandle).execute().then(() => consoleHandle);
}


/******************************************************************************/
/* TESTS                                                                      */
/******************************************************************************/

suite("Interpreter", () =>
{
    suite("DISPLAY", () =>
    {
        test("single literal prints to console", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      DISPLAY "HELLO, WORLD!".`
            );

            expect(out.lines).toEqual(["HELLO, WORLD!"]);
        });

        test("multiple operands concatenate on one line", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      DISPLAY "A" "B" "C".`
            );

            expect(out.lines).toEqual(["ABC"]);
        });

        test("numeric literal renders as text", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      DISPLAY 42.`
            );

            expect(out.lines).toEqual(["42"]);
        });

        test("multiple DISPLAY statements produce multiple lines", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      DISPLAY "ONE".
                      DISPLAY "TWO".`
            );

            expect(out.lines).toEqual(["ONE", "TWO"]);
        });

        test("WITH NO ADVANCING buffers until next write", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      DISPLAY "A: " WITH NO ADVANCING.
                      DISPLAY "B".`
            );

            expect(out.lines).toEqual(["A: B"]);
        });

        test("undefined identifier throws CobolRuntimeError", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    ` IDENTIFICATION DIVISION.
                      PROGRAM-ID. P.
                      PROCEDURE DIVISION.
                          DISPLAY MISSING.`
                );
            }
            catch(error) { thrown = error; }

            expect(thrown instanceof CobolRuntimeError).toBe(true);
            expect(thrown.message.includes("MISSING")).toBe(true);
        });

        test("identifier operand renders via DataItem.getDisplay", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 GREETING PIC X(10) VALUE "HI".
                  PROCEDURE DIVISION.
                      DISPLAY GREETING.`
            );

            // Padded to PIC width — authentic COBOL behaviour.
            expect(out.lines).toEqual(["HI        "]);
        });

        test("numeric identifier displays formatted by PIC", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 COUNTER PIC 9(3) VALUE 7.
                  PROCEDURE DIVISION.
                      DISPLAY COUNTER.`
            );

            expect(out.lines).toEqual(["007"]);
        });

        test("group display concatenates children", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 RECORD.
                     05 FIRST PIC X(3) VALUE "ABC".
                     05 SECOND PIC X(2) VALUE "XY".
                  PROCEDURE DIVISION.
                      DISPLAY RECORD.`
            );

            expect(out.lines).toEqual(["ABCXY"]);
        });
    });

    suite("MOVE", () =>
    {
        test("literal to single target", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 X PIC 9(3).
                  PROCEDURE DIVISION.
                      MOVE 42 TO X.
                      DISPLAY X.`
            );

            expect(out.lines).toEqual(["042"]);
        });

        test("literal to multiple targets", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 A PIC 9(2).
                  01 B PIC 9(2).
                  01 C PIC 9(2).
                  PROCEDURE DIVISION.
                      MOVE 7 TO A B C.
                      DISPLAY A B C.`
            );

            expect(out.lines).toEqual(["070707"]);
        });

        test("identifier source copies value", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 SRC PIC 9(3) VALUE 12.
                  01 DEST PIC 9(3).
                  PROCEDURE DIVISION.
                      MOVE SRC TO DEST.
                      DISPLAY DEST.`
            );

            expect(out.lines).toEqual(["012"]);
        });

        test("string literal to alphanumeric target", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 NAME PIC X(5).
                  PROCEDURE DIVISION.
                      MOVE "MATT" TO NAME.
                      DISPLAY NAME.`
            );

            expect(out.lines).toEqual(["MATT "]);
        });
    });

    suite("ACCEPT", () =>
    {
        test("assigns prompted value into target", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 USER-NAME PIC X(10).
                  PROCEDURE DIVISION.
                      ACCEPT USER-NAME.
                      DISPLAY USER-NAME.`,
                ["MATT"]
            );

            expect(out.lines[1]).toBe("MATT      ");
        });

        test("HELLO-NAME end to end", async () =>
        {
            const out = await execute(loadFixture("hello-name.cbl"), ["MATT"]);

            // [0] prompt line frozen by MockConsole.prompt
            // [1] greeting line
            expect(out.lines[0]).toBe("WHAT IS YOUR NAME? MATT");
            expect(out.lines[1]).toBe("HELLO, MATT                ");
        });

        test("non-numeric input into numeric PIC throws", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    ` IDENTIFICATION DIVISION.
                      PROGRAM-ID. P.
                      DATA DIVISION.
                      WORKING-STORAGE SECTION.
                      01 N PIC 9(3).
                      PROCEDURE DIVISION.
                          ACCEPT N.`,
                    ["hello"]
                );
            }
            catch(error) { thrown = error; }

            expect(thrown instanceof CobolRuntimeError).toBe(true);
            expect(thrown.message.includes("hello")).toBe(true);
        });

        test("partial-numeric input (50*2) into numeric PIC throws", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    ` IDENTIFICATION DIVISION.
                      PROGRAM-ID. P.
                      DATA DIVISION.
                      WORKING-STORAGE SECTION.
                      01 N PIC 9(3).
                      PROCEDURE DIVISION.
                          ACCEPT N.`,
                    ["50*2"]
                );
            }
            catch(error) { thrown = error; }

            expect(thrown instanceof CobolRuntimeError).toBe(true);
            expect(thrown.message.includes("50*2")).toBe(true);
        });

        test("empty input into numeric PIC throws", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    ` IDENTIFICATION DIVISION.
                      PROGRAM-ID. P.
                      DATA DIVISION.
                      WORKING-STORAGE SECTION.
                      01 N PIC 9(3).
                      PROCEDURE DIVISION.
                          ACCEPT N.`,
                    [""]
                );
            }
            catch(error) { thrown = error; }

            expect(thrown instanceof CobolRuntimeError).toBe(true);
        });

        test("signed numeric input is accepted", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 N PIC S9(3).
                  PROCEDURE DIVISION.
                      ACCEPT N.
                      DISPLAY N.`,
                ["-42"]
            );

            // [0] prompt freeze, [1] DISPLAY output
            expect(out.lines[1]).toBe("-042");
        });

        test("alphanumeric ACCEPT is unaffected by numeric validation", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 LABEL PIC X(10).
                  PROCEDURE DIVISION.
                      ACCEPT LABEL.
                      DISPLAY LABEL.`,
                ["50*2"]
            );

            expect(out.lines[1]).toBe("50*2      ");
        });
    });

    suite("ADD", () =>
    {
        test("in-place adds source to target", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 X PIC 9(3) VALUE 10.
                  PROCEDURE DIVISION.
                      ADD 5 TO X.
                      DISPLAY X.`
            );

            expect(out.lines).toEqual(["015"]);
        });

        test("multi-source TO multi-target", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 A PIC 9(3) VALUE 10.
                  01 B PIC 9(3) VALUE 20.
                  PROCEDURE DIVISION.
                      ADD 1 2 TO A B.
                      DISPLAY A " " B.`
            );

            expect(out.lines).toEqual(["013 023"]);
        });

        test("GIVING replaces target", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 A PIC 9(3) VALUE 5.
                  01 B PIC 9(3) VALUE 7.
                  01 C PIC 9(3) VALUE 99.
                  PROCEDURE DIVISION.
                      ADD A B GIVING C.
                      DISPLAY C.`
            );

            expect(out.lines).toEqual(["012"]);
        });

        test("non-numeric alpha source in arithmetic throws", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    ` IDENTIFICATION DIVISION.
                      PROGRAM-ID. P.
                      DATA DIVISION.
                      WORKING-STORAGE SECTION.
                      01 LABEL PIC X(5) VALUE "HELLO".
                      01 N PIC 9(3) VALUE 10.
                      PROCEDURE DIVISION.
                          ADD LABEL TO N.`
                );
            }
            catch(error) { thrown = error; }

            expect(thrown instanceof CobolRuntimeError).toBe(true);
            expect(thrown.message.includes("HELLO")).toBe(true);
        });
    });

    suite("SUBTRACT", () =>
    {
        test("in-place subtracts from target", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 X PIC 9(3) VALUE 10.
                  PROCEDURE DIVISION.
                      SUBTRACT 3 FROM X.
                      DISPLAY X.`
            );

            expect(out.lines).toEqual(["007"]);
        });

        test("FROM-via-GIVING reads from but does not modify it", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 A PIC 9(3) VALUE 20.
                  01 B PIC 9(3) VALUE 5.
                  01 C PIC 9(3).
                  PROCEDURE DIVISION.
                      SUBTRACT B FROM A GIVING C.
                      DISPLAY A " " B " " C.`
            );

            expect(out.lines).toEqual(["020 005 015"]);
        });

        test("multiple sources sum then subtract", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 X PIC 9(3) VALUE 50.
                  PROCEDURE DIVISION.
                      SUBTRACT 10 5 FROM X.
                      DISPLAY X.`
            );

            expect(out.lines).toEqual(["035"]);
        });

        test("in-place applies to multiple targets", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 A PIC 9(3) VALUE 30.
                  01 B PIC 9(3) VALUE 40.
                  PROCEDURE DIVISION.
                      SUBTRACT 5 FROM A B.
                      DISPLAY A " " B.`
            );

            expect(out.lines).toEqual(["025 035"]);
        });
    });

    suite("MULTIPLY", () =>
    {
        test("in-place multiplies target", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 X PIC 9(3) VALUE 4.
                  PROCEDURE DIVISION.
                      MULTIPLY 5 BY X.
                      DISPLAY X.`
            );

            expect(out.lines).toEqual(["020"]);
        });

        test("in-place applies to multiple targets", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 A PIC 9(3) VALUE 3.
                  01 B PIC 9(3) VALUE 4.
                  PROCEDURE DIVISION.
                      MULTIPLY 2 BY A B.
                      DISPLAY A " " B.`
            );

            expect(out.lines).toEqual(["006 008"]);
        });

        test("GIVING form", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 A PIC 9(2) VALUE 6.
                  01 B PIC 9(2) VALUE 7.
                  01 C PIC 9(3).
                  PROCEDURE DIVISION.
                      MULTIPLY A BY B GIVING C.
                      DISPLAY C.`
            );

            expect(out.lines).toEqual(["042"]);
        });
    });

    suite("DIVIDE", () =>
    {
        test("INTO in-place: target = target / divisor", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 X PIC 9(3) VALUE 20.
                  PROCEDURE DIVISION.
                      DIVIDE 5 INTO X.
                      DISPLAY X.`
            );

            expect(out.lines).toEqual(["004"]);
        });

        test("INTO in-place applies to multiple targets", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 A PIC 9(3) VALUE 12.
                  01 B PIC 9(3) VALUE 30.
                  PROCEDURE DIVISION.
                      DIVIDE 2 INTO A B.
                      DISPLAY A " " B.`
            );

            expect(out.lines).toEqual(["006 015"]);
        });

        test("INTO + GIVING: result = dividend / divisor", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 RESULT PIC 9(3).
                  PROCEDURE DIVISION.
                      DIVIDE 4 INTO 20 GIVING RESULT.
                      DISPLAY RESULT.`
            );

            expect(out.lines).toEqual(["005"]);
        });

        test("BY + GIVING: result = dividend / divisor", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 RESULT PIC 9(3)V99.
                  PROCEDURE DIVISION.
                      DIVIDE 7 BY 2 GIVING RESULT.
                      DISPLAY RESULT.`
            );

            expect(out.lines).toEqual(["003.50"]);
        });

        test("division by zero throws CobolRuntimeError", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    ` IDENTIFICATION DIVISION.
                      PROGRAM-ID. P.
                      DATA DIVISION.
                      WORKING-STORAGE SECTION.
                      01 X PIC 9(3) VALUE 10.
                      PROCEDURE DIVISION.
                          DIVIDE 0 INTO X.`
                );
            }
            catch(error) { thrown = error; }

            expect(thrown instanceof CobolRuntimeError).toBe(true);
            expect(thrown.message).toBe("Division by zero");
        });
    });

    suite("COMPUTE", () =>
    {
        test("simple arithmetic expression", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 RESULT PIC 9(4).
                  PROCEDURE DIVISION.
                      COMPUTE RESULT = 2 + 3 * 4.
                      DISPLAY RESULT.`
            );

            expect(out.lines).toEqual(["0014"]);
        });

        test("uses identifier values from working-storage", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 X PIC 9(2) VALUE 5.
                  01 Y PIC 9(2) VALUE 7.
                  01 RESULT PIC 9(4).
                  PROCEDURE DIVISION.
                      COMPUTE RESULT = X * Y + X.
                      DISPLAY RESULT.`
            );

            expect(out.lines).toEqual(["0040"]);
        });

        test("parens override precedence", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 RESULT PIC 9(3).
                  PROCEDURE DIVISION.
                      COMPUTE RESULT = (2 + 3) * 4.
                      DISPLAY RESULT.`
            );

            expect(out.lines).toEqual(["020"]);
        });

        test("exponentiation with decimal result", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 RESULT PIC 9(4)V99.
                  PROCEDURE DIVISION.
                      COMPUTE RESULT = 3 ** 4.
                      DISPLAY RESULT.`
            );

            expect(out.lines).toEqual(["0081.00"]);
        });

        test("undefined identifier in expression throws CobolRuntimeError", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    ` IDENTIFICATION DIVISION.
                      PROGRAM-ID. P.
                      DATA DIVISION.
                      WORKING-STORAGE SECTION.
                      01 RESULT PIC 9(3).
                      PROCEDURE DIVISION.
                          COMPUTE RESULT = MISSING + 1.`
                );
            }
            catch(error) { thrown = error; }

            expect(thrown instanceof CobolRuntimeError).toBe(true);
            expect(thrown.message.includes("MISSING")).toBe(true);
        });

        test("division by zero in expression throws", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    ` IDENTIFICATION DIVISION.
                      PROGRAM-ID. P.
                      DATA DIVISION.
                      WORKING-STORAGE SECTION.
                      01 RESULT PIC 9(3).
                      PROCEDURE DIVISION.
                          COMPUTE RESULT = 10 / 0.`
                );
            }
            catch(error) { thrown = error; }

            expect(thrown instanceof CobolRuntimeError).toBe(true);
            expect(thrown.message).toBe("Division by zero");
        });
    });

    suite("COMPUTE-DEMO integration", () =>
    {
        test("polynomial expressions match expected values", async () =>
        {
            const out = await execute(loadFixture("compute-demo.cbl"));

            expect(out.lines).toEqual([
                "X = 04",
                "X^2 + 2X + 1 = 0025.00",
                "(X + 1)(X + 2) = 0030.00"
            ]);
        });
    });

    suite("ARITH-DEMO integration", () =>
    {
        test("end-to-end fixture exercises all four ops in GIVING form", async () =>
        {
            const out = await execute(loadFixture("arith-demo.cbl"));

            expect(out.lines).toEqual([
                "A = 012",
                "B = 008",
                "A + B = 0020.00",
                "A - B = 0004.00",
                "A * B = 0096.00",
                "A / B = 0001.50"
            ]);
        });
    });

    suite("IF", () =>
    {
        test("true branch executes", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 X PIC 9(3) VALUE 0.
                  PROCEDURE DIVISION.
                      IF X = 0 THEN
                          DISPLAY "ZERO".
                      END-IF.`
            );

            expect(out.lines).toEqual(["ZERO"]);
        });

        test("false branch with no ELSE produces nothing", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 X PIC 9(3) VALUE 5.
                  PROCEDURE DIVISION.
                      IF X = 0 THEN
                          DISPLAY "ZERO".
                      END-IF.
                      DISPLAY "AFTER".`
            );

            expect(out.lines).toEqual(["AFTER"]);
        });

        test("false branch with ELSE executes ELSE body", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 X PIC 9(3) VALUE 5.
                  PROCEDURE DIVISION.
                      IF X = 0 THEN
                          DISPLAY "ZERO".
                      ELSE
                          DISPLAY "NONZERO".
                      END-IF.`
            );

            expect(out.lines).toEqual(["NONZERO"]);
        });

        test("AND combinator: both true", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 X PIC 9(3) VALUE 5.
                  01 Y PIC 9(3) VALUE 5.
                  PROCEDURE DIVISION.
                      IF X = 5 AND Y = 5 THEN
                          DISPLAY "BOTH".
                      ELSE
                          DISPLAY "NO".
                      END-IF.`
            );

            expect(out.lines).toEqual(["BOTH"]);
        });

        test("AND combinator: one false", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 X PIC 9(3) VALUE 5.
                  01 Y PIC 9(3) VALUE 0.
                  PROCEDURE DIVISION.
                      IF X = 5 AND Y = 5 THEN
                          DISPLAY "BOTH".
                      ELSE
                          DISPLAY "NO".
                      END-IF.`
            );

            expect(out.lines).toEqual(["NO"]);
        });

        test("OR combinator", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 X PIC 9(3) VALUE 1.
                  PROCEDURE DIVISION.
                      IF X = 1 OR X = 2 THEN
                          DISPLAY "MATCH".
                      END-IF.`
            );

            expect(out.lines).toEqual(["MATCH"]);
        });

        test("NOT prefix inverts truth", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 X PIC 9(3) VALUE 5.
                  PROCEDURE DIVISION.
                      IF NOT X = 0 THEN
                          DISPLAY "NZ".
                      END-IF.`
            );

            expect(out.lines).toEqual(["NZ"]);
        });

        test("infix NOT (X NOT = 0) treats as not-equal", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 X PIC 9(3) VALUE 7.
                  PROCEDURE DIVISION.
                      IF X NOT = 0 THEN
                          DISPLAY "NZ".
                      END-IF.`
            );

            expect(out.lines).toEqual(["NZ"]);
        });

        test("comparison operators: <, >, <=, >=", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 X PIC 9(3) VALUE 5.
                  PROCEDURE DIVISION.
                      IF X < 10 THEN DISPLAY "LT". END-IF.
                      IF X > 1  THEN DISPLAY "GT". END-IF.
                      IF X <= 5 THEN DISPLAY "LE". END-IF.
                      IF X >= 5 THEN DISPLAY "GE". END-IF.`
            );

            expect(out.lines).toEqual(["LT", "GT", "LE", "GE"]);
        });

        test("nested IF: inner true only when outer also true", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 X PIC 9(3) VALUE 0.
                  01 Y PIC 9(3) VALUE 0.
                  PROCEDURE DIVISION.
                      IF X = 0 THEN
                          IF Y = 0 THEN
                              DISPLAY "BOTH".
                          END-IF
                      END-IF.`
            );

            expect(out.lines).toEqual(["BOTH"]);
        });

        test("STOP RUN inside IF body terminates the program", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 X PIC 9(3) VALUE 0.
                  PROCEDURE DIVISION.
                      DISPLAY "BEFORE".
                      IF X = 0 THEN
                          STOP RUN.
                      END-IF.
                      DISPLAY "AFTER".`
            );

            expect(out.lines).toEqual(["BEFORE"]);
        });

        test("expression operands in comparison", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 X PIC 9(3) VALUE 4.
                  PROCEDURE DIVISION.
                      IF (X + 1) > 4 THEN
                          DISPLAY "OK".
                      END-IF.`
            );

            expect(out.lines).toEqual(["OK"]);
        });
    });

    suite("IF-DEMO integration", () =>
    {
        test("score in middle range hits >50 + in-range branches", async () =>
        {
            const out = await execute(loadFixture("if-demo.cbl"), ["75"]);

            // Prompt line + three IF outputs
            expect(out.lines[0]).toBe("ENTER A NUMBER (1-100): 75");
            expect(out.lines.slice(1)).toEqual([
                "BIGGER THAN 50",
                "IN RANGE"
            ]);
        });

        test("score 0 hits ZERO + 50-OR-LESS + OUT-OF-RANGE", async () =>
        {
            const out = await execute(loadFixture("if-demo.cbl"), ["0"]);

            expect(out.lines.slice(1)).toEqual([
                "ZERO",
                "50 OR LESS",
                "OUT OF RANGE"
            ]);
        });
    });

    suite("PERFORM", () =>
    {
        test("SIMPLE runs target paragraph once", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                  MAIN.
                      PERFORM SUB.
                      STOP RUN.
                  SUB.
                      DISPLAY "RAN".`
            );

            expect(out.lines).toEqual(["RAN"]);
        });

        test("TIMES runs target N times", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                  MAIN.
                      PERFORM SUB 3 TIMES.
                      STOP RUN.
                  SUB.
                      DISPLAY "RAN".`
            );

            expect(out.lines).toEqual(["RAN", "RAN", "RAN"]);
        });

        test("TIMES with count 0 doesn't run the body", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                  MAIN.
                      PERFORM SUB 0 TIMES.
                      DISPLAY "AFTER".
                      STOP RUN.
                  SUB.
                      DISPLAY "RAN".`
            );

            expect(out.lines).toEqual(["AFTER"]);
        });

        test("UNTIL stops when condition becomes true", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 N PIC 9(2) VALUE 0.
                  PROCEDURE DIVISION.
                  MAIN.
                      PERFORM TICK UNTIL N >= 3.
                      STOP RUN.
                  TICK.
                      DISPLAY N.
                      ADD 1 TO N.`
            );

            expect(out.lines).toEqual(["00", "01", "02"]);
        });

        test("UNTIL with initially-true condition runs zero times", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 N PIC 9(2) VALUE 5.
                  PROCEDURE DIVISION.
                  MAIN.
                      PERFORM TICK UNTIL N >= 3.
                      DISPLAY "AFTER".
                      STOP RUN.
                  TICK.
                      DISPLAY "RAN".`
            );

            expect(out.lines).toEqual(["AFTER"]);
        });

        test("VARYING loops with the variable tracked correctly", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 I PIC 9(2).
                  PROCEDURE DIVISION.
                  MAIN.
                      PERFORM SHOW VARYING I FROM 1 BY 1 UNTIL I > 4.
                      STOP RUN.
                  SHOW.
                      DISPLAY I.`
            );

            expect(out.lines).toEqual(["01", "02", "03", "04"]);
        });

        test("VARYING with custom step", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 I PIC 9(2).
                  PROCEDURE DIVISION.
                  MAIN.
                      PERFORM SHOW VARYING I FROM 2 BY 3 UNTIL I > 10.
                      STOP RUN.
                  SHOW.
                      DISPLAY I.`
            );

            expect(out.lines).toEqual(["02", "05", "08"]);
        });

        test("PERFORM unknown paragraph throws", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    ` IDENTIFICATION DIVISION.
                      PROGRAM-ID. P.
                      PROCEDURE DIVISION.
                      MAIN.
                          PERFORM MISSING.
                          STOP RUN.`
                );
            }
            catch(error) { thrown = error; }

            expect(thrown instanceof CobolRuntimeError).toBe(true);
            expect(thrown.message.includes("MISSING")).toBe(true);
        });

        test("nested PERFORM (paragraph performs another paragraph)", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                  MAIN.
                      PERFORM OUTER.
                      STOP RUN.
                  OUTER.
                      DISPLAY "OUTER-PRE".
                      PERFORM INNER.
                      DISPLAY "OUTER-POST".
                  INNER.
                      DISPLAY "INNER".`
            );

            expect(out.lines).toEqual(["OUTER-PRE", "INNER", "OUTER-POST"]);
        });

        test("STOP RUN inside PERFORMed paragraph terminates the program", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                  MAIN.
                      PERFORM HALT.
                      DISPLAY "AFTER MAIN".
                      STOP RUN.
                  HALT.
                      DISPLAY "BEFORE STOP".
                      STOP RUN.
                      DISPLAY "AFTER STOP".`
            );

            expect(out.lines).toEqual(["BEFORE STOP"]);
        });

        test("fall-through: paragraphs after MAIN run if no STOP RUN", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                  MAIN.
                      DISPLAY "MAIN".
                  NEXT-PARA.
                      DISPLAY "NEXT".`
            );

            expect(out.lines).toEqual(["MAIN", "NEXT"]);
        });
    });

    suite("PERFORM-DEMO integration", () =>
    {
        test("multiplication-table fixture produces full output", async () =>
        {
            const out = await execute(loadFixture("perform-demo.cbl"));

            expect(out.lines).toEqual([
                "MULTIPLICATION TABLE FOR 7:",
                "01 * 7 = 007",
                "02 * 7 = 014",
                "03 * 7 = 021",
                "04 * 7 = 028",
                "05 * 7 = 035",
                "06 * 7 = 042",
                "07 * 7 = 049",
                "08 * 7 = 056",
                "09 * 7 = 063",
                "10 * 7 = 070",
                "DONE!",
                "WHEEEE!",
                "WHEEEE!",
                "WHEEEE!"
            ]);
        });
    });

    suite("STOP RUN", () =>
    {
        test("halts execution at STOP RUN", async () =>
        {
            const out = await execute(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      DISPLAY "BEFORE".
                      STOP RUN.
                      DISPLAY "AFTER".`
            );

            expect(out.lines).toEqual(["BEFORE"]);
        });
    });

    suite("integration", () =>
    {
        test("HELLO-WORLD fixture runs end to end", async () =>
        {
            const out = await execute(loadFixture("hello-world.cbl"));

            expect(out.lines).toEqual(["HELLO, WORLD!"]);
        });
    });
});
