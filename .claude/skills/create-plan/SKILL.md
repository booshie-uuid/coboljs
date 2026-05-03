---
name: create-plan
description: You MUST use this before any development work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation.
user-invocable: true
---

# Create Plan

Produces an actionable, task-oriented, step-by-step plan to implement the user request. The plan must be saved to the working directory so it can be referenced, executed, and updated with a record of progress and implementation decisions, ensuring any deviations made during execution are captured alongside the original intent.

## When to Use

Trigger this skill when the user asks you to create a plan. Typical phrasings:

- "Create a plan ..."
- "Write a plan ..."
- "Plan out ..."
- "Make a step-by-step plan ..."

Do NOT trigger for:

- One-line tweaks, typo fixes, or minor single-file edits where planning is overhead
- Pure questions where no implementation work follows
- Requests for opinions or advice only
- Cases where the user has already provided a plan and just wants it executed

## Workflow

Follow these steps in order. Do not skip ahead.

Do NOT begin executing the plan unless the user explicitly asks for you to execute the plan.

### 1. Understand the request

Read the request carefully. If anything is ambiguous (scope, target environment, success criteria, hard constraints), ask clarifying questions before drafting the plan. ALWAYS make use of the `AskUserQuestion` tool unless it is unavailable; otherwise ask inline. A vague plan is worse than no plan — do not guess at unclear requirements.

### 2. Decompose into Tasks and Steps

- Let the user know you are creating a plan by saying "I am using the Create Plan skill to create a structured plan for this request."
- Break the work into discrete **Tasks**. A task is a coherent unit of work that produces a meaningful, testable outcome.
- Each task should represent no more than 10-15 minutes of focused work for an experienced implementer. If a task is too large, break it down further.
- Within each Task, list **Steps** — specific, actionable instructions an implementer can follow without further decomposition.
- Steps should be specific (e.g. `Add --dry-run flag to cli.ts`), not vague (e.g. `Update the CLI`).
- Order tasks so dependencies flow forward.

### 3. Determine the output path

Check whether `./claude/planning/CURRENT-PLAN.md` exists in the working directory.

- **If it does NOT exist** → write the new plan to `./claude/planning/CURRENT-PLAN.md`.
- **If it DOES exist** → ask the user:
  > "A `CURRENT-PLAN.md` already exists. Overwrite it with the new plan?"
  - If the user says **yes** → overwrite `./claude/planning/CURRENT-PLAN.md`.
  - If the user says **no** → ask the user to archive the existing plan before proceeding.


### 4. Write the plan

Use the structure in [assets/plan-template.md](./assets/plan-template.md). Every plan MUST contain:

- A top-level `# Plan: <title>` heading
- A `## Context` section (why this work is being done)
- One or more `## Task N: <title>` sections, each with:
  - `### Objective`
  - `### Expected Outcomes`
  - `### Risks / Constraints`
  - `### Steps` — written as a Markdown checklist (`- [ ] ...`)
  - `### Decisions` — left empty (filled in during execution)

### 5. Confirm to the user

Tell the user the exact path where the plan was written. Do NOT begin executing the plan unless the user explicitly asks for you to execute the plan.

## Notes for execution

When the plan is later executed (in this or a future session):

- **Tick steps in place**: change `- [ ]` to `- [*]` as each step is completed. Do not make any other modifications to the step. Do not delete or reorder steps.
- **Record decisions**: any key or impactful choice made during execution — particularly deviations from the original Steps — should be appended to that Task's Decisions section using the format:
  `- <decision>: <rationale>`

## Example

User request: "Plan out adding a dark-mode toggle to the settings page."

Decomposition:

- **Task 1: Add theme state and toggle UI** — surface a working dark-mode toggle in Settings; persist selection.
- **Task 2: Apply theme tokens across the app** — replace hardcoded colors with CSS variables; verify contrast; check modals, tooltips, and overlays.
- **Task 3: Test and document** — unit tests for persistence; manual light/dark QA; update README.

The skill writes the full plan (using the template) to `./claude/planning/CURRENT-PLAN.md`, or asks the user to archive the existing plan if a `./claude/planning/CURRENT-PLAN.md` already exists and the user declines to overwrite.