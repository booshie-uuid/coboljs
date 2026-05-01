/********************************************************************************
 * Local File System JS
 * 
 * A wrapper for the browser's File System Access API, providing a convenient
 * methods for reading and writing files and directories.
 * 
 * Mounts local working directory and secures user permission to read and write
 * to that directory for the rest of the session.
 * 
 * DOES NOT require the page to be run from a server. Can be opened directly 
 * from your local file system. No fuss, no muss.
 * 
 * @author Matthew Lynch
 * @license 
 * Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)	
 *******************************************************************************/

class LocalFileSystem
{
    constructor()
    {
        this.ready = false
        this.directoryHandle = null;
    }

    async setWorkingDirectory()
    {
        try
        {
            this.directoryHandle = await window.showDirectoryPicker();

            await this.confirmWriteAccess();

            this.ready = true;
        }
        catch(error)
        {
            // User dismissing the picker is a non-error — don't pollute the console.
            if(error.name !== "AbortError")
            {
                console.error("Error setting working directory:", error);
            }

            throw error;
        }
    }

    confirmFileSystemReady()
    {
        if(!this.ready) { throw new Error("File system is not ready. Try setting a working directory."); }
    }

    async confirmWriteAccess()
    {
        try
        {
            const timestamp = new Date().toLocaleString();
            const content = `${timestamp}: Confirming write access to ${this.directoryHandle.name}\n`;

            await this.writeFile("lfs-access.log", content, true, true, null, true);
        }
        catch(error)
        {
            console.error("Error confirming write access:", error);

            throw error;
        }
    }

    splitPath(path)
    {
        const segments = (path || "").split("/").filter(s => s.length > 0);
        const name = segments.pop() || "";
        const dir = segments.join("/");

        return { dir, name };
    }

    async resolveDirectory(path = "", create = false, bypassReadyCheck = false)
    {
        try
        {
            if(!bypassReadyCheck) { this.confirmFileSystemReady(); }

            const segments = (path || "").split("/").filter(s => s.length > 0);

            let handle = this.directoryHandle;

            for(const segment of segments)
            {
                handle = await handle.getDirectoryHandle(segment, { create });
            }

            return handle;
        }
        catch(error)
        {
            console.error("Error resolving directory:", error);

            throw error;
        }
    }

    async createDirectory(path)
    {
        try
        {
            this.confirmFileSystemReady();

            return await this.resolveDirectory(path, true);
        }
        catch(error)
        {
            console.error("Error creating directory:", error);

            throw error;
        }
    }

    async listFiles(path = "")
    {
        try
        {
            this.confirmFileSystemReady();

            const dirHandle = await this.resolveDirectory(path);

            const entries = [];

            for await(const [name, handle] of dirHandle.entries())
            {
                entries.push({ name, kind: handle.kind });
            }

            return entries;
        }
        catch(error)
        {
            console.error("Error listing files:", error);

            throw error;
        }
    }

    async getFile(path, create = false, fileHandle = null, bypassReadyCheck = false)
    {
        try
        {
            if(!bypassReadyCheck) { this.confirmFileSystemReady(); }

            if(!fileHandle)
            {
                const { dir, name } = this.splitPath(path);
                const dirHandle = await this.resolveDirectory(dir, false, bypassReadyCheck);

                fileHandle = await dirHandle.getFileHandle(name, { create });
            }

            return fileHandle;
        }
        catch(error)
        {
            console.error("Error getting file:", error);

            throw error;
        }
    }

    async readFile(path)
    {
        try
        {
            this.confirmFileSystemReady();

            const { dir, name } = this.splitPath(path);
            const dirHandle = await this.resolveDirectory(dir);
            const fileHandle = await dirHandle.getFileHandle(name);
            const file = await fileHandle.getFile();

            return await file.text();
        }
        catch(error)
        {
            console.error("Error reading file:", error);

            throw error;
        }
    }

    async writeFile(path, content, create = false, keepExistingData = false, fileHandle = null, bypassReadyCheck = false)
    {
        try
        {
            if(!bypassReadyCheck) { this.confirmFileSystemReady(); }

            if(!fileHandle)
            {
                const { dir, name } = this.splitPath(path);
                const dirHandle = await this.resolveDirectory(dir, false, bypassReadyCheck);

                fileHandle = await dirHandle.getFileHandle(name, { create });
            }

            const writable = await fileHandle.createWritable({ keepExistingData });

            if(keepExistingData)
            {
                const file = await fileHandle.getFile();

                await writable.seek(file.size);
            }

            await writable.write(content);
            await writable.close();
        }
        catch(error)
        {
            console.error("Error writing file:", error);

            throw error;
        }
    }
}
