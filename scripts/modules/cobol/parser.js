import { Program } from "./program.js";
import { DataItem } from "./data-item.js";
import { CobolSyntaxError } from "./errors.js";


/******************************************************************************/
/* PARSER                                                                     */
/******************************************************************************/

// Walks a token stream from the Lexer and produces a Program. Supported
// surface as of Task 10:
//   * IDENTIFICATION DIVISION (program-id)
//   * ENVIRONMENT DIVISION (skipped wholesale)
//   * DATA DIVISION → WORKING-STORAGE SECTION (level/name/PIC/VALUE)
//   * PROCEDURE DIVISION statements: DISPLAY, MOVE, ACCEPT, STOP RUN
// Subsequent tasks expand the statement set without changing the overall
// shape.

class Parser
{
    parse(tokens)
    {
        this.tokens = tokens;
        this.pos = 0;

        const program = new Program();

        this.parseIdentificationDivision(program);

        if(this.peekDivision() === "ENVIRONMENT") { this.skipDivision(); }
        if(this.peekDivision() === "DATA")        { this.parseDataDivision(program); }

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
        // division header or EOF. Used for ENVIRONMENT in Task 10 — DATA is
        // now parsed properly via parseDataDivision.
        this.consume();
        this.consume();
        this.consume();

        while(this.peek().type !== "EOF" && this.peekDivision() === null)
        {
            this.consume();
        }
    }

    parseDataDivision(program)
    {
        this.expect("KEYWORD", "DATA");
        this.expect("KEYWORD", "DIVISION");
        this.expect("PERIOD");

        // Only WORKING-STORAGE is supported. Other sections (FILE,
        // LINKAGE, etc.) are skipped — as is everything before the next
        // division header.
        while(this.peek().type !== "EOF" && this.peekDivision() === null)
        {
            if(this.matchKeyword("WORKING-STORAGE"))
            {
                this.consume();
                this.expect("KEYWORD", "SECTION");
                this.expect("PERIOD");

                this.parseWorkingStorageSection(program);

                continue;
            }

            this.consume();
        }
    }

    parseWorkingStorageSection(program)
    {
        const stack = [];

        while(this.peek().type === "NUMBER")
        {
            this.parseDataItem(program, stack);
        }
    }

    parseDataItem(program, stack)
    {
        const levelTok = this.expect("NUMBER");
        const level = parseInt(levelTok.value, 10);

        const isValid = (level >= 1 && level <= 49) || level === 77;

        if(!isValid)
        {
            this.errorAt(levelTok, `unsupported level number ${level}`);
        }

        const nameTok = this.expect("IDENTIFIER");
        const name = nameTok.value;

        let picString = null;
        let initialValue = undefined;

        while(true)
        {
            const t = this.peek();

            if(t.type === "PERIOD") { this.consume(); break; }
            if(t.type === "EOF")    { this.errorAt(t, "unexpected end of input in data item"); }

            if(t.type === "KEYWORD" && (t.value === "PIC" || t.value === "PICTURE"))
            {
                this.consume();
                picString = this.parsePicString();

                continue;
            }

            if(t.type === "KEYWORD" && t.value === "VALUE")
            {
                this.consume();
                initialValue = this.parseValueLiteral();

                continue;
            }

            this.errorAt(t, `unexpected token "${t.value}" in data item`);
        }

        let parent = null;

        if(level === 77)
        {
            // 77 is always top-level — clear the stack so subsequent items
            // do not accidentally nest under it.
            stack.length = 0;
        }
        else
        {
            while(stack.length && stack[stack.length - 1].level >= level) { stack.pop(); }

            if(stack.length) { parent = stack[stack.length - 1].item; }
        }

        const item = new DataItem({ level, name, parent, picString, initialValue, line: levelTok.line });

        if(level !== 77) { stack.push({ level, item }); }

        if(program.dataItems.has(name))
        {
            this.errorAt(nameTok, `duplicate data item name "${name}"`);
        }

        program.dataItems.set(name, item);
    }

    parsePicString()
    {
        let pic = "";

        while(true)
        {
            const t = this.peek();

            if(t.type === "IDENTIFIER" || t.type === "NUMBER")
            {
                pic += t.value;
                this.consume();
            }
            else if(t.type === "LPAREN")
            {
                this.consume();
                pic += "(";
            }
            else if(t.type === "RPAREN")
            {
                this.consume();
                pic += ")";
            }
            else
            {
                break;
            }
        }

        if(pic === "") { this.errorAt(this.peek(), "expected PIC string"); }

        return pic;
    }

    parseValueLiteral()
    {
        const t = this.consume();

        if(t.type === "STRING") { return t.value; }
        if(t.type === "NUMBER") { return parseFloat(t.value); }

        // Figurative constants (ZEROS, SPACES) and signed literals are
        // deferred until an example actually needs them.
        this.errorAt(t, `expected literal in VALUE clause, got ${t.type} "${t.value}"`);
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
            this.errorAt(t, `expected statement, got ${t.type} "${t.value}"`);
        }

        switch(t.value)
        {
            case "DISPLAY": return this.parseDisplay();
            case "MOVE":    return this.parseMove();
            case "ACCEPT":  return this.parseAccept();
            case "STOP":    return this.parseStopRun();

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
                this.errorAt(t, `expected identifier as MOVE target, got ${t.type} "${t.value}"`);
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

        this.errorAt(t, `expected operand, got ${t.type} "${t.value}"`);
    }

    parseStopRun()
    {
        const startTok = this.consume();

        this.expect("KEYWORD", "RUN");
        this.expect("PERIOD");

        return { kind: "STOP_RUN", line: startTok.line };
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

            this.errorAt(t, `expected ${want}, got ${t.type}${t.value !== null? ` "${t.value}"`: ""}`);
        }

        return t;
    }

    errorAt(token, message)
    {
        throw new CobolSyntaxError(token.line, message);
    }
}


export { Parser };
