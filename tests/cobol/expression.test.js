import { suite, test, expect } from "../runner.js";
import { Lexer } from "../../scripts/modules/cobol/lexer.js";
import { ExpressionEvaluator } from "../../scripts/modules/cobol/expression.js";
import { CobolSyntaxError, CobolRuntimeError } from "../../scripts/modules/cobol/errors.js";


function evaluate(expr, vars = {})
{
    const tokens = new Lexer().tokenize(expr).filter(t => t.type !== "EOF");
    const evaluator = new ExpressionEvaluator();

    return evaluator.evaluate(tokens, name => vars[name] ?? 0);
}


suite("ExpressionEvaluator", () =>
{
    suite("basic arithmetic", () =>
    {
        test("addition", () => expect(evaluate("1 + 2")).toBe(3));
        test("subtraction", () => expect(evaluate("10 - 4")).toBe(6));
        test("multiplication", () => expect(evaluate("3 * 4")).toBe(12));
        test("division", () => expect(evaluate("20 / 4")).toBe(5));
        test("decimal literals", () => expect(evaluate("0.5 + 0.25")).toBe(0.75));
    });

    suite("precedence", () =>
    {
        test("* before +", () => expect(evaluate("2 + 3 * 4")).toBe(14));
        test("/ before -", () => expect(evaluate("20 - 6 / 2")).toBe(17));
        test("parens override", () => expect(evaluate("(2 + 3) * 4")).toBe(20));
        test("nested parens", () => expect(evaluate("((1 + 2) * (3 + 4))")).toBe(21));
    });

    suite("exponentiation", () =>
    {
        test("simple power", () => expect(evaluate("2 ** 3")).toBe(8));
        test("right-associative", () => expect(evaluate("2 ** 3 ** 2")).toBe(512));
        test("** binds tighter than +", () => expect(evaluate("1 + 2 ** 3")).toBe(9));
        test("** binds tighter than *", () => expect(evaluate("3 * 2 ** 2")).toBe(12));
        test("negative exponent allowed", () => expect(evaluate("2 ** -2")).toBe(0.25));
    });

    suite("unary operators", () =>
    {
        test("unary minus on literal", () => expect(evaluate("-5 + 3")).toBe(-2));
        test("unary plus is identity", () => expect(evaluate("+5 + 3")).toBe(8));
        test("double negation", () => expect(evaluate("--5")).toBe(5));
        test("unary minus does not bind tighter than **", () => expect(evaluate("-2 ** 2")).toBe(-4));
        test("unary minus inside parens", () => expect(evaluate("3 * (-2)")).toBe(-6));
    });

    suite("identifiers", () =>
    {
        test("single identifier", () => expect(evaluate("X", { X: 42 })).toBe(42));
        test("identifier in expression", () => expect(evaluate("X + 1", { X: 5 })).toBe(6));
        test("multiple identifiers", () => expect(evaluate("X * Y", { X: 3, Y: 4 })).toBe(12));
        test("identifier with hyphen", () => expect(evaluate("USER-AGE + 1", { "USER-AGE": 21 })).toBe(22));

        test("undefined identifier reaches resolver", () =>
        {
            let receivedName = null;

            const tokens = new Lexer().tokenize("X + 1").filter(t => t.type !== "EOF");
            const evaluator = new ExpressionEvaluator();
            const resolver = (name) =>
            {
                receivedName = name;

                throw new CobolRuntimeError(1, `identifier "${name}" is not defined`);
            };

            let thrown = null;
            try { evaluator.evaluate(tokens, resolver); } catch(e) { thrown = e; }

            expect(receivedName).toBe("X");
            expect(thrown instanceof CobolRuntimeError).toBe(true);
        });
    });

    suite("errors", () =>
    {
        test("division by zero throws", () =>
        {
            let thrown = null;
            try { evaluate("10 / 0"); } catch(e) { thrown = e; }

            expect(thrown instanceof CobolRuntimeError).toBe(true);
            expect(thrown.message).toBe("Division by zero");
        });

        test("unclosed paren throws", () =>
        {
            let thrown = null;
            try { evaluate("(1 + 2"); } catch(e) { thrown = e; }

            expect(thrown instanceof CobolSyntaxError).toBe(true);
            expect(thrown.message.includes(")")).toBe(true);
        });

        test("trailing token throws", () =>
        {
            expect(() => evaluate("1 + 2 3")).toThrow("unexpected token");
        });

        test("empty expression throws", () =>
        {
            expect(() => evaluate("")).toThrow("empty expression");
        });

        test("missing operand after operator throws", () =>
        {
            expect(() => evaluate("1 +")).toThrow("unexpected end");
        });
    });

    suite("intrinsic functions", () =>
    {
        test("FUNCTION INTEGER truncates positive float toward zero", () =>
        {
            expect(evaluate("FUNCTION INTEGER(3.9)")).toBe(3);
        });

        test("FUNCTION INTEGER on negative goes toward minus infinity (floor)", () =>
        {
            expect(evaluate("FUNCTION INTEGER(-1.5)")).toBe(-2);
        });

        test("FUNCTION MOD with positive operands", () =>
        {
            expect(evaluate("FUNCTION MOD(7, 3)")).toBe(1);
        });

        test("FUNCTION MOD accepts space-separated args (commas optional)", () =>
        {
            expect(evaluate("FUNCTION MOD(10 4)")).toBe(2);
        });

        test("FUNCTION MOD with zero remainder", () =>
        {
            expect(evaluate("FUNCTION MOD(15, 5)")).toBe(0);
        });

        test("FUNCTION RANDOM with no parens returns float in [0, 1)", () =>
        {
            const original = Math.random;
            Math.random = () => 0.5;
            try
            {
                expect(evaluate("FUNCTION RANDOM")).toBe(0.5);
            }
            finally { Math.random = original; }
        });

        test("FUNCTION RANDOM composes with arithmetic", () =>
        {
            const original = Math.random;
            Math.random = () => 0.5;
            try
            {
                expect(evaluate("FUNCTION RANDOM * 100")).toBe(50);
            }
            finally { Math.random = original; }
        });

        test("nested FUNCTION calls (INTEGER of RANDOM * 100)", () =>
        {
            const original = Math.random;
            Math.random = () => 0.419;
            try
            {
                expect(evaluate("FUNCTION INTEGER(FUNCTION RANDOM * 100) + 1")).toBe(42);
            }
            finally { Math.random = original; }
        });

        test("function arg can be an arithmetic expression", () =>
        {
            expect(evaluate("FUNCTION MOD(2 + 5, 3)")).toBe(1);
        });

        test("identifier args resolve via the resolver", () =>
        {
            expect(evaluate("FUNCTION MOD(N, 3)", { N: 10 })).toBe(1);
        });

        test("unknown intrinsic throws clear syntax error", () =>
        {
            expect(() => evaluate("FUNCTION FROBNICATE(1)")).toThrow(`unknown intrinsic function "FROBNICATE"`);
        });

        test("wrong arity throws", () =>
        {
            expect(() => evaluate("FUNCTION MOD(7)")).toThrow("expects 2 argument(s), got 1");
        });

        test("RANDOM with explicit args throws (arity 0)", () =>
        {
            const original = Math.random;
            Math.random = () => 0.5;
            try
            {
                expect(() => evaluate("FUNCTION RANDOM(7)")).toThrow("expects 0 argument(s), got 1");
            }
            finally { Math.random = original; }
        });

        test("FUNCTION followed by non-identifier throws", () =>
        {
            expect(() => evaluate("FUNCTION 7")).toThrow("expected function name");
        });
    });
});
