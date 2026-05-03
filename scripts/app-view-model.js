import { Editor } from "./modules/editor.js";
import { Console } from "./modules/console.js";
import { FileIO } from "./modules/file-io.js";
import * as Cobol from "./modules/cobol.js";
import * as Examples from "./modules/examples.js";


/******************************************************************************/
/* CONSTANTS                                                                  */
/******************************************************************************/

const BOOT_EXAMPLE = "HELLO-WORLD";


/******************************************************************************/
/* VIEW MODEL                                                                 */
/******************************************************************************/

class AppViewModel
{
    constructor(version)
    {
        this.version = version;

        // Editor content reflects the column-aware textarea: col 1 maps to
        // COBOL col 7, so a leading space keeps col 7 blank and puts
        // division / paragraph names in Area A. Boot example is loaded
        // through the same pipeline `loadExample` uses at runtime.
        const bootSource = Examples.byName(BOOT_EXAMPLE)?.source ?? "";

        this.editor = new Editor(bootSource);
        this.console = new Console();
        this.fileIO = new FileIO();

        this.currentFileName = ko.observable(null);
        this.displayFileName = ko.pureComputed(() => this.currentFileName() || "untitled.cbl");

        this.runStatus = ko.observable("READY");

        // `isDirty` is derived from data: dirty iff the editor's text differs from
        // the last known-saved baseline. `lastSavedText(null)` makes any non-null
        // editor content count as dirty — used for "no file yet" states.
        this.lastSavedText = ko.observable(null);
        this.isDirty = ko.pureComputed(() => this.editor.text() !== this.lastSavedText());

        // Typing invalidates a prior runtime error — the user is working on the fix.
        this.editor.text.subscribe(() =>
        {
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

        this.examplesList = Examples.list();
        this.examplesOpen = ko.observable(false);

        this.mount = this.mount.bind(this);
        this.loadProgram = this.loadProgram.bind(this);
        this.saveProgram = this.saveProgram.bind(this);
        this.newProgram = this.newProgram.bind(this);
        this.run = this.run.bind(this);
        this.toggleExamples = this.toggleExamples.bind(this);
        this.loadExample = this.loadExample.bind(this);

        this.console.writeSystem(`> COBOL.JS // ${this.version}`);
        this.console.writeSystem("> READY.");
    }

    toggleExamples()
    {
        if(this.isBusy()) { return; }

        this.examplesOpen(!this.examplesOpen());
    }

    loadExample(entry)
    {
        if(this.isBusy()) { return; }

        this.examplesOpen(false);

        const example = Examples.byName(entry.name);

        if(!example)
        {
            this.console.writeError(`! EXAMPLE "${entry.name}" NOT AVAILABLE`);

            return;
        }

        this.editor.setText(example.source);
        this.currentFileName(null);
        this.lastSavedText(null);
        this.runStatus("READY");

        this.console.writeSystem("> LOADED EXAMPLE: " + example.name);
    }

    newProgram()
    {
        if(this.isBusy()) { return; }

        this.editor.setText("");
        this.currentFileName(null);
        this.lastSavedText(null);
        this.runStatus("READY");
        this.console.writeSystem("> NEW PROGRAM");
    }

    async run()
    {
        if(this.isBusy()) { return; }

        this.runStatus("RUNNING");
        this.console.writeSystem("> RUN " + this.displayFileName());

        if(this.isDirty()) { this.console.writeWarning("! UNSAVED EDITS — RUNNING IN-MEMORY SOURCE"); }

        try
        {
            const success = await Cobol.run(this.editor.getText(), this.console);

            this.runStatus(success? "READY": "ERROR");
        }
        catch(error)
        {
            // Surface the stack to devtools; Cobol.run already user-facing-errored.
            console.error(error);
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
            this.lastSavedText(source);

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

            name = (await this.console.prompt()).trim();

            if(!name)
            {
                this.console.writeSystem("> SAVE CANCELED");

                return;
            }
        }

        try
        {
            const sourceAtSave = this.editor.getText();
            const savedAs = await this.fileIO.write(name, sourceAtSave);

            this.currentFileName(savedAs);
            this.lastSavedText(sourceAtSave);
            this.console.writeSystem("> SAVED " + savedAs);
        }
        catch(error)
        {
            this.console.writeError("! " + error.message);
        }
    }
}

export { AppViewModel };
