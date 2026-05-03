// Builds a deploy-ready snapshot of the app under ./build/.
//
// Run from the project root:
//
//     node .project/build.js
//
// Wipes any existing ./build/ first, then copies only the files the
// browser actually needs at runtime. Project-only artifacts (.claude,
// .project, .git, tests, package.json, etc.) are deliberately left
// behind. The output is a self-contained static site — drop it on any
// HTTPS-capable host and it runs.

import { existsSync, rmSync, mkdirSync, cpSync, copyFileSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";


const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUILD_DIR    = resolve(PROJECT_ROOT, "build");

const ASSETS = [
    "index.html",
    "styles.css",
    "libs",
    "scripts",
    "examples"
];


function copyAsset(name)
{
    const src = resolve(PROJECT_ROOT, name);
    const dst = resolve(BUILD_DIR, name);

    if(!existsSync(src))
    {
        console.warn(`SKIP  ${name} (not found)`);

        return 0;
    }

    if(statSync(src).isDirectory())
    {
        cpSync(src, dst, { recursive: true });
    }
    else
    {
        mkdirSync(dirname(dst), { recursive: true });
        copyFileSync(src, dst);
    }

    return 1;
}


/******************************************************************************/
/* MAIN                                                                       */
/******************************************************************************/

if(existsSync(BUILD_DIR))
{
    rmSync(BUILD_DIR, { recursive: true, force: true });
    console.log(`CLEAN ${BUILD_DIR}`);
}

mkdirSync(BUILD_DIR, { recursive: true });

let copied = 0;

for(const asset of ASSETS)
{
    copied += copyAsset(asset);
    console.log(`COPY  ${asset}`);
}

console.log(`\nBuild complete. ${copied} assets copied to ${BUILD_DIR}`);
console.log(`Serve with any static host — e.g.  npx http-server build`);
