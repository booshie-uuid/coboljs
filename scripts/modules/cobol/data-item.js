import * as Pic from "./pic.js";
import { CobolSyntaxError } from "./errors.js";


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
        let num;

        if(typeof value === "number")      { num = value; }
        else if(typeof value === "string") { num = parseFloat(value); }
        else                               { num = NaN; }

        if(isNaN(num)) { num = 0; }

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

        const parsed = parseFloat(this.value);

        return isNaN(parsed)? 0: parsed;
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


export { DataItem };
