// Generates .project/STATS.md from the current state of the repo.
// Run from anywhere: `node .project/stats.js`

import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";


/******************************************************************************/
/* CONFIG                                                                     */
/******************************************************************************/

const SCRIPT_DIR   = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, "..");
const OUTPUT_PATH  = join(SCRIPT_DIR, "STATS.md");

// Top-level directory names skipped by the deliverable scan. Keeps build
// artefacts, vendored libraries, and meta-folders out of the LOC numbers.
const EXCLUDED_DIRS = new Set([
    ".claude", ".local", ".project", "libs", ".git", "node_modules"
]);

// Extensions the LOC table breaks out by language. Files with other
// extensions roll up under the trailing "Other" row, so the table
// always partitions the project total — and percentages always sum to
// exactly 100% via the largest-remainder apportionment in `render`.
const LANGUAGE_BY_EXTENSION = {
    ".cbl":  "COBOL",
    ".js":   "JS",
    ".css":  "CSS",
    ".html": "HTML"
};

// Files counted as "plans". The active PLAN.md is intentionally
// excluded — it's draft material until it's finalised, archived under
// `.claude/planning/plans/` with a version suffix, and counted from
// there. Mirrors the workflow used for reviews.
const PLAN_FILES = [
    ".claude/CLAUDE.md",
    ".claude/planning/DESIGN.md"
];
const PLAN_DIRS = [
    ".claude/planning/plans"
];

// Reviews live under .claude/planning/reviews/. The in-flight review at
// .claude/planning/REVIEW.md (before it's archived) is included so the
// count reflects the current review effort too.
const REVIEW_FILES = [
    ".claude/planning/REVIEW.md"
];
const REVIEW_DIRS = [
    ".claude/planning/reviews"
];


/******************************************************************************/
/* WALK                                                                       */
/******************************************************************************/

function walk(dir, exclude = new Set(), files = [])
{
    if(!existsSync(dir)) { return files; }

    for(const entry of readdirSync(dir))
    {
        if(exclude.has(entry)) { continue; }

        const path = join(dir, entry);
        const stat = statSync(path);

        if(stat.isDirectory())  { walk(path, exclude, files); }
        else if(stat.isFile())  { files.push(path); }
    }

    return files;
}


/******************************************************************************/
/* COUNTS                                                                     */
/******************************************************************************/

// Counts non-blank lines (any line with at least one non-whitespace char).
// Strips structural blank lines — STYLE.md mandates blank-line paragraphs
// between logical sections, plus the 2-line cushion above each section
// banner; counting them inflates LOC against actual code/prose density.
function countLines(file)
{
    const content = readFileSync(file, "utf-8");

    if(content.length === 0) { return 0; }

    return content
        .split(/\r?\n/)
        .filter(line => line.trim() !== "")
        .length;
}

function countTests(filesByExt)
{
    const testFiles = (filesByExt[".js"] ?? []).filter(f => f.endsWith(".test.js"));

    let total = 0;

    for(const file of testFiles)
    {
        const content = readFileSync(file, "utf-8");
        const matches = content.match(/^\s*test\(/gm);

        if(matches) { total += matches.length; }
    }

    return total;
}


/******************************************************************************/
/* GROUPING                                                                   */
/******************************************************************************/

function groupByExtension(files)
{
    const byExt = {};

    for(const file of files)
    {
        const ext = extname(file).toLowerCase();

        (byExt[ext] = byExt[ext] || []).push(file);
    }

    return byExt;
}

function totalLines(files)
{
    return files.reduce((sum, file) => sum + countLines(file), 0);
}


/******************************************************************************/
/* PLANNING SCAN                                                              */
/******************************************************************************/

function planningLines(fileList, dirList)
{
    let total = 0;

    for(const relPath of fileList)
    {
        const path = join(PROJECT_ROOT, relPath);
        if(existsSync(path)) { total += countLines(path); }
    }

    for(const relDir of dirList)
    {
        const path = join(PROJECT_ROOT, relDir);
        if(!existsSync(path)) { continue; }

        for(const file of walk(path)) { total += countLines(file); }
    }

    return total;
}


/******************************************************************************/
/* RENDERING                                                                  */
/******************************************************************************/

function fmtNum(n)
{
    return n.toLocaleString("en-US");
}

// Apportions integer percentages across `values` so they sum to exactly
// `targetTotal` (default 100), using the largest-remainder method:
// floor each share, then hand out the leftover seats to the rows with
// the largest fractional remainders. Avoids the 1+88+10+2=101% drift
// that independent `Math.round` calls produce.
function apportionPercentages(values, total, targetTotal = 100)
{
    if(total === 0) { return values.map(() => 0); }

    const exact   = values.map(v => (v / total) * targetTotal);
    const floored = exact.map(Math.floor);

    let assigned = floored.reduce((a, b) => a + b, 0);

    const remainders = exact
        .map((e, i) => ({ idx: i, frac: e - floored[i] }))
        .sort((a, b) => b.frac - a.frac);

    let i = 0;

    while(assigned < targetTotal && i < remainders.length)
    {
        floored[remainders[i].idx]++;
        assigned++;
        i++;
    }

    return floored;
}

function render(stats)
{
    const labels = [...Object.values(LANGUAGE_BY_EXTENSION), "Other"];
    const locs   = [...Object.keys(LANGUAGE_BY_EXTENSION).map(ext => stats.locByExt[ext] ?? 0), stats.otherLoc];

    const percentages = apportionPercentages(locs, stats.totalLoc);

    const langRows = labels
        .map((label, i) => `* ${label}: ${fmtNum(locs[i])} (${percentages[i]}%)`)
        .join("\n");

    return `# Project Statistics

## Deliverable

### Overview
* Lines of Code: ${fmtNum(stats.totalLoc)}
* Files: ${fmtNum(stats.totalFiles)}
* Tests: ${fmtNum(stats.totalTests)}

### Lines of Code (LOC) by Code Type
${langRows}

## Planning

### Lines of Documentation
* Plans: ${fmtNum(stats.planLoc)}
* Reviews: ${fmtNum(stats.reviewLoc)}
`;
}


/******************************************************************************/
/* MAIN                                                                       */
/******************************************************************************/

const allFiles   = walk(PROJECT_ROOT, EXCLUDED_DIRS);
const filesByExt = groupByExtension(allFiles);

const totalLoc = totalLines(allFiles);
const locByExt = {};

let categorisedLoc = 0;

for(const ext of Object.keys(LANGUAGE_BY_EXTENSION))
{
    const loc = totalLines(filesByExt[ext] ?? []);

    locByExt[ext] = loc;
    categorisedLoc += loc;
}

const stats = {
    totalLoc,
    totalFiles: allFiles.length,
    totalTests: countTests(filesByExt),
    locByExt,
    otherLoc:   totalLoc - categorisedLoc,
    planLoc:    planningLines(PLAN_FILES, PLAN_DIRS),
    reviewLoc:  planningLines(REVIEW_FILES, REVIEW_DIRS)
};

const output = render(stats);

writeFileSync(OUTPUT_PATH, output);

console.log(output);
console.log(`Wrote ${OUTPUT_PATH}`);
