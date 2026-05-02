/******************************************************************************/
/* COBOL ERRORS                                                               */
/******************************************************************************/

class CobolSyntaxError extends Error
{
    constructor(line, message)
    {
        super(message);

        this.name = "CobolSyntaxError";
        this.line = line;
    }
}

class CobolRuntimeError extends Error
{
    constructor(line, message)
    {
        super(message);

        this.name = "CobolRuntimeError";
        this.line = line;
    }
}


export { CobolSyntaxError, CobolRuntimeError };
