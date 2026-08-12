import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ToolExecutor, ToolExecutionContext, ToolExecutionResult } from "./types.js";
import { slugify } from "../util.js";

/**
 * GenerateDocExecutor — generate a .MD document following a procedure template,
 * save it as an artifact and store it into the specialist's knowledge (hindsight).
 */
export class GenerateDocExecutor implements ToolExecutor {
  readonly type = "generate_doc";

  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const prompt = String(ctx.input.prompt ?? "").trim();
    if (!prompt) return { content: "❌ Prompt wajib diisi.", artifacts: [] };

    const system = this.buildSystemPrompt(ctx);
    const markdown = await ctx.llm.chat([
      { role: "system", content: system },
      { role: "user", content: prompt },
    ]);

    const title = prompt.length > 80 ? `${prompt.slice(0, 77)}...` : prompt;
    const artifactPath = this.saveMarkdown(ctx, title, markdown);

    await ctx.knowledge.create(ctx.specialist.id, title, markdown, `procedure:${ctx.procedure?.name ?? "default"}`);

    return { content: markdown, artifacts: [artifactPath] };
  }

  private buildSystemPrompt(ctx: ToolExecutionContext): string {
    const parts: string[] = [
      `Kamu adalah ${ctx.specialist.name}.`,
      ctx.specialist.description ? `Deskripsi: ${ctx.specialist.description}` : "",
    ];

    if (ctx.procedure?.template) {
      parts.push(
        `Gunakan struktur dokumen berikut dan lengkapi SEMUA bagian (ganti placeholder {...} dengan konten yang sesuai):\n\n${ctx.procedure.template}`
      );
    } else {
      parts.push("Buat dokumen markdown yang lengkap, terstruktur, dan profesional.");
    }

    parts.push("Gunakan Bahasa Indonesia kecuali istilah teknis. Jawab langsung dengan markdown, tanpa pembukaan.");
    return parts.filter(Boolean).join("\n");
  }

  private saveMarkdown(ctx: ToolExecutionContext, title: string, markdown: string): string {
    const dir = join(ctx.dataDir, "documents", slugify(ctx.specialist.name));
    mkdirSync(dir, { recursive: true });

    const date = new Date().toISOString().slice(0, 10);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `${date}-${stamp}-${slugify(ctx.tool.name)}.md`;
    const filePath = join(dir, filename);

    writeFileSync(filePath, `# ${title}\n\n${markdown}\n`, "utf8");
    return filePath;
  }
}
