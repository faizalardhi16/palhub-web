# UI Tailwind Motion Refresh - 2026-08-12

## Task
Refine the PalHub redesign by moving styling to TailwindCSS, adding Framer Motion, and removing AI-themed icons in favor of more neutral operational iconography.

## Summary
Migrated the redesigned frontend from custom CSS-first styling to TailwindCSS utilities plus a small shared component layer, introduced Framer Motion transitions across layout and page sections, and replaced AI-centric icons/copy with a more product-operations visual language.

## Decisions
- TailwindCSS v4 is now the primary styling mechanism; `styles.css` is reduced to Tailwind entry plus shared component utility classes.
- Framer Motion is used for restrained page-entry, tab-switch, card, and result-panel animation rather than broad decorative motion.
- `lucide-react` replaced the previous custom SVG set for the active UI, with icons chosen to avoid AI/brain/spark motifs.

## Modules
- `web/postcss.config.js`: Tailwind PostCSS integration.
- `web/src/styles.css`: Tailwind entry, theme tokens, and shared helper classes.
- `web/src/components/Layout.tsx`: Tailwind layout shell with motion and neutral icon set.
- `web/src/pages/Specialists.tsx`: Tailwind catalog page with motion-driven sections.
- `web/src/pages/SpecialistDetail.tsx`: Tailwind workbench tabs and entity panels.
- `web/src/pages/Playground.tsx`: Tailwind execution console and result surface.

## Lessons
- Tailwind v4 component classes cannot `@apply` other custom component classes; helpers need to expand directly to core utilities.
- Keeping animation restrained preserves the more powerful product feel better than adding many micro-effects.

## API
- No API contract changes. Frontend-only presentation migration.
