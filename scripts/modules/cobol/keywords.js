/******************************************************************************/
/* KEYWORDS                                                                   */
/******************************************************************************/

const KEYWORDS = new Set([
    // Divisions / Sections
    "IDENTIFICATION", "ENVIRONMENT", "DATA", "PROCEDURE",
    "DIVISION", "SECTION", "WORKING-STORAGE", "PROGRAM-ID",

    // Data
    "PIC", "PICTURE", "VALUE", "ZERO", "ZEROS", "ZEROES", "SPACE", "SPACES",

    // I/O
    "DISPLAY", "ACCEPT", "WITH", "NO", "ADVANCING",

    // Movement
    "MOVE", "TO", "FROM",

    // Arithmetic
    "ADD", "SUBTRACT", "MULTIPLY", "DIVIDE", "COMPUTE",
    "BY", "INTO", "GIVING",

    // Control flow
    "IF", "THEN", "ELSE", "END-IF",
    "PERFORM", "TIMES", "UNTIL", "VARYING",
    "STOP", "RUN", "GOBACK", "EXIT", "PARAGRAPH", "PROGRAM",

    // Conditions
    "AND", "OR", "NOT",

    // Intrinsic function call
    "FUNCTION"
]);


function has(word)
{
    return KEYWORDS.has(String(word).toUpperCase());
}


export { KEYWORDS, has };
