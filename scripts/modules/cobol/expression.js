import { CobolSyntaxError, CobolRuntimeError } from "./errors.js";


/******************************************************************************/
/* EXPRESSION EVALUATOR                                                       */
/******************************************************************************/

// Recursive-descent parser/evaluator for COBOL arithmetic expressions.
// Walks a flat token array (a slice produced by the Parser) and returns
// the numeric result.
//
// Grammar (precedence low → high):
//   expression := term (('+' | '-') term)*
//   term       := unary (('*' | '/') unary)*
//   unary      := ('-' | '+') unary | factor
//   factor     := primary ('**' unary)?            // right-associative
//   primary    := NUMBER | IDENTIFIER | '(' expression ')'
//
// Right-associative `**` is encoded by recursing through `unary` on the
// right side; that also lets `2 ** -3` parse without an extra rule.
//
// Identifier values are resolved via a per-call callback that receives
// `(name, line)` and returns a number — the caller emits a positioned
// runtime error if the name is undefined. Stateless across calls (the
// `tokens`/`pos` cursor is reset on each `evaluate`), so a single shared
// instance can be reused — matters in PERFORM-VARYING loops over
// expressions. Also called from condition parsing for the two arithmetic
// sub-expressions of a comparison.

class ExpressionEvaluator
{
    evaluate(tokens, resolver)
    {
        if(tokens.length === 0) { throw new CobolSyntaxError(null, "empty expression"); }

        this.tokens = tokens;
        this.pos = 0;
        this.resolver = resolver;

        const value = this.parseExpression();

        if(this.pos < this.tokens.length)
        {
            const t = this.tokens[this.pos];

            throw new CobolSyntaxError(t.line, `unexpected token "${t.value}" in expression`);
        }

        return value;
    }


    /* GRAMMAR *****************************************************************/

    parseExpression()
    {
        let left = this.parseTerm();

        while(this.matchOperator("+", "-"))
        {
            const op = this.consume();
            const right = this.parseTerm();

            left = (op.value === "+")? left + right: left - right;
        }

        return left;
    }

    parseTerm()
    {
        let left = this.parseUnary();

        while(this.matchOperator("*", "/"))
        {
            const op = this.consume();
            const right = this.parseUnary();

            if(op.value === "/" && right === 0) { throw new CobolRuntimeError(op.line, "Division by zero"); }

            left = (op.value === "*")? left * right: left / right;
        }

        return left;
    }

    parseUnary()
    {
        if(this.matchOperator("+", "-"))
        {
            const op = this.consume();
            const value = this.parseUnary();

            return op.value === "-"? -value: value;
        }

        return this.parseFactor();
    }

    parseFactor()
    {
        const left = this.parsePrimary();

        if(this.matchOperator("**"))
        {
            this.consume();
            const right = this.parseUnary();

            return left ** right;
        }

        return left;
    }

    parsePrimary()
    {
        const t = this.peek();

        if(!t) { throw new CobolSyntaxError(null, "unexpected end of expression"); }

        if(t.type === "NUMBER")
        {
            this.consume();

            return parseFloat(t.value);
        }

        if(t.type === "IDENTIFIER")
        {
            this.consume();

            return this.resolver(t.value, t.line);
        }

        if(t.type === "LPAREN")
        {
            this.consume();
            const value = this.parseExpression();

            const closing = this.peek();

            if(!closing || closing.type !== "RPAREN")
            {
                throw new CobolSyntaxError((closing ?? t).line, "expected ')' in expression");
            }

            this.consume();

            return value;
        }

        // EOF tokens carry value: null — render as just the type so the
        // error doesn't read `got EOF "null"`.
        const got = t.value === null? t.type: `${t.type} "${t.value}"`;

        throw new CobolSyntaxError(t.line, `expected expression, got ${got}`);
    }


    /* CURSOR ******************************************************************/

    peek()
    {
        return this.tokens[this.pos];
    }

    consume()
    {
        return this.tokens[this.pos++];
    }

    matchOperator(...values)
    {
        const t = this.peek();

        return Boolean(t) && t.type === "OPERATOR" && values.includes(t.value);
    }
}


export { ExpressionEvaluator };
