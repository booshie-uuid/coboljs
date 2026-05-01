/******************************************************************************/
/* EDITOR                                                                     */
/******************************************************************************/

class Editor
{
    constructor(initialText = "")
    {
        this.text = ko.observable(initialText);

        this.lineNumbers = ko.pureComputed(() =>
        {
            const count = Math.max(1, this.text().split("\n").length);

            const numbers = new Array(count);
            for(let i = 0; i < count; i++) { numbers[i] = String(i + 1).padStart(6, "0"); }

            return numbers;
        });
    }

    getText()
    {
        return this.text();
    }

    setText(text)
    {
        this.text(text);
    }

    insertIndent(textarea)
    {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const indent = "    ";

        const before = textarea.value.substring(0, start);
        const after = textarea.value.substring(end);

        textarea.value = before + indent + after;
        textarea.selectionStart = textarea.selectionEnd = start + indent.length;

        // Trigger KO's input subscription so the observable picks up the change.
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }
}


/******************************************************************************/
/* KNOCKOUT BINDING                                                           */
/******************************************************************************/

ko.bindingHandlers.editorWiring =
{
    init(element, valueAccessor)
    {
        const editor = valueAccessor();

        const textarea = element.querySelector("textarea");
        const gutter = element.querySelector(".editor-gutter");

        if(!textarea || !gutter) { return; }

        textarea.addEventListener("scroll", () =>
        {
            gutter.scrollTop = textarea.scrollTop;
        });

        textarea.addEventListener("keydown", (event) =>
        {
            if(event.key !== "Tab") { return; }

            event.preventDefault();
            editor.insertIndent(textarea);
        });
    }
};


export { Editor };
