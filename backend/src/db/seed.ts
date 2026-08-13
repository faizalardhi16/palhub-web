import type Database from "better-sqlite3";

export interface SeedResult {
  specialists: number;
  tools: number;
  procedures: number;
}

const FINANCE_PROCEDURE_TEMPLATE = `# {Judul Dokumen}

## Definisi
Jelaskan definisi, istilah kunci, dan lingkup dokumen.

## Prosedur / Penggunaan
Langkah-langkah prosedur yang benar, termasuk syarat pendaftaran, penggunaan, dan perpanjangan (renewal).

## Aturan yang Boleh / Tidak Boleh Dilanggar
- Boleh: ...
- Tidak boleh: ...
Sebutkan dasar hukum / regulasi yang relevan.

## Sumber
- Daftar sumber referensi yang dipakai.`;

const BA_PROCEDURE_TEMPLATE = `# Solusi Sistem: {Judul}

## 1. Ringkasan
Deskripsi singkat masalah dan solusi.

## 2. Requirements
- FR-1: ...
- FR-2: ...
- NFR-1: ...

## 3. Entities / Data Model
- Entity: field-field penting

## 4. Alur / Flow
- Step-by-step alur sistem

## 5. Aturan Bisnis
- Aturan-aturan yang harus di-enforce sistem

## 6. Open Questions
- Pertanyaan yang masih butuh konfirmasi user`;

export function seedIfEmpty(db: Database.Database): SeedResult {
  const count = db.prepare("SELECT COUNT(*) AS c FROM specialists").get() as { c: number };
  if (count.c > 0) return { specialists: 0, tools: 0, procedures: 0 };

  const insertSpecialist = db.prepare(
    "INSERT INTO specialists (name, description) VALUES (?, ?)"
  );
  const insertProcedure = db.prepare(
    "INSERT INTO procedures (specialist_id, name, description, template) VALUES (?, ?, ?, ?)"
  );
  const insertTool = db.prepare(
    "INSERT INTO tools (specialist_id, name, description, type, procedure_id) VALUES (?, ?, ?, ?, ?)"
  );

  const seed = db.transaction(() => {
    const finance = insertSpecialist.run(
      "Finance",
      "Ahli keuangan & perpajakan Indonesia. Menjawab pertanyaan seputar pajak, Chart of Accounts (CoA), standard code, dan aturan yang boleh / tidak boleh dilanggar."
    );
    const financeId = Number(finance.lastInsertRowid);

    const genDoc = insertProcedure.run(
      financeId,
      "Generate Document",
      "Struktur standar dokumen finance (definisi, prosedur, aturan, sumber).",
      FINANCE_PROCEDURE_TEMPLATE
    );
    const genDocId = Number(genDoc.lastInsertRowid);

    insertTool.run(financeId, "crawl", "Crawl standard code / aturan terbaru dari web. Input cukup prompt.", "crawl", null);
    insertTool.run(financeId, "web_search", "Cari informasi dari web (Google via DuckDuckGo/Serper). Return judul, URL, snippet.", "web_search", null);
    insertTool.run(financeId, "generate_doc", "Generate dokumen .MD sesuai procedure Generate Document.", "generate_doc", genDocId);
    insertTool.run(financeId, "knowledge_search", "Cari knowledge yang sudah di-crawl / disimpan.", "knowledge_query", null);

    const ba = insertSpecialist.run(
      "Business Analyst",
      "Mengubah penjelasan domain (dari specialist lain / user) menjadi solusi sistem: requirements, entities, alur, dan aturan bisnis."
    );
    const baId = Number(ba.lastInsertRowid);

    const baProc = insertProcedure.run(
      baId,
      "System Solution Template",
      "Struktur dokumen solusi sistem yang dihasilkan BA.",
      BA_PROCEDURE_TEMPLATE
    );
    const baProcId = Number(baProc.lastInsertRowid);

    insertTool.run(baId, "transform", "Konversi penjelasan domain → solusi sistem (.MD).", "generate_doc", baProcId);
    insertTool.run(baId, "knowledge_search", "Cari solusi / knowledge yang pernah dibuat.", "knowledge_query", null);
  });

  seed();

  return {
    specialists: 2,
    procedures: 2,
    tools: 5,
  };
}

/**
 * ensureSeedTools — idempotent migration untuk DB yang sudah ke-seed.
 * Menambah tool baru (misal web_search) ke specialist yang sudah ada,
 * tanpa nge-drop data knowledge yang udah di-crawl.
 */
export function ensureSeedTools(db: Database.Database): number {
  const getSpecialist = db.prepare("SELECT id FROM specialists WHERE name = ?");
  const hasTool = db.prepare(
    "SELECT id FROM tools WHERE specialist_id = ? AND name = ?"
  );
  const insertTool = db.prepare(
    "INSERT INTO tools (specialist_id, name, description, type, procedure_id) VALUES (?, ?, ?, ?, ?)"
  );

  const ensure = (specialistName: string, name: string, description: string, type: string): number => {
    const spec = getSpecialist.get(specialistName) as { id: number } | undefined;
    if (!spec) return 0;
    const existing = hasTool.get(spec.id, name) as { id: number } | undefined;
    if (existing) return 0;
    insertTool.run(spec.id, name, description, type, null);
    return 1;
  };

  let added = 0;
  added += ensure(
    "Finance",
    "web_search",
    "Cari informasi dari web (Google via DuckDuckGo/Serper). Return judul, URL, snippet.",
    "web_search"
  );
  return added;
}

/**
 * ensureStandardTools — idempotent migration: tiap specialist punya tool
 * standar (crawl, web_search, knowledge_search, generate_doc) dengan nama
 * & deskripsi yang konsisten. Nama legacy (architect_crawl, knowledge,
 * document, dst) di-rename ke standar — biar MCP tool-nya rapi
 * (`solution_architect_crawl` bukan `solution_architect_architect_crawl`)
 * dan deskripsinya jelas, sehingga agent milih specialist yang benar.
 */
const LEGACY_TOOL_RENAMES: Record<string, { name: string; type: string }> = {
  architect_crawl: { name: "crawl", type: "crawl" },
  architect_websearch: { name: "web_search", type: "web_search" },
  architect_search: { name: "knowledge_search", type: "knowledge_query" },
  knowledge: { name: "knowledge_search", type: "knowledge_query" },
  document: { name: "generate_doc", type: "generate_doc" },
};

export function ensureStandardTools(db: Database.Database): number {
  const renameTool = db.prepare("UPDATE tools SET name = ?, type = ? WHERE id = ?");
  const hasTool = db.prepare("SELECT id FROM tools WHERE specialist_id = ? AND name = ?");
  const insertTool = db.prepare(
    "INSERT INTO tools (specialist_id, name, description, type, procedure_id) VALUES (?, ?, ?, ?, NULL)"
  );
  const updateDesc = db.prepare("UPDATE tools SET description = ? WHERE id = ?");

  let changed = 0;

  // 1) Rename tool legacy → standar (untuk specialist mana pun)
  const legacyRows = db
    .prepare("SELECT id, specialist_id, name FROM tools WHERE name IN (?, ?, ?, ?, ?)")
    .all(...Object.keys(LEGACY_TOOL_RENAMES)) as Array<{ id: number; specialist_id: number; name: string }>;
  for (const row of legacyRows) {
    const target = LEGACY_TOOL_RENAMES[row.name];
    const clash = hasTool.get(row.specialist_id, target.name) as { id: number } | undefined;
    if (clash) {
      // tool standar udah ada → hapus yang legacy biar gak dobel
      db.prepare("DELETE FROM tools WHERE id = ?").run(row.id);
    } else {
      renameTool.run(target.name, target.type, row.id);
    }
    changed++;
  }

  // 2) Pastikan tiap specialist punya 4 tool standar + deskripsi domain-aware
  const specs = db.prepare("SELECT id, name FROM specialists ORDER BY id").all() as Array<{ id: number; name: string }>;
  for (const spec of specs) {
    const stds = standardToolsFor(spec.name);
    for (const std of stds) {
      const existing = hasTool.get(spec.id, std.name) as { id: number } | undefined;
      if (!existing) {
        insertTool.run(spec.id, std.name, std.description, std.type);
        changed++;
      }
    }
  }

  // 3) Update deskripsi tool yang baru di-rename (biar agent tau ini punya siapa)
  for (const row of legacyRows) {
    const target = LEGACY_TOOL_RENAMES[row.name];
    const spec = db.prepare("SELECT name FROM specialists WHERE id = ?").get(row.specialist_id) as { name: string };
    const std = standardToolsFor(spec.name).find((s) => s.name === target.name);
    if (std) {
      const tool = db.prepare("SELECT id FROM tools WHERE specialist_id = ? AND name = ?").get(row.specialist_id, target.name) as { id: number } | undefined;
      if (tool) updateDesc.run(std.description, tool.id);
    }
  }

  return changed;
}

/** Tool standar per specialist dengan deskripsi yang menyebut domain-nya. */
function standardToolsFor(specialistName: string): Array<{ name: string; type: string; description: string }> {
  return [
    {
      name: "crawl",
      type: "crawl",
      description: `Crawl sumber / best practice terkait ${specialistName} dari web. Input cukup prompt.`,
    },
    {
      name: "web_search",
      type: "web_search",
      description: `Cari informasi dari web (Google via DuckDuckGo/Serper) — topik ${specialistName}. Return judul, URL, snippet.`,
    },
    {
      name: "knowledge_search",
      type: "knowledge_query",
      description: `Cari knowledge ${specialistName} yang sudah di-crawl / disimpan (fresh, bukan snapshot skill).`,
    },
    {
      name: "generate_doc",
      type: "generate_doc",
      description: `Generate dokumen .MD sesuai procedure ${specialistName}.`,
    },
  ];
}

/**
 * ensureDevelopmentCycle — idempotent seed pipeline "Development Cycle".
 * Pipeline inilah yang di-export jadi skill orchestrator: prompt
 * "gunakan development cycle untuk develop aplikasi finance" di Cursor/Codex
 * bakal ke-trigger oleh SKILL.md hasil export (domain finance → Finance).
 */
export function ensureDevelopmentCycle(db: Database.Database): number {
  const getSpecialist = db.prepare("SELECT id FROM specialists WHERE name = ?");
  const getPipeline = db.prepare("SELECT id FROM pipelines WHERE name = ?");
  const insertPipeline = db.prepare(
    "INSERT INTO pipelines (name, description) VALUES (?, ?)"
  );
  const insertStage = db.prepare(
    `INSERT INTO pipeline_stages (pipeline_id, position, specialist_id, name, instruction, max_iterations)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const existing = getPipeline.get("Development Cycle") as { id: number } | undefined;
  if (existing) return 0;

  const finance = getSpecialist.get("Finance") as { id: number } | undefined;
  const ba = getSpecialist.get("Business Analyst") as { id: number } | undefined;
  if (!finance || !ba) return 0;

  const stages: Array<{
    specialistId: number;
    name: string;
    instruction: string;
    maxIterations: number;
  }> = [
    {
      specialistId: finance.id,
      name: "Analisis Domain & Aturan Finance",
      instruction:
        "Pelajari domain finance yang relevan dengan aplikasi yang diminta: pajak (PPh 21, PPN, dll), Chart of Accounts, standar akuntansi (SAK), dan aturan yang boleh / tidak boleh dilanggar. Baca knowledge bundle finance, rangkum aturan kunci + sumber resminya (OJK, DJP, dll). Output: ringkasan domain & constraint yang harus dipatuhi sistem.",
      maxIterations: 3,
    },
    {
      specialistId: ba.id,
      name: "Requirement & Desain Sistem",
      instruction:
        "Dari ringkasan domain stage 1, susun solusi sistem: functional requirements (FR), non-functional (NFR), entities / data model, alur sistem, dan aturan bisnis yang harus di-enforce (termasuk constraint pajak/akuntansi). Output: dokumen desain .MD.",
      maxIterations: 3,
    },
    {
      specialistId: ba.id,
      name: "Panduan Implementasi",
      instruction:
        "Dari desain stage 2, beri panduan implementasi teknis: modul aplikasi, struktur file/kode, skema database (tabel + field penting), API endpoints, dan aturan bisnis yang wajib di-implement di kode. Output: implementation plan .MD.",
      maxIterations: 3,
    },
    {
      specialistId: ba.id,
      name: "Test Plan & Dokumentasi",
      instruction:
        "Dari implementation plan stage 3, susun test plan: skenario unit test, integration test, dan edge case (terutama perhitungan pajak / akuntansi), plus checklist dokumentasi (README, API docs). Output: test plan + checklist .MD.",
      maxIterations: 2,
    },
  ];

  const seed = db.transaction(() => {
    const pipe = insertPipeline.run(
      "Development Cycle",
      "Development cycle lengkap untuk membangun aplikasi: analisis domain → requirement & desain → implementasi → test & dokumentasi. Cocok untuk aplikasi finance / perpajakan (knowledge dari specialist Finance)."
    );
    const pipelineId = Number(pipe.lastInsertRowid);
    stages.forEach((s, i) => {
      insertStage.run(
        pipelineId,
        i,
        s.specialistId,
        s.name,
        s.instruction,
        s.maxIterations
      );
    });
  });

  seed();
  return 1;
}
