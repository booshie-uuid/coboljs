// Must be served from a local web server (http(s)/localhost). ES6 modules
// and the File System Access API both refuse to load from file:// origins.

import "./modules/bindings.js";
import { AppViewModel } from "./app-view-model.js";


/******************************************************************************/
/* APP SINGLETON                                                              */
/******************************************************************************/

// Format: V{plan}_{task}_{publish}. `plan` is 0 until the project ships its
// first complete product. `task` tracks the most recently completed task in
// PLAN.md and bumps as each one lands. `publish` resets to 0 on any change.
const VERSION = "V0_12_0";


class App
{
    constructor()
    {
        this.version = VERSION;
        this.viewModel = null;
    }

    start()
    {
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
