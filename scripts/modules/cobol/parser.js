import { Program } from "./program.js";
import { CobolSyntaxError } from "./errors.js";
import * as Arithmetic from "./parser/arithmetic.js";
import * as DataDivision from "./parser/data-division.js";


/******************************************************************************/
/* PARSER                                                                     */
/******************************************************************************/

// Walks a token stream from the Lexer and produces a Program. The Parser
// owns the cursor (`peek`/`consume`/`expect`), error helpers, and the
// statement dispatch. Cohesive sub-grammars (arithmetic, data-division)
// live in `parser/*.js` as free functions taking the Parser instance —
// keeps each file in head-size while the supported COBOL surface grows.
//
// Supported surface as of Task 12:
//   * IDENTIFICATION DIVISION (program-id)
//   * ENVIRONMENT DIVISION (skipped wholesale)
//   * DATA DIVISION → WORKING-STORAGE SECTION (level/name/PIC/VALUE)
//   * PROCEDURE DIVISION statements:
//       DISPLAY, MOVE, ACCEPT, ADD, SUBTRACT, MULTIPLY, DIVIDE,
//       COMPUTE, STOP RUN

class Parser
{
    parse(tokens)
    {
        this.tokens = tokens;
        this.pos = 0;

        const program = new Program();

        this.parseIdentificationDivision(program);

        if(this.peekDivision() === "ENVIRONMENT") { this.skipDivision(); }
        if(this.peekDivision() === "DATA")        { DataDivision.parseDataDivision(this, program); }

        if(this.peekDivision() === "PROCEDURE")   { this.parseProcedureDivision(program); }

        return program;
    }


    /* DIVISIONS ***************************************************************/

    parseIdentificationDivision(program)
    {
        this.expect("KEYWORD", "IDENTIFICATION");
        this.expect("KEYWORD", "DIVISION");
        this.expect("PERIOD");

        this.expect("KEYWORD", "PROGRAM-ID");
        this.expect("PERIOD");

        const nameTok = this.consume();

        if(nameTok.type !== "IDENTIFIER" && nameTok.type !== "KEYWORD")
        {
            this.errorAt(nameTok, `expected program name, got ${nameTok.type}`);
        }

        program.programId = nameTok.value;

        this.expect("PERIOD");
    }

    skipDivision()
    {
        // Consume `<NAME> DIVISION .`, then drop tokens until the next
        // division header or EOF. Used for ENVIRONMENT — DATA is parsed
        // properly via DataDivision.parseDataDivision.
        this.consume();
        this.consume();
        this.consume();

        while(this.peek().type !== "EOF" && this.peekDivision() === null)
        {
            this.consume();
        }
    }

    parseProcedureDivision(program)
    {
        this.expect("KEYWORD", "PROCEDURE");
        this.expect("KEYWORD", "DIVISION");
        this.expect("PERIOD");

        while(this.peek().type !== "EOF" && this.peekDivision() === null)
        {
            const statement = this.parseStatement();

            program.currentParagraph().addStatement(statement);
        }
    }


    /* STATEMENTS **************************************************************/

    parseStatement()
    {
        const t = this.peek();

        if(t.type !== "KEYWORD")
        {
            this.errorExpected(t, "statement");
        }

        switch(t.value)
        {
            case "DISPLAY":  return this.parseDisplay();
            case "MOVE":     return this.parseMove();
            case "ACCEPT":   return this.parseAccept();
            case "ADD":      return Arithmetic.parseAdd(this);
            case "SUBTRACT": return Arithmetic.parseSubtract(this);
            case "MULTIPLY": return Arithmetic.parseMultiply(this);
            case "DIVIDE":   return Arithmetic.parseDivide(this);
            case "COMPUTE":  return this.parseCompute();
            case "STOP":     return this.parseStopRun();

            default: this.errorAt(t, `unsupported statement "${t.value}"`);
        }
    }

    parseDisplay()
    {
        const startTok = this.consume();

        const operands = [];
        let noAdvance = false;

        while(true)
        {
            const t = this.peek();

            if(t.type === "PERIOD") { this.consume(); break; }
            if(t.type === "EOF")    { this.errorAt(t, "unexpected end of input in DISPLAY"); }

            if(t.type === "KEYWORD" && t.value === "WITH")
            {
                this.consume();
                this.expect("KEYWORD", "NO");
                this.expect("KEYWORD", "ADVANCING");

                noAdvance = true;

                continue;
            }

            operands.push(this.parseOperand());
        }

        return { kind: "DISPLAY", operands, noAdvance, line: startTok.line };
    }

    parseMove()
    {
        const startTok = this.consume();

        const source = this.parseOperand();

        this.expect("KEYWORD", "TO");

        const targets = [];

        while(true)
        {
            const t = this.peek();

            if(t.type === "PERIOD") { this.consume(); break; }
            if(t.type === "EOF")    { this.errorAt(t, "unexpected end of input in MOVE"); }

            if(t.type !== "IDENTIFIER")
            {
                this.errorExpected(t, "identifier as MOVE target");
            }

            targets.push({ kind: "identifier", name: t.value, line: t.line });
            this.consume();
        }

        if(targets.length === 0)
        {
            this.errorAt(startTok, "MOVE requires at least one target");
        }

        return { kind: "MOVE", source, targets, line: startTok.line };
    }

    parseAccept()
    {
        const startTok = this.consume();

        const nameTok = this.expect("IDENTIFIER");
        this.expect("PERIOD");

        const target = { kind: "identifier", name: nameTok.value, line: nameTok.line };

        return { kind: "ACCEPT", target, line: startTok.line };
    }

    // COMPUTE target = expression.
    //
    // The expression is captured as a token slice and handed to
    // ExpressionEvaluator at runtime — keeps expression-grammar concerns
    // out of the Parser (which only cares about statement boundaries) and
    // lets Task 13's condition parsing reuse the same evaluator.
    parseCompute()
    {
        const startTok = this.consume();

        const targetTok = this.expect("IDENTIFIER");
        const target = { kind: "identifier", name: targetTok.value, line: targetTok.line };

        const eqTok = this.consume();

        if(eqTok.type !== "OPERATOR" || eqTok.value !== "=")
        {
            this.errorExpected(eqTok, `"=" in COMPUTE`);
        }

        const expressionTokens = [];

        while(true)
        {
            const t = this.peek();

            if(t.type === "PERIOD") { this.consume(); break; }
            if(t.type === "EOF")    { this.errorAt(t, "unexpected end of input in COMPUTE"); }

            expressionTokens.push(t);
            this.consume();
        }

        if(expressionTokens.length === 0) { this.errorAt(startTok, "COMPUTE requires an expression"); }

        return { kind: "COMPUTE", target, expressionTokens, line: startTok.line };
    }

    parseStopRun()
    {
        const startTok = this.consume();

        this.expect("KEYWORD", "RUN");
        this.expect("PERIOD");

        return { kind: "STOP_RUN", line: startTok.line };
    }


    /* OPERAND LISTS ***********************************************************/

    parseOperandsUntilKeyword(...stopKeywords)
    {
        const operands = [];

        while(true)
        {
            const t = this.peek();

            if(t.type === "PERIOD" || t.type === "EOF")                       { break; }
            if(t.type === "KEYWORD" && stopKeywords.includes(t.value))        { break; }

            operands.push(this.parseOperand());
        }

        return operands;
    }

    parseIdentifiersUntilKeyword(...stopKeywords)
    {
        const identifiers = [];

        while(true)
        {
            const t = this.peek();

            if(t.type === "PERIOD" || t.type === "EOF")                       { break; }
            if(t.type === "KEYWORD" && stopKeywords.includes(t.value))        { break; }

            if(t.type !== "IDENTIFIER")
            {
                this.errorExpected(t, "identifier");
            }

            identifiers.push({ kind: "identifier", name: t.value, line: t.line });
            this.consume();
        }

        return identifiers;
    }

    parseOperand()
    {
        const t = this.consume();

        if(t.type === "STRING")
        {
            return { kind: "literal", literalType: "string", value: t.value, line: t.line };
        }

        if(t.type === "NUMBER")
        {
            return { kind: "literal", literalType: "number", value: t.value, line: t.line };
        }

        if(t.type === "IDENTIFIER")
        {
            return { kind: "identifier", name: t.value, line: t.line };
        }

        this.errorExpected(t, "operand");
    }


    /* CURSOR ******************************************************************/

    peek(offset = 0)
    {
        return this.tokens[this.pos + offset];
    }

    peekDivision()
    {
        // Looks for the three-token shape `<NAME> DIVISION .` that signals a
        // division header. Returns the division name or null.
        const t1 = this.peek(0);
        const t2 = this.peek(1);
        const t3 = this.peek(2);

        if(!t1 || !t2 || !t3) { return null; }

        const isDivision = t1.type === "KEYWORD"
            && t2.type === "KEYWORD" && t2.value === "DIVISION"
            && t3.type === "PERIOD";

        return isDivision? t1.value: null;
    }

    matchKeyword(value)
    {
        const t = this.peek();

        return t.type === "KEYWORD" && t.value === value;
    }

    consume()
    {
        return this.tokens[this.pos++];
    }

    expect(type, value)
    {
        const t = this.consume();

        const wrongType = t.type !== type;
        const wrongValue = value !== undefined && t.value !== value;

        if(wrongType || wrongValue)
        {
            const want = value !== undefined? `${type} "${value}"`: type;

            this.errorExpected(t, want);
        }

        return t;
    }

    errorAt(token, message)
    {
        throw new CobolSyntaxError(token.line, message);
    }

    // "expected <want>, got <got>" — `got` omits the value part for tokens
    // that carry `value: null` (EOF), so the error reads `got EOF` rather
    // than `got EOF "null"`.
    errorExpected(token, want)
    {
        const got = token.value === null? token.type: `${token.type} "${token.value}"`;

        this.errorAt(token, `expected ${want}, got ${got}`);
    }
}


export { Parser };
