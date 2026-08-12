# Global Design System
**Generated:** 2026-08-12
**Architect:** Elphidran (Palskills)
**Vibe:** Confident, modern, technical
**Dark Mode:** Light-first
**Scope:** Shared across all modules

## Color Palette

### Light Theme
| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | #0f766e | Primary actions, links, active states |
| `primary-hover` | #115e59 | Hover states |
| `primary-soft` | #ccfbf1 | Highlight backgrounds, chips |
| `secondary` | #0f172a | High-emphasis text, navigation |
| `accent` | #f59e0b | Attention moments, metrics |
| `surface` | #ffffff | Cards and panels |
| `surface-alt` | #f8fafc | Secondary panels |
| `background` | #eef6f5 | Page background |
| `text-primary` | #0f172a | Headings and main content |
| `text-secondary` | #475569 | Supporting text |
| `border` | #dbe7e5 | Borders and dividers |
| `success` | #15803d | Positive state |
| `warning` | #d97706 | Warning state |
| `error` | #b91c1c | Destructive state |
| `info` | #0369a1 | Informational state |

## Typography

| Token | Font | Size | Weight | Line Height | Usage |
|-------|------|------|--------|-------------|-------|
| `display` | "Space Grotesk", system-ui | 52px | 700 | 1.05 | Hero headlines |
| `h1` | "Space Grotesk", system-ui | 36px | 700 | 1.1 | Page titles |
| `h2` | "Space Grotesk", system-ui | 24px | 700 | 1.2 | Section titles |
| `h3` | "Space Grotesk", system-ui | 18px | 600 | 1.25 | Card titles |
| `body` | "Plus Jakarta Sans", system-ui | 15px | 400 | 1.65 | Body text |
| `meta` | "Plus Jakarta Sans", system-ui | 13px | 500 | 1.5 | Labels and metadata |
| `mono` | "JetBrains Mono", ui-monospace | 13px | 400 | 1.6 | Code and result blocks |

## Spacing Scale

| Token | Value |
|-------|-------|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |
| `space-12` | 48px |
| `space-16` | 64px |

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 12px | Inputs |
| `radius-md` | 18px | Buttons and cards |
| `radius-lg` | 28px | Hero panels |
| `radius-pill` | 999px | Tags and pills |

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-sm` | 0 14px 40px rgba(15, 23, 42, 0.06) | Cards |
| `shadow-md` | 0 22px 60px rgba(15, 23, 42, 0.1) | Floating panels |
| `shadow-glow` | 0 0 0 1px rgba(15, 118, 110, 0.08), 0 30px 80px rgba(15, 118, 110, 0.12) | Hero surfaces |

## Shared Component Patterns

### Buttons
- Primary: solid `primary`, white text, medium shadow
- Secondary: white surface, slate border, dark text
- Ghost: transparent with subtle hover tint
- Danger: soft red surface with red border/text

### Layout
- Sticky left rail with dark contrast surface
- Main canvas uses wide hero section, then modular surface blocks
- Section pairs favor 2-column layouts on desktop and 1-column on mobile

## Implementation Notes
1. Use CSS variables for all colors and shadows.
2. Prefer icon-led labels over emoji.
3. Keep motion short and restrained: 160ms to 220ms.
4. Make every key panel readable as a standalone product surface, not a raw form dump.
