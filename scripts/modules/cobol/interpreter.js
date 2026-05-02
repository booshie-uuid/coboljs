import { CobolRuntimeError } from "./errors.js";
import { ExpressionEvaluator } from "./expression.js";


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
            case "DISPLAY":  return this.executeDisplay(statement);
            case "MOVE":     return this.executeMove(statement);
            case "ACCEPT":   return this.executeAccept(statement);
            case "ADD":      return this.executeAdd(statement);
            case "SUBTRACT": return this.executeSubtract(statement);
            case "MULTIPLY": return this.executeMultiply(statement);
            case "DIVIDE":   return this.executeDivide(statement);
            case "COMPUTE":  return this.executeCompute(statement);

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


    /* ARITHMETIC **************************************************************/

    executeAdd(statement)
    {
        const sum = statement.sources.reduce((acc, op) => acc + this.numericOf(op), 0);

        for(const target of statement.targets)
        {
            const item = this.lookupItem(target);

            item.assign(statement.giving? sum: item.getNumeric() + sum);
        }
    }

    executeSubtract(statement)
    {
        const sum = statement.sources.reduce((acc, op) => acc + this.numericOf(op), 0);

        if(statement.giving)
        {
            const fromValue = this.numericOf(statement.from);
            const result = fromValue - sum;

            for(const target of statement.targets) { this.lookupItem(target).assign(result); }

            return;
        }

        for(const target of statement.targets)
        {
            const item = this.lookupItem(target);

            item.assign(item.getNumeric() - sum);
        }
    }

    executeMultiply(statement)
    {
        const multiplier = this.numericOf(statement.multiplier);

        if(statement.giving)
        {
            const result = multiplier * this.numericOf(statement.multiplicand);

            for(const target of statement.targets) { this.lookupItem(target).assign(result); }

            return;
        }

        for(const target of statement.targets)
        {
            const item = this.lookupItem(target);

            item.assign(item.getNumeric() * multiplier);
        }
    }

    executeDivide(statement)
    {
        const divisor = this.numericOf(statement.divisor);

        if(divisor === 0) { throw new CobolRuntimeError(statement.line, "Division by zero"); }

        if(statement.giving)
        {
            const result = this.numericOf(statement.dividend) / divisor;

            for(const target of statement.targets) { this.lookupItem(target).assign(result); }

            return;
        }

        for(const target of statement.targets)
        {
            const item = this.lookupItem(target);

            item.assign(item.getNumeric() / divisor);
        }
    }


    /* COMPUTE *****************************************************************/

    executeCompute(statement)
    {
        const resolver = (name, line) => this.lookupItem({ name, line }).getNumeric();

        const evaluator = new ExpressionEvaluator(resolver);
        const result = evaluator.evaluate(statement.expressionTokens);

        this.lookupItem(statement.target).assign(result);
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

    numericOf(operand)
    {
        if(operand.kind === "literal")
        {
            const parsed = parseFloat(operand.value);

            return isNaN(parsed)? 0: parsed;
        }

        if(operand.kind === "identifier")
        {
            return this.lookupItem(operand).getNumeric();
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
