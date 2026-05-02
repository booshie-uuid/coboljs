import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";


/******************************************************************************/
/* FIXTURES                                                                   */
/******************************************************************************/

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));

function loadFixture(name)
{
    return readFileSync(resolve(TESTS_DIR, "data", name), "utf-8");
}


/******************************************************************************/
/* TEST RUNNER                                                                */
/******************************************************************************/

const tests = [];

let currentSuite = "";


function suite(name, fn)
{
    const previous = currentSuite;
    currentSuite = previous? `${previous} > ${name}`: name;

    fn();

    currentSuite = previous;
}

function test(name, fn)
{
    tests.push({ name: currentSuite? `${currentSuite} > ${name}`: name, fn });
}


/******************************************************************************/
/* ASSERTIONS                                                                 */
/******************************************************************************/

function expect(actual)
{
    return {
        toBe(expected)
        {
            if(actual !== expected)
            {
                throw new Error(`expected ${render(expected)}, got ${render(actual)}`);
            }
        },

        toEqual(expected)
        {
            const a = JSON.stringify(actual);
            const e = JSON.stringify(expected);

            if(a !== e)
            {
                throw new Error(`expected ${e}, got ${a}`);
            }
        },

        toThrow(messagePattern)
        {
            let thrown = null;

            try { actual(); }
            catch(error) { thrown = error; }

            if(!thrown) { throw new Error(`expected function to throw`); }

            if(messagePattern && !String(thrown.message).includes(messagePattern))
            {
                throw new Error(`expected throw to include "${messagePattern}", got "${thrown.message}"`);
            }
        }
    };
}

function render(value)
{
    if(typeof value === "string") { return `"${value}"`; }

    return JSON.stringify(value);
}


/******************************************************************************/
/* RUN                                                                        */
/******************************************************************************/

async function run()
{
    let passed = 0;
    let failed = 0;

    const failures = [];

    for(const { name, fn } of tests)
    {
        try
        {
            await fn();
            passed++;

            console.log(`  \x1b[32m✓\x1b[0m  ${name}`);
        }
        catch(error)
        {
            failed++;
            failures.push({ name, error });

            console.log(`  \x1b[31m✗\x1b[0m  ${name}`);
            console.log(`     \x1b[31m${error.message}\x1b[0m`);
        }
    }

    console.log("");
    console.log(`${passed} passed, ${failed} failed (${tests.length} total)`);

    if(failed > 0) { process.exitCode = 1; }
}


export { suite, test, expect, run, loadFixture };
