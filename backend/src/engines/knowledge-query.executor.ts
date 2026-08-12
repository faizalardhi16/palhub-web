import type { ToolExecutor, ToolExecutionContext, ToolExecutionResult } from "./types.js";

/**
 * KnowledgeQueryExecutor — RAG v1: keyword search over the specialist's
 * knowledge group (FTS5). Raw retrieval, returns top chunks with sources.
 */
export class KnowledgeQueryExecutor implements ToolExecutor {
  readonly type = "knowledge_query";

  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const query = String(ctx.input.prompt ?? "").trim();
    if (!query) return { content: "❌ Query wajib diisi.", artifacts: [] };

    const results = await ctx.knowledge.search(ctx.specialist.id, query, 5);
    if (results.length === 0) {
      return {
        content: "Tidak ada knowledge yang cocok dengan query tersebut.",
        artifacts: [],
      };
    }

    const lines: string[] = [`# Knowledge: ${query}`, ""];
    for (const item of results) {
      lines.push(`## ${item.title}`, `- Sumber: ${item.source || "-"}`, "", item.content.slice(0, 1500), "");
    }

    return { content: lines.join("\n"), artifacts: [] };
  }
}
