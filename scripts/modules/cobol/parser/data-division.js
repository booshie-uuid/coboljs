import { DataItem } from "../data-item.js";


/******************************************************************************/
/* DATA DIVISION PARSER                                                       */
/******************************************************************************/

// DATA DIVISION + WORKING-STORAGE SECTION + data-item parsing — extracted
// from parser.js to keep the main parser focused on division dispatch and
// statements. Only WORKING-STORAGE is supported; other sections (FILE,
// LINKAGE, etc.) are skipped wholesale.
//
// Relies on the Parser instance for cursor primitives (peek/consume/expect/
// matchKeyword) and error helpers (errorAt/errorExpected).


// Entry — called from parser.js when the next division is DATA.
function parseDataDivision(parser, program)
{
    parser.expect("KEYWORD", "DATA");
    parser.expect("KEYWORD", "DIVISION");
    parser.expect("PERIOD");

    while(parser.peek().type !== "EOF" && parser.peekDivision() === null)
    {
        if(parser.matchKeyword("WORKING-STORAGE"))
        {
            parser.consume();
            parser.expect("KEYWORD", "SECTION");
            parser.expect("PERIOD");

            parseWorkingStorageSection(parser, program);

            continue;
        }

        parser.consume();
    }
}


function parseWorkingStorageSection(parser, program)
{
    const stack = [];

    while(parser.peek().type === "NUMBER")
    {
        parseDataItem(parser, program, stack);
    }
}


function parseDataItem(parser, program, stack)
{
    const levelTok = parser.expect("NUMBER");
    const level = parseInt(levelTok.value, 10);

    const isValid = (level >= 1 && level <= 49) || level === 77;

    if(!isValid) { parser.errorAt(levelTok, `unsupported level number ${level}`); }

    const nameTok = parser.expect("IDENTIFIER");
    const name = nameTok.value;

    // Reject duplicates before constructing the DataItem — its
    // constructor calls `parent.addChild(this)`, so a late check
    // would leave a phantom child on the parent.
    if(program.dataItems.has(name))
    {
        parser.errorAt(nameTok, `duplicate data item name "${name}"`);
    }

    let picString = null;
    let initialValue = undefined;

    while(true)
    {
        const t = parser.peek();

        if(t.type === "PERIOD") { parser.consume(); break; }
        if(t.type === "EOF")    { parser.errorAt(t, "unexpected end of input in data item"); }

        if(t.type === "KEYWORD" && (t.value === "PIC" || t.value === "PICTURE"))
        {
            parser.consume();
            picString = parsePicString(parser);

            continue;
        }

        if(t.type === "KEYWORD" && t.value === "VALUE")
        {
            parser.consume();
            initialValue = parseValueLiteral(parser);

            continue;
        }

        parser.errorAt(t, `unexpected token "${t.value}" in data item`);
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

    program.dataItems.set(name, item);
}


function parsePicString(parser)
{
    // Lexer-emitted LPAREN/RPAREN tokens already carry value "(" / ")",
    // so all four PIC-token branches collapse into a single
    // `pic += value` form.
    const PIC_TOKEN_TYPES = new Set(["IDENTIFIER", "NUMBER", "LPAREN", "RPAREN"]);

    let pic = "";

    while(PIC_TOKEN_TYPES.has(parser.peek().type))
    {
        pic += parser.consume().value;
    }

    if(pic === "") { parser.errorAt(parser.peek(), "expected PIC string"); }

    return pic;
}


function parseValueLiteral(parser)
{
    const t = parser.consume();

    if(t.type === "STRING") { return t.value; }
    if(t.type === "NUMBER") { return parseFloat(t.value); }

    // Figurative constants (ZEROS, SPACES) and signed literals are
    // deferred until an example actually needs them.
    parser.errorExpected(t, "literal in VALUE clause");
}


export { parseDataDivision };
