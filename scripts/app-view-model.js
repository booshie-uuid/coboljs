import { Editor } from "./modules/editor.js";
import { Console } from "./modules/console.js";
import { FileIO } from "./modules/file-io.js";


/******************************************************************************/
/* PLACEHOLDER SOURCE                                                         */
/******************************************************************************/

// Replaced in Task 16 by Examples.byName("HELLO-WORLD").source.
//
// Indentation reflects the editor's coordinate system: the gutter visually
// represents cols 1-6 (sequence area), so textarea col 1 is COBOL col 7
// (indicator). One leading space keeps col 7 blank and puts division /
// paragraph names at col 8 (Area A); five leading spaces put statements at
// col 12 (Area B).
const INITIAL_SOURCE =
` IDENTIFICATION DIVISION.
 PROGRAM-ID. HELLO-WORLD.

 PROCEDURE DIVISION.
     DISPLAY "HELLO, WORLD!".
     STOP RUN.
`;


/******************************************************************************/
/* VIEW MODEL                                                                 */
/******************************************************************************/

class AppViewModel
{
    constructor()
    {
        this.editor = new Editor(INITIAL_SOURCE);
        this.console = new Console();
        this.fileIO = new FileIO();

        this.currentFileName = ko.observable(null);
        this.displayFileName = ko.pureComputed(() => this.currentFileName() || "untitled.cbl");

        this.runStatus = ko.observable("READY");
        this.isDirty = ko.observable(true);

        this.editor.text.subscribe(() =>
        {
            this.isDirty(true);

            // Typing invalidates a prior runtime error — the user is working on the fix.
            if(this.runStatus() === "ERROR") { this.runStatus("READY"); }
        });

        this.status = ko.pureComputed(() =>
        {
            const r = this.runStatus();

            if(r === "RUNNING") { return "RUNNING"; }
            if(r === "ERROR")   { return "ERROR"; }

            return this.isDirty()? "UNSAVED": "SAVED";
        });

        this.isBusy = ko.pureComputed(() => this.console.isPrompting() || this.runStatus() === "RUNNING");

        this.mount = this.mount.bind(this);
        this.loadProgram = this.loadProgram.bind(this);
        this.saveProgram = this.saveProgram.bind(this);
        this.newProgram = this.newProgram.bind(this);
        this.run = this.run.bind(this);
    }

    newProgram()
    {
        if(this.isBusy()) { return; }

        this.editor.setText("");
        this.currentFileName(null);
        this.isDirty(true);
        this.runStatus("READY");
        this.console.writeSystem("> NEW PROGRAM");
    }

    async run()
    {
        if(this.isBusy()) { return; }

        if(this.isDirty())
        {
            this.console.writeError("! SAVE BEFORE RUNNING");

            return;
        }

        this.runStatus("RUNNING");
        this.console.writeSystem("> RUN " + this.displayFileName());

        const start = performance.now();

        try
        {
            const firstLine = (this.editor.getText().split("\n")[0] || "").trim();

            if(firstLine) { this.console.write(firstLine); }

            const elapsed = Math.round(performance.now() - start);
            this.console.writeSystem("> PROGRAM TERMINATED NORMALLY (" + elapsed + "ms)");

            this.runStatus("READY");
        }
        catch(error)
        {
            this.console.writeError("! " + error.message);
            this.runStatus("ERROR");
        }
    }

    async mount()
    {
        if(this.isBusy()) { return; }

        try
        {
            const mounted = await this.fileIO.mount();

            if(mounted) { this.console.writeSystem("> WORKING DIRECTORY MOUNTED"); }
            else        { this.console.writeSystem("> SET DIR CANCELED"); }
        }
        catch(error)
        {
            this.console.writeError("! " + error.message);
        }
    }

    async loadProgram(name)
    {
        if(this.isBusy()) { return; }

        try
        {
            const source = await this.fileIO.read(name);

            this.editor.setText(source);
            this.currentFileName(name);
            this.isDirty(false);

            this.console.writeSystem("> LOADED " + name);
        }
        catch(error)
        {
            this.console.writeError("! " + error.message);
        }
    }

    async saveProgram()
    {
        if(this.isBusy()) { return; }

        if(!this.fileIO.isMounted())
        {
            this.console.writeError("! SET WORKING DIRECTORY TO ENABLE SAVING");

            return;
        }

        let name = this.currentFileName();

        if(!name)
        {
            this.console.write("SAVE AS: ", true);

            name = await this.console.prompt();

            if(!name)
            {
                this.console.writeSystem("> SAVE CANCELED");

                return;
            }
        }

        try
        {
            const savedAs = await this.fileIO.write(name, this.editor.getText());

            this.currentFileName(savedAs);
            this.isDirty(false);
            this.console.writeSystem("> SAVED " + savedAs);
        }
        catch(error)
        {
            this.console.writeError("! " + error.message);
        }
    }
}

export { AppViewModel };
