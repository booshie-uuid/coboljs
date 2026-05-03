import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { suite, test, expect } from "./runner.js";
import * as Examples from "../scripts/modules/examples.js";
import { Lexer } from "../scripts/modules/cobol/lexer.js";
import { Parser } from "../scripts/modules/cobol/parser.js";
import { Interpreter } from "../scripts/modules/cobol/interpreter.js";


/******************************************************************************/
/* HELPERS                                                                    */
/******************************************************************************/

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadExampleSource(fileName)
{
    return readFileSync(resolve(PROJECT_ROOT, "examples", fileName), "utf-8");
}

class MockConsole
{
    constructor(promptResponses = [])
    {
        this.lines = [];
        this.partial = "";
        this.promptResponses = [...promptResponses];
    }

    write(text, noAdvance = false)
    {
        if(noAdvance) { this.partial += text; return; }
        this.lines.push(this.partial + text);
        this.partial = "";
    }

    writeSystem()  {}
    writeError()   {}
    writeWarning() {}

    isPrompting() { return false; }

    async prompt()
    {
        return this.promptResponses.shift() ?? "";
    }
}

async function runSource(source, promptResponses = [])
{
    const tokens = new Lexer().tokenize(source);
    const program = new Parser().parse(tokens);
    const console = new MockConsole(promptResponses);

    await new Interpreter(program, console).execute();

    return console.lines;
}


/******************************************************************************/
/* MANIFEST                                                                   */
/******************************************************************************/

suite("Examples", () =>
{
    suite("manifest", () =>
    {
        test("list() returns six entries with name and description", () =>
        {
            const entries = Examples.list();

            expect(entries.length).toBe(6);

            for(const entry of entries)
            {
                expect(typeof entry.name).toBe("string");
                expect(typeof entry.description).toBe("string");
                expect(entry.name.length > 0).toBe(true);
                expect(entry.description.length > 0).toBe(true);
            }
        });

        test("list() includes the canonical six names", () =>
        {
            const names = Examples.list().map(e => e.name);

            expect(names).toEqual([
                "HELLO-WORLD",
                "FIZZBUZZ",
                "FIBONACCI",
                "MORTGAGE-CALC",
                "GUESS-THE-NUMBER",
                "FORTUNE-COOKIE"
            ]);
        });

        test("byName returns null for an unknown example", () =>
        {
            expect(Examples.byName("DOES-NOT-EXIST")).toBe(null);
        });

        test("byName returns the seeded source after seedForTesting", () =>
        {
            Examples.seedForTesting("HELLO-WORLD", loadExampleSource("hello-world.cbl"));

            const entry = Examples.byName("HELLO-WORLD");

            expect(entry !== null).toBe(true);
            expect(entry.name).toBe("HELLO-WORLD");
            expect(entry.source.includes("HELLO, WORLD!")).toBe(true);
        });
    });


    /* INTEGRATION ************************************************************/

    suite("integration", () =>
    {
        test("HELLO-WORLD runs and prints the canonical greeting", async () =>
        {
            const source = loadExampleSource("hello-world.cbl");
            const lines = await runSource(source);

            expect(lines).toEqual(["HELLO, WORLD!"]);
        });

        test("FIZZBUZZ produces the canonical 1-20 sequence", async () =>
        {
            const source = loadExampleSource("fizzbuzz.cbl");
            const lines = await runSource(source);

            expect(lines).toEqual([
                "01", "02", "FIZZ", "04", "BUZZ",
                "FIZZ", "07", "08", "FIZZ", "BUZZ",
                "11", "FIZZ", "13", "14", "FIZZBUZZ",
                "16", "17", "FIZZ", "19", "BUZZ"
            ]);
        });

        test("FIBONACCI prints the first fifteen Fibonacci numbers", async () =>
        {
            const source = loadExampleSource("fibonacci.cbl");
            const lines = await runSource(source);

            expect(lines).toEqual([
                "000", "001", "001", "002", "003",
                "005", "008", "013", "021", "034",
                "055", "089", "144", "233", "377"
            ]);
        });

        test("MORTGAGE-CALC computes the standard 30-yr / 6.5% / 100k payment", async () =>
        {
            const source = loadExampleSource("mortgage-calc.cbl");
            const lines = await runSource(source, ["100000", "6.5", "30"]);

            // Final line carries the result; per-prompt lines stay in
            // `partial` (no-advance) and end up prefixed onto the output.
            const last = lines[lines.length - 1];

            expect(last.includes("MONTHLY PAYMENT: $")).toBe(true);
            expect(last.includes("0000632.06")).toBe(true);
        });

        test("GUESS-THE-NUMBER converges on target 42 after expected guesses", async () =>
        {
            // Stub Math.random so the example's INTEGER(RANDOM * 100) + 1
            // resolves deterministically to 42. floor(0.419 * 100) + 1 = 42.
            const originalRandom = Math.random;
            Math.random = () => 0.419;

            try
            {
                const source = loadExampleSource("guess-the-number.cbl");
                const lines = await runSource(source, ["50", "70", "40", "42"]);

                expect(lines.some(l => l.includes("TOO HIGH"))).toBe(true);
                expect(lines.some(l => l.includes("TOO LOW"))).toBe(true);

                const last = lines[lines.length - 1];

                expect(last.includes("YOU GOT IT IN")).toBe(true);
                expect(last.includes("04")).toBe(true);
            }
            finally { Math.random = originalRandom; }
        });

        test("FORTUNE-COOKIE picks a fortune and renders mirror/whisper variants", async () =>
        {
            // Stub Math.random so PICK = INTEGER(0.51 * 6) + 1 = 4 ("TRUST THE SHADOWS.")
            const originalRandom = Math.random;
            Math.random = () => 0.51;

            try
            {
                const source = loadExampleSource("fortune-cookie.cbl");
                const lines = await runSource(source, ["MATT"]);

                expect(lines.some(l => l.includes("HELLO,    MATT!"))).toBe(true);
                expect(lines.some(l => l.includes("MIRROR:   TTAM"))).toBe(true);
                expect(lines.some(l => l.includes("WHISPER:  matt"))).toBe(true);
                expect(lines.some(l => l.includes("TRUST THE SHADOWS"))).toBe(true);

                // LENGTH("MATT") = 4; MOD(4, 9) + 1 = 5 → padded to "05"
                expect(lines.some(l => l.includes("LUCKY NUMBER: 05"))).toBe(true);
            }
            finally { Math.random = originalRandom; }
        });

        test("FORTUNE-COOKIE reveals palindrome easter egg for ANNA", async () =>
        {
            const originalRandom = Math.random;
            Math.random = () => 0.0;

            try
            {
                const source = loadExampleSource("fortune-cookie.cbl");
                const lines = await runSource(source, ["anna"]);

                expect(lines.some(l => l.includes("PALINDROME NAME"))).toBe(true);
                expect(lines.some(l => l.includes("MIRROR:   ANNA"))).toBe(true);
            }
            finally { Math.random = originalRandom; }
        });

        test("FORTUNE-COOKIE falls back to SEEKER for empty input", async () =>
        {
            const originalRandom = Math.random;
            Math.random = () => 0.0;

            try
            {
                const source = loadExampleSource("fortune-cookie.cbl");
                const lines = await runSource(source, [""]);

                expect(lines.some(l => l.includes("HELLO,    SEEKER!"))).toBe(true);
            }
            finally { Math.random = originalRandom; }
        });
    });
});
