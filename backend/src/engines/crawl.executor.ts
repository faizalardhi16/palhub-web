import type { ToolExecutor, ToolExecutionContext, ToolExecutionResult } from "./types.js";
import type { KnowledgeTemplateService } from "../services/template.service.js";

const MAX_SOURCES = 3;
const URL_REGEX = /https?:\/\/[^\s"'<>]+/g;

/**
 * CrawlExecutor — prompt-only input. Pipeline: crawl → web search → format → save.
 *
 *  1. URL eksplisit di prompt → dipakai langsung sebagai sumber.
 *  2. Tanpa URL → web search → LLM-suggested (di-handle template service).
 *  3. Semua sumber di-fetch, lalu AI menyusun catatan knowledge TERSTRUKTUR
 *     sesuai template domain (English) — bukan teks mentah crawl.
 *  4. Catatan disimpan ke knowledge + embedding.
 *
 * Ini satu pipeline yang sama dengan knowledge_generate: hasilnya konsisten
 * dengan standar note (frontmatter + sections + wikilink), walaupun sumber
 * crawl-nya berbahasa Indonesia.
 */
export class CrawlExecutor implements ToolExecutor {
  readonly type = "crawl";

  constructor(private readonly template: KnowledgeTemplateService) {}

  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const prompt = String(ctx.input.prompt ?? "").trim();
    if (!prompt) return { content: "❌ Prompt is required.", artifacts: [] };

    const explicitUrls = this.extractUrls(prompt);

    try {
      const result = await this.template.generate({
        topic: prompt,
        specialistId: ctx.specialist.id,
        sources: explicitUrls,
      });

      if (result.duplicate) {
        return {
          content:
            `ℹ️ Topic already covered by existing note **#${result.existing_id} "${result.title}"** — no duplicate created.\n` +
            `- Sources: ${result.sources.join(", ") || "unknown"}\n\n` +
            "To force a new note, paste a URL that has never been crawled.",
          artifacts: explicitUrls,
        };
      }

      const lines = [
        `✅ Structured knowledge note saved: **#${result.id} ${result.title}**`,
        `- Template: ${result.template}`,
        `- Sources (${result.sources.length}): ${result.sources.join(", ")}`,
        `- Size: ${result.chars.toLocaleString("id-ID")} chars`,
        "",
        "### Preview:",
        result.preview,
      ];
      return { content: lines.join("\n"), artifacts: explicitUrls };
    } catch (error) {
      return { content: `❌ ${(error as Error).message}`, artifacts: [] };
    }
  }

  private extractUrls(text: string): string[] {
    const matches = text.match(URL_REGEX) ?? [];
    return [...new Set(matches)].slice(0, MAX_SOURCES);
  }
}
