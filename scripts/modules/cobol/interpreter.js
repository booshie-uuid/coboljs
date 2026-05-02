import { CobolRuntimeError } from "./errors.js";


/******************************************************************************/
/* INTERPRETER                                                                */
/******************************************************************************/

// Walks a Program produced by the Parser, dispatching each statement and
// emitting output to the supplied console handle. Async because ACCEPT
// awaits the user; arithmetic and control-flow statements arrive in
// later tasks but the dispatch pattern stays the same.
//
// Control flow for Tasks 9-10 is simple: walk every paragraph in order;
// STOP RUN returns immediately. Task 15 replaces the early-return with a
// proper `StopRunSignal` exception so PERFORMed paragraphs can propagate.

class Interpreter
{
    constructor(program, consoleHandle)
    {
        this.program = program;
        this.console = consoleHandle;
    }

    async execute()
    {
        for(const paragraph of this.program.paragraphs)
        {
            for(const statement of paragraph.statements)
            {
                if(statement.kind === "STOP_RUN") { return; }

                await this.executeStatement(statement);
            }
        }
    }

    async executeStatement(statement)
    {
        switch(statement.kind)
        {
            case "DISPLAY": return this.executeDisplay(statement);
            case "MOVE":    return this.executeMove(statement);
            case "ACCEPT":  return this.executeAccept(statement);

            default:
                throw new CobolRuntimeError(statement.line, `unsupported statement "${statement.kind}"`);
        }
    }


    /* DISPLAY *****************************************************************/

    executeDisplay(statement)
    {
        let output = "";

        for(const operand of statement.operands)
        {
            output += this.resolveDisplayOf(operand);
        }

        this.console.write(output, statement.noAdvance);
    }


    /* MOVE ********************************************************************/

    executeMove(statement)
    {
        const value = this.resolveValueOf(statement.source);

        for(const target of statement.targets)
        {
            const item = this.lookupItem(target);

            item.assign(value);
        }
    }


    /* ACCEPT ******************************************************************/

    async executeAccept(statement)
    {
        const item = this.lookupItem(statement.target);
        const input = await this.console.prompt();

        item.assign(input);
    }


    /* RESOLUTION **************************************************************/

    resolveDisplayOf(operand)
    {
        if(operand.kind === "literal")
        {
            return String(operand.value);
        }

        if(operand.kind === "identifier")
        {
            return this.lookupItem(operand).getDisplay();
        }

        throw new CobolRuntimeError(operand.line, `unknown operand kind "${operand.kind}"`);
    }

    resolveValueOf(operand)
    {
        if(operand.kind === "literal")
        {
            if(operand.literalType === "number") { return parseFloat(operand.value); }

            return operand.value;
        }

        if(operand.kind === "identifier")
        {
            const item = this.lookupItem(operand);

            if(item.isGroup())              { return item.getDisplay(); }
            if(item.pic.kind === "numeric") { return item.getNumeric(); }

            return item.getDisplay();
        }

        throw new CobolRuntimeError(operand.line, `unknown operand kind "${operand.kind}"`);
    }

    lookupItem(operand)
    {
        const item = this.program.dataItems.get(operand.name);

        if(!item)
        {
            throw new CobolRuntimeError(operand.line, `identifier "${operand.name}" is not defined`);
        }

        return item;
    }
}


export { Interpreter };
