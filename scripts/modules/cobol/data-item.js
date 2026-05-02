import * as Pic from "./pic.js";
import { CobolSyntaxError, CobolRuntimeError } from "./errors.js";


/******************************************************************************/
/* DATA ITEM                                                                  */
/******************************************************************************/

class DataItem
{
    constructor({ level, name, parent = null, picString = null, initialValue = undefined, line = null })
    {
        this.level = level;
        this.name = name;
        this.parent = parent;
        this.children = [];
        this.line = line;

        this.pic = (picString != null)? Pic.parsePic(picString, line): null;

        if(this.isElementary())
        {
            if(initialValue !== undefined)
            {
                this.assign(initialValue);
            }
            else
            {
                this.value = this.pic.kind === "numeric"? 0: " ".repeat(this.pic.length);
            }
        }

        if(parent) { parent.addChild(this); }
    }

    isGroup()
    {
        return this.pic === null;
    }

    isElementary()
    {
        return this.pic !== null;
    }

    addChild(child)
    {
        if(this.isElementary())
        {
            throw new CobolSyntaxError(child.line, `cannot nest "${child.name}" inside elementary item "${this.name}"`);
        }

        this.children.push(child);
    }


    /* ASSIGN ******************************************************************/

    assign(value)
    {
        if(this.isGroup())
        {
            throw new Error(`cannot assign to group item "${this.name}"`);
        }

        if(this.pic.kind === "numeric") { this.assignNumeric(value); }
        else                            { this.assignAlpha(value); }
    }

    assignNumeric(value)
    {
        const num = parseStrictNumber(value);

        if(num === null)
        {
            throw new CobolRuntimeError(this.line, `invalid numeric data "${value}" for ${this.name}`);
        }

        // Unsigned PIC silently drops a negative sign per classic COBOL.
        this.value = this.pic.signed? num: Math.abs(num);
    }

    assignAlpha(value)
    {
        let str = String(value);

        if(str.length > this.pic.length) { str = str.substring(0, this.pic.length); }
        else                             { str = str.padEnd(this.pic.length, " "); }

        this.value = str;
    }


    /* READ ********************************************************************/

    getDisplay()
    {
        if(this.isGroup())
        {
            return this.children.map(c => c.getDisplay()).join("");
        }

        if(this.pic.kind === "numeric") { return this.formatNumeric(); }

        return this.value;
    }

    getNumeric()
    {
        if(this.isGroup())
        {
            throw new Error(`cannot read numeric from group item "${this.name}"`);
        }

        if(this.pic.kind === "numeric") { return this.value; }

        const parsed = parseStrictNumber(this.value);

        if(parsed === null)
        {
            throw new CobolRuntimeError(this.line, `invalid numeric data "${this.value}" for ${this.name}`);
        }

        return parsed;
    }

    formatNumeric()
    {
        const total = this.pic.length + this.pic.decimalLength;
        const max = Math.pow(10, total);
        const scale = Math.pow(10, this.pic.decimalLength);

        const absScaled = Math.abs(Math.trunc(this.value * scale));
        const truncated = absScaled % max;
        const padded = String(truncated).padStart(total, "0");

        let formatted;

        if(this.pic.decimalLength > 0)
        {
            const integerPart = padded.substring(0, this.pic.length);
            const decimalPart = padded.substring(this.pic.length);

            formatted = integerPart + "." + decimalPart;
        }
        else
        {
            formatted = padded;
        }

        return (this.value < 0 && this.pic.signed)? "-" + formatted: formatted;
    }
}


/******************************************************************************/
/* HELPERS                                                                    */
/******************************************************************************/

// Returns the numeric value of `value`, or null if it can't be cleanly
// interpreted. Stricter than parseFloat — partial parses like "50*2" fail.
function parseStrictNumber(value)
{
    if(typeof value === "number") { return isNaN(value)? null: value; }
    if(typeof value !== "string") { return null; }

    const trimmed = value.trim();

    if(trimmed === "") { return null; }

    const num = Number(trimmed);

    return isNaN(num)? null: num;
}


export { DataItem };
