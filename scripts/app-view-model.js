import { Editor } from "./modules/editor.js";
import { Console } from "./modules/console.js";
import { FileIO } from "./modules/file-io.js";
import * as Cobol from "./modules/cobol.js";


/******************************************************************************/
/* PLACEHOLDER SOURCE                                                         */
/******************************************************************************/

// Boot-time editor content. Updated each task to demo the latest
// feature; will be replaced by an Examples lookup in Task 16.
//
// Indentation reflects the editor's coordinate system: the gutter
// visually represents cols 1-6 (sequence area), so textarea col 1 is
// COBOL col 7 (indicator). One leading space keeps col 7 blank and
// puts division / paragraph names at col 8 (Area A); five leading
// spaces put statements at col 12 (Area B).
const INITIAL_SOURCE =
` IDENTIFICATION DIVISION.
 PROGRAM-ID. PERFORM-DEMO.

 DATA DIVISION.
 WORKING-STORAGE SECTION.
 01 I PIC 9(2).
 01 PRODUCT PIC 9(3).

 PROCEDURE DIVISION.
 MAIN.
     DISPLAY "MULTIPLICATION TABLE FOR 7:".
     PERFORM PRINT-ROW VARYING I FROM 1 BY 1 UNTIL I > 10.
     DISPLAY "DONE!".
     PERFORM CHEER 3 TIMES.
     STOP RUN.

 PRINT-ROW.
     MULTIPLY I BY 7 GIVING PRODUCT.
     DISPLAY I " * 7 = " PRODUCT.

 CHEER.
     DISPLAY "WHEEEE!".
`;


/******************************************************************************/
/* VIEW MODEL                                                                 */
/******************************************************************************/

class AppViewModel
{
    constructor(version)
    {
        this.version = version;

        this.editor = new Editor(INITIAL_SOURCE);
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

        this.mount = this.mount.bind(this);
        this.loadProgram = this.loadProgram.bind(this);
        this.saveProgram = this.saveProgram.bind(this);
        this.newProgram = this.newProgram.bind(this);
        this.run = this.run.bind(this);

        this.console.writeSystem(`> COBOL.JS // ${this.version}`);
        this.console.writeSystem("> READY.");
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
