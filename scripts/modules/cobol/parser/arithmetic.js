/******************************************************************************/
/* ARITHMETIC STATEMENT PARSERS                                               */
/******************************************************************************/

// COBOL arithmetic statement parsers — extracted from parser.js to keep
// the main parser focused on division/dispatch/operand concerns.
//
// Each function consumes the leading keyword (ADD/SUBTRACT/MULTIPLY/
// DIVIDE), the operands, and the trailing period; returns the statement
// AST node. They rely on the Parser instance for cursor primitives
// (peek/consume/expect/matchKeyword), error helpers (errorAt/errorExpected),
// and operand-list helpers (parseOperand/parseOperandsUntilKeyword/
// parseIdentifiersUntilKeyword).


// Forms supported (plain or GIVING; not both):
//   ADD a [b...] TO target [target...].
//   ADD a [b...] GIVING target [target...].
function parseAdd(parser)
{
    const startTok = parser.consume();

    const sources = parser.parseOperandsUntilKeyword("TO", "GIVING");

    if(sources.length === 0) { parser.errorAt(parser.peek(), "ADD requires at least one source"); }

    const next = parser.peek();
    let targets = [];
    let giving = false;

    if(parser.matchKeyword("TO"))
    {
        parser.consume();
        targets = parser.parseIdentifiersUntilKeyword();
    }
    else if(parser.matchKeyword("GIVING"))
    {
        parser.consume();
        targets = parser.parseIdentifiersUntilKeyword();
        giving = true;
    }
    else
    {
        parser.errorExpected(next, "TO or GIVING in ADD");
    }

    parser.expect("PERIOD");

    if(targets.length === 0) { parser.errorAt(startTok, "ADD requires at least one target"); }

    return { kind: "ADD", sources, targets, giving, line: startTok.line };
}


// Forms supported:
//   SUBTRACT a [b...] FROM target [target...].
//   SUBTRACT a [b...] FROM via GIVING target [target...].
function parseSubtract(parser)
{
    const startTok = parser.consume();

    const sources = parser.parseOperandsUntilKeyword("FROM");

    if(sources.length === 0) { parser.errorAt(parser.peek(), "SUBTRACT requires at least one source"); }

    parser.expect("KEYWORD", "FROM");

    const firstAfterFrom = parser.parseOperand();

    let from = null;
    let targets = [];
    let giving = false;

    if(parser.matchKeyword("GIVING"))
    {
        parser.consume();
        from = firstAfterFrom;
        targets = parser.parseIdentifiersUntilKeyword();
        giving = true;
    }
    else
    {
        if(firstAfterFrom.kind !== "identifier")
        {
            parser.errorAt(firstAfterFrom, "SUBTRACT FROM target must be an identifier");
        }

        targets = [firstAfterFrom, ...parser.parseIdentifiersUntilKeyword()];
    }

    parser.expect("PERIOD");

    if(targets.length === 0) { parser.errorAt(startTok, "SUBTRACT requires at least one target"); }

    return { kind: "SUBTRACT", sources, from, targets, giving, line: startTok.line };
}


// Forms supported:
//   MULTIPLY x BY target [target...].
//   MULTIPLY x BY y GIVING target [target...].
function parseMultiply(parser)
{
    const startTok = parser.consume();

    const multiplier = parser.parseOperand();

    parser.expect("KEYWORD", "BY");

    const second = parser.parseOperand();

    let multiplicand = null;
    let targets = [];
    let giving = false;

    if(parser.matchKeyword("GIVING"))
    {
        parser.consume();
        multiplicand = second;
        targets = parser.parseIdentifiersUntilKeyword();
        giving = true;
    }
    else
    {
        if(second.kind !== "identifier")
        {
            parser.errorAt(second, "MULTIPLY BY target must be an identifier");
        }

        targets = [second, ...parser.parseIdentifiersUntilKeyword()];
    }

    parser.expect("PERIOD");

    if(targets.length === 0) { parser.errorAt(startTok, "MULTIPLY requires at least one target"); }

    return { kind: "MULTIPLY", multiplier, multiplicand, targets, giving, line: startTok.line };
}


// Forms supported:
//   DIVIDE divisor INTO target [target...].
//   DIVIDE divisor INTO dividend GIVING target [target...].
//   DIVIDE dividend BY divisor GIVING target [target...].
//
// INTO vs BY: with INTO, the first operand is the divisor (and a non-GIVING
// form is allowed because the second operand is both dividend and target).
// With BY, the first operand is the dividend, and GIVING is required because
// there is no implicit target to write back into.
function parseDivide(parser)
{
    const startTok = parser.consume();

    const first = parser.parseOperand();

    const directionTok = parser.consume();

    if(directionTok.type !== "KEYWORD" || (directionTok.value !== "INTO" && directionTok.value !== "BY"))
    {
        parser.errorExpected(directionTok, "INTO or BY in DIVIDE");
    }

    const direction = directionTok.value;
    const second = parser.parseOperand();

    let divisor = null;
    let dividend = null;
    let targets = [];
    let giving = false;

    if(parser.matchKeyword("GIVING"))
    {
        parser.consume();

        if(direction === "INTO") { divisor = first;  dividend = second; }
        else                     { dividend = first; divisor = second; }

        targets = parser.parseIdentifiersUntilKeyword();
        giving = true;
    }
    else
    {
        if(direction === "BY")
        {
            parser.errorAt(directionTok, "DIVIDE BY requires GIVING (use COMPUTE for in-place divide-by)");
        }

        if(second.kind !== "identifier")
        {
            parser.errorAt(second, "DIVIDE INTO target must be an identifier");
        }

        divisor = first;
        targets = [second, ...parser.parseIdentifiersUntilKeyword()];
    }

    parser.expect("PERIOD");

    if(targets.length === 0) { parser.errorAt(startTok, "DIVIDE requires at least one target"); }

    return { kind: "DIVIDE", divisor, dividend, targets, giving, line: startTok.line };
}


export { parseAdd, parseSubtract, parseMultiply, parseDivide };
