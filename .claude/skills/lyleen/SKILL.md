---
name: lyleen
description: "Palbox knowledge graph reader, bootstrapper & discoverer — creates .palbox/ if missing, traverses [[wikilinks]] for context, and auto-saves source code analysis to flows/."
version: 4.0.0
author: Palskills
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [palskills, palbox, knowledge-graph, wikilinks, context-retrieval, bootstrapper]
    related_skills: [astralym, jetdragon, anubis, panthalus]
---

# Lyleen — Knowledge Graph Reader & Bootstrapper

Lyleen is the **gatekeeper** of the palskills knowledge graph. The palbox is an Obsidian-style interconnected vault where every `.md` file is a **node** and `[[wikilinks]]` form the **edges**. When invoked, Lyleen first checks whether `.palbox/` exists — if not, it bootstraps the entire graph from the codebase. Once the graph exists, Lyleen traverses wikilinks to retrieve a **context subgraph** relevant to the user's prompt.

## Palbox as a Knowledge Graph

```
                    .palbox/
                        │
              ┌─────────┼──────────┐
              ▼         ▼          ▼
         README.md  architecture  methods.md
              │         │              │
         [[architecture]]  [[methods]]   [[flows/auth]]
         [[methods]]       [[flows/*]]   [[history/*]]
              │         │              │
              └────┬────┴──────┬───────┘
                   │           │
                   ▼           ▼
               flows/      history/
              auth.md     2026-07-19-login.md
                 │              │
            [[methods]]    [[flows/auth]]
            [[history/*]]  [[architecture]]
```

**Nodes** = `.md` files. **Edges** = `[[wikilinks]]` between them.

> See `references/knowledge-graph-design.md` for the full design rationale behind the palbox graph architecture.

## How It Works

### Step 1: Check if Palbox Exists

```bash
ls .palbox/ 2>/dev/null
```

### Step 2a: Palbox Missing → BOOTSTRAP

If `.palbox/` does NOT exist, Lyleen creates the knowledge graph from scratch.

#### Bootstrap Process

**1. Create the folder structure:**

```bash
mkdir -p .palbox/{flows,history,plans}
```

**2. Analyze the codebase:**

```bash
find . -maxdepth 2 -type d ! -path './.git/*' ! -path './node_modules/*' ! -path './__pycache__/*' ! -path './.venv/*' | sort
ls -la package.json requirements.txt pyproject.toml go.mod Cargo.toml 2>/dev/null
cat README.md 2>/dev/null
git log --oneline --since="3 months ago" | head -20
find . -name '*test*' -o -name '*spec*' | head -20
```

**3. Create interconnected core documents with wikilinks:**

`.palbox/README.md` — the root node, links to everything:
```markdown
# [Project Name]

**Generated:** YYYY-MM-DD
**Bootstrapped by:** Lyleen (palskills)

## Overview
[Brief description]

## Tech Stack
- **Language:** [...]
- **Framework:** [...]
- **Database:** [...]

## Knowledge Graph
- [[architecture]] — folder structure & design patterns
- [[methods]] — coding conventions & standards
- [[flows/]] — feature workflow documentation
- [[history/]] — past development sessions
```

`.palbox/architecture.md` — codebase map:
```markdown
# Architecture

**Last Updated:** YYYY-MM-DD

## Folder Structure
```
[annotated tree]
```

## Design Patterns
[Patterns detected]

## Key Modules
| Module | Responsibility |
|--------|---------------|
| ... | ... |

## Related
- [[methods]] — how we build
- [[README]] — project overview
```

`.palbox/methods.md` — conventions:
```markdown
# Development Methods

**Last Updated:** YYYY-MM-DD

## Coding Conventions
[...]

## Testing Strategy
[...]

## Git Workflow
[...]

## Related
- [[architecture]] — where things live
- [[README]] — project overview
```

**4. Report:**

```
## Palbox Knowledge Graph Bootstrapped ✓

Created `.palbox/` with interconnected nodes:
- [[README]] — root node, links to all core docs
- [[architecture]] — codebase map ↔ [[methods]]
- [[methods]] — conventions ↔ [[architecture]]
- `flows/` — (empty) ready for feature docs
- `history/` — (empty) ready for session records

Graph has [N] nodes and [M] edges.
```

### Step 2b: Palbox Exists → TRAVERSE (Read-only)

**Phase 1: Seed Discovery**

Find palbox entries that directly match the user's prompt keywords:

```bash
grep -ril "<keyword1>\|<keyword2>" .palbox/ --include="*.md" | head -10
```

Each matching file is a **seed node**.

**Phase 2: Graph Traversal**

For each seed node, extract all `[[wikilinks]]` and follow them 1-2 hops:

```python
# Pseudo-code for link traversal
visited = set()
queue = seed_nodes

for node in queue:
    visited.add(node)
    content = read(".palbox/" + node)
    links = extract_wikilinks(content)  # regex: \[\[([^\]]+)\]\]
    for link in links:
        resolved = resolve_link(link)  # handle paths, .md extension
        if resolved not in visited:
            queue.append(resolved)
            if depth > max_depth: break
```

**Phase 3: Build Context Subgraph**

Return the connected subgraph as structured context:

```
## Palbox Context (Knowledge Graph)

### Seed: [[flows/auth-login]]
Matched: "login", "authentication"

### Linked Nodes (1 hop)
- [[architecture]] — Auth module lives in `src/auth/`
- [[methods]] — Uses JWT + refresh token pattern

### Linked Nodes (2 hops)  
- [[history/2026-07-10-jwt-refresh]] — Previous JWT refresh work
- [[history/2026-06-28-session-store]] — Session storage refactor

### Graph Summary
- **Nodes traversed:** 5
- **Relevant past work:** 2 sessions
- **Conventions found:** JWT pattern, testing with pytest
```

**Phase 4: Deliver**

Return the subgraph to Astralym/Jetdragon. The context is now **relational** — not just a flat list of files, but a connected graph of knowledge.

### Step 2c: Palbox Exists → DISCOVER (Auto-save to flows/)

Triggered when the user explicitly asks to **learn**, **study**, **pelajari**, or **discover** a module, component, or flow. Unlike TRAVERSE (read-only), DISCOVER reads actual source code and **writes findings to `.palbox/flows/<module>.md`**.

**When to use DISCOVER vs TRAVERSE:**

| User says | Mode | Action |
|-----------|------|--------|
| "what do we know about auth" | TRAVERSE | Read palbox, return context |
| "pelajari flow dan codebase export" | DISCOVER | Read source, write flow doc |
| "learn the payment module" | DISCOVER | Read source, write flow doc |
| "analyze how logging works" | DISCOVER | Read source, write flow doc |

**Phase 1: Identify Target**

Extract the module/topic from user prompt. Map to source directories:

```bash
# Find relevant source files
find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.js" -o -name "*.go" -o -name "*.rs" \) \
  ! -path "./.git/*" ! -path "./node_modules/*" ! -path "./__pycache__/*" ! -path "./.venv/*" \
  | xargs grep -l "<keyword>" 2>/dev/null | head -20
```

**Phase 2: Deep Analysis**

Read the identified files. For each file, extract:
- **Entry points**: exported functions, route handlers, CLI commands
- **Data flow**: what goes in → what transformations → what comes out
- **Dependencies**: imports, external services, databases
- **Patterns**: design patterns used, conventions followed
- **Edge cases**: error handling, validation, boundary conditions

**Phase 3: Write Flow Document**

Create `.palbox/flows/<module>.md` using this template:

```markdown
# [Module Name]

**Discovered:** YYYY-MM-DD
**Source:** [list of files analyzed]
**Analysis by:** Lyleen (palskills)

## Entry Points
| Entry | Type | Source | Description |
|-------|------|--------|-------------|
| ... | route/function/class | file:line | ... |

## Data Flow
[Describe how data moves through this module]

```
[diagram or step-by-step flow]
```

## Dependencies
- **Internal:** [[architecture]], [[methods]]
- **External:** [list external services/APIs]
- **Packages:** [key third-party packages]

## Key Patterns
[Patterns and conventions detected]

## Edge Cases & Error Handling
[How errors are handled, validation, edge cases]

## Related
- [[architecture]] — module structure
- [[methods]] — applicable conventions
- [[history/]] — past work on this module
```

**Phase 4: Update Architecture**

If this is a new module not yet in architecture.md, append:

```bash
echo "- [[flows/<module>]] — [one-line description]" >> .palbox/architecture.md
```

**Phase 5: Report**

```
## Lyleen Discovered: [Module] ✓

**Saved:** .palbox/flows/<module>.md
**Files analyzed:** [N]
**Architecture updated:** [yes/no]

**Graph after discovery:**
- Node created: [[flows/<module>]]
- Edges added: → [[architecture]], [[methods]]
```

## Wikilink Conventions

| Syntax | Meaning |
|--------|---------|
| `[[architecture]]` | Links to `.palbox/architecture.md` |
| `[[methods]]` | Links to `.palbox/methods.md` |
| `[[flows/auth]]` | Links to `.palbox/flows/auth.md` |
| `[[history/2026-07-19-feature]]` | Links to a specific history entry |
| `[[methods#testing-strategy]]` | Links to a heading within a page |
| `[[architecture|see architecture]]` | Aliased link (display text differs) |

## Traversal Rules

1. **Max depth: 2 hops** — enough for context, prevents graph explosion
2. **Bidirectional awareness** — if A links to B, treat B's link to A as redundant
3. **Prioritize seeds** — direct matches are primary; linked nodes are supporting
4. **Skip cycles** — `visited` set prevents infinite loops
5. **Highlight orphans** — if a seed has no wikilinks, flag it so user can enrich

## Rules

1. **Bootstrap if missing** — never return "palbox not found"; create the graph
2. **Analyze before writing** — read actual files, don't guess
3. **Traverse wikilinks** — context retrieval is graph traversal, not grep
4. **Return subgraphs** — provide related nodes, not isolated files
5. **Max 2 hops** — enough context without noise
6. **Report graph stats** — nodes traversed, links followed, orphans found
7. **Bootstrap is one-time** — subsequent calls traverse the existing graph
8. **Bidirectional links matter** — Panthalus maintains them; Lyleen exploits them
9. **DISCOVER writes to flows/** — when user says "learn/pelajari/discover", save analysis to `.palbox/flows/<module>.md` and update architecture.md
10. **Panthalus owns history/** — Lyleen never writes to `history/`; that's Panthalus's domain (recording development sessions)
