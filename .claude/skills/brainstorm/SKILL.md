---
name: brainstorm
description: You MUST use this whenever you do not have a clear idea of what the user is asking you to do. Helps generate ideas, explore possibilities, and clarify requirements before creating a plan.
user-invocable: true
---

# Brainstorming

## Description

Interactive design refinement methodology for turning rough ideas into fully-formed designs through collaborative dialogue. Use this skill during creative development phases before implementation begins.

## When to Use

- Designing new features with unclear requirements
- Exploring architecture decisions
- Refining user requirements
- Breaking down complex problems
- When multiple valid approaches exist

## When NOT to Use

- Clear "mechanical" processes with known implementation
- Simple bug fixes with obvious solutions
- Tasks with explicit requirements already defined

---

## Asking Questions

ALWAYS use the `AskUserQuestion` tool to ask questions unless it is unavailable.

Do NOT ask multiple questions at once — ask one question, wait for the answer, then ask the next question based on the user's response.

## Three-Phase Process

### Phase 1: Understanding

**Goal**: Clarify requirements through sequential questioning.

**Rules**:
- Ask only ONE question per message
- If a topic needs more exploration, break it into multiple questions
- Prefer multiple-choice questions over open-ended when possible
- Wait for user response before next question

**Example**:
```
BAD: "What authentication method do you want, and should we support SSO,
      and what about password requirements?"

GOOD: "Which authentication method should we use?
       a) Username/password only
       b) OAuth (Google, GitHub)
       c) Both options"
```

### Phase 2: Exploration

**Goal**: Present alternatives with clear trade-offs.

**Process**:
1. Present 2-3 different approaches
2. Lead with the recommended option
3. Explain trade-offs for each
4. Let user choose direction

**Format**:
```markdown
## Approach 1: [Name] (Recommended)
[Description]
- Pros: [Benefits]
- Cons: [Drawbacks]

## Approach 2: [Name]
[Description]
- Pros: [Benefits]
- Cons: [Drawbacks]

Which approach aligns better with your goals?
```

### Phase 3: Design Presentation

**Goal**: Present validated design in digestible chunks.

**Rules**:
- Break design into 200-300 word sections
- Validate incrementally after each section
- Cover: architecture, components, data flow, error handling, testing
- Be flexible - allow user to request clarification or changes

**Sections to Cover**:
1. Architecture overview
2. Component breakdown
3. Data flow
4. Error handling
5. Testing considerations

---

## Core Principles

### YAGNI Ruthlessly

Remove unnecessary features aggressively:
- Question every "nice to have"
- Start with minimal viable design
- Add complexity only when justified
- "We might need this later" = remove it

### One Question at a Time

Sequential questioning produces better results:
- Gives user time to think deeply
- Prevents overwhelming with choices
- Creates natural conversation flow
- Allows follow-up on unclear points

### Multiple-Choice Preference

When possible, provide structured options:
- Reduces cognitive load
- Surfaces your understanding
- Makes decisions concrete
- Still allow "Other" option

---

## Output Format

After design validation, document to timestamped markdown:

```markdown
# Design: [Feature Name]
Date: [YYYY-MM-DD]

## Summary
[2-3 sentences]

## Architecture
[Architecture decisions]

## Components
[Component breakdown]

## Data Flow
[How data moves through system]

## Error Handling
[Error scenarios and handling]

## Testing Strategy
[Testing approach]

## Open Questions
[Any remaining unknowns]
```

---

## Post-Design Workflow

After design is validated:
1. Add a copy of the design to the working directory.
2. Ask the user if they want to create a plan for implementation.

NEVER proceed to implementation or planning without explicit user confirmation after design validation.

---
