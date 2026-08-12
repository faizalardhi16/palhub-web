---
name: astralym
description: "Core state machine orchestrator for the palskills development system. Routes user prompts through STANDALONE_GATE → CHECK_GRAPH → PLANNING → DEVELOPING → RECORDING across an Obsidian-like knowledge graph. Design, component, and architecture skills are optional — user confirms at the gate."
version: 3.1.0
author: Palskills
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [palskills, state-machine, orchestrator, knowledge-graph, development-workflow]
    related_skills: [lyleen, jetdragon, anubis, panthalus, elphidran, astegon, blazamut]
---

# Astralym — State Machine Core

Astralym is the central orchestrator of the palskills development system. It routes every user prompt through a lean pipeline, treating the **palbox as a knowledge graph** where every `.md` file is a node connected by `[[wikilinks]]`.

## The Pipeline (6 Core States)

5 main states + 1 optional standalone gate at the start.

```
                        ┌──────────────────────┐
     user prompt        │                      │
   ───────────────────► │  STANDALONE GATE      │  ← user decides
                        │  (Astralym)           │
                        │                      │
                        │  Ask user:            │
                        │  → Design?            │
                        │     (Elphidran)       │
                        │  → Componentize?      │
                        │     (Astegon)         │
                        │  → Architect?         │
                        │     (Blazamut)        │
                        │                      │
                        │  Execute selected     │
                        │  standalone steps     │
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │    CHECK_GRAPH        │
                        │    (Lyleen)           │
                        │                      │
                        │  .palbox/ missing?    │
                        │  → bootstrap graph    │
                        │  .palbox/ exists?     │
                        │  → traverse wikilinks │
                        │  → return subgraph    │
                        └──────────┬───────────┘
                                   │
                         context subgraph
                         (seeds + neighbors)
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │    PLANNING           │  ← conditional:
                        │    (Jetdragon)        │    skip if simple +
                        │                      │    unambiguous
                        │  → study subgraph     │
                        │  → ask questions      │
                        │  → generate plan      │
                        │    with [[wikilinks]] │
                        └──────────┬───────────┘
                                   │
                         user says "Gas"
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │    DEVELOPING         │
                        │    (Anubis → Codex)   │
                        │                      │
                        │  → build Codex prompt │
                        │  → codex exec         │
                        │  → verify output      │
                        └──────────┬───────────┘
                                   │
                         code committed
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │    RECORDING          │
                        │    (Panthalus)        │
                        │                      │
                        │  → create history node│
                        │  → add [[wikilinks]]  │
                        │  → create backlinks   │
                        │  → enrich the graph   │
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │    DONE              │
                        │    (Report + stats)  │
                        └──────────────────────┘
```

## Pipeline States

| State | Skill | Always? | Action |
|-------|-------|---------|--------|
| `STANDALONE_GATE` | Astralym | ❌ User decides | Ask: "Design (Elphidran)? Componentize (Astegon)? Architect (Blazamut)?" — execute selected |
| `CHECK_GRAPH` | Lyleen | ✅ Yes | Bootstrap if missing; traverse `[[wikilinks]]` → context subgraph |
| `PLANNING` | Jetdragon | ❌ Conditional | Study subgraph → generate plan → ask questions → wait for "Gas" |
| `DEVELOPING` | Anubis → Codex | ✅ Yes | Build Codex prompt → `codex exec` → verify |
| `RECORDING` | Panthalus | ✅ Yes | Create history node → backlinks → enrich graph |
| `DONE` | Astralym | ✅ Yes | Report summary + graph stats; return to IDLE |

## STANDALONE GATE: Optional Pre-Pipeline Steps

**Before** CHECK_GRAPH, Astralym MUST ask the user which standalone steps they want to run. These are **optional** — the user can pick zero, one, two, or all three. Do NOT assume or default to running all of them.

### Confirmation Prompt

Use `clarify()` with choices:

> "Before we start the pipeline — do you want to run any standalone steps?
> - **Design** (Elphidran): design tokens, colors, typography
> - **Componentize** (Astegon): atomic component hierarchy, SRP specs
> - **Architect** (Blazamut): SOLID modules, API contracts
>
> You can pick all three, just one, two, or none — skip straight to pipeline."

**User can answer with:**
- "All" / "Semua" / "All three" → run all three
- "Design" / "Elphidran" → run Design only
- "Componentize" / "Astegon" → run Componentize only
- "Architect" / "Blazamut" → run Architect only
- "Design + Architect" / "Elphidran + Blazamut" → run only those two
- "None" / "Skip" / "Langsung" → proceed to CHECK_GRAPH immediately
- Any combination like "Componentize + Architect"

### Execution Order

When multiple standalone steps are selected, execute in this order:

```
Design (Elphidran) → Componentize (Astegon) → Architect (Blazamut)
```

**Rationale:** Design tokens flow into components; API contracts inform component data shapes.

However, **Astegon and Blazamut can run in parallel** after Elphidran if the user selected both — they don't depend on each other (confirmed in memory: homogeneous data source).

### State Tracking

After standalone steps complete, mark them in `state.md`:

```markdown
## Standalone Steps
- [x] Design — ran Elphidran, output: [[design]]
- [x] Componentize — ran Astegon, output: [[components/dashboard]]
- [s] Architect — user skipped
```

### When Standalone Steps Already Exist

If `.palbox/design.md`, `.palbox/components/`, or `.palbox/architectures/` already exist, Astralym should:
1. Still ask the user (don't assume skip)
2. If user says yes, tell them: "⚠️ `design.md` already exists. Overwrite or skip?" — use `clarify()`

This prevents accidental overwrites of existing design/component/architecture work.

## Standalone Skills (Reference)

These are the skills invoked by the STANDALONE GATE. They are **per-project**, not per-task.

| Skill | When to call | Output |
|-------|-------------|--------|
| **Elphidran** | Once, at project start (or design refresh) | `.palbox/design.md` — colors, typography, spacing tokens |
| **Astegon** | When (re)building frontend from scratch or major FE restructure | `.palbox/components/*.md` — atomic decomposition + SRP specs |
| **Blazamut** | When (re)building backend from scratch or major BE restructure | `.palbox/architectures/*.md` — SOLID modules + API contracts |

They exist in the skill registry, referenceable from palbox via `[[wikilinks]]`, but Astralym does NOT gate on them. The pipeline stays lean.

## PLANNING Gate: Complexity Assessment

Before entering PLANNING (Jetdragon), Astralym asks: **"Does this task have ambiguity?"**

**Skip PLANNING** (go straight to DEVELOPING) when ALL of:
- Scope is 100% clear from the prompt
- No design/architecture decisions needed
- No edge cases to clarify
- User already implied "just do it" (no brainstorming needed)
- Examples: fix typo, rename variable, add docstring, simple CRUD endpoint, update dependency

**Run PLANNING** when ANY of:
- Multiple implementation approaches exist
- User explicitly asks for brainstorming / "how should we"
- Feature touches multiple modules
- Risk of breaking existing functionality
- User hasn't decided the approach yet
- Examples: new feature, refactor, auth flow, API redesign, data model change

**Gate rule:** when in doubt, run PLANNING. A skipped plan that should've existed is worse than a quick plan that confirms the obvious.

## CRITICAL: state.md

ON LOAD: Astralym MUST create or read `.palbox/state.md`. This file tracks pipeline progress with checkboxes and makes the state machine visible, resumable, and auditable.

### state.md Template

```markdown
# Astralym Pipeline State
**Feature:** [extract from user prompt]
**Started:** [current datetime]
**Last Updated:** [current datetime]

## Standalone Steps (user-selected)
- [ ] Design — Elphidran: design tokens, typography, colors (*user decides*)
- [ ] Componentize — Astegon: atomic components + SRP specs (*user decides*)
- [ ] Architect — Blazamut: SOLID modules + API contracts (*user decides*)

## Progress
- [ ] CHECK_GRAPH — Lyleen: bootstrap or retrieve context
- [ ] PLANNING — Jetdragon: create plan, ask questions (*skip if simple + unambiguous*)
- [ ] DEVELOPING — Anubis: execute with SOLID + SRP
- [ ] RECORDING — Panthalus: record with backlinks
- [ ] DONE — Report summary

## Plan
pending

## Context
pending
```

### Rules for state.md
1. **Create BEFORE running any step.** The file must exist from the start.
2. **Mark states with the correct symbol:**
   - `[x]` = completed successfully
   - `[s]` = intentionally skipped (add one-line reason)
   - `[!]` = failed or interrupted (add why)
   - `[ ]` = pending
3. **Add notes after each step:**
   - CHECK_GRAPH: "Retrieved [N] relevant nodes" or "Bootstrapped palbox with [N] files"
   - PLANNING: Link to plan: `[[plans/YYYY-MM-DD-feature]]` or "[s] Simple task, no ambiguity"
   - DEVELOPING: "Implemented: [files changed], [N] commits"
   - RECORDING: Link to history: `[[history/YYYY-MM-DD-feature]]`
   - DONE: "Completed at [datetime]. [N] files, [M] commits."
4. **Update "Last Updated"** every time you touch the file.
5. **On resume:** Read state.md first. Skip `[x]` and `[s]` steps. Continue from first `[ ]`.

## Palbox Knowledge Graph Structure

```
.palbox/
├── README.md              # Root node — [[architecture]], [[methods]]
├── architecture.md         # Codebase map — [[methods]], [[flows/*]]
├── design.md               # Design system — [[architecture]] (Elphidran — standalone)
├── methods.md              # Conventions — [[architecture]], [[history/*]]
├── flows/                  # Feature docs — [[architecture]], [[methods]], [[history/*]]
│   └── *.md
├── components/             # Component specs — [[design]], [[flows/*]] (Astegon — standalone)
│   └── *.md
├── architectures/          # Backend architecture specs — [[flows/*]] (Blazamut — standalone)
│   └── *.md
├── plans/                  # Active plans — [[flows/*]], [[components/*]], [[history/*]]
│   └── YYYY-MM-DD-*.md
└── history/                # Session records — [[flows/*]], [[architecture]], [[methods]]
    └── YYYY-MM-DD-*.md
```

## Usage Modes

Palskills works in **two environments**, not just Hermes:

### A. Hermes (native)
```
"Load astralym, build a user dashboard"
```
Astralym orchestrates: Lyleen → Jetdragon (if complex) → Anubis → Panthalus.

### B. Any coding agent (via CLI-generated configs)
```bash
npm i -g palskills
palskills  # generates .codex.md / .cursorrules / CLAUDE.md
```
Then in Codex, Cursor, or Claude Code:
```
Lyleen: learn the auth module
Astralym: build a forgot-password feature
```
The agent reads the config and follows the skill's step-by-step instructions.

**Design rule:** every agent config MUST contain the complete multi-mode skill system, not just static rules. The user explicitly rejected rules-only configs.

## Pitfalls

1. **Flat `.md` files are invisible to agents.** When generating agent configs, each skill MUST be a folder with `SKILL.md` inside — e.g. `.codex/skills/anubis/SKILL.md`, NOT `.codex/skills/anubis.md`. Coding agents won't recognize flat skill files. The `palskills` CLI v1.0.7 had this bug; fixed in v1.0.8.

2. **Agent configs must embed full skill content, not just SOLID rules.** The user rejected rules-only configs. Every generated config (`.codex.md`, `.cursorrules`, `CLAUDE.md`) must contain the complete multi-mode skill system with step-by-step instructions.

3. **Don't skip the STANDALONE GATE confirmation.** Always ask the user whether they want Design/Componentize/Architect before running the pipeline — even if the `[[wikilinks]]` exist. The user may want to refresh or skip. Never assume.

4. **Existing standalone outputs need overwrite confirmation.** If `design.md`, `components/`, or `architectures/` already exist and the user selects that step, ask "overwrite or skip?" before running.

## Rules

1. **Standalone gate first** — always ask user which standalone steps to run before CHECK_GRAPH
2. **Lean pipeline, no filler** — only states that run per-task stay in pipeline
3. **Graph is source of truth** — always traverse before planning
4. **Gate on complexity, not ceremony** — simple tasks skip PLANNING, complex ones don't
5. **User approval is gate** — DEVELOPING only after "Gas" (when PLANNING ran) or immediately (when PLANNING skipped)
6. **Recording is mandatory** — every session enriches the graph
7. **Links over repetition** — use `[[wikilinks]]` instead of duplicating content
8. **Bidirectional links** — every edge should have a backlink (Panthalus enforces this)
9. **Standalone steps are user's choice** — never run Elphidran/Astegon/Blazamut without explicit user selection

## See Also

- `references/cli-integration.md` — How the `palskills` CLI generates agent configs (`.codex.md`, `.cursorrules`, `CLAUDE.md`) that integrate with this pipeline
- `references/cross-agent-pattern.md` — Folder-per-skill structure and cross-agent compatibility
- `scripts/sync-to-package.sh` — Sync Hermes-installed skills back to npm package source before publishing
