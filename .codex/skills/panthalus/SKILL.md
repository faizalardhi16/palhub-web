---
name: panthalus
description: "Palbox knowledge graph archivist — records sessions with bi-directional [[wikilinks]], creating a traversable Obsidian-like vault of development history."
version: 2.0.0
author: Palskills
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [palskills, palbox, knowledge-graph, wikilinks, archivist]
    related_skills: [astralym, lyleen, jetdragon, anubis]
---

# Panthalus — Knowledge Graph Archivist

Panthalus is the **graph builder** of the palskills system. After every development session, it records what was done — not as an isolated file, but as a **node** in the palbox knowledge graph, connected via `[[wikilinks]]` to related entries. It also **backlinks** — updating existing nodes to point to the new entry, maintaining a bidirectional graph.

## The Graph Philosophy

```
Before Panthalus:          After Panthalus:

[[flows/auth]]                 [[flows/auth]]
     │                              │
     └── (no links)                 ├── [[history/2026-07-19-login]]
                                    │         │
[[architecture]]                [[architecture]]
     │                              │
     └── (no links)                 └── [[history/2026-07-19-login]]

                              [[history/2026-07-19-login]]
                                    │
                                    ├── [[flows/auth]]
                                    ├── [[architecture]]
                                    └── [[methods]]
```

Every session enriches the graph. Nodes gain connections. Orphans get adopted.

## How It Works

### Step 1: Collect Artifacts

After Anubis/Codex completes:

```bash
git log --oneline --since="1 hour ago"
git diff --stat HEAD~1
```

Collect: plan, files changed, commits, decisions, lessons.

### Step 2: Identify Related Nodes

Find existing palbox entries that relate to this session:

```bash
# Search for related flows, patterns, past work
grep -ril "<feature_keywords>" .palbox/flows/ .palbox/history/ 2>/dev/null
```

These become the **link targets** for the new entry.

### Step 3: Create History Node with Wikilinks

Create `.palbox/history/YYYY-MM-DD-feature-name.md`:

```markdown
# [Feature Name]
**Date:** YYYY-MM-DD
**Executor:** Codex CLI

## Links
- [[flows/auth]] — Authentication flow this feature extends
- [[architecture]] — Auth module in `src/auth/`
- [[methods]] — JWT + testing conventions followed
- [[history/2026-07-10-jwt-refresh]] — Previous JWT work this builds on

## Original Prompt
> [user's original prompt]

## Plan
[approved plan from Jetdragon]

## Codex Execution
### Prompt Sent
``` [Codex prompt] ```

### Files Changed
- `path/to/file.py` — [what was done]
- `path/to/another.py` — [what was done]

### Commits
- `abc1234` feat(scope): description
- `def5678` test(scope): description

## Key Decisions
| Decision | Rationale |
|----------|-----------|
| ... | ... |

## Lessons Learned
- **Pitfall:** ...
- **Discovery:** ...
- **Codex quirk:** ...

## Backlinks
*The following entries now link here:*
- [[flows/auth]] — updated with link to this session
- [[history/2026-07-10-jwt-refresh]] — updated with "see also" link
```

### Step 4: Create Backlinks (CRITICAL)

For every `[[link]]` in the history entry, Panthalus **must** add a reciprocal link back:

```bash
# For each linked file, append a backlink
echo "- [[history/2026-07-19-feature]] — [one-line summary]" >> .palbox/flows/auth.md
```

**Backlink format:**
```markdown
## Related Sessions
- [[history/2026-07-19-login-fix]] — Fixed login edge case with expired tokens
- [[history/2026-07-10-jwt-refresh]] — Implemented JWT refresh rotation
```

If the target file doesn't have a "Related Sessions" section, create one at the bottom.

### Step 5: Update Core Docs (If Structure Changed)

Only when architecture or methods fundamentally change:

- `.palbox/architecture.md` — new modules, pattern shifts
- `.palbox/methods.md` — new conventions emerged

Add the change AND link to the history entry that caused it:
```markdown
## Changelog
- [[history/2026-07-19-feature]] — Added `src/cache/` module for Redis caching layer
```

### Step 6: Report

```
## Knowledge Graph Updated

**New node:** [[history/2026-07-19-feature]]
**Edges created:** 6 (3 outgoing, 3 backlinks)
**Nodes enriched:** [[flows/auth]], [[architecture]], [[history/2026-07-10-jwt-refresh]]

**Graph health:**
- Total nodes: 12
- Total edges: 34
- Orphan nodes: 0
- Avg. degree: 2.8
```

## Graph Health Checks

Every ~5 sessions, Panthalus should audit the graph:

```bash
# Find orphan nodes (no incoming links)
for f in .palbox/history/*.md; do
  name=$(basename "$f" .md)
  grep -rl "\[\[history/$name\]\]" .palbox/ | wc -l
done

# Find broken links
grep -roh '\[\[[^]]*\]\]' .palbox/ | sed 's/\[\[//;s/\]\]//' | while read link; do
  # Resolve and check if file exists
done
```

Flag:
- **Orphans** — history entries with no backlinks (nothing points to them)
- **Dead ends** — entries with no outgoing links
- **Broken links** — wikilinks pointing to non-existent files

## Wikilink Conventions

| Syntax | Usage |
|--------|-------|
| `[[flows/feature-name]]` | Link to a flow document |
| `[[history/YYYY-MM-DD-name]]` | Link to a past session |
| `[[architecture]]` | Link to architecture doc |
| `[[methods]]` | Link to methods doc |
| `[[README]]` | Link to project overview |

## Rules

1. **Record EVERY session** — no exceptions
2. **Always create bi-directional links** — outgoing + backlinks
3. **Enrich, don't duplicate** — link to existing docs instead of repeating them
4. **Backlink section** — every linked file gets a `## Related Sessions` entry
5. **Graph health** — audit every ~5 sessions
6. **No orphan nodes** — every history entry must have at least one incoming link
7. **Preserve the plan** — full plan in history, not summarized
8. **Codex metadata** — capture flags, iterations, prompt patterns
