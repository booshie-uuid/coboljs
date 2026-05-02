// Generates .project/STATS.md and .project/STATS.html from the current
// state of the repo. Run from anywhere: `node .project/stats.js`.
// HTML output is a self-contained 1080x1920 portrait card sized for
// LinkedIn / story posting.

import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";


/******************************************************************************/
/* CONFIG                                                                     */
/******************************************************************************/

const SCRIPT_DIR        = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT      = resolve(SCRIPT_DIR, "..");
const MD_OUTPUT_PATH    = join(SCRIPT_DIR, "STATS.md");
const HTML_OUTPUT_PATH  = join(SCRIPT_DIR, "STATS.html");

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

// Counts whitespace-separated tokens that contain at least one
// alphanumeric — strips bare markdown markers (*, -, etc.) without
// trying to fully parse markdown.
function countWords(file)
{
    const content = readFileSync(file, "utf-8");

    return content.split(/\s+/).filter(token => /[a-zA-Z0-9]/.test(token)).length;
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

function planningWords(fileList, dirList)
{
    let total = 0;

    for(const relPath of fileList)
    {
        const path = join(PROJECT_ROOT, relPath);
        if(existsSync(path)) { total += countWords(path); }
    }

    for(const relDir of dirList)
    {
        const path = join(PROJECT_ROOT, relDir);
        if(!existsSync(path)) { continue; }

        for(const file of walk(path)) { total += countWords(file); }
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

### Words of Documentation
* Plans: ${fmtNum(stats.planWords)}
* Reviews: ${fmtNum(stats.reviewWords)}
`;
}


// Self-contained 524x932 portrait card sized for LinkedIn (which scales
// 1080-wide uploads to ~524 wide in feed, so we render natively at the
// target size to preserve gradient/glow fidelity). Synthwave palette
// matches the app shell. Bar shows all 5 buckets so it always partitions
// to 100%; the legend lists only the four named languages (in size
// order, COBOL highlighted).
function renderHtml(stats)
{
    const labels = [...Object.values(LANGUAGE_BY_EXTENSION), "Other"];
    const locs   = [...Object.keys(LANGUAGE_BY_EXTENSION).map(ext => stats.locByExt[ext] ?? 0), stats.otherLoc];

    const percentages = apportionPercentages(locs, stats.totalLoc);

    const COLORS = {
        "JS":    "#ffb13b",
        "CSS":   "#a44dff",
        "HTML":  "#ff5e5e",
        "COBOL": "#ff2bd6",
        "Other": "#4a5060"
    };

    const DISPLAY = {
        "JS":    "JavaScript",
        "CSS":   "CSS",
        "HTML":  "HTML",
        "COBOL": "COBOL",
        "Other": "Other"
    };

    const ranked = labels
        .map((label, i) => ({ label, loc: locs[i], pct: percentages[i] }))
        .sort((a, b) => b.loc - a.loc);

    const barSegments = ranked
        .map(r => `<div class="bar-segment" style="width:${r.pct}%;background:${COLORS[r.label]};"></div>`)
        .join("");

    const legendRows = ranked
        .filter(r => r.label !== "Other")
        .map(r =>
        {
            const isCobol = r.label === "COBOL";

            return `
            <div class="legend-row${isCobol? " cobol": ""}">
                <div class="dot${isCobol? " diamond": ""}" style="background:${COLORS[r.label]};color:${COLORS[r.label]};"></div>
                <div class="legend-label">${DISPLAY[r.label]}</div>
                <div class="legend-pct">${r.pct}%</div>
                <div class="legend-loc">${fmtNum(r.loc)} lines</div>
            </div>`;
        })
        .join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>COBOL.JS — Stats</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

body
{
    width: 524px;
    height: 932px;
    background: #0a0a1f;
    color: #e2f5ff;
    font-family: 'Cascadia Mono', 'Consolas', 'Courier New', monospace;
    padding: 44px 40px;
    position: relative;
    overflow: hidden;
}

body::before
{
    content: '';
    position: absolute;
    inset: 0;
    background:
        radial-gradient(circle at 0% 0%, rgba(255, 43, 214, 0.18) 0%, transparent 55%),
        radial-gradient(circle at 100% 100%, rgba(0, 246, 255, 0.12) 0%, transparent 55%),
        repeating-linear-gradient(0deg, transparent 0, transparent 1px, rgba(0, 246, 255, 0.04) 1px, rgba(0, 246, 255, 0.04) 2px);
    pointer-events: none;
}

.title
{
    font-size: 82px;
    font-weight: 700;
    color: #ff2bd6;
    text-shadow: 0 0 20px rgba(255, 43, 214, 0.7), 0 0 40px rgba(255, 43, 214, 0.35);
    letter-spacing: -1.5px;
    line-height: 0.9;
    position: relative;
}

.tagline
{
    color: #00f6ff;
    font-size: 18px;
    margin-top: 12px;
    letter-spacing: 2px;
    text-shadow: 0 0 8px rgba(0, 246, 255, 0.6);
    position: relative;
}

.numbers
{
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 30px;
    position: relative;
}

.number .value
{
    font-size: 56px;
    font-weight: 700;
    color: #e2f5ff;
    text-shadow: 0 0 12px rgba(0, 246, 255, 0.45);
    line-height: 1;
    letter-spacing: -1px;
}

.number .label
{
    color: #7d8aa3;
    font-size: 13px;
    margin-top: 8px;
    letter-spacing: 2px;
    text-transform: uppercase;
}

.bar
{
    display: flex;
    height: 20px;
    border-radius: 2px;
    overflow: hidden;
    box-shadow: 0 0 14px rgba(0, 246, 255, 0.25);
    margin-top: 30px;
    position: relative;
}

.bar-segment { height: 100%; }

.legend
{
    margin-top: 22px;
    display: flex;
    flex-direction: column;
    gap: 13px;
    position: relative;
}

.legend-row
{
    display: flex;
    align-items: center;
    font-size: 20px;
}

.dot
{
    width: 14px;
    height: 14px;
    border-radius: 50%;
    margin-right: 14px;
    box-shadow: 0 0 8px currentColor;
    flex-shrink: 0;
}

.dot.diamond
{
    border-radius: 0;
    transform: rotate(45deg);
    box-shadow: 0 0 14px currentColor;
}

.legend-label
{
    flex: 0 0 136px;
    color: #e2f5ff;
}

.legend-pct
{
    flex: 0 0 63px;
    color: #00f6ff;
    text-align: right;
    font-weight: 700;
}

.legend-loc
{
    color: #7d8aa3;
    margin-left: 16px;
    font-size: 16px;
}

.legend-row.cobol .legend-label
{
    color: #ff2bd6;
    text-shadow: 0 0 8px rgba(255, 43, 214, 0.6);
    font-weight: 700;
}

.legend-row.cobol .legend-pct
{
    color: #ff2bd6;
    text-shadow: 0 0 8px rgba(255, 43, 214, 0.6);
}

.legend-row.cobol .legend-loc
{
    color: #c46cb5;
}

.process-box
{
    margin-top: 30px;
    padding: 22px 26px;
    border: 1px solid rgba(0, 246, 255, 0.4);
    border-radius: 5px;
    box-shadow: 0 0 16px rgba(0, 246, 255, 0.2), inset 0 0 12px rgba(0, 246, 255, 0.04);
    background: rgba(0, 246, 255, 0.03);
    display: flex;
    flex-direction: column;
    gap: 13px;
    position: relative;
}

.process-row,
.tests-row
{
    display: flex;
    justify-content: space-between;
    align-items: baseline;
}

.process-label,
.tests-label
{
    color: #e2f5ff;
    font-size: 20px;
    text-transform: uppercase;
    letter-spacing: 3px;
}

.process-value
{
    color: #00f6ff;
    font-size: 25px;
    font-weight: 700;
    text-shadow: 0 0 8px rgba(0, 246, 255, 0.45);
}

.process-value .unit
{
    color: #7d8aa3;
    font-size: 16px;
    font-weight: 400;
    margin-left: 6px;
    text-shadow: none;
    letter-spacing: 1px;
}

.tests-row
{
    margin-top: 30px;
}

.tests-value
{
    color: #00ff7e;
    font-size: 27px;
    font-weight: 700;
    text-shadow: 0 0 9px rgba(0, 255, 126, 0.55);
    display: flex;
    align-items: baseline;
    gap: 14px;
}

.tests-tick
{
    color: #00ff7e;
    font-size: 27px;
    text-shadow: 0 0 11px rgba(0, 255, 126, 0.85);
}

.built-with
{
    margin-top: 30px;
    text-align: center;
}

.built-with::before
{
    content: '';
    display: block;
    width: 155px;
    height: 1px;
    margin: 0 auto 18px;
    background: linear-gradient(90deg, transparent, rgba(0, 246, 255, 0.5) 25%, rgba(255, 43, 214, 0.5) 75%, transparent);
}

.built-with-prefix
{
    color: rgba(0, 246, 255, 0.75);
    font-size: 13px;
    letter-spacing: 5px;
    text-transform: uppercase;
}

.built-with-name
{
    color: #ff2bd6;
    font-size: 33px;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    text-shadow: 0 0 12px rgba(255, 43, 214, 0.8), 0 0 28px rgba(255, 43, 214, 0.4);
    margin-top: 7px;
    line-height: 1;
}
</style>
</head>
<body>
    <div class="title">COBOL.JS</div>
    <div class="tagline">// JAVASCRIPT COBOL EMULATOR</div>

    <div class="numbers">
        <div class="number"><div class="value">${fmtNum(stats.totalLoc)}</div><div class="label">Lines of Code</div></div>
        <div class="number"><div class="value">${fmtNum(stats.totalFiles)}</div><div class="label">Files</div></div>
    </div>

    <div class="bar">${barSegments}</div>
    <div class="legend">${legendRows}
    </div>

    <div class="process-box">
        <div class="process-row"><div class="process-label">Plans</div><div class="process-value">${fmtNum(stats.planWords)}<span class="unit">words</span></div></div>
        <div class="process-row"><div class="process-label">Reviews</div><div class="process-value">${fmtNum(stats.reviewWords)}<span class="unit">words</span></div></div>
    </div>

    <div class="tests-row">
        <div class="tests-label">Tests</div>
        <div class="tests-value">${fmtNum(stats.totalTests)} / ${fmtNum(stats.totalTests)} <span class="tests-tick">✓</span></div>
    </div>

    <div class="built-with">
        <div class="built-with-prefix">// Built with</div>
        <div class="built-with-name">Claude Code</div>
    </div>
</body>
</html>
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
    otherLoc:    totalLoc - categorisedLoc,
    planWords:   planningWords(PLAN_FILES, PLAN_DIRS),
    reviewWords: planningWords(REVIEW_FILES, REVIEW_DIRS)
};

const markdown = render(stats);
const html     = renderHtml(stats);

writeFileSync(MD_OUTPUT_PATH, markdown);
writeFileSync(HTML_OUTPUT_PATH, html);

console.log(markdown);
console.log(`Wrote ${MD_OUTPUT_PATH}`);
console.log(`Wrote ${HTML_OUTPUT_PATH}`);
