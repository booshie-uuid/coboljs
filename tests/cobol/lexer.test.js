import { suite, test, expect, loadFixture } from "../runner.js";
import { Lexer } from "../../scripts/modules/cobol/lexer.js";


function lex(source)
{
    return new Lexer().tokenize(source).filter(t => t.type !== "EOF");
}


suite("Lexer", () =>
{
    suite("basics", () =>
    {
        test("empty source produces only EOF", () =>
        {
            const tokens = new Lexer().tokenize("");

            expect(tokens.length).toBe(1);
            expect(tokens[0].type).toBe("EOF");
        });

        test("whitespace-only source produces only EOF", () =>
        {
            const tokens = new Lexer().tokenize("   \n  \t  \n");

            expect(tokens.length).toBe(1);
            expect(tokens[0].type).toBe("EOF");
        });

        test("period is its own token", () =>
        {
            const tokens = lex(".");

            expect(tokens).toEqual([{ type: "PERIOD", value: ".", line: 1 }]);
        });
    });

    suite("identifiers and keywords", () =>
    {
        test("plain identifier is uppercased", () =>
        {
            const tokens = lex("MyVar");

            expect(tokens).toEqual([{ type: "IDENTIFIER", value: "MYVAR", line: 1 }]);
        });

        test("identifier with hyphen", () =>
        {
            const tokens = lex("USER-NAME");

            expect(tokens).toEqual([{ type: "IDENTIFIER", value: "USER-NAME", line: 1 }]);
        });

        test("reserved word becomes KEYWORD", () =>
        {
            const tokens = lex("DISPLAY");

            expect(tokens).toEqual([{ type: "KEYWORD", value: "DISPLAY", line: 1 }]);
        });

        test("keyword matching is case-insensitive", () =>
        {
            const tokens = lex("display Display DISPLAY");

            expect(tokens.length).toBe(3);
            for(const t of tokens) { expect(t.type).toBe("KEYWORD"); expect(t.value).toBe("DISPLAY"); }
        });

        test("multi-word keyword PROGRAM-ID", () =>
        {
            const tokens = lex("PROGRAM-ID");

            expect(tokens).toEqual([{ type: "KEYWORD", value: "PROGRAM-ID", line: 1 }]);
        });

        test("multi-word keyword END-IF", () =>
        {
            const tokens = lex("END-IF");

            expect(tokens).toEqual([{ type: "KEYWORD", value: "END-IF", line: 1 }]);
        });
    });

    suite("numbers", () =>
    {
        test("integer", () =>
        {
            const tokens = lex("123");

            expect(tokens).toEqual([{ type: "NUMBER", value: "123", line: 1 }]);
        });

        test("decimal", () =>
        {
            const tokens = lex("3.14");

            expect(tokens).toEqual([{ type: "NUMBER", value: "3.14", line: 1 }]);
        });

        test("trailing period is not consumed by number", () =>
        {
            const tokens = lex("42.");

            expect(tokens).toEqual([
                { type: "NUMBER", value: "42",  line: 1 },
                { type: "PERIOD", value: ".",   line: 1 }
            ]);
        });
    });

    suite("strings", () =>
    {
        test("single-quoted", () =>
        {
            const tokens = lex("'hello'");

            expect(tokens).toEqual([{ type: "STRING", value: "hello", line: 1 }]);
        });

        test("double-quoted", () =>
        {
            const tokens = lex('"hello"');

            expect(tokens).toEqual([{ type: "STRING", value: "hello", line: 1 }]);
        });

        test("doubled quote escapes", () =>
        {
            const tokens = lex("'don''t'");

            expect(tokens).toEqual([{ type: "STRING", value: "don't", line: 1 }]);
        });

        test("preserves spaces inside", () =>
        {
            const tokens = lex("'HELLO, WORLD!'");

            expect(tokens).toEqual([{ type: "STRING", value: "HELLO, WORLD!", line: 1 }]);
        });

        test("unterminated string throws with line number", () =>
        {
            expect(() => lex("'oops")).toThrow("unterminated string");
        });
    });

    suite("operators and parens", () =>
    {
        test("single-char operators", () =>
        {
            const tokens = lex("+ - * / = < >");

            expect(tokens.map(t => t.value)).toEqual(["+", "-", "*", "/", "=", "<", ">"]);
            for(const t of tokens) { expect(t.type).toBe("OPERATOR"); }
        });

        test("two-char operators >= <= **", () =>
        {
            const tokens = lex(">= <= **");

            expect(tokens.map(t => t.value)).toEqual([">=", "<=", "**"]);
            for(const t of tokens) { expect(t.type).toBe("OPERATOR"); }
        });

        test("parens", () =>
        {
            const tokens = lex("(123)");

            expect(tokens).toEqual([
                { type: "LPAREN", value: "(",   line: 1 },
                { type: "NUMBER", value: "123", line: 1 },
                { type: "RPAREN", value: ")",   line: 1 }
            ]);
        });
    });

    suite("comments", () =>
    {
        test("line starting with * is skipped", () =>
        {
            const tokens = lex("* this entire line is a comment\nDISPLAY 'OK'.");

            expect(tokens).toEqual([
                { type: "KEYWORD", value: "DISPLAY", line: 2 },
                { type: "STRING",  value: "OK",      line: 2 },
                { type: "PERIOD",  value: ".",       line: 2 }
            ]);
        });

        test("indented * is also a comment line", () =>
        {
            const tokens = lex("    * indented comment\nDISPLAY 'OK'.");

            expect(tokens).toEqual([
                { type: "KEYWORD", value: "DISPLAY", line: 2 },
                { type: "STRING",  value: "OK",      line: 2 },
                { type: "PERIOD",  value: ".",       line: 2 }
            ]);
        });

        test("inline *> truncates the rest of the line", () =>
        {
            const tokens = lex("DISPLAY 'OK' *> trailing comment\n");

            expect(tokens).toEqual([
                { type: "KEYWORD", value: "DISPLAY", line: 1 },
                { type: "STRING",  value: "OK",      line: 1 }
            ]);
        });
    });

    suite("line tracking", () =>
    {
        test("tokens carry their source line", () =>
        {
            const tokens = lex("DISPLAY 'A'.\nDISPLAY 'B'.");
            const lineNums = tokens.map(t => t.line);

            expect(lineNums).toEqual([1, 1, 1, 2, 2, 2]);
        });

        test("blank lines do not affect numbering", () =>
        {
            const tokens = lex("DISPLAY 'A'.\n\n\nDISPLAY 'B'.");
            const lineNums = tokens.filter(t => t.value === "DISPLAY").map(t => t.line);

            expect(lineNums).toEqual([1, 4]);
        });
    });

    suite("error reporting", () =>
    {
        test("unexpected character carries line number", () =>
        {
            try
            {
                lex("DISPLAY @\n");
                throw new Error("should have thrown");
            }
            catch(error)
            {
                expect(error.line).toBe(1);
                expect(error.message.includes("unexpected character")).toBe(true);
            }
        });

        test("unterminated string carries line number", () =>
        {
            try
            {
                lex("DISPLAY 'oops\nNEXT-LINE");
                throw new Error("should have thrown");
            }
            catch(error)
            {
                expect(error.line).toBe(1);
            }
        });
    });

    suite("hello-world program", () =>
    {
        test("lexes the bundled HELLO-WORLD source", () =>
        {
            const source = loadFixture("hello-world.cbl");
            const tokens = lex(source);
            const types = tokens.map(t => t.type);

            // 16 expected: IDENTIFICATION DIVISION . PROGRAM-ID . HELLO-WORLD .
            //              PROCEDURE DIVISION . DISPLAY "HELLO, WORLD!" . STOP RUN .
            expect(tokens.length).toBe(16);
            expect(types[0]).toBe("KEYWORD");
            expect(tokens[0].value).toBe("IDENTIFICATION");
        });
    });
});
