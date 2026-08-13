import type Database from "better-sqlite3";
import type { Knowledge, PipelineDetail, Specialist } from "../domain/types.js";
import type { PipelineService } from "./pipeline.service.js";
import type { KnowledgeService } from "./knowledge.service.js";
import type { SpecialistService } from "./specialist.service.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillExportFile {
  path: string;
  content: string;
}

export interface SkillExportStats {
  stages: number;
  specialists: number;
  knowledge_notes: number;
  junk_filtered: number;
  duplicate_filtered: number;
}

export interface SkillExport {
  skill_name: string;
  pipeline_id: number;
  generated_at: string;
  stats: SkillExportStats;
  files: SkillExportFile[];
  skill_md: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** `Nama Pipeline!` → `nama-pipeline` */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "skill";
}

/**
 * Sampah dari hasil crawl (film/bioskop dll) — jangan ikut ke-download ke skill.
 * Heuristic: keyword blocklist di title+source. Keep list kecil & jelas.
 */
const JUNK_KEYWORDS = [
  "film",
  "bioskop",
  "cinema",
  "nonton",
  "rilis",
  "jadwal",
  "tiket",
  "trailer",
  "movie",
  "rating terbaik",
  "streaming",
];

function isJunkKnowledge(k: Knowledge): boolean {
  const hay = `${k.title} ${k.source ?? ""}`.toLowerCase();
  return JUNK_KEYWORDS.some((w) => hay.includes(w));
}

/** Filter konten sampah (film/bioskop dll) dari hasil crawl — dipakai juga oleh template service. */
export function isJunkTitle(title: string, source = ""): boolean {
  const hay = `${title} ${source}`.toLowerCase();
  return JUNK_KEYWORDS.some((w) => hay.includes(w));
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Derive tags dari judul + sumber — dipakai buat index padat & MCP
 * knowledge_topics. Keep list kecil & jelas biar konsisten.
 */
const TAG_RULES: Array<[RegExp, string]> = [
  [/pph\s*21|pph21|pasal\s*21/i, "pph21"],
  [/\bppn\b/i, "ppn"],
  [/pajak|perpajakan|djp\b/i, "pajak"],
  [/coa|chart\s*of\s*account/i, "coa"],
  [/sak\b|psak|standar akuntansi/i, "sak"],
  [/siklus akuntansi/i, "siklus"],
  [/laporan|neraca|laba rugi|arus kas/i, "laporan"],
  [/jurnal|buku besar|double.?entry/i, "jurnal"],
  [/tarif efektif|\bter\b/i, "ter"],
  [/ptkp|npwp|wajib pajak/i, "npwp"],
  [/pendaftaran|registrasi/i, "pendaftaran"],
  [/akuntansi|accounting/i, "akuntansi"],
  [/edukasi|belajar|panduan/i, "edukasi"],
  [/solusi sistem|requirement|requirements/i, "solusi-sistem"],
  [/test plan|unit test|integration/i, "testing"],
];

export function deriveTags(title: string, source = ""): string[] {
  const hay = `${title} ${source}`;
  const tags = TAG_RULES.filter(([re]) => re.test(hay)).map(([, tag]) => tag);
  return [...new Set(tags)].slice(0, 4);
}

/** Ringkasan 1 baris (±160 char) dari konten crawl — buat index padat. */
export function summarize(content: string, max = 160): string {
  const clean = (content || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function frontmatter(k: Knowledge): string {
  const date = k.created_at ? k.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const tags = deriveTags(k.title, k.source);
  return [
    "---",
    `title: ${k.title.replace(/:/g, " -")}`,
    `source: ${k.source || "unknown"}`,
    `date: ${date}`,
    `tier: crawl`,
    `tags: [${tags.join(", ")}]`,
    `summary: ${summarize(k.content)}`,
    "---",
    "",
  ].join("\n");
}

function renderKnowledgeNote(k: Knowledge): string {
  const body = (k.content || "").trim();
  return `${frontmatter(k)}${body}\n`;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SkillExportService {
  constructor(
    private readonly db: Database.Database,
    private readonly pipeline: PipelineService,
    private readonly specialistService: SpecialistService,
    private readonly knowledge: KnowledgeService
  ) {}

  /**
   * Export pipeline → skill package (SKILL.md + knowledge/ bundle).
   * Skill ini siap di-install ke skill store (Tauri: `local:<folder>`) lalu
   * di-inject ke Cursor / Codex / Claude Code / OpenCode — agent di tool
   * itulah yang menjalankan pipeline-nya, bukan backend.
   */
  exportPipeline(pipelineId: number): SkillExport {
    const detail = this.pipeline.get(pipelineId);
    const stages = detail.stages;
    const skillName = slugify(detail.name);

    // --- Kumpulkan knowledge per specialist (filter junk + dedupe) ---
    const specialistIds = [...new Set(stages.map((s) => s.specialist_id))];
    const knowledgeBySpecialist = new Map<number, Knowledge[]>();
    let junkFiltered = 0;
    let duplicateFiltered = 0;

    for (const sid of specialistIds) {
      const all = this.knowledge.listBySpecialist(sid, 500);
      const seen = new Set<string>();
      const kept: Knowledge[] = [];
      for (const k of all) {
        if (isJunkKnowledge(k)) {
          junkFiltered++;
          continue;
        }
        const norm = normalizeTitle(k.title);
        if (seen.has(norm)) {
          duplicateFiltered++;
          continue;
        }
        seen.add(norm);
        kept.push(k);
      }
      knowledgeBySpecialist.set(sid, kept);
    }

    const specialistById = new Map<number, Specialist>();
    for (const sid of specialistIds) {
      specialistById.set(sid, this.specialistService.get(sid));
    }

    // --- Render files ---
    const files: SkillExportFile[] = [];

    // knowledge/<specialist-slug>/... (sub-index padat: wikilink + tags + summary)
    const knowledgeNoteFiles: SkillExportFile[] = [];
    const totalNotes = [...knowledgeBySpecialist.values()].reduce((a, n) => a + n.length, 0);
    const topLevelLines: string[] = [
      "# Knowledge Bundle",
      "",
      `${specialistIds.length} specialist · ${totalNotes} catatan (export ${new Date().toISOString().slice(0, 10)}).`,
      "",
      "Baca index ini dulu buat milih cabang, JANGAN baca semua catatan.",
      "",
    ];

    for (const sid of specialistIds) {
      const spec = specialistById.get(sid)!;
      const notes = knowledgeBySpecialist.get(sid) ?? [];
      const dir = `knowledge/${slugify(spec.name)}`;
      const indexLines = [
        `# Knowledge: ${spec.name}`,
        "",
        `${notes.length} catatan (export ${new Date().toISOString().slice(0, 10)}).`,
        "",
        "## Daftar Catatan",
        "",
        "> Format: `[[nama-file|judul]]` — `tags` — ringkasan 1 baris.",
        "> Buka file-nya (wikilink) cuma kalau ringkasannya relevan.",
        "",
      ];
      for (const k of notes) {
        const filename = `k${k.id}-${slugify(k.title).slice(0, 48)}`;
        const tags = deriveTags(k.title, k.source);
        const tagStr = tags.length ? `\`${tags.join(", ")}\`` : "";
        indexLines.push(`- [[${filename}|${k.title}]] ${tagStr} — ${summarize(k.content, 120)}`);
        knowledgeNoteFiles.push({
          path: `${dir}/${filename}.md`,
          content: renderKnowledgeNote(k),
        });
      }
      indexLines.push("");
      files.push({ path: `${dir}/index.md`, content: indexLines.join("\n") });

      // Top-level entry: specialist + tag cloud + count
      const tagCloud = [...new Set(notes.flatMap((n) => deriveTags(n.title, n.source)))].slice(0, 6).join(", ");
      topLevelLines.push(
        `- **${spec.name}** (${notes.length} catatan) — ${tagCloud || spec.description.slice(0, 60)} → \`${dir}/index.md\``
      );
    }
    topLevelLines.push("");
    files.push({ path: "knowledge/index.md", content: topLevelLines.join("\n") });
    files.push(...knowledgeNoteFiles);

    // SKILL.md
    const skillMd = this.renderSkillMd(detail, specialistById, knowledgeBySpecialist);
    files.unshift({ path: "SKILL.md", content: skillMd });

    return {
      skill_name: skillName,
      pipeline_id: pipelineId,
      generated_at: new Date().toISOString(),
      stats: {
        stages: stages.length,
        specialists: specialistIds.length,
        knowledge_notes: files.filter((f) => f.path.endsWith(".md") && f.path.includes("/") && !f.path.endsWith("index.md")).length,
        junk_filtered: junkFiltered,
        duplicate_filtered: duplicateFiltered,
      },
      files,
      skill_md: skillMd,
    };
  }

  private renderSkillMd(
    detail: PipelineDetail,
    specialistById: Map<number, Specialist>,
    knowledgeBySpecialist: Map<number, Knowledge[]>
  ): string {
    const stages = detail.stages;
    const skillName = slugify(detail.name);

    // Trigger words: dari description pipeline + nama specialist + judul knowledge
    const triggers = new Set<string>([...skillName.split("-")]);
    if (detail.description) {
      for (const w of detail.description.toLowerCase().split(/[^a-z0-9]+/)) {
        if (w.length > 3) triggers.add(w);
      }
    }
    for (const spec of specialistById.values()) {
      for (const w of spec.name.toLowerCase().split(/[^a-z0-9]+/)) {
        if (w.length > 2) triggers.add(w);
      }
    }
    for (const notes of knowledgeBySpecialist.values()) {
      for (const k of notes.slice(0, 10)) {
        for (const w of k.title.toLowerCase().split(/[^a-z0-9]+/)) {
          if (w.length > 3) triggers.add(w);
        }
      }
    }
    const triggerList = [...triggers].slice(0, 24).join(", ");

    const lines: string[] = [];
    lines.push("---");
    lines.push(`name: ${skillName}`);
    lines.push(
      `description: ${detail.description || `Orkestrasi ${detail.name}`} Trigger: ${triggerList}.`
    );
    lines.push("---");
    lines.push("");
    lines.push(`# ${detail.name} — Orchestrator Skill`);
    lines.push("");
    lines.push(
      "Kamu adalah **orchestrator**. Saat user minta sesuatu yang cocok dengan skill ini, jalankan stages di bawah **secara berurutan**. Jangan lompat-lompat stage, dan **jangan mengarang fakta domain** — baca dulu knowledge bundle yang tersedia."
    );
    lines.push("");
    lines.push("## Domain & Knowledge");
    lines.push("");
    lines.push("Pipeline ini membawa domain knowledge yang di-bundle:");
    lines.push("");
    lines.push("- Baca `knowledge/index.md` (top-level) DULU — cuma berisi cabang per specialist + tags.");
    lines.push("- Lalu buka sub-index `knowledge/<specialist>/index.md` (wikilink + ringkasan 1 baris).");
    lines.push("- Terakhir, buka note penuh via wikilink — **cuma yang relevan**.");
    lines.push("");
    for (const sid of [...specialistById.keys()]) {
      const spec = specialistById.get(sid)!;
      const notes = knowledgeBySpecialist.get(sid) ?? [];
      lines.push(
        `- **${spec.name}** (${notes.length} catatan) — ${spec.description} Sub-index: \`knowledge/${slugify(spec.name)}/index.md\``
      );
    }
    lines.push("");
    lines.push("### Aturan pakai knowledge (penting!)");
    lines.push("1. Selalu cek tanggal & sumber catatan (frontmatter `source`, `date`).");
    lines.push("2. Index pakai wikilink `[[file|judul]]` — resolve ke file `.md` dengan nama yang sama di folder itu.");
    lines.push("3. **JANGAN baca semua catatan** — kalau total notes > 20 atau keyword gak pasti, pakai MCP `knowledge_search` (atau `knowledge_topics`) dulu, baru buka yang relevan.");
    lines.push("4. Kalau hasil search gak cukup → **refine query** (ganti keyword / filter specialist).");
    lines.push("5. Kalau info di knowledge kurang / kedaluwarsa / bertentangan, **tanya user** — jangan asumsi.");
    lines.push("");
    lines.push("## Stages");
    lines.push("");
    stages.forEach((stage, i) => {
      const spec = specialistById.get(stage.specialist_id);
      lines.push(`### Stage ${i + 1}: ${stage.name}`);
      lines.push("");
      if (spec) {
        lines.push(`- **Specialist:** ${spec.name} — ${spec.description}`);
        lines.push(`- **Knowledge:** \`knowledge/${slugify(spec.name)}/\``);
      }
      lines.push(`- **Instruksi:** ${stage.instruction || "(tidak ada instruksi spesifik)"}`);
      lines.push(`- **Max iterasi feedback:** ${stage.max_iterations}`);
      lines.push("");
    });
    lines.push("## Aturan Orkestrasi");
    lines.push("");
    lines.push("1. Kerjakan stage berurutan dari atas ke bawah; **output stage N menjadi input stage N+1**.");
    lines.push("2. Sebelum tiap stage, baca knowledge specialist-nya (kalau ada).");
    lines.push("3. Kalau butuh info tambahan (tidak ada di knowledge / konteks user), **tanya user dulu** — jangan lanjut dengan asumsi.");
    lines.push("4. **Setiap output stage WAJIB diawali header `## Stage N: <nama stage>`** — kerjakan satu per satu, JANGAN menggabungkan stage.");
    lines.push("5. Tiap stage wajib menghasilkan output tertulis (ringkasan / dokumen / kode sesuai instruksi).");
    lines.push("6. Setelah stage terakhir: rangkum hasil akhir + sebutkan artefak yang dihasilkan.");
    lines.push("");
    lines.push("## Output Akhir");
    lines.push("");
    lines.push("- Ringkasan eksekusi per stage (apa yang dikerjakan, keputusan penting).");
    lines.push("- Artefak: daftar file/dokumen yang dihasilkan.");
    lines.push("");
    lines.push("## MCP PalHub (opsional, kalau tersedia)");
    lines.push("");
    lines.push("Kalau MCP server PalHub ke-connect (endpoint `http://43.133.142.161:8787/mcp`), prefer pakai tool MCP buat data live:");
    lines.push("- `knowledge_search` — cari knowledge fresh (bukan snapshot bundle) + sumbernya.");
    lines.push("- `orchestrator_plan` — minta rekomendasi pipeline/stages buat task user.");
    lines.push("- `pipeline_run` — jalankan pipeline penuh server-side kalau user minta otomatis.");
    lines.push("Bundle `knowledge/` di skill ini tetap jadi fallback offline.");
    lines.push("");

    return lines.join("\n");
  }
}
