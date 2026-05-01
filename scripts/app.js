// Must be served from a local web server (http(s)/localhost). ES6 modules
// and the File System Access API both refuse to load from file:// origins.

import { AppViewModel } from "./app-view-model.js";


/******************************************************************************/
/* APP SINGLETON                                                              */
/******************************************************************************/

class App
{
    constructor()
    {
        this.viewModel = null;
    }

    start()
    {
        this.viewModel = new AppViewModel();

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
