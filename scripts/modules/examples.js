/******************************************************************************/
/* EXAMPLES                                                                   */
/******************************************************************************/

// Bundled example programs. Manifest lives here (the human-readable
// metadata); source lives as .cbl files under `/examples/`. Sources are
// fetched once at boot via `loadAll()` and cached, so `byName` is a
// synchronous lookup afterwards.
//
// Adding an example: drop a `.cbl` file in `/examples/`, then add an
// entry to MANIFEST. Order in the array drives dropdown order.

const MANIFEST = [
    { name: "HELLO-WORLD",      description: "Smallest possible program — DISPLAY only",                fileName: "hello-world.cbl"      },
    { name: "FIZZBUZZ",         description: "Classic FizzBuzz — arithmetic, IF, nested PERFORM",       fileName: "fizzbuzz.cbl"         },
    { name: "FIBONACCI",        description: "Fibonacci sequence — PERFORM UNTIL with running totals",  fileName: "fibonacci.cbl"        },
    { name: "MORTGAGE-CALC",    description: "Monthly payment via COMPUTE with V-decimal PICs",         fileName: "mortgage-calc.cbl"    },
    { name: "GUESS-THE-NUMBER", description: "Interactive — ACCEPT in a loop with IF/ELSE feedback",    fileName: "guess-the-number.cbl" }
];

const sources = new Map();

let loadPromise = null;


async function loadAll(baseUrl = "examples")
{
    if(loadPromise) { return loadPromise; }

    loadPromise = Promise.all(MANIFEST.map(async entry =>
    {
        const response = await fetch(`${baseUrl}/${entry.fileName}`);

        if(!response.ok)
        {
            throw new Error(`failed to load example "${entry.name}" (${response.status} ${response.statusText})`);
        }

        sources.set(entry.name, await response.text());
    }));

    return loadPromise;
}

function list()
{
    return MANIFEST.map(({ name, description }) => ({ name, description }));
}

function byName(name)
{
    const entry = MANIFEST.find(e => e.name === name);

    if(!entry)                   { return null; }
    if(!sources.has(entry.name)) { return null; }

    return {
        name: entry.name,
        description: entry.description,
        source: sources.get(entry.name)
    };
}

// Test-only entry point. The Node test harness has no fetch (and we
// don't want one), so tests inject example sources directly read from
// disk and exercise `byName` against them.
function seedForTesting(name, source)
{
    sources.set(name, source);
}


export { loadAll, list, byName, seedForTesting };
