/******************************************************************************/
/* ERROR                                                                      */
/******************************************************************************/

class FileIOError extends Error
{
    constructor(message)
    {
        super(message);
        this.name = "FileIOError";
    }
}


/******************************************************************************/
/* FILE IO                                                                    */
/******************************************************************************/

class FileIO
{
    constructor()
    {
        this.fs = new LocalFileSystem();

        this.isMounted = ko.observable(false);
        this.programList = ko.observableArray([]);
    }

    async mount()
    {
        try
        {
            await this.fs.setWorkingDirectory();
        }
        catch(error)
        {
            // Browser fires AbortError when the user cancels the directory picker.
            if(error.name === "AbortError") { return false; }

            throw new FileIOError("Failed to mount working directory: " + error.message);
        }

        this.isMounted(true);

        await this.refreshList();

        return true;
    }

    async refreshList()
    {
        if(!this.isMounted()) { return; }

        let entries;

        try { entries = await this.fs.listFiles(); }
        catch(error) { throw new FileIOError("Failed to list files: " + error.message); }

        const programs = entries
            .filter(e => e.kind === "file" && e.name.endsWith(".cbl"))
            .map(e => e.name)
            .sort();

        this.programList(programs);
    }

    async read(name)
    {
        try { return await this.fs.readFile(name); }
        catch(error) { throw new FileIOError("Failed to read " + name + ": " + error.message); }
    }

    async write(name, source)
    {
        const filename = name.endsWith(".cbl")? name: (name + ".cbl");

        try { await this.fs.writeFile(filename, source, true, false); }
        catch(error) { throw new FileIOError("Failed to write " + filename + ": " + error.message); }

        await this.refreshList();

        return filename;
    }
}


export { FileIO, FileIOError };
