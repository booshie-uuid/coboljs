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

    writeSystem(text) { this.lines.push("[sys] " + text); }
    writeError(text)  { this.lines.push("[err] " + text); }

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
