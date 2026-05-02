// Companion `autoScrollBottom` Knockout binding lives in scripts/modules/bindings.js.


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

    writeWarning(text)
    {
        this.flushPartial();
        this.lines.push({ text: text, kind: "warning" });
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


export { Console };
