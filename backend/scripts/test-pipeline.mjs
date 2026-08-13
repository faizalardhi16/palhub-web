// E2E test PipelineService — pakai mock LLM yang simulasi NEED_MORE loop
import Database from "better-sqlite3";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { SpecialistService } from "./services/specialist.service.js";
import { KnowledgeService } from "./services/knowledge.service.js";
import { PipelineService } from "./services/pipeline.service.js";

const TEST_DIR = "/tmp/palhub-pipe-test";
rmSync(TEST_DIR, { recursive: true, force: true });
mkdirSync(TEST_DIR, { recursive: true });

const db = new Database(join(TEST_DIR, "test.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE specialists (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE procedures (id INTEGER PRIMARY KEY AUTOINCREMENT, specialist_id INTEGER NOT NULL REFERENCES specialists(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', template TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE tools (id INTEGER PRIMARY KEY AUTOINCREMENT, specialist_id INTEGER NOT NULL REFERENCES specialists(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', type TEXT NOT NULL, procedure_id INTEGER REFERENCES procedures(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE knowledge (id INTEGER PRIMARY KEY AUTOINCREMENT, specialist_id INTEGER NOT NULL REFERENCES specialists(id) ON DELETE CASCADE, title TEXT NOT NULL, content TEXT NOT NULL, source TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE pipelines (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE pipeline_stages (id INTEGER PRIMARY KEY AUTOINCREMENT, pipeline_id INTEGER NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE, position INTEGER NOT NULL, specialist_id INTEGER NOT NULL REFERENCES specialists(id), name TEXT NOT NULL, instruction TEXT NOT NULL DEFAULT '', max_iterations INTEGER NOT NULL DEFAULT 3);
CREATE TABLE pipeline_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, pipeline_id INTEGER NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'running', started_at TEXT NOT NULL DEFAULT (datetime('now')), finished_at TEXT, error TEXT NOT NULL DEFAULT '');
CREATE TABLE pipeline_run_events (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE, stage_position INTEGER, specialist_id INTEGER, kind TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')));
`);

const specialistService = new SpecialistService(db);
const knowledge = new KnowledgeService(db);

// Seed specialist
const finance = specialistService.create({ name: "Finance Specialist", description: "Ahli pajak, PPN, laporan keuangan" });
const ba = specialistService.create({ name: "Business Analyst", description: "Gathering requirement, analisis bisnis, translate ke system" });

// Knowledge finance
knowledge.create(finance.id, "PPN", "PPN (Pajak Pertambahan Nilai) = 11% di Indonesia, naik jadi 12% mulai 2025 untuk barang mewah.", "manual");
knowledge.create(finance.id, "PPh 21", "PPh 21 adalah pajak penghasilan karyawan, tarif progresif 5%-35%.", "manual");

// Mock LLM: simulasi agentic loop
let llmCalls = 0;
const mockLlm = {
  async chat(messages) {
    llmCalls++;
    const prompt = messages[0]?.content ?? "";
    // Stage 1: Finance share knowledge → langsung selesai
    if (prompt.includes("TUGAS STAGE: Share knowledge pajak")) {
      return "PPN di Indonesia saat ini 11%, barang mewah 12% mulai 2025. PPh 21 tarif progresif 5-35%.";
    }
    // Stage 2: BA gather → butuh info tambahan (NEED_MORE) → retry → selesai
    if (prompt.includes("TUGAS STAGE: Gather requirement")) {
      if (llmCalls <= 2) {
        return "Requirement awal: sistem harus handle pajak.\nNEED_MORE: apa aturan PPN terbaru untuk barang mewah?";
      }
      return "Requirement: sistem harus menghitung PPN otomatis, handle tarif 11% & 12% barang mewah, generate laporan PPh 21.";
    }
    // Resolve: Finance menjawab pertanyaan BA
    if (prompt.includes("Ada pertanyaan dari pipeline stage lain")) {
      return "PPN barang mewah = 12% mulai 2025, yang lain tetap 11%.";
    }
    // Stage 3: Translate
    if (prompt.includes("TUGAS STAGE: Translate ke system")) {
      return "System spec: module tax-calculator dengan input amount & category, output PPN 11%/12%.";
    }
    return "FALLBACK: " + prompt.slice(0, 80);
  },
};

const pipeline = new PipelineService({ db, specialistService, knowledge, llm: mockLlm });

// === Test 1: CRUD pipeline ===
console.log("=== TEST 1: CRUD ===");
const p = pipeline.create({ name: "Tax → Requirement", description: "Finance ke BA ke System" });
console.log("create:", p.name, "stage_count:", p.stage_count);
pipeline.addStage(p.id, { specialist_id: finance.id, name: "Share knowledge pajak", instruction: "Share knowledge pajak", max_iterations: 2 });
pipeline.addStage(p.id, { specialist_id: ba.id, name: "Gather requirement", instruction: "Gather requirement", max_iterations: 3 });
pipeline.addStage(p.id, { specialist_id: ba.id, name: "Translate ke system", instruction: "Translate ke system", max_iterations: 2 });
const detail = pipeline.get(p.id);
console.log("stages:", detail.stages.map((s) => `${s.position}:${s.name}`).join(" | "));

// reorder
const ids = detail.stages.map((s) => s.id).reverse();
pipeline.reorderStages(p.id, { stage_ids: ids });
const after = pipeline.get(p.id);
console.log("after reorder:", after.stages.map((s) => `${s.position}:${s.name}`).join(" | "));
// reorder balik
pipeline.reorderStages(p.id, { stage_ids: ids.reverse() });

// === Test 2: Run pipeline (agentic loop) ===
console.log("\n=== TEST 2: RUN (agentic loop) ===");
const run = await pipeline.run(p.id);
console.log("status:", run.status);
console.log("events:");
for (const ev of run.events) {
  const pos = ev.stage_position !== null ? `stage#${ev.stage_position + 1}` : "-----";
  const sp = ev.specialist_id ? specialistService.get(ev.specialist_id).name : "-";
  console.log(`  [${pos}] [${sp}] ${ev.kind}: ${ev.content.slice(0, 90)}`);
}

// Assertions
const kinds = run.events.map((e) => e.kind);
const assert = (cond, msg) => {
  if (!cond) { console.error("❌ FAIL:", msg); process.exitCode = 1; }
  else console.log("✅ PASS:", msg);
};
assert(run.status === "done", "run status done");
assert(kinds.includes("need_more"), "ada event need_more (BA minta info PPN)");
assert(kinds.includes("resolve"), "ada event resolve (Finance dipanggil)");
assert(kinds.includes("answer"), "ada event answer (Finance jawab)");
const needMoreIdx = kinds.indexOf("need_more");
assert(needMoreIdx < kinds.indexOf("answer"), "answer terjadi SETELAH need_more");
assert(kinds.filter((k) => k === "stage_done").length === 3, "3 stage done");

console.log("\nllmCalls:", llmCalls, "(harus > 3 karena ada feedback loop)");

// === Test 3: listRuns ===
console.log("\n=== TEST 3: listRuns ===");
const runs = pipeline.listRuns(p.id);
assert(runs.length === 1, "ada 1 run");
const run2 = pipeline.getRun(runs[0].id);
assert(run2.events.length === run.events.length, "getRun konsisten");

// === Test 4: validation ===
console.log("\n=== TEST 4: VALIDATION ===");
try {
  pipeline.addStage(p.id, { specialist_id: 999, name: "x", instruction: "y" });
  assert(false, "specialist 999 harus ditolak");
} catch (e) {
  assert(String(e.message).includes("tidak ditemukan"), "specialist invalid ditolak");
}
try {
  pipeline.reorderStages(p.id, { stage_ids: [1] });
  assert(false, "reorder salah jumlah harus ditolak");
} catch (e) {
  assert(true, "reorder salah jumlah ditolak");
}
try {
  pipeline.run(p.id);
  const empty = pipeline.create({ name: "Empty Pipe", description: "" });
  await pipeline.run(empty.id);
  assert(false, "pipeline kosong harus ditolak");
} catch (e) {
  assert(true, "pipeline kosong ditolak");
}

console.log("\nDONE");
