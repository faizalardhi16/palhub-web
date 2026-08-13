import { deriveTags, isJunkTitle, slugify, summarize } from "./skill-export.service.js";

/**
 * Format catatan knowledge — SATU konvensi buat semua jalur masuk
 * (crawl, knowledge_generate, dll): frontmatter + body + wikilink
 * Catatan Terkait. Dipakai biar bundle skill konsisten & interlinked.
 */

export interface RelatedNote {
  id: number;
  title: string;
}

export interface NoteMeta {
  title: string;
  source: string;
  date: string;
  tier: "crawl" | "generated" | "manual";
  template?: string;
}

/** Frontmatter YAML (title/source/date/tier/template/tags/summary). */
export function renderFrontmatter(meta: NoteMeta, tags: string[], summary: string): string {
  const lines = [
    "---",
    `title: ${meta.title.replace(/:/g, " -")}`,
    `source: ${meta.source || "unknown"}`,
    `date: ${meta.date}`,
    `tier: ${meta.tier}`,
  ];
  if (meta.template) lines.push(`template: ${meta.template}`);
  lines.push(`tags: [${tags.join(", ")}]`, `summary: ${summary}`, "---", "");
  return lines.join("\n");
}

/** Section "## Related Notes" dengan wikilink [[k{id}-{slug}|judul]]. */
export function renderRelatedSection(related: RelatedNote[]): string {
  if (related.length === 0) return "";
  const links = related
    .map((r) => `- [[k${r.id}-${slugify(r.title).slice(0, 48)}|${r.title}]]`)
    .join("\n");
  return `\n\n## Related Notes\n\n${links}`;
}

/** Catatan lengkap: frontmatter + body + related. */
export function buildKnowledgeNote(meta: NoteMeta, body: string, related: RelatedNote[] = []): string {
  const bodyText = (body || "").trim();
  const tags = deriveTags(meta.title, meta.source);
  const fm = renderFrontmatter(meta, tags, summarize(bodyText));
  return fm + bodyText + renderRelatedSection(related);
}

/** Filter related: buang dirinya sendiri & konten junk (film/bioskop dll). */
export function cleanRelated(related: Array<{ id: number; title: string }>, excludeTitle: string): RelatedNote[] {
  return related.filter((r) => r.title.toLowerCase() !== excludeTitle.toLowerCase() && !isJunkTitle(r.title));
}
