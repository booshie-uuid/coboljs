import { CobolRuntimeError } from "./errors.js";
import { ExpressionEvaluator } from "./expression.js";


/******************************************************************************/
/* INTERPRETER                                                                */
/******************************************************************************/

// Walks a Program produced by the Parser, dispatching each statement
// and emitting output to the supplied console handle. Async because
// ACCEPT awaits the user.
//
// Control-flow unwinds use internal exception classes. Throwing instead
// of returning a sentinel lets each signal propagate cleanly through
// nested IF bodies and PERFORMed paragraphs without every caller having
// to inspect a return value.
//
//   StopRunSignal      — STOP RUN / GOBACK; caught by `execute` (whole
//                        program halts).
//   ExitParagraphSignal — EXIT PARAGRAPH; caught by `runParagraph`
//                        (current paragraph ends, control returns to
//                        whoever invoked it — the top-level walk or a
//                        PERFORM).
//   ExitPerformSignal  — EXIT PERFORM; caught by `executePerform`
//                        (enclosing PERFORM returns). If thrown outside
//                        a PERFORM it's converted to a runtime error in
//                        `execute`.
//
// Bare EXIT and EXIT PROGRAM are no-ops: bare EXIT is the placeholder-
// paragraph idiom; EXIT PROGRAM is defined as a no-op in the main
// program (it only does work in sub-programs, which we don't yet
// support).

class StopRunSignal extends Error
{
    constructor() { super("STOP RUN"); this.name = "StopRunSignal"; }
}

class ExitParagraphSignal extends Error
{
    constructor() { super("EXIT PARAGRAPH"); this.name = "ExitParagraphSignal"; }
}

class ExitPerformSignal extends Error
{
    constructor(line) { super("EXIT PERFORM"); this.name = "ExitPerformSignal"; this.line = line; }
}


class Interpreter
{
    constructor(program, consoleHandle)
    {
        this.program = program;
        this.console = consoleHandle;
        this.evaluator = new ExpressionEvaluator();

        // Bind once so each COMPUTE/condition evaluation can hand the
        // same function reference to ExpressionEvaluator without
        // allocating a fresh closure per call.
        this.resolveNumeric = (name, line) => this.lookupName(name, line).getNumeric();
    }

    async execute()
    {
        try
        {
            for(const paragraph of this.program.paragraphs)
            {
                await this.runParagraph(paragraph);
            }
        }
        catch(error)
        {
            if(error instanceof StopRunSignal) { return; }

            // EXIT PERFORM that escapes its enclosing PERFORM is a usage
            // error (statement only meaningful inside a PERFORM target).
            if(error instanceof ExitPerformSignal)
            {
                throw new CobolRuntimeError(error.line, "EXIT PERFORM is only valid inside a PERFORMed paragraph");
            }

            throw error;
        }
    }

    async runParagraph(paragraph)
    {
        try
        {
            for(const statement of paragraph.statements)
            {
                await this.executeStatement(statement);
            }
        }
        catch(error)
        {
            if(error instanceof ExitParagraphSignal) { return; }

            throw error;
        }
    }

    lookupParagraph(name, line)
    {
        const found = this.program.paragraphs.find(p => p.name === name);

        if(!found) { throw new CobolRuntimeError(line, `paragraph "${name}" is not defined`); }

        return found;
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
            case "IF":       return this.executeIf(statement);
            case "PERFORM":  return this.executePerform(statement);
            case "STOP_RUN": throw new StopRunSignal();
            case "GOBACK":   throw new StopRunSignal();
            case "EXIT":     return this.executeExit(statement);

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
        const result = this.evaluator.evaluate(statement.expressionTokens, this.resolveNumeric);

        this.lookupItem(statement.target).assign(result);
    }


    /* PERFORM *****************************************************************/

    async executePerform(statement)
    {
        const paragraph = this.lookupParagraph(statement.target, statement.line);

        try
        {
            switch(statement.form)
            {
                case "SIMPLE":
                    await this.runParagraph(paragraph);
                    return;

                case "TIMES":
                {
                    const count = this.numericOf(statement.count);

                    for(let i = 0; i < count; i++) { await this.runParagraph(paragraph); }

                    return;
                }

                case "UNTIL":
                    while(!this.evaluateCondition(statement.condition))
                    {
                        await this.runParagraph(paragraph);
                    }
                    return;

                case "VARYING":
                {
                    const varItem = this.lookupName(statement.varName, statement.line);
                    const byValue = this.numericOf(statement.by);

                    varItem.assign(this.numericOf(statement.from));

                    while(!this.evaluateCondition(statement.condition))
                    {
                        await this.runParagraph(paragraph);
                        varItem.assign(varItem.getNumeric() + byValue);
                    }

                    return;
                }
            }

            throw new CobolRuntimeError(statement.line, `unknown PERFORM form "${statement.form}"`);
        }
        catch(error)
        {
            if(error instanceof ExitPerformSignal) { return; }

            throw error;
        }
    }


    /* EXIT ********************************************************************/

    executeExit(statement)
    {
        if(statement.form === "PARAGRAPH") { throw new ExitParagraphSignal(); }
        if(statement.form === "PERFORM")   { throw new ExitPerformSignal(statement.line); }

        // PLAIN and PROGRAM: no-op.
    }


    /* IF / CONDITIONS *********************************************************/

    async executeIf(statement)
    {
        const branch = this.evaluateCondition(statement.condition)? statement.thenBody: statement.elseBody;

        for(const inner of branch) { await this.executeStatement(inner); }
    }

    evaluateCondition(node)
    {
        switch(node.kind)
        {
            case "compare": return this.evaluateCompare(node);

            case "logical":
                if(node.op === "AND") { return this.evaluateCondition(node.left) && this.evaluateCondition(node.right); }
                if(node.op === "OR")  { return this.evaluateCondition(node.left) || this.evaluateCondition(node.right); }
                throw new CobolRuntimeError(node.line, `unknown logical op "${node.op}"`);

            case "not":
                return !this.evaluateCondition(node.operand);

            default:
                throw new CobolRuntimeError(node.line, `unknown condition kind "${node.kind}"`);
        }
    }

    evaluateCompare(node)
    {
        const left  = this.evaluator.evaluate(node.left,  this.resolveNumeric);
        const right = this.evaluator.evaluate(node.right, this.resolveNumeric);

        switch(node.op)
        {
            case "=":  return left === right;
            case "<":  return left <  right;
            case ">":  return left >  right;
            case "<=": return left <= right;
            case ">=": return left >= right;

            default:
                throw new CobolRuntimeError(node.line, `unknown comparison op "${node.op}"`);
        }
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
            const trimmed = String(operand.value).trim();
            const parsed  = trimmed === ""? NaN: Number(trimmed);

            if(isNaN(parsed))
            {
                throw new CobolRuntimeError(operand.line, `invalid numeric data "${operand.value}"`);
            }

            return parsed;
        }

        if(operand.kind === "identifier")
        {
            return this.lookupItem(operand).getNumeric();
        }

        throw new CobolRuntimeError(operand.line, `unknown operand kind "${operand.kind}"`);
    }

    lookupName(name, line)
    {
        const item = this.program.dataItems.get(name);

        if(!item) { throw new CobolRuntimeError(line, `identifier "${name}" is not defined`); }

        return item;
    }

    lookupItem(operand)
    {
        return this.lookupName(operand.name, operand.line);
    }
}


export { Interpreter };
