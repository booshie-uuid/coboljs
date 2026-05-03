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
                loadFixture("interpreter/display/single-literal-prints-to-console.cbl")
            );

            expect(out.lines).toEqual(["HELLO, WORLD!"]);
        });

        test("multiple operands concatenate on one line", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/display/multiple-operands-concatenate-on-one-line.cbl")
            );

            expect(out.lines).toEqual(["ABC"]);
        });

        test("numeric literal renders as text", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/display/numeric-literal-renders-as-text.cbl")
            );

            expect(out.lines).toEqual(["42"]);
        });

        test("multiple DISPLAY statements produce multiple lines", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/display/multiple-display-statements-produce-multiple-lines.cbl")
            );

            expect(out.lines).toEqual(["ONE", "TWO"]);
        });

        test("WITH NO ADVANCING buffers until next write", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/display/with-no-advancing-buffers-until-next-write.cbl")
            );

            expect(out.lines).toEqual(["A: B"]);
        });

        test("undefined identifier throws CobolRuntimeError", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    loadFixture("interpreter/display/undefined-identifier-throws-cobolruntimeerror.cbl")
                );
            }
            catch(error) { thrown = error; }

            expect(thrown instanceof CobolRuntimeError).toBe(true);
            expect(thrown.message.includes("MISSING")).toBe(true);
        });

        test("identifier operand renders via DataItem.getDisplay", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/display/identifier-operand-renders-via-dataitem-getdisplay.cbl")
            );

            // Padded to PIC width — authentic COBOL behaviour.
            expect(out.lines).toEqual(["HI        "]);
        });

        test("numeric identifier displays formatted by PIC", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/display/numeric-identifier-displays-formatted-by-pic.cbl")
            );

            expect(out.lines).toEqual(["007"]);
        });

        test("group display concatenates children", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/display/group-display-concatenates-children.cbl")
            );

            expect(out.lines).toEqual(["ABCXY"]);
        });
    });

    suite("MOVE", () =>
    {
        test("literal to single target", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/move/literal-to-single-target.cbl")
            );

            expect(out.lines).toEqual(["042"]);
        });

        test("literal to multiple targets", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/move/literal-to-multiple-targets.cbl")
            );

            expect(out.lines).toEqual(["070707"]);
        });

        test("identifier source copies value", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/move/identifier-source-copies-value.cbl")
            );

            expect(out.lines).toEqual(["012"]);
        });

        test("string literal to alphanumeric target", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/move/string-literal-to-alphanumeric-target.cbl")
            );

            expect(out.lines).toEqual(["MATT "]);
        });

        test("MOVE to a group-item target throws CobolRuntimeError", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    loadFixture("interpreter/move/move-to-a-group-item-target-throws-cobolruntimeerror.cbl")
                );
            }
            catch(error) { thrown = error; }

            expect(thrown instanceof CobolRuntimeError).toBe(true);
            expect(thrown.message.includes("RECORD")).toBe(true);
        });
    });

    suite("ACCEPT", () =>
    {
        test("assigns prompted value into target", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/accept/assigns-prompted-value-into-target.cbl"),
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
                    loadFixture("interpreter/accept/non-numeric-input-into-numeric-pic-throws.cbl"),
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
                    loadFixture("interpreter/accept/partial-numeric-input-50-2-into-numeric-pic-throws.cbl"),
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
                    loadFixture("interpreter/accept/empty-input-into-numeric-pic-throws.cbl"),
                    [""]
                );
            }
            catch(error) { thrown = error; }

            expect(thrown instanceof CobolRuntimeError).toBe(true);
        });

        test("signed numeric input is accepted", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/accept/signed-numeric-input-is-accepted.cbl"),
                ["-42"]
            );

            // [0] prompt freeze, [1] DISPLAY output
            expect(out.lines[1]).toBe("-042");
        });

        test("alphanumeric ACCEPT is unaffected by numeric validation", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/accept/alphanumeric-accept-is-unaffected-by-numeric-validation.cbl"),
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
                loadFixture("interpreter/add/in-place-adds-source-to-target.cbl")
            );

            expect(out.lines).toEqual(["015"]);
        });

        test("multi-source TO multi-target", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/add/multi-source-to-multi-target.cbl")
            );

            expect(out.lines).toEqual(["013 023"]);
        });

        test("GIVING replaces target", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/add/giving-replaces-target.cbl")
            );

            expect(out.lines).toEqual(["012"]);
        });

        test("non-numeric alpha source in arithmetic throws", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    loadFixture("interpreter/add/non-numeric-alpha-source-in-arithmetic-throws.cbl")
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
                loadFixture("interpreter/subtract/in-place-subtracts-from-target.cbl")
            );

            expect(out.lines).toEqual(["007"]);
        });

        test("FROM-via-GIVING reads from but does not modify it", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/subtract/from-via-giving-reads-from-but-does-not-modify-it.cbl")
            );

            expect(out.lines).toEqual(["020 005 015"]);
        });

        test("multiple sources sum then subtract", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/subtract/multiple-sources-sum-then-subtract.cbl")
            );

            expect(out.lines).toEqual(["035"]);
        });

        test("in-place applies to multiple targets", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/subtract/in-place-applies-to-multiple-targets.cbl")
            );

            expect(out.lines).toEqual(["025 035"]);
        });
    });

    suite("MULTIPLY", () =>
    {
        test("in-place multiplies target", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/multiply/in-place-multiplies-target.cbl")
            );

            expect(out.lines).toEqual(["020"]);
        });

        test("in-place applies to multiple targets", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/multiply/in-place-applies-to-multiple-targets.cbl")
            );

            expect(out.lines).toEqual(["006 008"]);
        });

        test("GIVING form", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/multiply/giving-form.cbl")
            );

            expect(out.lines).toEqual(["042"]);
        });
    });

    suite("DIVIDE", () =>
    {
        test("INTO in-place: target = target / divisor", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/divide/into-in-place-target-target-divisor.cbl")
            );

            expect(out.lines).toEqual(["004"]);
        });

        test("INTO in-place applies to multiple targets", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/divide/into-in-place-applies-to-multiple-targets.cbl")
            );

            expect(out.lines).toEqual(["006 015"]);
        });

        test("INTO + GIVING: result = dividend / divisor", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/divide/into-giving-result-dividend-divisor.cbl")
            );

            expect(out.lines).toEqual(["005"]);
        });

        test("BY + GIVING: result = dividend / divisor", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/divide/by-giving-result-dividend-divisor.cbl")
            );

            expect(out.lines).toEqual(["003.50"]);
        });

        test("division by zero throws CobolRuntimeError", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    loadFixture("interpreter/divide/division-by-zero-throws-cobolruntimeerror.cbl")
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
                loadFixture("interpreter/compute/simple-arithmetic-expression.cbl")
            );

            expect(out.lines).toEqual(["0014"]);
        });

        test("uses identifier values from working-storage", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/compute/uses-identifier-values-from-working-storage.cbl")
            );

            expect(out.lines).toEqual(["0040"]);
        });

        test("parens override precedence", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/compute/parens-override-precedence.cbl")
            );

            expect(out.lines).toEqual(["020"]);
        });

        test("exponentiation with decimal result", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/compute/exponentiation-with-decimal-result.cbl")
            );

            expect(out.lines).toEqual(["0081.00"]);
        });

        test("undefined identifier in expression throws CobolRuntimeError", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    loadFixture("interpreter/compute/undefined-identifier-in-expression-throws-cobolruntimeerror.cbl")
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
                    loadFixture("interpreter/compute/division-by-zero-in-expression-throws.cbl")
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
                loadFixture("interpreter/if/true-branch-executes.cbl")
            );

            expect(out.lines).toEqual(["ZERO"]);
        });

        test("false branch with no ELSE produces nothing", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/if/false-branch-with-no-else-produces-nothing.cbl")
            );

            expect(out.lines).toEqual(["AFTER"]);
        });

        test("false branch with ELSE executes ELSE body", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/if/false-branch-with-else-executes-else-body.cbl")
            );

            expect(out.lines).toEqual(["NONZERO"]);
        });

        test("AND combinator: both true", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/if/and-combinator-both-true.cbl")
            );

            expect(out.lines).toEqual(["BOTH"]);
        });

        test("AND combinator: one false", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/if/and-combinator-one-false.cbl")
            );

            expect(out.lines).toEqual(["NO"]);
        });

        test("OR combinator", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/if/or-combinator.cbl")
            );

            expect(out.lines).toEqual(["MATCH"]);
        });

        test("NOT prefix inverts truth", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/if/not-prefix-inverts-truth.cbl")
            );

            expect(out.lines).toEqual(["NZ"]);
        });

        test("infix NOT (X NOT = 0) treats as not-equal", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/if/infix-not-x-not-0-treats-as-not-equal.cbl")
            );

            expect(out.lines).toEqual(["NZ"]);
        });

        test("comparison operators: <, >, <=, >=", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/if/comparison-operators.cbl")
            );

            expect(out.lines).toEqual(["LT", "GT", "LE", "GE"]);
        });

        test("nested IF: inner true only when outer also true", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/if/nested-if-inner-true-only-when-outer-also-true.cbl")
            );

            expect(out.lines).toEqual(["BOTH"]);
        });

        test("STOP RUN inside IF body terminates the program", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/if/stop-run-inside-if-body-terminates-the-program.cbl")
            );

            expect(out.lines).toEqual(["BEFORE"]);
        });

        test("expression operands in comparison", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/if/expression-operands-in-comparison.cbl")
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
                loadFixture("interpreter/perform/simple-runs-target-paragraph-once.cbl")
            );

            expect(out.lines).toEqual(["RAN"]);
        });

        test("TIMES runs target N times", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/perform/times-runs-target-n-times.cbl")
            );

            expect(out.lines).toEqual(["RAN", "RAN", "RAN"]);
        });

        test("TIMES with count 0 doesn't run the body", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/perform/times-with-count-0-doesn-t-run-the-body.cbl")
            );

            expect(out.lines).toEqual(["AFTER"]);
        });

        test("UNTIL stops when condition becomes true", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/perform/until-stops-when-condition-becomes-true.cbl")
            );

            expect(out.lines).toEqual(["00", "01", "02"]);
        });

        test("UNTIL with initially-true condition runs zero times", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/perform/until-with-initially-true-condition-runs-zero-times.cbl")
            );

            expect(out.lines).toEqual(["AFTER"]);
        });

        test("VARYING loops with the variable tracked correctly", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/perform/varying-loops-with-the-variable-tracked-correctly.cbl")
            );

            expect(out.lines).toEqual(["01", "02", "03", "04"]);
        });

        test("VARYING with custom step", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/perform/varying-with-custom-step.cbl")
            );

            expect(out.lines).toEqual(["02", "05", "08"]);
        });

        test("VARYING with identifier FROM and BY operands", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/perform/varying-with-identifier-from-and-by-operands.cbl")
            );

            expect(out.lines).toEqual(["04", "06", "08", "10"]);
        });

        test("PERFORM unknown paragraph throws", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    loadFixture("interpreter/perform/perform-unknown-paragraph-throws.cbl")
                );
            }
            catch(error) { thrown = error; }

            expect(thrown instanceof CobolRuntimeError).toBe(true);
            expect(thrown.message.includes("MISSING")).toBe(true);
        });

        test("nested PERFORM (paragraph performs another paragraph)", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/perform/nested-perform-paragraph-performs-another-paragraph.cbl")
            );

            expect(out.lines).toEqual(["OUTER-PRE", "INNER", "OUTER-POST"]);
        });

        test("STOP RUN inside PERFORMed paragraph terminates the program", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/perform/stop-run-inside-performed-paragraph-terminates-the-program.cbl")
            );

            expect(out.lines).toEqual(["BEFORE STOP"]);
        });

        test("fall-through: paragraphs after MAIN run if no STOP RUN", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/perform/fall-through-paragraphs-after-main-run-if-no-stop-run.cbl")
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
                loadFixture("interpreter/stop-run/halts-execution-at-stop-run.cbl")
            );

            expect(out.lines).toEqual(["BEFORE"]);
        });
    });

    suite("GOBACK", () =>
    {
        test("halts execution at GOBACK", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/goback/halts-execution-at-goback.cbl")
            );

            expect(out.lines).toEqual(["BEFORE"]);
        });

        test("GOBACK inside PERFORMed paragraph terminates the program", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/goback/goback-inside-performed-paragraph-terminates-the-program.cbl")
            );

            expect(out.lines).toEqual(["MAIN", "SUB"]);
        });
    });

    suite("EXIT", () =>
    {
        test("bare EXIT is a no-op", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/exit/bare-exit-is-a-no-op.cbl")
            );

            expect(out.lines).toEqual(["BEFORE", "AFTER"]);
        });

        test("PERFORM of an EXIT-only paragraph runs and returns", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/exit/perform-of-an-exit-only-paragraph-runs-and-returns.cbl")
            );

            expect(out.lines).toEqual(["MAIN", "AFTER-PERFORM"]);
        });

        test("EXIT PROGRAM is a no-op in main program", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/exit/exit-program-is-a-no-op-in-main-program.cbl")
            );

            expect(out.lines).toEqual(["BEFORE", "AFTER"]);
        });

        test("EXIT PARAGRAPH skips remaining statements in current paragraph", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/exit/exit-paragraph-skips-remaining-statements-in-current-paragraph.cbl")
            );

            expect(out.lines).toEqual(["MAIN-1", "SUB-1", "MAIN-2"]);
        });

        test("EXIT PARAGRAPH at top level falls through to next paragraph", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/exit/exit-paragraph-at-top-level-falls-through-to-next-paragraph.cbl")
            );

            expect(out.lines).toEqual(["M-1", "NEXT"]);
        });

        test("EXIT PARAGRAPH inside an IF body unwinds the paragraph", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/exit/exit-paragraph-inside-an-if-body-unwinds-the-paragraph.cbl")
            );

            expect(out.lines).toEqual(["M-1", "S-1", "M-2"]);
        });

        test("EXIT PERFORM breaks out of UNTIL loop", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/exit/exit-perform-breaks-out-of-until-loop.cbl")
            );

            expect(out.lines).toEqual(["01", "02", "03", "AFTER"]);
        });

        test("EXIT PERFORM breaks out of TIMES loop", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/exit/exit-perform-breaks-out-of-times-loop.cbl")
            );

            expect(out.lines).toEqual(["01", "02", "AFTER"]);
        });

        test("EXIT PERFORM breaks out of VARYING loop", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/exit/exit-perform-breaks-out-of-varying-loop.cbl")
            );

            expect(out.lines).toEqual(["01", "02", "03", "04", "AFTER"]);
        });

        test("EXIT PERFORM at top level (outside PERFORM) throws runtime error", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    loadFixture("interpreter/exit/exit-perform-at-top-level-outside-perform-throws-runtime-error.cbl")
                );
            }
            catch(error) { thrown = error; }

            expect(thrown instanceof CobolRuntimeError).toBe(true);
            expect(thrown.message.includes("EXIT PERFORM")).toBe(true);
        });
    });

    suite("signed numeric literals", () =>
    {
        test("MOVE -5 stores negative value", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/signed-numeric-literals/move-5-stores-negative-value.cbl")
            );

            expect(out.lines).toEqual(["-005"]);
        });

        test("ADD with negative literal subtracts", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/signed-numeric-literals/add-with-negative-literal-subtracts.cbl")
            );

            expect(out.lines).toEqual(["007"]);
        });

        test("PERFORM VARYING counts down with negative BY step", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/signed-numeric-literals/perform-varying-counts-down-with-negative-by-step.cbl")
            );

            expect(out.lines).toEqual(["03", "02", "01"]);
        });

        test("VALUE -100 initializes with negative", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/signed-numeric-literals/value-100-initializes-with-negative.cbl")
            );

            expect(out.lines).toEqual(["-00100"]);
        });

        test("DISPLAY of bare negative literal", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/signed-numeric-literals/display-of-bare-negative-literal.cbl")
            );

            expect(out.lines).toEqual(["-7"]);
        });
    });

    suite("string conditions", () =>
    {
        test("identifier = literal: trailing-space padding rtrimmed", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/string-conditions/identifier-equals-literal.cbl")
            );

            expect(out.lines).toEqual(["MATCH"]);
        });

        test("identifier != literal takes ELSE branch", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/string-conditions/identifier-not-equal-literal.cbl")
            );

            expect(out.lines).toEqual(["NO"]);
        });

        test("ordering uses lexicographic compare", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/string-conditions/ordering-uses-lexicographic.cbl")
            );

            expect(out.lines).toEqual(["BEFORE-Z", "AFTER-A"]);
        });

        test("UPPER-CASE normalises input before comparing", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/string-conditions/upper-case-normalises-input.cbl")
            );

            expect(out.lines).toEqual(["MATCH"]);
        });

        test("LENGTH of TRIMmed alpha resolves to a number for COMPUTE", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/string-conditions/length-in-numeric-context.cbl")
            );

            expect(out.lines).toEqual(["04"]);
        });

        test("string vs number compare throws CobolRuntimeError", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    loadFixture("interpreter/string-conditions/mixed-type-compare-throws.cbl")
                );
            }
            catch(error) { thrown = error; }

            expect(thrown instanceof CobolRuntimeError).toBe(true);
            expect(thrown.message.includes("cannot compare")).toBe(true);
        });
    });

    suite("FUNCTION as operand", () =>
    {
        test("DISPLAY of FUNCTION UPPER-CASE", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/function-as-operand/display-of-upper-case.cbl")
            );

            expect(out.lines).toEqual(["MATT      "]);
        });

        test("DISPLAY mixes literal and FUNCTION operands on one line", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/function-as-operand/display-mixes-literal-and-function.cbl")
            );

            expect(out.lines).toEqual(["HELLO MATT!"]);
        });

        test("MOVE FUNCTION UPPER-CASE TO target", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/function-as-operand/move-upper-case-to-target.cbl")
            );

            expect(out.lines).toEqual(["MATT      "]);
        });

        test("MOVE FUNCTION INTEGER TO numeric target", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/function-as-operand/move-numeric-function-to-numeric-target.cbl")
            );

            expect(out.lines).toEqual(["007"]);
        });

        test("ADD with FUNCTION MOD as source", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/function-as-operand/add-uses-function-source.cbl")
            );

            expect(out.lines).toEqual(["011"]);
        });

        test("PERFORM ... TIMES with FUNCTION INTEGER count", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/function-as-operand/perform-times-with-function-count.cbl")
            );

            expect(out.lines).toEqual(["WOO", "WOO", "WOO"]);
        });

        test("MOVE string-returning FUNCTION to numeric target throws", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    loadFixture("interpreter/function-as-operand/move-string-function-to-numeric-target-throws.cbl")
                );
            }
            catch(error) { thrown = error; }

            expect(thrown instanceof CobolRuntimeError).toBe(true);
            expect(thrown.message.includes("invalid numeric data")).toBe(true);
        });
    });

    suite("period-less IF bodies", () =>
    {
        test("single DISPLAY without period inside IF body", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/period-less-if-bodies/display-without-period.cbl")
            );

            expect(out.lines).toEqual(["ZERO"]);
        });

        test("multiple statements without periods in THEN body", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/period-less-if-bodies/multiple-statements-without-periods.cbl")
            );

            expect(out.lines).toEqual(["ZERO", "15", "DONE"]);
        });

        test("ELSE branch with period-less statements", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/period-less-if-bodies/else-branch-without-periods.cbl")
            );

            expect(out.lines).toEqual(["NON-ZERO", "MOVING-ON"]);
        });

        test("nested IF inside IF, both period-less", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/period-less-if-bodies/nested-if-without-periods.cbl")
            );

            expect(out.lines).toEqual(["X-ZERO", "Y-BIG", "0"]);
        });

        test("COMPUTE and PERFORM as period-less inner statements", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/period-less-if-bodies/compute-and-perform-without-periods.cbl")
            );

            expect(out.lines).toEqual(["014", "WOO", "WOO"]);
        });

        test("STOP RUN as period-less inner statement halts the program", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/period-less-if-bodies/stop-run-inside-if-without-period.cbl")
            );

            expect(out.lines).toEqual(["BEFORE", "HALTING"]);
        });

        test("mixed period and period-less statements coexist in one body", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/period-less-if-bodies/mixed-period-and-period-less.cbl")
            );

            expect(out.lines).toEqual(["FIRST", "SECOND", "THIRD", "FOURTH"]);
        });
    });

    suite("coverage gaps", () =>
    {
        test("ACCEPT into a numeric PIC with non-numeric input throws CobolRuntimeError", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    loadFixture("interpreter/coverage-gaps/accept-non-numeric-into-numeric.cbl"),
                    ["banana"]
                );
            }
            catch(error) { thrown = error; }

            expect(thrown instanceof CobolRuntimeError).toBe(true);
            expect(thrown.message.includes("invalid numeric data")).toBe(true);
        });

        test("COMPUTE result assigned to an alpha PIC throws CobolRuntimeError", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    loadFixture("interpreter/coverage-gaps/compute-result-into-alpha.cbl")
                );
            }
            catch(error) { thrown = error; }

            expect(thrown instanceof CobolRuntimeError).toBe(true);
        });

        test("Empty PROCEDURE DIVISION runs without error", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/coverage-gaps/empty-procedure-division.cbl")
            );

            expect(out.lines).toEqual([]);
        });

        test("Program with no PROCEDURE DIVISION at all runs without error", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/coverage-gaps/no-procedure-division.cbl")
            );

            expect(out.lines).toEqual([]);
        });

        test("Group DISPLAY concatenates mixed-kind children correctly", async () =>
        {
            const out = await execute(
                loadFixture("interpreter/coverage-gaps/group-display-mixed-children.cbl")
            );

            expect(out.lines).toEqual(["ITEM:042 /1995"]);
        });

        test("Error line number is the line of the failing statement, even deep in nested IF", async () =>
        {
            let thrown = null;

            try
            {
                await execute(
                    loadFixture("interpreter/coverage-gaps/error-line-deep-in-nested-if.cbl")
                );
            }
            catch(error) { thrown = error; }

            expect(thrown instanceof CobolRuntimeError).toBe(true);
            // DIVIDE statement is on line 12 of the fixture.
            expect(thrown.line).toBe(12);
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
