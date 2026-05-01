/******************************************************************************/
/* CONSOLE                                                                    */
/******************************************************************************/

class Console
{
    constructor()
    {
        this.lines = ko.observableArray([]);
        this.isPrompting = ko.observable(false);
        this.pendingPartial = ko.observable("");
        this.promptInput = ko.observable("");

        this.pendingResolve = null;

        this.handleInputKeyDown = this.handleInputKeyDown.bind(this);

        this.writeSystem("> COBOL.JS V0.1 // SYNTHWAVE EDITION");
        this.writeSystem("> READY.");
    }

    write(text, noAdvance = false)
    {
        if(noAdvance)
        {
            this.pendingPartial(this.pendingPartial() + text);

            return;
        }

        const fullText = this.pendingPartial() + text;

        this.pendingPartial("");
        this.lines.push({ text: fullText, kind: "output" });
    }

    writeSystem(text)
    {
        this.flushPartial();
        this.lines.push({ text: text, kind: "system" });
    }

    writeError(text)
    {
        this.flushPartial();
        this.lines.push({ text: text, kind: "error" });
    }

    flushPartial()
    {
        const partial = this.pendingPartial();

        if(!partial) { return; }

        this.lines.push({ text: partial, kind: "output" });
        this.pendingPartial("");
    }

    clear()
    {
        this.lines.removeAll();
        this.pendingPartial("");
    }

    prompt()
    {
        if(this.pendingResolve) { return Promise.reject(new Error("Console already prompting")); }

        return new Promise((resolve) =>
        {
            this.pendingResolve = resolve;
            this.isPrompting(true);
        });
    }

    submitPrompt()
    {
        if(!this.pendingResolve) { return; }

        const value = this.promptInput();
        const partial = this.pendingPartial();
        const displayed = partial? (partial + value): ("> " + value);

        this.lines.push({ text: displayed, kind: "input" });

        this.pendingPartial("");
        this.promptInput("");
        this.isPrompting(false);

        const resolve = this.pendingResolve;
        this.pendingResolve = null;

        resolve(value);
    }

    handleInputKeyDown(viewModel, event)
    {
        if(event.key !== "Enter") { return true; }

        this.submitPrompt();

        return false;
    }
}


/******************************************************************************/
/* KNOCKOUT BINDINGS                                                          */
/******************************************************************************/

ko.bindingHandlers.autoScrollBottom =
{
    update(element, valueAccessor)
    {
        ko.unwrap(valueAccessor());

        // Defer to next tick so the foreach has rendered the new line(s) before we scroll.
        setTimeout(() => { element.scrollTop = element.scrollHeight; }, 0);
    }
};


export { Console };
