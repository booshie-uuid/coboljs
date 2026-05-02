import { CobolSyntaxError } from "./errors.js";


/******************************************************************************/
/* PIC PARSING                                                                */
/******************************************************************************/

// Parses a COBOL PIC clause into a kind/length/decimal/sign descriptor.
// Returns: { kind: "alphanumeric" | "alphabetic" | "numeric",
//            length: int, decimalLength: int, signed: bool }
// Throws CobolSyntaxError on malformed input.
//
// Supported forms:
//   X(20) | XXX            alphanumeric, length n
//   A(10) | AAA            alphabetic,   length n
//   9(5) | 99999           unsigned numeric, n digits
//   S9(5)                  signed numeric, n digits
//   9(3)V99 | 9(3)V9(2)    numeric with implied decimal point

function parsePic(picString, line = null)
{
    const chars = String(picString).toUpperCase();

    if(!chars) { throw new CobolSyntaxError(line, "empty PIC clause"); }

    let i = 0;

    let signed = false;
    let picKind = null;
    let length = 0;
    let decimalLength = 0;
    let inDecimal = false;

    if(chars[i] === "S")
    {
        signed = true;
        i++;
    }

    while(i < chars.length)
    {
        const ch = chars[i];

        if(ch === "X" || ch === "A" || ch === "9")
        {
            const kind = (ch === "X")? "alphanumeric": (ch === "A"? "alphabetic": "numeric");

            if(picKind && picKind !== kind)
            {
                throw new CobolSyntaxError(line, `PIC mixes types: "${picString}"`);
            }

            picKind = kind;
            i++;

            let count = 1;

            if(chars[i] === "(")
            {
                const close = chars.indexOf(")", i);

                if(close === -1) { throw new CobolSyntaxError(line, `unclosed paren in PIC: "${picString}"`); }

                const repeat = parseInt(chars.substring(i + 1, close), 10);

                if(isNaN(repeat) || repeat < 1)
                {
                    throw new CobolSyntaxError(line, `invalid repeat in PIC: "${picString}"`);
                }

                count = repeat;
                i = close + 1;
            }

            while(chars[i] === ch) { count++; i++; }

            if(inDecimal) { decimalLength += count; }
            else          { length += count; }
        }
        else if(ch === "V")
        {
            if(picKind && picKind !== "numeric")
            {
                throw new CobolSyntaxError(line, `V is only valid in numeric PIC: "${picString}"`);
            }

            picKind = "numeric";
            inDecimal = true;
            i++;
        }
        else
        {
            throw new CobolSyntaxError(line, `unexpected character "${ch}" in PIC: "${picString}"`);
        }
    }

    if(picKind === null)
    {
        throw new CobolSyntaxError(line, `PIC has no character symbol: "${picString}"`);
    }

    if(signed && picKind !== "numeric")
    {
        throw new CobolSyntaxError(line, `S is only valid in numeric PIC: "${picString}"`);
    }

    if(picKind === "numeric" && length === 0 && decimalLength === 0)
    {
        throw new CobolSyntaxError(line, `PIC has no digits: "${picString}"`);
    }

    return { kind: picKind, length, decimalLength, signed };
}


export { parsePic };
