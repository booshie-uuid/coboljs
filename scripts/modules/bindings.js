/******************************************************************************/
/* KNOCKOUT BINDINGS                                                          */
/******************************************************************************/

// Registers all custom binding handlers used across the app. Imported once
// by app.js so the binding handlers exist before ko.applyBindings runs.
// Keeping these out of the modules they relate to means those modules stay
// import-side-effect-free and can be unit-tested in Node without a ko stub.


/* EDITOR WIRING **************************************************************/

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


/* AUTO SCROLL BOTTOM *********************************************************/

ko.bindingHandlers.autoScrollBottom =
{
    update(element, valueAccessor)
    {
        ko.unwrap(valueAccessor());

        // Defer to next tick so the foreach has rendered the new line(s) before we scroll.
        setTimeout(() => { element.scrollTop = element.scrollHeight; }, 0);
    }
};


/* CLOSE ON OUTSIDE CLICK *****************************************************/

// Sets the bound observable to false when a click lands outside the element.
// Used by the EXAMPLES dropdown so clicking the editor or another rail
// button collapses the menu without each consumer wiring its own listener.
ko.bindingHandlers.closeOnOutsideClick =
{
    init(element, valueAccessor)
    {
        const observable = valueAccessor();

        const handler = (event) =>
        {
            if(!element.contains(event.target)) { observable(false); }
        };

        document.addEventListener("mousedown", handler);

        ko.utils.domNodeDisposal.addDisposeCallback(element, () =>
        {
            document.removeEventListener("mousedown", handler);
        });
    }
};
