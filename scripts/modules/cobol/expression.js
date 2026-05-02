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
// Identifier values are resolved via the constructor-supplied callback,
// which receives `(name, line)` so the resolver can emit a positioned
// error if the name is undefined. Reusable from condition parsing in
// Task 13 — comparisons evaluate two arithmetic sub-expressions.

class ExpressionEvaluator
{
    constructor(resolver)
    {
        this.resolver = resolver;
    }

    evaluate(tokens)
    {
        if(tokens.length === 0) { throw new CobolSyntaxError(null, "empty expression"); }

        this.tokens = tokens;
        this.pos = 0;

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

            return Math.pow(left, right);
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

        throw new CobolSyntaxError(t.line, `expected expression, got ${t.type} "${t.value}"`);
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
