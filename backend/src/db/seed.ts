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
