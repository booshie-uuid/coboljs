import { Lexer } from "./cobol/lexer.js";
import { Parser } from "./cobol/parser.js";
import { Interpreter } from "./cobol/interpreter.js";
import { CobolSyntaxError, CobolRuntimeError } from "./cobol/errors.js";


/******************************************************************************/
/* RUN                                                                        */
/******************************************************************************/

async function run(source, consoleHandle)
{
    const start = performance.now();

    try
    {
        const tokens = new Lexer().tokenize(source);
        const program = new Parser().parse(tokens);

        await new Interpreter(program, consoleHandle).execute();

        const elapsed = Math.round(performance.now() - start);
        consoleHandle.writeSystem(`> PROGRAM TERMINATED NORMALLY (${elapsed}ms)`);

        return true;
    }
    catch(error)
    {
        if(error instanceof CobolSyntaxError)
        {
            consoleHandle.writeError(`! SYNTAX ERROR LINE ${error.line}: ${error.message}`);
        }
        else if(error instanceof CobolRuntimeError)
        {
            consoleHandle.writeError(`! RUNTIME ERROR LINE ${error.line}: ${error.message}`);
        }
        else
        {
            consoleHandle.writeError(`! INTERNAL ERROR: ${error.message}`);

            // Re-throw so the dev still sees the stack in browser devtools.
            throw error;
        }

        return false;
    }
}


export { run, CobolSyntaxError, CobolRuntimeError };
