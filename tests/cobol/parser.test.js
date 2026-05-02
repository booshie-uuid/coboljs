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
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. HELLO-WORLD.
                  PROCEDURE DIVISION.`
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
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. .`)
            ).toThrow("expected program name");
        });
    });

    suite("division skipping", () =>
    {
        test("ENVIRONMENT DIVISION is skipped", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. PROG.
                  ENVIRONMENT DIVISION.
                  CONFIGURATION SECTION.
                  PROCEDURE DIVISION.
                      DISPLAY "OK".`
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
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. PROG.
                  DATA DIVISION.
                  FILE SECTION.
                  FD INPUT-FILE.
                  WORKING-STORAGE SECTION.
                  01 X PIC 9(3) VALUE 7.
                  PROCEDURE DIVISION.
                      DISPLAY X.`
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
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 USER-NAME PIC X(20).
                  PROCEDURE DIVISION.
                      DISPLAY "OK".`
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
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 COUNTER PIC 9(3) VALUE 5.
                  PROCEDURE DIVISION.
                      DISPLAY "OK".`
            );

            const item = program.dataItems.get("COUNTER");

            expect(item.getDisplay()).toBe("005");
        });

        test("VALUE with string literal", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 GREETING PIC X(10) VALUE "HI".
                  PROCEDURE DIVISION.
                      DISPLAY "OK".`
            );

            expect(program.dataItems.get("GREETING").getDisplay()).toBe("HI        ");
        });

        test("group / elementary nesting via level numbers", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 STUDENT.
                     05 NAME PIC X(5).
                     05 AGE PIC 9(2).
                  PROCEDURE DIVISION.
                      DISPLAY "OK".`
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
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 GROUP.
                     05 INNER PIC X(3).
                  77 STANDALONE PIC 9(3).
                  PROCEDURE DIVISION.
                      DISPLAY "OK".`
            );

            const standalone = program.dataItems.get("STANDALONE");

            expect(standalone.parent).toBe(null);
        });

        test("PICTURE keyword accepted as alias for PIC", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  DATA DIVISION.
                  WORKING-STORAGE SECTION.
                  01 X PICTURE 9(3).
                  PROCEDURE DIVISION.
                      DISPLAY "OK".`
            );

            expect(program.dataItems.get("X").pic.length).toBe(3);
        });

        test("duplicate name throws syntax error", () =>
        {
            expect(() =>
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        DATA DIVISION.
                        WORKING-STORAGE SECTION.
                        01 X PIC 9(3).
                        01 X PIC X(3).
                        PROCEDURE DIVISION.`)
            ).toThrow(`duplicate data item name "X"`);
        });

        test("unsupported level number throws", () =>
        {
            expect(() =>
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        DATA DIVISION.
                        WORKING-STORAGE SECTION.
                        88 FLAG VALUE 1.
                        PROCEDURE DIVISION.`)
            ).toThrow("unsupported level number 88");
        });
    });

    suite("DISPLAY", () =>
    {
        test("single string literal", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      DISPLAY "HI".`
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
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      DISPLAY "A" "B" 42.`
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
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      DISPLAY USER-NAME.`
            );

            const op = program.paragraphs[0].statements[0].operands[0];

            expect(op.kind).toBe("identifier");
            expect(op.name).toBe("USER-NAME");
        });

        test("WITH NO ADVANCING flag captured", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      DISPLAY "PROMPT: " WITH NO ADVANCING.`
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.noAdvance).toBe(true);
            expect(stmt.operands.length).toBe(1);
            expect(stmt.operands[0].value).toBe("PROMPT: ");
        });

        test("missing terminating period raises end-of-input error", () =>
        {
            expect(() =>
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        PROCEDURE DIVISION.
                            DISPLAY "A"`)
            ).toThrow("unexpected end of input in DISPLAY");
        });
    });

    suite("MOVE", () =>
    {
        test("single source, single target", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      MOVE 5 TO X.`
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
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      MOVE 0 TO A B C.`
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.targets.map(t => t.name)).toEqual(["A", "B", "C"]);
        });

        test("identifier source", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      MOVE SOURCE TO DEST.`
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.source.kind).toBe("identifier");
            expect(stmt.source.name).toBe("SOURCE");
        });

        test("missing TO throws", () =>
        {
            expect(() =>
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        PROCEDURE DIVISION.
                            MOVE 5 X.`)
            ).toThrow(`expected KEYWORD "TO"`);
        });

        test("no targets throws", () =>
        {
            expect(() =>
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        PROCEDURE DIVISION.
                            MOVE 5 TO.`)
            ).toThrow("MOVE requires at least one target");
        });
    });

    suite("ACCEPT", () =>
    {
        test("captures target identifier", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      ACCEPT USER-NAME.`
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.kind).toBe("ACCEPT");
            expect(stmt.target.name).toBe("USER-NAME");
        });

        test("missing identifier throws", () =>
        {
            expect(() =>
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        PROCEDURE DIVISION.
                            ACCEPT.`)
            ).toThrow("expected IDENTIFIER");
        });
    });

    suite("ADD", () =>
    {
        test("in-place: ADD x TO y", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      ADD 1 TO COUNTER.`
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
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      ADD A B TO C D.`
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.sources.map(s => s.name)).toEqual(["A", "B"]);
            expect(stmt.targets.map(t => t.name)).toEqual(["C", "D"]);
        });

        test("GIVING form", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      ADD A B GIVING C.`
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.giving).toBe(true);
            expect(stmt.targets[0].name).toBe("C");
        });

        test("missing TO/GIVING throws", () =>
        {
            expect(() =>
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        PROCEDURE DIVISION.
                            ADD A B C.`)
            ).toThrow("expected TO or GIVING in ADD");
        });

        test("no targets throws", () =>
        {
            expect(() =>
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        PROCEDURE DIVISION.
                            ADD 1 TO.`)
            ).toThrow("ADD requires at least one target");
        });
    });

    suite("SUBTRACT", () =>
    {
        test("in-place: SUBTRACT x FROM y", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      SUBTRACT 1 FROM COUNTER.`
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
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      SUBTRACT A FROM B GIVING C.`
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.giving).toBe(true);
            expect(stmt.from.name).toBe("B");
            expect(stmt.targets[0].name).toBe("C");
        });

        test("FROM literal in in-place form throws", () =>
        {
            expect(() =>
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        PROCEDURE DIVISION.
                            SUBTRACT 5 FROM 10.`)
            ).toThrow("must be an identifier");
        });
    });

    suite("MULTIPLY", () =>
    {
        test("in-place: MULTIPLY x BY y", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      MULTIPLY 2 BY VALUE-FIELD.`
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
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      MULTIPLY A BY B GIVING C.`
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
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        PROCEDURE DIVISION.
                            MULTIPLY 2 X.`)
            ).toThrow(`expected KEYWORD "BY"`);
        });
    });

    suite("DIVIDE", () =>
    {
        test("in-place: DIVIDE divisor INTO target", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      DIVIDE 3 INTO TOTAL.`
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.kind).toBe("DIVIDE");
            expect(stmt.giving).toBe(false);
            expect(stmt.targets[0].name).toBe("TOTAL");
        });

        test("INTO + GIVING", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      DIVIDE A INTO B GIVING C.`
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.giving).toBe(true);
            expect(stmt.divisor.name).toBe("A");
            expect(stmt.dividend.name).toBe("B");
        });

        test("BY + GIVING", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      DIVIDE A BY B GIVING C.`
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.giving).toBe(true);
            expect(stmt.dividend.name).toBe("A");
            expect(stmt.divisor.name).toBe("B");
        });

        test("BY without GIVING throws", () =>
        {
            expect(() =>
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        PROCEDURE DIVISION.
                            DIVIDE A BY B.`)
            ).toThrow("DIVIDE BY requires GIVING");
        });

        test("missing direction throws", () =>
        {
            expect(() =>
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        PROCEDURE DIVISION.
                            DIVIDE A B GIVING C.`)
            ).toThrow("expected INTO or BY");
        });
    });

    suite("COMPUTE", () =>
    {
        test("captures target and expression tokens", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      COMPUTE Y = X + 1.`
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
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        PROCEDURE DIVISION.
                            COMPUTE Y X + 1.`)
            ).toThrow(`expected "=" in COMPUTE`);
        });

        test("empty expression throws", () =>
        {
            expect(() =>
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        PROCEDURE DIVISION.
                            COMPUTE Y = .`)
            ).toThrow("COMPUTE requires an expression");
        });

        test("missing terminating period throws", () =>
        {
            expect(() =>
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        PROCEDURE DIVISION.
                            COMPUTE Y = X + 1`)
            ).toThrow("unexpected end of input in COMPUTE");
        });
    });

    suite("IF / conditions", () =>
    {
        test("simple compare with optional THEN", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      IF X = 0 THEN
                          DISPLAY "Z".
                      END-IF.`
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
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      IF X = 0
                          DISPLAY "Z".
                      END-IF.`
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.kind).toBe("IF");
            expect(stmt.thenBody.length).toBe(1);
        });

        test("ELSE branch captured", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      IF X = 0 THEN
                          DISPLAY "Z".
                      ELSE
                          DISPLAY "NZ".
                      END-IF.`
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.thenBody.length).toBe(1);
            expect(stmt.elseBody.length).toBe(1);
            expect(stmt.elseBody[0].operands[0].value).toBe("NZ");
        });

        test("AND combinator builds logical node", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      IF X = 0 AND Y = 0 THEN
                          DISPLAY "BOTH".
                      END-IF.`
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
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      IF X = 1 OR X = 2 THEN
                          DISPLAY "OK".
                      END-IF.`
            );

            const cond = program.paragraphs[0].statements[0].condition;

            expect(cond.kind).toBe("logical");
            expect(cond.op).toBe("OR");
        });

        test("NOT prefix wraps in not node", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      IF NOT X = 0 THEN
                          DISPLAY "NZ".
                      END-IF.`
            );

            const cond = program.paragraphs[0].statements[0].condition;

            expect(cond.kind).toBe("not");
            expect(cond.operand.kind).toBe("compare");
        });

        test("infix NOT (X NOT = 0) wraps the comparison", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      IF X NOT = 0 THEN
                          DISPLAY "NZ".
                      END-IF.`
            );

            const cond = program.paragraphs[0].statements[0].condition;

            expect(cond.kind).toBe("not");
            expect(cond.operand.kind).toBe("compare");
            expect(cond.operand.op).toBe("=");
        });

        test("paren expression in comparison: (X + 1) > Y", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      IF (X + 1) > Y THEN
                          DISPLAY "OK".
                      END-IF.`
            );

            const cond = program.paragraphs[0].statements[0].condition;

            expect(cond.kind).toBe("compare");
            expect(cond.op).toBe(">");
        });

        test("paren-condition: (X = 1) AND (Y = 2)", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      IF (X = 1) AND (Y = 2) THEN
                          DISPLAY "OK".
                      END-IF.`
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
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      IF X = 0 THEN
                          IF Y = 0 THEN
                              DISPLAY "BOTH".
                          END-IF
                      END-IF.`
            );

            const outer = program.paragraphs[0].statements[0];

            expect(outer.kind).toBe("IF");
            expect(outer.thenBody.length).toBe(1);
            expect(outer.thenBody[0].kind).toBe("IF");
        });

        test("missing END-IF throws", () =>
        {
            expect(() =>
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        PROCEDURE DIVISION.
                            IF X = 0 THEN
                                DISPLAY "Z".`)
            ).toThrow("unexpected end of input in IF body");
        });

        test("missing comparison operator throws", () =>
        {
            expect(() =>
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        PROCEDURE DIVISION.
                            IF X AND Y THEN
                                DISPLAY "Z".
                            END-IF.`)
            ).toThrow("expected comparison operator");
        });
    });

    suite("paragraphs / PERFORM", () =>
    {
        test("paragraph header creates a new paragraph", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                  MAIN.
                      DISPLAY "A".`
            );

            // paragraphs[0] is the anonymous default; MAIN is appended.
            expect(program.paragraphs.length).toBe(2);
            expect(program.paragraphs[1].name).toBe("MAIN");
            expect(program.paragraphs[1].statements.length).toBe(1);
        });

        test("statements before any header land in the anonymous paragraph", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      DISPLAY "A".
                  LATER.
                      DISPLAY "B".`
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
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        PROCEDURE DIVISION.
                        MAIN.
                            DISPLAY "A".
                        MAIN.
                            DISPLAY "B".`)
            ).toThrow(`duplicate paragraph name "MAIN"`);
        });

        test("PERFORM SIMPLE captures target", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                  MAIN.
                      PERFORM SUB.
                  SUB.
                      DISPLAY "S".`
            );

            const stmt = program.paragraphs[1].statements[0];

            expect(stmt.kind).toBe("PERFORM");
            expect(stmt.form).toBe("SIMPLE");
            expect(stmt.target).toBe("SUB");
        });

        test("PERFORM TIMES with literal count", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                  MAIN.
                      PERFORM SUB 5 TIMES.
                  SUB.
                      DISPLAY "S".`
            );

            const stmt = program.paragraphs[1].statements[0];

            expect(stmt.form).toBe("TIMES");
            expect(stmt.count.kind).toBe("literal");
            expect(stmt.count.value).toBe("5");
        });

        test("PERFORM UNTIL captures condition", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                  MAIN.
                      PERFORM SUB UNTIL X = 0.
                  SUB.
                      DISPLAY "S".`
            );

            const stmt = program.paragraphs[1].statements[0];

            expect(stmt.form).toBe("UNTIL");
            expect(stmt.condition.kind).toBe("compare");
        });

        test("PERFORM VARYING captures all parts", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                  MAIN.
                      PERFORM SUB VARYING I FROM 1 BY 1 UNTIL I > 5.
                  SUB.
                      DISPLAY "S".`
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
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        PROCEDURE DIVISION.
                        MAIN.
                            PERFORM SUB TIMES.
                        SUB.
                            DISPLAY "S".`)
            ).toThrow("expected operand");
        });
    });

    suite("STOP RUN", () =>
    {
        test("parsed as STOP_RUN statement", () =>
        {
            const program = parse(
                ` IDENTIFICATION DIVISION.
                  PROGRAM-ID. P.
                  PROCEDURE DIVISION.
                      STOP RUN.`
            );

            const stmt = program.paragraphs[0].statements[0];

            expect(stmt.kind).toBe("STOP_RUN");
        });

        test("STOP without RUN throws syntax error", () =>
        {
            expect(() =>
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        PROCEDURE DIVISION.
                            STOP.`)
            ).toThrow(`expected KEYWORD "RUN"`);
        });
    });

    suite("statement errors", () =>
    {
        test("unsupported statement keyword reports clearly", () =>
        {
            expect(() =>
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        PROCEDURE DIVISION.
                            GOBACK.`)
            ).toThrow(`unsupported statement "GOBACK"`);
        });

        test("non-keyword at statement start reports clearly", () =>
        {
            expect(() =>
                parse(` IDENTIFICATION DIVISION.
                        PROGRAM-ID. P.
                        PROCEDURE DIVISION.
                            123.`)
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
