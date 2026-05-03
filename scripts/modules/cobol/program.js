/******************************************************************************/
/* PROGRAM                                                                    */
/******************************************************************************/

// Container the Parser fills and the Interpreter walks. Holds the
// program identifier, the working-storage data items, and the ordered
// list of paragraphs in PROCEDURE DIVISION.
//
// Every Program starts with a single anonymous paragraph (`name ===
// null`). Statements before the first named paragraph land there;
// named-paragraph headers append additional paragraphs.

class Program
{
    constructor()
    {
        this.programId = null;
        this.dataItems = new Map();
        this.paragraphs = [new Paragraph(null)];
    }

    addParagraph(name)
    {
        const paragraph = new Paragraph(name);

        this.paragraphs.push(paragraph);

        return paragraph;
    }

    currentParagraph()
    {
        return this.paragraphs[this.paragraphs.length - 1];
    }
}


/******************************************************************************/
/* PARAGRAPH                                                                  */
/******************************************************************************/

class Paragraph
{
    constructor(name)
    {
        this.name = name;
        this.statements = [];
    }

    addStatement(statement)
    {
        this.statements.push(statement);
    }
}


export { Program, Paragraph };
