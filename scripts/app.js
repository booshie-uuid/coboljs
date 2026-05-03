// Must be served from a local web server (http(s)/localhost). ES6 modules
// and the File System Access API both refuse to load from file:// origins.

import "./modules/bindings.js";
import { AppViewModel } from "./app-view-model.js";
import * as Examples from "./modules/examples.js";


/******************************************************************************/
/* APP SINGLETON                                                              */
/******************************************************************************/

// Format: V{plan}_{task}_{release}.
// {plan}    — the current plan number.
// {task}    — the most recently completed task within the current plan.
// {release} — resets to 0 whenever {task} changes.
const VERSION = "V0_17_0";


class App
{
    constructor()
    {
        this.version = VERSION;
        this.viewModel = null;
    }

    async start()
    {
        // Examples are fetched up front so the editor can preload the
        // boot example and the dropdown is responsive to the first click.
        // A fetch failure (offline dev, misconfigured server) is logged
        // but does not block boot — the app still works without examples.
        try { await Examples.loadAll(); }
        catch(error) { console.error("Examples failed to load:", error); }

        this.viewModel = new AppViewModel(this.version);

        ko.applyBindings(this.viewModel);
    }
}

const app = new App();

window.App = app;


/******************************************************************************/
/* BOOTSTRAP                                                                  */
/******************************************************************************/

if(document.readyState === "loading")
{
    document.addEventListener("DOMContentLoaded", () => app.start());
}
else
{
    app.start();
}
