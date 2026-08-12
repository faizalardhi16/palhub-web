import type { ToolExecutor, ToolExecutionContext, ToolExecutionResult } from "./types.js";
import type { WebSearchService } from "../services/search.service.js";

/**
 * WebSearchExecutor — search the web for information on a topic.
 * Input: prompt (topic / query). Returns top N results (title, url, snippet).
 * Does NOT save to knowledge — use crawl to fetch & persist full content.
 */
export class WebSearchExecutor implements ToolExecutor {
  readonly type = "web_search";

  constructor(private readonly search: WebSearchService) {}

  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const prompt = String(ctx.input.prompt ?? "").trim();
    if (!prompt) return { content: "❌ Prompt wajib diisi.", artifacts: [] };

    const results = await this.search.search(prompt, 5);
    if (results.length === 0) {
      return {
        content: `🔍 Tidak ada hasil untuk: "${prompt}"`,
        artifacts: [],
      };
    }

    const lines: string[] = [`# Web Search: ${prompt}`, "", `Provider: ${this.search.active}`, ""];
    for (const [i, r] of results.entries()) {
      lines.push(
        `${i + 1}. [${r.title}](${r.url})`,
        `   ${r.snippet}`,
        ""
      );
    }

    return {
      content: lines.join("\n"),
      artifacts: results.map((r) => r.url),
    };
  }
}
