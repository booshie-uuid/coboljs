/******************************************************************************/
/* CONDITION PARSER                                                           */
/******************************************************************************/

// Builds a condition tree for IF and PERFORM-UNTIL. The grammar:
//
//   condition := orCond
//   orCond    := andCond (OR andCond)*
//   andCond   := notCond (AND notCond)*
//   notCond   := NOT notCond | atom
//   atom      := '(' condition ')' | comparison
//   comparison := expression [NOT] compOp expression
//   compOp    := '=' | '<' | '>' | '<=' | '>='
//
// Comparison operands are captured as token slices and handed to
// ExpressionEvaluator at runtime (mirrors COMPUTE), so arithmetic in
// conditions reuses the same precedence/parens logic.
//
// Paren disambiguation: `(X = 1)` is a paren-condition while `(X + 1)` is
// the start of an expression. `lookaheadIsParenCondition` peeks ahead to
// the matching `)` to decide.
//
// AST node shapes:
//   { kind: "compare", left: <tokens>, op, right: <tokens>, line }
//   { kind: "logical", op: "AND" | "OR", left: <cond>, right: <cond>, line }
//   { kind: "not", operand: <cond>, line }


const COMPARISON_OPERATORS = new Set(["=", "<", ">", "<=", ">="]);


function parseCondition(parser)
{
    return parseOrCondition(parser);
}


function parseOrCondition(parser)
{
    let left = parseAndCondition(parser);

    while(parser.matchKeyword("OR"))
    {
        const opTok = parser.consume();
        const right = parseAndCondition(parser);

        left = { kind: "logical", op: "OR", left, right, line: opTok.line };
    }

    return left;
}


function parseAndCondition(parser)
{
    let left = parseNotCondition(parser);

    while(parser.matchKeyword("AND"))
    {
        const opTok = parser.consume();
        const right = parseNotCondition(parser);

        left = { kind: "logical", op: "AND", left, right, line: opTok.line };
    }

    return left;
}


function parseNotCondition(parser)
{
    if(parser.matchKeyword("NOT"))
    {
        const notTok = parser.consume();
        const operand = parseNotCondition(parser);

        return { kind: "not", operand, line: notTok.line };
    }

    return parseConditionAtom(parser);
}


function parseConditionAtom(parser)
{
    if(parser.peek().type === "LPAREN" && lookaheadIsParenCondition(parser))
    {
        parser.consume();
        const inner = parseCondition(parser);
        parser.expect("RPAREN");

        return inner;
    }

    return parseComparison(parser);
}


function parseComparison(parser)
{
    const left = readExpressionSlice(parser);

    if(left.length === 0) { parser.errorAt(parser.peek(), "expected expression in comparison"); }

    let negated = false;

    if(parser.matchKeyword("NOT"))
    {
        parser.consume();
        negated = true;
    }

    const opTok = parser.consume();

    if(opTok.type !== "OPERATOR" || !COMPARISON_OPERATORS.has(opTok.value))
    {
        parser.errorExpected(opTok, "comparison operator (=, <, >, <=, >=)");
    }

    const right = readExpressionSlice(parser);

    if(right.length === 0) { parser.errorAt(parser.peek(), "expected expression after comparison operator"); }

    const compare = { kind: "compare", left, op: opTok.value, right, line: opTok.line };

    return negated? { kind: "not", operand: compare, line: opTok.line }: compare;
}


/******************************************************************************/
/* HELPERS                                                                    */
/******************************************************************************/

// Reads tokens for a single expression. Stops on:
//   - KEYWORD or PERIOD at any depth — neither appears inside an
//     expression, with the exception of FUNCTION (intrinsic call kicker).
//   - top-level comparison operator (=, <, >, <=, >=)
//   - unmatched RPAREN
// Balanced parens are consumed wholesale and handed to ExpressionEvaluator
// at runtime.
function readExpressionSlice(parser)
{
    const tokens = [];
    let parenDepth = 0;

    while(true)
    {
        const t = parser.peek();

        if(!t || t.type === "EOF")                         { break; }
        if(t.type === "KEYWORD" && t.value !== "FUNCTION") { break; }
        if(t.type === "PERIOD")                            { break; }

        if(t.type === "LPAREN")
        {
            parenDepth++;
        }
        else if(t.type === "RPAREN")
        {
            if(parenDepth === 0) { break; }
            parenDepth--;
        }
        else if(parenDepth === 0)
        {
            if(t.type === "OPERATOR" && COMPARISON_OPERATORS.has(t.value)) { break; }
        }

        tokens.push(t);
        parser.consume();
    }

    return tokens;
}


// At an `(`, scans to the matching `)` and decides whether the contents
// form a condition (logical / comparison op at top depth → return true)
// or an arithmetic expression (no such ops → false). Doesn't advance the
// cursor.
function lookaheadIsParenCondition(parser)
{
    let depth = 0;
    let i = 0;

    while(true)
    {
        const t = parser.peek(i);

        if(!t || t.type === "EOF") { return false; }

        if(t.type === "LPAREN")
        {
            depth++;
        }
        else if(t.type === "RPAREN")
        {
            depth--;
            if(depth === 0) { return false; }
        }
        else if(depth === 1)
        {
            if(t.type === "OPERATOR" && COMPARISON_OPERATORS.has(t.value)) { return true; }
            if(t.type === "KEYWORD" && (t.value === "AND" || t.value === "OR" || t.value === "NOT")) { return true; }
        }

        i++;
    }
}


export { parseCondition };
