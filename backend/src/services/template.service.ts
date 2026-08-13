import * as cheerio from "cheerio";
import { z } from "zod";
import type { LlmClient } from "../llm/client.js";
import type { KnowledgeService } from "./knowledge.service.js";
import type { SpecialistService } from "./specialist.service.js";
import type { WebSearchService } from "./search.service.js";
import type { EmbeddingService } from "./embedding.service.js";
import type { KnowledgeTemplate } from "../templates/registry.js";
import { detectTemplate, getTemplate, TEMPLATES } from "../templates/registry.js";
import { deriveTags, isJunkTitle, summarize } from "./skill-export.service.js";
import { renderFrontmatter, renderRelatedSection } from "./note-format.js";

const MAX_SOURCES = 3;
// 2500 chars/source — cukup buat analisis & ringkasan, tapi bikin LLM call
// jauh lebih cepat (input 3×4000 chars → generate bisa 60-90s, timeout MCP).
const MAX_CONTENT_CHARS = 2500;
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
  /** true kalau gak bikin note baru karena sudah ada yang sama. */
  duplicate?: boolean;
  /** id note existing kalau duplicate. */
  existing_id?: number | null;
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

    // 1) Resolve specialist: eksplisit (id/name) → match template → detect
    //    dari TOPIK (kata kunci topik vs nama specialist) → fallback pertama.
    const specialist = this.resolveSpecialist(input, topic);
    if (!specialist) throw new Error("Specialist tidak ditemukan — passing specialist_id / specialist_name");

    // 2) Template final: eksplisit, atau auto-detect dari nama specialist
    //    yang SUDAH di-resolve (bukan dari input mentah).
    const finalTemplate = input.templateId
      ? getTemplate(input.templateId) ?? detectTemplate(specialist.name)
      : detectTemplate(specialist.name);

    // 4) Dedupe: kalau topik ini udah ke-cover note existing (hybrid search
    //    dapet match kuat di specialist yang sama), gak usah bikin duplikat.
    //    Skip kalau user kasih `sources` eksplisit — itu intent buat sumber baru.
    if (!input.sources?.length) {
      const existing = await this.findExistingCoverage(topic, specialist.id);
      if (existing) {
        return {
          id: existing.id,
          title: existing.title,
          specialist_id: specialist.id,
          template: finalTemplate.id,
          sources: existing.source ? existing.source.split(", ").filter(Boolean) : [],
          chars: existing.content.length,
          preview: existing.content.slice(0, 300),
          duplicate: true,
          existing_id: existing.id,
        };
      }
    }

    // 5) Resolve & fetch sources (URL yang udah dikenal di-skip biar gak
    //    nambah duplikat dari sumber yang sama)
    const urls = await this.resolveSources(topic, input.sources, specialist.id);
    const sources = await this.fetchSources(urls);
    if (sources.length === 0) {
      throw new Error(
        "Semua sumber gagal di-fetch atau udah ada di knowledge. " +
          "Coba kasih URL baru yang belum pernah di-crawl, atau topic yang beda."
      );
    }

    // 6) LLM isi template → JSON (retry 1x kalau gagal validasi)
    const { title, sections } = await this.fillTemplate(topic, finalTemplate, sources);

    // 7) Cek duplikat judul (LLM kadang bikin judul yang sama persis)
    const titleDup = this.findTitleDuplicate(title, specialist.id);
    if (titleDup) {
      return {
        id: titleDup.id,
        title: titleDup.title,
        specialist_id: specialist.id,
        template: finalTemplate.id,
        sources: titleDup.source ? titleDup.source.split(", ").filter(Boolean) : [],
        chars: titleDup.content.length,
        preview: titleDup.content.slice(0, 300),
        duplicate: true,
        existing_id: titleDup.id,
      };
    }

    // 8) Catatan terkait (wikilink ke note lain yang relevan — format sama
    //    dengan skill bundle: [[k{id}-{slug}|judul]])
    const related = await this.findRelated(title, specialist.id);

    // 9) Render markdown (frontmatter + sections + wikilink) & simpan
    const markdown = this.renderMarkdown(title, finalTemplate, sections, sources, related);
    const note = this.deps.knowledge.create(
      specialist.id,
      title,
      markdown,
      sources.map((s) => s.url).join(", ")
    );

    // 10) Embedding: backfill cuma proses yang missing — aman dipanggil langsung
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

  /**
   * Resolve specialist tujuan catatan. Prioritas:
   *  1. specialist_id eksplisit
   *  2. specialist_name eksplisit
   *  3. template_id eksplisit → specialist yang namanya match keyword template
   *  4. auto-detect dari TOPIK: token nama specialist yang muncul di topik
   *  5. auto-detect dari TOPIK: keyword template yang muncul di topik
   *     (misal "cqrs/microservice" → tech → Solution Architect)
   *  6. fallback: specialist pertama
   */
  private resolveSpecialist(
    input: GenerateKnowledgeInput,
    topic: string
  ): { id: number; name: string } | null {
    const all = this.deps.specialists.list();

    // 1) Eksplisit by id
    if (input.specialistId) {
      try {
        const s = this.deps.specialists.get(input.specialistId);
        if (s) return { id: s.id, name: s.name };
      } catch {
        /* fall through */
      }
    }
    // 2) Eksplisit by name
    const name = input.specialistName;
    if (name) {
      const s = all.find((x) => x.name.toLowerCase() === name.toLowerCase());
      if (s) return { id: s.id, name: s.name };
    }
    // 3) Template eksplisit → specialist yang namanya match keyword template
    if (input.templateId) {
      const tpl = getTemplate(input.templateId);
      if (tpl) {
        const s = all.find((x) => tpl.match.some((kw) => x.name.toLowerCase().includes(kw)));
        if (s) return { id: s.id, name: s.name };
      }
    }
    // 4) Auto-detect dari topik: token nama specialist (len > 3) yang muncul
    //    di topik. Contoh: topik "event-driven architecture" → "architect"
    //    match "Solution Architect", bukan "Finance".
    const topicLower = topic.toLowerCase();
    const scored = all
      .map((s) => {
        const nameTokens = s.name
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((w) => w.length > 3);
        const score = nameTokens.filter((w) => topicLower.includes(w)).length;
        return { s, score };
      })
      .sort((a, b) => b.score - a.score);
    if (scored[0] && scored[0].score > 0) {
      return { id: scored[0].s.id, name: scored[0].s.name };
    }
    // 5) Auto-detect dari topik: keyword template di topik → specialist yang
    //    namanya match template itu. "cqrs/microservice/database" → tech.
    const templateMatch = TEMPLATES.find((t) => t.match.some((kw) => topicLower.includes(kw)));
    if (templateMatch) {
      const s = all.find((x) => templateMatch.match.some((kw) => x.name.toLowerCase().includes(kw)));
      if (s) return { id: s.id, name: s.name };
    }
    // 6) Fallback: specialist pertama
    return all[0] ? { id: all[0].id, name: all[0].name } : null;
  }

  /** Priority: URL eksplisit → web search → LLM-suggested. */
  private async resolveSources(topic: string, explicit: string[] | undefined, specialistId: number): Promise<string[]> {
    const explicitUrls = (explicit ?? []).filter((u) => /^https?:\/\//.test(u));
    if (explicitUrls.length > 0) {
      // URL eksplisit = intent user → hormati apa adanya, gak di-filter.
      return explicitUrls.slice(0, MAX_SOURCES);
    }

    // URL langsung di topic (misal "jelaskan https://pajak.go.id/...")
    const inline = (topic.match(URL_REGEX) ?? []).slice(0, MAX_SOURCES);
    if (inline.length > 0) return inline;

    const searchResults = await this.deps.search.search(topic, MAX_SOURCES);
    if (searchResults.length === 0) return [];

    // Filter: buang URL yang udah pernah di-crawl di specialist ini —
    // biar gak terus-terusan nambah duplikat dari sumber yang sama.
    const known = this.existingBySource(specialistId);
    const fresh = searchResults.map((r) => r.url).filter((u) => !known.has(this.normalizeSource(u)));
    return (fresh.length > 0 ? fresh : []).slice(0, MAX_SOURCES);
  }

  /** Set URL sumber (ternormalisasi) yang udah ada di knowledge specialist. */
  private existingBySource(specialistId: number): Set<string> {
    const rows = this.deps.knowledge.listBySpecialist(specialistId, 500);
    return new Set(
      rows
        .map((r) => r.source)
        .filter(Boolean)
        .map((s) => this.normalizeSource(s))
    );
  }

  /** Normalisasi URL buat perbandingan: buang scheme, trailing slash, lowercase. */
  private normalizeSource(url: string): string {
    return url
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "")
      .toLowerCase();
  }

  /**
   * Cek apakah topik udah ke-cover note existing.
   * Syarat: hasil search harus HYBRID (keyword + semantic confirm) dengan
   * score >= 0.5 — keyword-only itu sinyal lemah (cuma term-ratio, banyak
   * false positive kayak "PPh Pasal 22" vs catatan "PPh Pasal 21").
   * Guard angka: topik & title yang punya angka BERBEDA dianggap topik beda.
   */
  private async findExistingCoverage(topic: string, specialistId: number): Promise<{
    id: number;
    title: string;
    content: string;
    source: string;
  } | null> {
    try {
      if (this.deps.embedding?.enabled) {
        const hits = await this.deps.embedding.search(topic, { specialistId, limit: 1, mode: "hybrid" });
        const top = hits[0];
        if (
          top &&
          top.specialist_id === specialistId &&
          top.method === "hybrid" &&
          top.score >= 0.5 &&
          !this.hasConflictingNumber(topic, top.title)
        ) {
          return { id: top.id, title: top.title, content: top.content, source: top.source };
        }
        return null;
      }
    } catch {
      /* fall through ke keyword */
    }
    const kw = this.deps.knowledge.search(specialistId, topic, 3);
    if (kw.length === 0) return null;
    // Keyword fallback: match title persis / source sama
    const terms = topic.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    const best = kw[0];
    const hay = `${best.title} ${best.content.slice(0, 400)}`.toLowerCase();
    const hit = terms.filter((t) => hay.includes(t)).length / Math.max(1, terms.length);
    if (hit >= 0.8 && !this.hasConflictingNumber(topic, best.title)) {
      return { id: best.id, title: best.title, content: best.content, source: best.source };
    }
    return null;
  }

  /**
   * True kalau dua teks punya angka yang BEDA SEMUA (misal "Pasal 22" vs
   * "Pasal 21") — indikasi topik beda, jangan dianggap duplikat.
   */
  private hasConflictingNumber(a: string, b: string): boolean {
    const numsA = new Set(a.match(/\d+/g) ?? []);
    const numsB = new Set(b.match(/\d+/g) ?? []);
    if (numsA.size === 0 || numsB.size === 0) return false;
    return [...numsA].every((n) => !numsB.has(n));
  }

  /** Cek duplikat judul (normalized) di specialist yang sama. */
  private findTitleDuplicate(title: string, specialistId: number): { id: number; title: string; content: string; source: string } | null {
    const norm = title.toLowerCase().trim().replace(/\s+/g, " ");
    const rows = this.deps.knowledge.listBySpecialist(specialistId, 500);
    const dup = rows.find((r) => r.title.toLowerCase().trim().replace(/\s+/g, " ") === norm);
    return dup ? { id: dup.id, title: dup.title, content: dup.content, source: dup.source } : null;
  }

  /** Cari note terkait (wikilink) — hybrid search judul, filter junk & self. */
  private async findRelated(title: string, specialistId: number, limit = 3): Promise<Array<{ id: number; title: string }>> {
    const clean = (h: { id: number; title: string }) =>
      h.title.toLowerCase() !== title.toLowerCase() && !isJunkTitle(h.title);
    try {
      if (this.deps.embedding?.enabled) {
        const hits = await this.deps.embedding.search(title, { specialistId, limit: limit + 4, mode: "hybrid" });
        return hits
          .filter((h) => h.score >= 0.38 && clean(h))
          .slice(0, limit)
          .map((h) => ({ id: h.id, title: h.title }));
      }
    } catch {
      /* fall through */
    }
    return this.deps.knowledge
      .search(specialistId, title, limit + 4)
      .filter(clean)
      .slice(0, limit)
      .map((k) => ({ id: k.id, title: k.title }));
  }

  private async fetchSources(urls: string[]): Promise<Array<{ url: string; text: string }>> {
    // PARALEL — 3 URL sequential = 3×15s; paralel = max(15s). Ini krusial
    // buat MCP tool yang client-nya timeout ~60s.
    const fetched = await Promise.all(
      urls.map(async (url): Promise<{ url: string; text: string } | null> => {
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
          return text ? { url, text: text.slice(0, MAX_CONTENT_CHARS) } : null;
        } catch {
          return null;
        }
      })
    );
    return fetched.filter((s): s is { url: string; text: string } => s !== null);
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
- Tulis SELURUH isi catatan dalam Bahasa Inggris profesional (English), walaupun topik/prompt atau sumbernya berbahasa Indonesia/bahasa lain. TRANSLATE semua konten — JANGAN menyalin kalimat Indonesia apa adanya. Kalau seluruh sumber berbahasa Indonesia, catatan tetap harus 100% English. Nama proper (instansi, nama undang-undang, istilah teknis) tetap seperti aslinya.
- Judul juga dalam Bahasa Inggris.
- Fakta harus dari sumber, JANGAN mengarang angka/regulasi. Kalau sumber tidak menyebut, tulis "not mentioned in the sources".
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
      const raw = await this.deps.llm.chat(messages, { temperature: 0.2, maxTokens: 8000, json: true });
      return this.parseJson(raw, template);
    };

    try {
      return await attempt();
    } catch (firstError) {
      // Retry 1x dengan feedback — output LLM kadang lari dari format JSON
      return await attempt(`Output tidak valid: ${(firstError as Error).message}`);
    }
  }

  /**
   * Parse JSON dari output LLM.
   * - Fence ```json ... ``` cuma di-strip kalau SELURUH output dibungkus satu
   *   fence. JANGAN pakai regex fence bebas — JSON yang berisi kode fence di
   *   dalam nilai string (misal template tech: section "Contoh Kode") bakal
   *   ke-motong & rusak.
   * - Sisanya: cari JSON object TERLUAR dengan balanced brace scan, toleran
   *   sama teks tambahan sebelum/ sesudah object.
   */
  private parseJson(raw: string, template: KnowledgeTemplate): { title: string; sections: Record<string, string> } {
    let text = raw.trim();
    const wrapped = text.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
    if (wrapped) text = wrapped[1].trim();

    const start = text.indexOf("{");
    if (start === -1) {
      throw new Error("Output LLM bukan JSON object (gak ada '{')");
    }
    let depth = 0;
    let end = -1;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) {
      throw new Error("Output LLM bukan JSON object (brace gak seimbang / ke-truncate)");
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

  /**
   * Render catatan markdown dengan konvensi yang SAMA dengan skill bundle:
   * frontmatter (title/source/date/tier/tags/summary) + body + wikilink
   * `[[k{id}-{slug}|judul]]` ke catatan terkait.
   */
  private renderMarkdown(
    title: string,
    template: KnowledgeTemplate,
    sections: Record<string, string>,
    sources: Array<{ url: string; text: string }>,
    related: Array<{ id: number; title: string }>
  ): string {
    const date = new Date().toISOString().slice(0, 10);
    const sourceStr = sources.map((s) => s.url).join(", ") || "unknown";
    const sourceList = sources.map((s) => `- ${s.url}`).join("\n");

    const body: string[] = [`# ${title}`, ""];
    for (const section of template.sections) {
      const content = (sections[section.key] ?? "").trim();
      if (!content) continue;
      body.push(`## ${section.heading}`, "", content, "");
    }
    body.push("## References", "", sourceList, "");
    const bodyText = body.join("\n").trim();

    const fm = renderFrontmatter(
      { title, source: sourceStr, date, tier: "generated", template: template.id },
      deriveTags(title, sourceStr),
      summarize(bodyText)
    );
    return fm + bodyText + renderRelatedSection(related);
  }
}
