import * as cheerio from "cheerio";
import type { ToolExecutor, ToolExecutionContext, ToolExecutionResult } from "./types.js";
import type { WebSearchService } from "../services/search.service.js";
import { buildKnowledgeNote, cleanRelated } from "../services/note-format.js";

const MAX_SOURCES = 5;
const MAX_CONTENT_CHARS = 4000;
const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const URL_REGEX = /https?:\/\/[^\s"'<>]+/g;

interface SourceCandidate {
  url: string;
  title: string;
}

/**
 * CrawlExecutor — prompt-only input. Strategy:
 *  1. Extract URLs directly from the prompt → fetch them.
 *  2. No URLs → web_search (topic → result URLs), then fetch candidates.
 *  3. Search empty/fails → ask LLM to suggest official source URLs (grounded
 *     in the specialist persona), then fetch candidates that respond 200.
 * Fetched content is saved into the specialist's knowledge group.
 */
export class CrawlExecutor implements ToolExecutor {
  readonly type = "crawl";

  constructor(private readonly search: WebSearchService) {}

  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const prompt = String(ctx.input.prompt ?? "").trim();
    if (!prompt) return { content: "❌ Prompt wajib diisi.", artifacts: [] };

    const candidates = await this.resolveCandidates(ctx, prompt);
    if (candidates.length === 0) {
      return {
        content:
          "Tidak ada sumber yang bisa di-crawl.\n\n" +
          "Tips: tempel URL langsung di prompt, atau set LLM_API_KEY biar agent bisa menyarankan sumber resmi.",
        artifacts: [],
      };
    }

    const saved: string[] = [];
    const lines: string[] = [`# Crawl: ${prompt}`, ""];
    let failures = 0;

    for (const candidate of candidates.slice(0, MAX_SOURCES)) {
      const text = await this.fetchText(candidate.url);
      if (!text) {
        failures++;
        continue;
      }

      const title = candidate.title || new URL(candidate.url).hostname;
      // Simpan dengan format yang SAMA dengan knowledge_generate:
      // frontmatter + body + wikilink Catatan Terkait (bukan teks mentah).
      const related = this.findRelated(ctx, title);
      const note = buildKnowledgeNote(
        {
          title,
          source: candidate.url,
          date: new Date().toISOString().slice(0, 10),
          tier: "crawl",
        },
        text,
        related
      );
      await ctx.knowledge.create(ctx.specialist.id, title, note, candidate.url);
      saved.push(candidate.url);
      lines.push(`- ✅ [${title}](${candidate.url}) — ${text.length.toLocaleString("id-ID")} karakter`);
    }

    lines.push("");
    if (saved.length > 0) {
      lines.push(`**${saved.length} sumber disimpan ke knowledge**${failures > 0 ? ` (${failures} gagal di-fetch)` : ""}.`);
    } else {
      lines.push("Semua sumber gagal di-fetch.");
    }

    return { content: lines.join("\n"), artifacts: saved };
  }

  private async resolveCandidates(ctx: ToolExecutionContext, prompt: string): Promise<SourceCandidate[]> {
    const explicitUrls = this.extractUrls(prompt);
    if (explicitUrls.length > 0) {
      return explicitUrls.map((url) => ({ url, title: "" }));
    }

    // 1. Web search: topic → result URLs
    const searchResults = await this.search.search(prompt, MAX_SOURCES);
    if (searchResults.length > 0) {
      return searchResults.map((r) => ({ url: r.url, title: r.title }));
    }

    // 2. Fallback: LLM-suggested sources (grounded in the specialist persona)
    try {
      const system = [
        `Kamu adalah ${ctx.specialist.name}. ${ctx.specialist.description ?? ""}`,
        "User minta kamu mencari sumber informasi dari prompt berikut.",
        "Jawab HANYA dengan JSON array berisi 3-5 URL sumber resmi/terpercaya yang relevan, format: [\"https://...\", ...]",
        "Tidak ada teks lain, hanya JSON.",
      ].join("\n");

      const raw = await ctx.llm.chat(
        [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        { temperature: 0.2, maxTokens: 500 }
      );

      const json = raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1);
      const urls = JSON.parse(json) as unknown[];
      return urls
        .filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u))
        .map((url) => ({ url, title: "" }));
    } catch {
      return [];
    }
  }

  /** Cari note terkait (wikilink) — keyword search, filter junk & self. */
  private findRelated(ctx: ToolExecutionContext, title: string, limit = 3): Array<{ id: number; title: string }> {
    return cleanRelated(ctx.knowledge.search(ctx.specialist.id, title, limit + 4), title).slice(0, limit);
  }

  private extractUrls(text: string): string[] {
    const matches = text.match(URL_REGEX) ?? [];
    return [...new Set(matches)].slice(0, MAX_SOURCES);
  }

  private async fetchText(url: string): Promise<string | null> {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) return null;

      const html = await res.text();
      const $ = cheerio.load(html);
      $("script, style, noscript, nav, footer, header, aside, form").remove();
      const text = $("body").text().replace(/\s+/g, " ").trim();
      return text ? text.slice(0, MAX_CONTENT_CHARS) : null;
    } catch {
      return null;
    }
  }
}
