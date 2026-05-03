import { suite, test, expect, loadFixture } from "../runner.js";
import { Lexer } from "../../scripts/modules/cobol/lexer.js";
import { Parser } from "../../scripts/modules/cobol/parser.js";


function parse(source)
{
    return new Parser().parse(new Lexer().tokenize(source));
}


suite("Parser", () =>
{
    suite("identification division", () =>
    {
        test("captures program-id from identifier", () =>
        {
            const program = parse(
                loadFixture("parser/identification-division/captures-program-id-from-identifier.cbl")
            );

            expect(program.programId).toBe("HELLO-WORLD");
        });

        test("missing IDENTIFICATION throws syntax error", () =>
        {
            expect(() => parse(" PROCEDURE DIVISION.")).toThrow(`expected KEYWORD "IDENTIFICATION"`);
        });

        test("missing PROGRAM-ID name throws syntax error", () =>
        {
            expect(() =>
                parse(loadFixture("parser/identification-division/missing-program-id-name-throws-syntax-error.cbl"))
            ).toThrow("expected program name");
        });
    });

    suite("division skipping", () =>
    {
        test("ENVIRONMENT DIVISION is skipped", () =>
        {
            const program = parse(
                loadFixture("parser/division-skipping/environment-division-is-skipped.cbl")
            );

            expect(program.programId).toBe("PROG");
            expect(program.paragraphs[0].statements.length).toBe(1);
        });

        test("non-WORKING-STORAGE sections inside DATA DIVISION are skipped", () =>
        {
            // FILE SECTION comes before WORKING-STORAGE here. The parser
            // should consume FILE-SECTION tokens until WORKING-STORAGE
            // appears and pick up parsing there.
            const program = parse(
                loadFixture("parser/division-skipping/non-working-storage-sections-inside-data-division-are-skipped.cbl")
            );

            expect(program.dataItems.has("X")).toBe(true);
            expect(program.dataItems.get("X").getDisplay()).toBe("007");
        });
    });

    suite("WORKING-STORAGE", () =>
    {
        test("elementary item with PIC registers in dataItems", () =>
        {
            const program = parse(
                loadFixture("parser/working-storage/elementary-item-with-pic-registers-in-dataitems.cbl")
            );

            const item = program.dataItems.get("USER-NAME");

            expect(item !== undefined).toBe(true);
            expect(item.level).toBe(1);
            expect(item.name).toBe("USER-NAME");
            expect(item.pic.kind).toBe("alphanumeric");
            expect(item.pic.length).toBe(20);
        });

        test("VALUE clause initialises the field", () =>
        {
            const program = parse(
                loadFixture("parser/working-storage/value-clause-initialises-the-field.cbl")
            );

            const item = program.dataItems.get("COUNTER");

            expect(item.getDisplay()).toBe("005");
        });

        test("VALUE with string literal", () =>
        {
            const program = parse(
                loadFixture("parser/working-storage/value-with-string-literal.cbl")
            );

            expect(program.dataItems.get("GREETING").getDisplay()).toBe("HI        ");
        });

        test("group / elementary nesting via level numbers", () =>
        {
            const program = parse(
                loadFixture("parser/working-storage/group-elementary-nesting-via-level-numbers.cbl")
            );

            const student = program.dataItems.get("STUDENT");
            const name = program.dataItems.get("NAME");
            const age = program.dataItems.get("AGE");

            expect(student.isGroup()).toBe(true);
            expect(student.children.length).toBe(2);
            expect(name.parent).toBe(student);
            expect(age.parent).toBe(student);
        });

        test("level 77 is always top-level", () =>
        {
            const program = parse(
                loadFixture("parser/working-storage/level-77-is-always-top-level.cbl")
            );

            const standalone = program.dataItems.get("STANDALONE");

            expect(standalone.parent).toBe(null);
        });

        test("PICTURE keyword accepted as alias for PIC", () =>
        {
            const program = parse(
                loadFixture("parser/working-storage/picture-keyword-accepted-as-alias-for-pic.cbl")
            );

            expect(program.dataItems.get("X").pic.length).toBe(3);
        });

        test("duplicate name throws syntax error", () =>
        {
            expect(() =>
                parse(loadFixture("parser/working-storage/duplicate-name-throws-syntax-error.cbl"))
            ).toThrow(`duplicate data item name "X"`);
        });

        test("unsupported level number throws", () =>
        {
            expect(() =>
                parse(loadFixture("parser/working-storage/unsupported-level-number-throws.cbl"))
            ).toThrow("unsupported level number 88");
        });
    });

    suite("DISPLAY", () =>
    {
        test("single string literal", () =>
        {
            const program = parse(
                loadFixture("parser/display/single-string-literal.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.kind).toBe("DISPLAY");
            expect(stmt.noAdvance).toBe(false);
            expect(stmt.operands.length).toBe(1);
            expect(stmt.operands[0].kind).toBe("literal");
            expect(stmt.operands[0].literalType).toBe("string");
            expect(stmt.operands[0].value).toBe("HI");
        });

        test("multiple operands collected in order", () =>
        {
            const program = parse(
                loadFixture("parser/display/multiple-operands-collected-in-order.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.operands.length).toBe(3);
            expect(stmt.operands[0].value).toBe("A");
            expect(stmt.operands[1].value).toBe("B");
            expect(stmt.operands[2].literalType).toBe("number");
            expect(stmt.operands[2].value).toBe("42");
        });

        test("identifier operand recorded as identifier kind", () =>
        {
            const program = parse(
                loadFixture("parser/display/identifier-operand-recorded-as-identifier-kind.cbl")
            );

            const op = program.paragraphs[0].statements[0].operands[0];

            expect(op.kind).toBe("identifier");
            expect(op.name).toBe("USER-NAME");
        });

        test("WITH NO ADVANCING flag captured", () =>
        {
            const program = parse(
                loadFixture("parser/display/with-no-advancing-flag-captured.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.noAdvance).toBe(true);
            expect(stmt.operands.length).toBe(1);
            expect(stmt.operands[0].value).toBe("PROMPT: ");
        });

        test("missing terminating period raises end-of-input error", () =>
        {
            expect(() =>
                parse(loadFixture("parser/display/missing-terminating-period-raises-end-of-input-error.cbl"))
            ).toThrow("unexpected end of input in DISPLAY");
        });
    });

    suite("MOVE", () =>
    {
        test("single source, single target", () =>
        {
            const program = parse(
                loadFixture("parser/move/single-source-single-target.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.kind).toBe("MOVE");
            expect(stmt.source.kind).toBe("literal");
            expect(stmt.source.value).toBe("5");
            expect(stmt.targets.length).toBe(1);
            expect(stmt.targets[0].name).toBe("X");
        });

        test("multiple targets", () =>
        {
            const program = parse(
                loadFixture("parser/move/multiple-targets.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.targets.map(t => t.name)).toEqual(["A", "B", "C"]);
        });

        test("identifier source", () =>
        {
            const program = parse(
                loadFixture("parser/move/identifier-source.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.source.kind).toBe("identifier");
            expect(stmt.source.name).toBe("SOURCE");
        });

        test("missing TO throws", () =>
        {
            expect(() =>
                parse(loadFixture("parser/move/missing-to-throws.cbl"))
            ).toThrow(`expected KEYWORD "TO"`);
        });

        test("no targets throws", () =>
        {
            expect(() =>
                parse(loadFixture("parser/move/no-targets-throws.cbl"))
            ).toThrow("MOVE requires at least one target");
        });
    });

    suite("ACCEPT", () =>
    {
        test("captures target identifier", () =>
        {
            const program = parse(
                loadFixture("parser/accept/captures-target-identifier.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.kind).toBe("ACCEPT");
            expect(stmt.target.name).toBe("USER-NAME");
        });

        test("missing identifier throws", () =>
        {
            expect(() =>
                parse(loadFixture("parser/accept/missing-identifier-throws.cbl"))
            ).toThrow("expected IDENTIFIER");
        });
    });

    suite("ADD", () =>
    {
        test("in-place: ADD x TO y", () =>
        {
            const program = parse(
                loadFixture("parser/add/in-place-add-x-to-y.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.kind).toBe("ADD");
            expect(stmt.giving).toBe(false);
            expect(stmt.sources.length).toBe(1);
            expect(stmt.targets.length).toBe(1);
            expect(stmt.targets[0].name).toBe("COUNTER");
        });

        test("multi-source TO multi-target", () =>
        {
            const program = parse(
                loadFixture("parser/add/multi-source-to-multi-target.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.sources.map(s => s.name)).toEqual(["A", "B"]);
            expect(stmt.targets.map(t => t.name)).toEqual(["C", "D"]);
        });

        test("GIVING form", () =>
        {
            const program = parse(
                loadFixture("parser/add/giving-form.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.giving).toBe(true);
            expect(stmt.targets[0].name).toBe("C");
        });

        test("missing TO/GIVING throws", () =>
        {
            expect(() =>
                parse(loadFixture("parser/add/missing-to-giving-throws.cbl"))
            ).toThrow("expected TO or GIVING in ADD");
        });

        test("no targets throws", () =>
        {
            expect(() =>
                parse(loadFixture("parser/add/no-targets-throws.cbl"))
            ).toThrow("ADD requires at least one target");
        });
    });

    suite("SUBTRACT", () =>
    {
        test("in-place: SUBTRACT x FROM y", () =>
        {
            const program = parse(
                loadFixture("parser/subtract/in-place-subtract-x-from-y.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.kind).toBe("SUBTRACT");
            expect(stmt.giving).toBe(false);
            expect(stmt.from).toBe(null);
            expect(stmt.targets[0].name).toBe("COUNTER");
        });

        test("FROM-via-GIVING form", () =>
        {
            const program = parse(
                loadFixture("parser/subtract/from-via-giving-form.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.giving).toBe(true);
            expect(stmt.from.name).toBe("B");
            expect(stmt.targets[0].name).toBe("C");
        });

        test("FROM literal in in-place form throws", () =>
        {
            expect(() =>
                parse(loadFixture("parser/subtract/from-literal-in-in-place-form-throws.cbl"))
            ).toThrow("must be an identifier");
        });
    });

    suite("MULTIPLY", () =>
    {
        test("in-place: MULTIPLY x BY y", () =>
        {
            const program = parse(
                loadFixture("parser/multiply/in-place-multiply-x-by-y.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.kind).toBe("MULTIPLY");
            expect(stmt.giving).toBe(false);
            expect(stmt.multiplicand).toBe(null);
            expect(stmt.targets[0].name).toBe("VALUE-FIELD");
        });

        test("GIVING form", () =>
        {
            const program = parse(
                loadFixture("parser/multiply/giving-form.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.giving).toBe(true);
            expect(stmt.multiplier.name).toBe("A");
            expect(stmt.multiplicand.name).toBe("B");
            expect(stmt.targets[0].name).toBe("C");
        });

        test("missing BY throws", () =>
        {
            expect(() =>
                parse(loadFixture("parser/multiply/missing-by-throws.cbl"))
            ).toThrow(`expected KEYWORD "BY"`);
        });
    });

    suite("DIVIDE", () =>
    {
        test("in-place: DIVIDE divisor INTO target", () =>
        {
            const program = parse(
                loadFixture("parser/divide/in-place-divide-divisor-into-target.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.kind).toBe("DIVIDE");
            expect(stmt.giving).toBe(false);
            expect(stmt.targets[0].name).toBe("TOTAL");
        });

        test("INTO + GIVING", () =>
        {
            const program = parse(
                loadFixture("parser/divide/into-giving.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.giving).toBe(true);
            expect(stmt.divisor.name).toBe("A");
            expect(stmt.dividend.name).toBe("B");
        });

        test("BY + GIVING", () =>
        {
            const program = parse(
                loadFixture("parser/divide/by-giving.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.giving).toBe(true);
            expect(stmt.dividend.name).toBe("A");
            expect(stmt.divisor.name).toBe("B");
        });

        test("BY without GIVING throws", () =>
        {
            expect(() =>
                parse(loadFixture("parser/divide/by-without-giving-throws.cbl"))
            ).toThrow("DIVIDE BY requires GIVING");
        });

        test("missing direction throws", () =>
        {
            expect(() =>
                parse(loadFixture("parser/divide/missing-direction-throws.cbl"))
            ).toThrow("expected INTO or BY");
        });
    });

    suite("COMPUTE", () =>
    {
        test("captures target and expression tokens", () =>
        {
            const program = parse(
                loadFixture("parser/compute/captures-target-and-expression-tokens.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.kind).toBe("COMPUTE");
            expect(stmt.target.name).toBe("Y");
            // Three expression tokens: X, +, 1
            expect(stmt.expressionTokens.length).toBe(3);
            expect(stmt.expressionTokens[0].value).toBe("X");
            expect(stmt.expressionTokens[1].value).toBe("+");
            expect(stmt.expressionTokens[2].value).toBe("1");
        });

        test("missing = throws", () =>
        {
            expect(() =>
                parse(loadFixture("parser/compute/missing-throws.cbl"))
            ).toThrow(`expected "=" in COMPUTE`);
        });

        test("empty expression throws", () =>
        {
            expect(() =>
                parse(loadFixture("parser/compute/empty-expression-throws.cbl"))
            ).toThrow("COMPUTE requires an expression");
        });

        test("missing terminating period throws", () =>
        {
            expect(() =>
                parse(loadFixture("parser/compute/missing-terminating-period-throws.cbl"))
            ).toThrow("unexpected end of input in COMPUTE");
        });
    });

    suite("IF / conditions", () =>
    {
        test("simple compare with optional THEN", () =>
        {
            const program = parse(
                loadFixture("parser/if-conditions/simple-compare-with-optional-then.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.kind).toBe("IF");
            expect(stmt.condition.kind).toBe("compare");
            expect(stmt.condition.op).toBe("=");
            expect(stmt.thenBody.length).toBe(1);
            expect(stmt.elseBody.length).toBe(0);
        });

        test("THEN keyword is optional", () =>
        {
            const program = parse(
                loadFixture("parser/if-conditions/then-keyword-is-optional.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.kind).toBe("IF");
            expect(stmt.thenBody.length).toBe(1);
        });

        test("ELSE branch captured", () =>
        {
            const program = parse(
                loadFixture("parser/if-conditions/else-branch-captured.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.thenBody.length).toBe(1);
            expect(stmt.elseBody.length).toBe(1);
            expect(stmt.elseBody[0].operands[0].value).toBe("NZ");
        });

        test("AND combinator builds logical node", () =>
        {
            const program = parse(
                loadFixture("parser/if-conditions/and-combinator-builds-logical-node.cbl")
            );

            const cond = program.paragraphs[0].statements[0].condition;

            expect(cond.kind).toBe("logical");
            expect(cond.op).toBe("AND");
            expect(cond.left.kind).toBe("compare");
            expect(cond.right.kind).toBe("compare");
        });

        test("OR combinator builds logical node", () =>
        {
            const program = parse(
                loadFixture("parser/if-conditions/or-combinator-builds-logical-node.cbl")
            );

            const cond = program.paragraphs[0].statements[0].condition;

            expect(cond.kind).toBe("logical");
            expect(cond.op).toBe("OR");
        });

        test("NOT prefix wraps in not node", () =>
        {
            const program = parse(
                loadFixture("parser/if-conditions/not-prefix-wraps-in-not-node.cbl")
            );

            const cond = program.paragraphs[0].statements[0].condition;

            expect(cond.kind).toBe("not");
            expect(cond.operand.kind).toBe("compare");
        });

        test("infix NOT (X NOT = 0) wraps the comparison", () =>
        {
            const program = parse(
                loadFixture("parser/if-conditions/infix-not-x-not-0-wraps-the-comparison.cbl")
            );

            const cond = program.paragraphs[0].statements[0].condition;

            expect(cond.kind).toBe("not");
            expect(cond.operand.kind).toBe("compare");
            expect(cond.operand.op).toBe("=");
        });

        test("paren expression in comparison: (X + 1) > Y", () =>
        {
            const program = parse(
                loadFixture("parser/if-conditions/paren-expression-in-comparison-x-1-y.cbl")
            );

            const cond = program.paragraphs[0].statements[0].condition;

            expect(cond.kind).toBe("compare");
            expect(cond.op).toBe(">");
        });

        test("paren-condition: (X = 1) AND (Y = 2)", () =>
        {
            const program = parse(
                loadFixture("parser/if-conditions/paren-condition-x-1-and-y-2.cbl")
            );

            const cond = program.paragraphs[0].statements[0].condition;

            expect(cond.kind).toBe("logical");
            expect(cond.op).toBe("AND");
            expect(cond.left.kind).toBe("compare");
            expect(cond.right.kind).toBe("compare");
        });

        test("nested IF inside IF", () =>
        {
            const program = parse(
                loadFixture("parser/if-conditions/nested-if-inside-if.cbl")
            );

            const outer = program.paragraphs[0].statements[0];

            expect(outer.kind).toBe("IF");
            expect(outer.thenBody.length).toBe(1);
            expect(outer.thenBody[0].kind).toBe("IF");
        });

        test("missing END-IF throws", () =>
        {
            expect(() =>
                parse(loadFixture("parser/if-conditions/missing-end-if-throws.cbl"))
            ).toThrow("unexpected end of input in IF body");
        });

        test("missing comparison operator throws", () =>
        {
            expect(() =>
                parse(loadFixture("parser/if-conditions/missing-comparison-operator-throws.cbl"))
            ).toThrow("expected comparison operator");
        });
    });

    suite("paragraphs / PERFORM", () =>
    {
        test("paragraph header creates a new paragraph", () =>
        {
            const program = parse(
                loadFixture("parser/paragraphs-perform/paragraph-header-creates-a-new-paragraph.cbl")
            );

            // paragraphs[0] is the anonymous default; MAIN is appended.
            expect(program.paragraphs.length).toBe(2);
            expect(program.paragraphs[1].name).toBe("MAIN");
            expect(program.paragraphs[1].statements.length).toBe(1);
        });

        test("statements before any header land in the anonymous paragraph", () =>
        {
            const program = parse(
                loadFixture("parser/paragraphs-perform/statements-before-any-header-land-in-the-anonymous-paragraph.cbl")
            );

            expect(program.paragraphs.length).toBe(2);
            expect(program.paragraphs[0].name).toBe(null);
            expect(program.paragraphs[0].statements.length).toBe(1);
            expect(program.paragraphs[1].name).toBe("LATER");
            expect(program.paragraphs[1].statements.length).toBe(1);
        });

        test("duplicate paragraph name throws", () =>
        {
            expect(() =>
                parse(loadFixture("parser/paragraphs-perform/duplicate-paragraph-name-throws.cbl"))
            ).toThrow(`duplicate paragraph name "MAIN"`);
        });

        test("PERFORM SIMPLE captures target", () =>
        {
            const program = parse(
                loadFixture("parser/paragraphs-perform/perform-simple-captures-target.cbl")
            );

            const stmt = program.paragraphs[1].statements[0];

            expect(stmt.kind).toBe("PERFORM");
            expect(stmt.form).toBe("SIMPLE");
            expect(stmt.target).toBe("SUB");
        });

        test("PERFORM TIMES with literal count", () =>
        {
            const program = parse(
                loadFixture("parser/paragraphs-perform/perform-times-with-literal-count.cbl")
            );

            const stmt = program.paragraphs[1].statements[0];

            expect(stmt.form).toBe("TIMES");
            expect(stmt.count.kind).toBe("literal");
            expect(stmt.count.value).toBe("5");
        });

        test("PERFORM UNTIL captures condition", () =>
        {
            const program = parse(
                loadFixture("parser/paragraphs-perform/perform-until-captures-condition.cbl")
            );

            const stmt = program.paragraphs[1].statements[0];

            expect(stmt.form).toBe("UNTIL");
            expect(stmt.condition.kind).toBe("compare");
        });

        test("PERFORM VARYING captures all parts", () =>
        {
            const program = parse(
                loadFixture("parser/paragraphs-perform/perform-varying-captures-all-parts.cbl")
            );

            const stmt = program.paragraphs[1].statements[0];

            expect(stmt.form).toBe("VARYING");
            expect(stmt.varName).toBe("I");
            expect(stmt.from.value).toBe("1");
            expect(stmt.by.value).toBe("1");
            expect(stmt.condition.kind).toBe("compare");
        });

        test("PERFORM with TIMES but no count throws", () =>
        {
            expect(() =>
                parse(loadFixture("parser/paragraphs-perform/perform-with-times-but-no-count-throws.cbl"))
            ).toThrow("expected operand");
        });
    });

    suite("STOP RUN", () =>
    {
        test("parsed as STOP_RUN statement", () =>
        {
            const program = parse(
                loadFixture("parser/stop-run/parsed-as-stop-run-statement.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.kind).toBe("STOP_RUN");
        });

        test("STOP without RUN throws syntax error", () =>
        {
            expect(() =>
                parse(loadFixture("parser/stop-run/stop-without-run-throws-syntax-error.cbl"))
            ).toThrow(`expected KEYWORD "RUN"`);
        });
    });

    suite("GOBACK", () =>
    {
        test("parsed as GOBACK statement", () =>
        {
            const program = parse(
                loadFixture("parser/goback/parsed-as-goback-statement.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.kind).toBe("GOBACK");
        });

        test("GOBACK without trailing period throws syntax error", () =>
        {
            expect(() =>
                parse(loadFixture("parser/goback/goback-without-trailing-period-throws-syntax-error.cbl"))
            ).toThrow(`expected PERIOD`);
        });
    });

    suite("EXIT", () =>
    {
        test("bare EXIT parses as form PLAIN", () =>
        {
            const program = parse(
                loadFixture("parser/exit/bare-exit-parses-as-form-plain.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.kind).toBe("EXIT");
            expect(stmt.form).toBe("PLAIN");
        });

        test("EXIT PARAGRAPH parses as form PARAGRAPH", () =>
        {
            const program = parse(
                loadFixture("parser/exit/exit-paragraph-parses-as-form-paragraph.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.kind).toBe("EXIT");
            expect(stmt.form).toBe("PARAGRAPH");
        });

        test("EXIT PROGRAM parses as form PROGRAM", () =>
        {
            const program = parse(
                loadFixture("parser/exit/exit-program-parses-as-form-program.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.kind).toBe("EXIT");
            expect(stmt.form).toBe("PROGRAM");
        });

        test("EXIT PERFORM parses as form PERFORM", () =>
        {
            const program = parse(
                loadFixture("parser/exit/exit-perform-parses-as-form-perform.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.kind).toBe("EXIT");
            expect(stmt.form).toBe("PERFORM");
        });
    });

    suite("signed numeric literals", () =>
    {
        test("DISPLAY accepts negative literal", () =>
        {
            const program = parse(
                loadFixture("parser/signed-numeric-literals/display-accepts-negative-literal.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];
            const operand = stmt.operands[0];

            expect(operand.kind).toBe("literal");
            expect(operand.literalType).toBe("number");
            expect(operand.value).toBe("-5");
        });

        test("MOVE source accepts +5 (explicit positive)", () =>
        {
            const program = parse(
                loadFixture("parser/signed-numeric-literals/move-source-accepts-5-explicit-positive.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.source.value).toBe("5");
        });

        test("PERFORM VARYING accepts negative BY step", () =>
        {
            const program = parse(
                loadFixture("parser/signed-numeric-literals/perform-varying-accepts-negative-by-step.cbl")
            );

            const stmt = program.paragraphs[1].statements[0];

            expect(stmt.form).toBe("VARYING");
            expect(stmt.from.value).toBe("3");
            expect(stmt.by.value).toBe("-1");
        });

        test("VALUE clause accepts negative literal", () =>
        {
            const program = parse(
                loadFixture("parser/signed-numeric-literals/value-clause-accepts-negative-literal.cbl")
            );

            const item = program.dataItems.get("BALANCE");

            expect(item.value).toBe(-100);
        });

        test("ADD with bare negative literal as one of the sources", () =>
        {
            const program = parse(
                loadFixture("parser/signed-numeric-literals/add-with-bare-negative-literal-as-one-of-the-sources.cbl")
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.sources.length).toBe(1);
            expect(stmt.sources[0].value).toBe("-3");
        });
    });

    suite("statement errors", () =>
    {
        test("unsupported statement keyword reports clearly", () =>
        {
            expect(() =>
                parse(loadFixture("parser/statement-errors/unsupported-statement-keyword-reports-clearly.cbl"))
            ).toThrow(`unsupported statement "ZERO"`);
        });

        test("non-keyword at statement start reports clearly", () =>
        {
            expect(() =>
                parse(loadFixture("parser/statement-errors/non-keyword-at-statement-start-reports-clearly.cbl"))
            ).toThrow("expected statement");
        });
    });

    suite("integration", () =>
    {
        test("HELLO-WORLD fixture parses cleanly", () =>
        {
            const program = parse(loadFixture("hello-world.cbl"));

            expect(program.programId).toBe("HELLO-WORLD");
            expect(program.paragraphs.length).toBe(1);

            const statements = program.paragraphs[0].statements;

            expect(statements.length).toBe(2);
            expect(statements[0].kind).toBe("DISPLAY");
            expect(statements[0].operands[0].value).toBe("HELLO, WORLD!");
            expect(statements[1].kind).toBe("STOP_RUN");
        });
    });
});
