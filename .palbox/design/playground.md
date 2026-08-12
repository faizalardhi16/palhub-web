# Playground Design Extensions
**Parent:** [[_global]]
**Module:** playground
**Generated:** 2026-08-12

## Module Accent Color
| Token | Hex | Usage |
|-------|-----|-------|
| `module-primary` | #7c3aed | Run actions and output callouts |
| `module-light` | #f3e8ff | Prompt/result supporting surfaces |
| `module-dark` | #6d28d9 | Active and pressed states |

## Module-Specific Components

### Prompt Composer
- Two-column composition: control panel + output
- Prompt area should feel like an operator console, not a plain textarea

### Result Surface
- Monospace output area with darker inset background
- Sticky action row for copy and context info

## Unique Patterns
- Emphasize the bridge between web UI and MCP by showing that identical output returns via `/mcp`.
