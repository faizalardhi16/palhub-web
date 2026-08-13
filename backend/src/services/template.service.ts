import * as cheerio from "cheerio";
import { z } from "zod";
import type { LlmClient } from "../llm/client.js";
import type { KnowledgeService } from "./knowledge.service.js";
import type { SpecialistService } from "./specialist.service.js";
import type { WebSearchService } from "./search.service.js";
import type { EmbeddingService } from "./embedding.service.js";
import type { KnowledgeTemplate } from "../templates/registry.js";
import { detectTemplate, getTemplate, TEMPLATES } from "../templates/registry.js";

const MAX_SOURCES = 3;
const MAX_CONTENT_CHARS = 4000;
const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const URL_REGEX = /https?:\/\/[^\s"'<>]+/g;

export interface GenerateKnowledgeInput {
  topic: string;
  specialistId?: number | null;
  specialistName?: string;
  templateId?: string;
  sources?: string[];
}

export interface GenerateKnowledgeResult {
  id: number;
  title: string;
  specialist_id: number;
  template: string;
  sources: string[];
  chars: number;
  preview: string;
}

/** Skema output LLM — di-validate biar catatan selalu rapi & lengkap. */
const OUTPUT_SCHEMA = z.object({
  title: z.string().min(3).max(200),
  sections: z.record(z.string(), z.string()),
});

/**
 * KnowledgeTemplateService — "crawl → AI isi template → simpan + embed".
 *
 * Flow:
 *  1. Resolve sources: URL eksplisit dari input → web search → LLM-suggested.
 *  2. Fetch tiap source (text bersih, max 4000 chars).
 *  3. LLM mengisi template (per domain) jadi JSON — dengan guidance per section.
 *  4. Validasi zod → kalau gagal, retry 1x dengan feedback error.
 *  5. Render markdown, simpan ke knowledge (FTS trigger otomatis), embed.
 *
 * Catatan yang dihasilkan terstruktur (bukan teks mentah crawl) — itu bedanya
 * sama CrawlExecutor: skill dapet "domain knowledge" yang rapi, bukan dump.
 */
export class KnowledgeTemplateService {
  constructor(
    private readonly deps: {
      knowledge: KnowledgeService;
      specialists: SpecialistService;
      search: WebSearchService;
      llm: LlmClient;
      embedding?: EmbeddingService;
    }
  ) {}

  listTemplates(): Array<{ id: string; name: string; description: string; sections: string[] }> {
    return TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      sections: t.sections.map((s) => s.heading),
    }));
  }

  async generate(input: GenerateKnowledgeInput): Promise<GenerateKnowledgeResult> {
    const topic = input.topic.trim();
    if (!topic) throw new Error("topic wajib diisi");

    // 1) Resolve template sementara (buat fallback specialist match kalau
    //    specialist_id gak di-pass). Final template di langkah 3.
    const template = input.templateId
      ? getTemplate(input.templateId) ?? detectTemplate(input.specialistName ?? "")
      : detectTemplate(input.specialistName ?? "");
    if (!template) throw new Error("Template tidak ditemukan");

    // 2) Resolve specialist (eksplisit dari caller; kalau gak ada, cari yang match template)
    const specialist = this.resolveSpecialist(input.specialistId, input.specialistName, template);
    if (!specialist) throw new Error("Specialist tidak ditemukan — passing specialist_id / specialist_name");

    // 3) Template final: kalau user gak pilih eksplisit, auto-detect dari
    //    nama specialist yang SUDAH di-resolve (bukan dari input mentah).
    const finalTemplate = input.templateId ? template : detectTemplate(specialist.name);

    // 3) Resolve & fetch sources
    const urls = await this.resolveSources(topic, input.sources);
    const sources = await this.fetchSources(urls);
    if (sources.length === 0) {
      throw new Error("Semua sumber gagal di-fetch. Coba kasih URL langsung yang valid.");
    }

    // 4) LLM isi template → JSON (retry 1x kalau gagal validasi)
    const { title, sections } = await this.fillTemplate(topic, finalTemplate, sources);

    // 5) Render markdown & simpan
    const markdown = this.renderMarkdown(topic, title, finalTemplate, sections, sources);
    const note = this.deps.knowledge.create(
      specialist.id,
      title,
      markdown,
      sources.map((s) => s.url).join(", ")
    );

    // 6) Embedding: backfill cuma proses yang missing — aman dipanggil langsung
    if (this.deps.embedding?.enabled) {
      void this.deps.embedding.backfill().catch(() => {});
    }

    return {
      id: note.id,
      title: note.title,
      specialist_id: specialist.id,
      template: finalTemplate.id,
      sources: sources.map((s) => s.url),
      chars: note.content.length,
      preview: note.content.slice(0, 300),
    };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private resolveSpecialist(
    specialistId: number | null | undefined,
    specialistName: string | undefined,
    template: KnowledgeTemplate
  ): { id: number; name: string } | null {
    // 1) Eksplisit by id
    if (specialistId) {
      try {
        const s = this.deps.specialists.get(specialistId);
        if (s) return { id: s.id, name: s.name };
      } catch {
        /* fall through */
      }
    }
    // 2) By name
    if (specialistName) {
      const s = this.deps.specialists
        .list()
        .find((x) => x.name.toLowerCase() === specialistName.toLowerCase());
      if (s) return { id: s.id, name: s.name };
    }
    // 3) Auto: specialist yang namanya match keyword template
    const all = this.deps.specialists.list();
    const matched = all.find((s) => template.match.some((kw) => s.name.toLowerCase().includes(kw)));
    if (matched) return { id: matched.id, name: matched.name };
    // 4) Fallback: specialist pertama
    return all[0] ? { id: all[0].id, name: all[0].name } : null;
  }

  /** Priority: URL eksplisit → web search → LLM-suggested. */
  private async resolveSources(topic: string, explicit?: string[]): Promise<string[]> {
    const explicitUrls = (explicit ?? []).filter((u) => /^https?:\/\//.test(u));
    if (explicitUrls.length > 0) return explicitUrls.slice(0, MAX_SOURCES);

    // URL langsung di topic (misal "jelaskan https://pajak.go.id/...")
    const inline = (topic.match(URL_REGEX) ?? []).slice(0, MAX_SOURCES);
    if (inline.length > 0) return inline;

    const searchResults = await this.deps.search.search(topic, MAX_SOURCES);
    if (searchResults.length > 0) return searchResults.map((r) => r.url);

    return [];
  }

  private async fetchSources(urls: string[]): Promise<Array<{ url: string; text: string }>> {
    const out: Array<{ url: string; text: string }> = [];
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) continue;
        const html = await res.text();
        const $ = cheerio.load(html);
        $("script, style, noscript, nav, footer, header, aside, form").remove();
        const text = $("body").text().replace(/\s+/g, " ").trim();
        if (text) out.push({ url, text: text.slice(0, MAX_CONTENT_CHARS) });
      } catch {
        /* skip */
      }
    }
    return out;
  }

  /** LLM mengisi template → JSON. Retry 1x dengan feedback error kalau validasi gagal. */
  private async fillTemplate(
    topic: string,
    template: KnowledgeTemplate,
    sources: Array<{ url: string; text: string }>
  ): Promise<{ title: string; sections: Record<string, string> }> {
    const sourceBlock = sources
      .map((s, i) => `[Sumber ${i + 1}: ${s.url}]\n${s.text}`)
      .join("\n\n---\n\n");

    const sectionSpec = template.sections
      .map((s) => {
        const req = s.required ? "WAJIB" : "opsional";
        return `- "${s.key}" (${req}): ${s.guidance}`;
      })
      .join("\n");

    const system = `Kamu adalah peneliti yang menyusun catatan domain knowledge dari hasil crawl web.
Kamu membuat catatan berformat template "${template.name}".

TUGAS: Baca semua sumber di bawah, lalu susun catatan ${template.id} tentang topik: "${topic}".

STRUKTUR OUTPUT — JSON object, HANYA JSON, tanpa markdown fence, tanpa teks lain:
{
  "title": "Judul catatan (spesifik, mengandung topik, max 12 kata)",
  "sections": {
    <key section>: "isi section sesuai guidance",
    ...
  }
}

KEY JSON sections yang TERSEDIA (pilih SEMUA key yang required, plus opsional kalau relevan):
${sectionSpec}

ATURAN:
- Tulis dalam Bahasa Indonesia yang profesional, kecuali istilah teknis.
- Fakta harus dari sumber, JANGAN mengarang angka/regulasi. Kalau sumber tidak menyebut, tulis "tidak disebutkan dalam sumber".
- Section yang wajib TIDAK BOLEH kosong.
- Gunakan bullet (-) untuk daftar, dan format angka/tarif persis seperti di sumber.`;

    const user = `Topik: ${topic}

${sourceBlock}`;

    const attempt = async (feedback?: string): Promise<{ title: string; sections: Record<string, string> }> => {
      const messages: Array<{ role: "system" | "user"; content: string }> = [
        { role: "system", content: system },
        { role: "user", content: user },
      ];
      if (feedback) {
        messages.push({
          role: "user",
          content: `Output sebelumnya GAGAL validasi dengan error:\n${feedback}\n\nPerbaiki dan kirim ulang JSON yang valid.`,
        });
      }
      const raw = await this.deps.llm.chat(messages, { temperature: 0.2, maxTokens: 12000 });
      return this.parseJson(raw, template);
    };

    try {
      return await attempt();
    } catch (firstError) {
      // Retry 1x dengan feedback — output LLM kadang lari dari format JSON
      return await attempt(`Output tidak valid: ${(firstError as Error).message}`);
    }
  }

  /** Parse JSON dari output LLM — toleran sama markdown fence & teks di sekitar. */
  private parseJson(raw: string, template: KnowledgeTemplate): { title: string; sections: Record<string, string> } {
    let text = raw.trim();
    // Strip markdown fence kalau ada (```json ... ```)
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Output LLM bukan JSON object");
    }
    const parsed = OUTPUT_SCHEMA.parse(JSON.parse(text.slice(start, end + 1)));
    // Validasi section wajib terisi — kalau kosong, retry dengan feedback
    for (const section of template.sections) {
      if (section.required && !(parsed.sections[section.key] ?? "").trim()) {
        throw new Error(`Section wajib "${section.key}" kosong`);
      }
    }
    return parsed;
  }

  private renderMarkdown(
    topic: string,
    title: string,
    template: KnowledgeTemplate,
    sections: Record<string, string>,
    sources: Array<{ url: string; text: string }>
  ): string {
    const date = new Date().toISOString().slice(0, 10);
    const sourceList = sources.map((s) => `- ${s.url}`).join("\n");
    const lines: string[] = [
      `# ${title}`,
      "",
      `> Topik: ${topic} • Template: ${template.name} • Tanggal: ${date}`,
      "",
    ];
    for (const section of template.sections) {
      const content = (sections[section.key] ?? "").trim();
      if (!content) continue;
      lines.push(`## ${section.heading}`, "", content, "");
    }
    lines.push("## Referensi", "", sourceList, "");
    return lines.join("\n").trim();
  }
}
