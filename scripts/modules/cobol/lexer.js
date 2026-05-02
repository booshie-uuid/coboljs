import * as Keywords from "./keywords.js";
import { CobolSyntaxError } from "./errors.js";


/******************************************************************************/
/* LEXER                                                                      */
/******************************************************************************/

class Lexer
{
    tokenize(source)
    {
        const tokens = [];
        const lines = source.split(/\r?\n/);

        for(let i = 0; i < lines.length; i++)
        {
            const line = lines[i];
            const lineNum = i + 1;

            // A leading `*` (after any leading whitespace) is a full-line
            // comment. `*>` is the inline form and is handled mid-line.
            const trimmed = line.trimStart();

            if(trimmed.startsWith("*") && !trimmed.startsWith("*>")) { continue; }

            this.tokenizeLine(line, lineNum, tokens);
        }

        tokens.push({ type: "EOF", value: null, line: lines.length });

        return tokens;
    }

    tokenizeLine(line, lineNum, tokens)
    {
        const len = line.length;

        let i = 0;

        while(i < len)
        {
            const ch = line[i];

            if(ch === " " || ch === "\t") { i++; continue; }

            if(ch === "*" && line[i + 1] === ">") { return; }

            if(ch === "'" || ch === '"')
            {
                const result = this.readString(line, i, ch, lineNum);

                tokens.push({ type: "STRING", value: result.value, line: lineNum });
                i = result.end;

                continue;
            }

            if(this.isDigit(ch))
            {
                const result = this.readNumber(line, i);

                tokens.push({ type: "NUMBER", value: result.value, line: lineNum });
                i = result.end;

                continue;
            }

            if(ch === ".")
            {
                tokens.push({ type: "PERIOD", value: ".", line: lineNum });
                i++;

                continue;
            }

            if(ch === "(")
            {
                tokens.push({ type: "LPAREN", value: "(", line: lineNum });
                i++;

                continue;
            }

            if(ch === ")")
            {
                tokens.push({ type: "RPAREN", value: ")", line: lineNum });
                i++;

                continue;
            }

            const twoChar = line.substring(i, i + 2);

            if(twoChar === ">=" || twoChar === "<=" || twoChar === "**")
            {
                tokens.push({ type: "OPERATOR", value: twoChar, line: lineNum });
                i += 2;

                continue;
            }

            if("+-*/=<>".includes(ch))
            {
                tokens.push({ type: "OPERATOR", value: ch, line: lineNum });
                i++;

                continue;
            }

            if(this.isIdentStart(ch))
            {
                const result = this.readIdent(line, i);
                const type = Keywords.has(result.value)? "KEYWORD": "IDENTIFIER";

                tokens.push({ type, value: result.value, line: lineNum });
                i = result.end;

                continue;
            }

            throw new CobolSyntaxError(lineNum, `unexpected character '${ch}'`);
        }
    }

    readString(line, start, quote, lineNum)
    {
        let i = start + 1;
        let value = "";

        while(i < line.length)
        {
            const ch = line[i];

            if(ch === quote)
            {
                // Doubled quote inside the string is the COBOL escape.
                if(line[i + 1] === quote) { value += quote; i += 2; continue; }

                return { value, end: i + 1 };
            }

            value += ch;
            i++;
        }

        throw new CobolSyntaxError(lineNum, "unterminated string literal");
    }

    readNumber(line, start)
    {
        let end = start;

        while(end < line.length && this.isDigit(line[end])) { end++; }

        // Optional decimal portion. We only consume the dot if the next char
        // is a digit, so a sentence-terminating period stays its own token.
        if(line[end] === "." && this.isDigit(line[end + 1]))
        {
            end++;

            while(end < line.length && this.isDigit(line[end])) { end++; }
        }

        return { value: line.substring(start, end), end };
    }

    readIdent(line, start)
    {
        let end = start + 1;

        while(end < line.length && this.isIdentCont(line[end])) { end++; }

        return { value: line.substring(start, end).toUpperCase(), end };
    }

    isDigit(ch)
    {
        return ch >= "0" && ch <= "9";
    }

    isIdentStart(ch)
    {
        return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
    }

    isIdentCont(ch)
    {
        return this.isIdentStart(ch) || this.isDigit(ch) || ch === "-" || ch === "_";
    }
}


export { Lexer };
