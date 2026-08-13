// Simulasi: agent di Cursor/Codex yang dapet skill "development-cycle"
// (SKILL.md + knowledge bundle) — dibuktikan bisa jalanin pipeline-nya.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SKILL_DIR = "/tmp/skills/development-cycle";
const BASE = process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1";
const KEY = process.env.LLM_API_KEY ?? "";
const MODEL = process.env.LLM_MODEL ?? "deepseek-chat";

// --- Baca skill persis seperti agent baca file yang di-inject ---
function readSkill() {
  const skill = readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8");

  // index + semua note knowledge (batch kecil biar prompt gak kebesaran)
  const knowledgeDir = join(SKILL_DIR, "knowledge");
  const parts = [];
  const collect = (dir, depth) => {
    if (depth > 3) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) collect(p, depth + 1);
      else if (entry.name.endsWith(".md")) {
        const raw = readFileSync(p, "utf8");
        parts.push(`--- ${p.replace(SKILL_DIR + "/", "")} ---\n${raw.slice(0, 2500)}`);
      }
    }
  };
  collect(knowledgeDir, 0);
  return { skill, knowledge: parts.join("\n\n") };
}

async function main() {
  const { skill, knowledge } = readSkill();

  const system = `Kamu adalah AI coding agent di Cursor (agentic coding tool).
Skill berikut sudah di-inject ke project lo dan WAJIB dipakai:

===== SKILL.md =====
${skill}
===== END SKILL.md =====

===== KNOWLEDGE BUNDLE =====
${knowledge}
===== END KNOWLEDGE BUNDLE =====`;

  const messages = [
    { role: "system", content: system },
    {
      role: "user",
      content: `gunakan development cycle untuk develop aplikasi finance — aplikasi payroll & penjualan untuk UMKM yang harus hitung PPh 21 karyawan dan PPN penjualan, plus pencatatan keuangan dasar (jurnal + laporan). Jalanin skill di atas secara lengkap, stage demi stage.`,
    },
  ];

  console.log(`\n🧠 Turn 1: user prompt → agent... (system ${system.length} chars)\n`);

  // Turn 1: agent mulai (Stage 1 + mungkin nanya user)
  let out = await chat(messages);
  console.log(out.slice(0, 6000));
  console.log("\n----- (akhir turn 1) -----\n");

  // Turn 2: user jawab pertanyaan / kasih konfirmasi → agent lanjut semua stage
  messages.push({ role: "assistant", content: out });
  messages.push({
    role: "user",
    content: `Lanjut. Asumsi wajar aja. Scope-nya: payroll dengan perhitungan PPh 21 (TER bulanan), penjualan dengan PPN, dan jurnal + laporan keuangan dasar. Kerjakan Stage 2 sampai Stage 4 secara lengkap sekarang, jangan berhenti.`,
  });
  console.log("🧠 Turn 2: user konfirmasi → agent lanjut...\n");
  out += "\n\n" + await chat(messages);
  console.log(out.slice(-6000));

  // --- Verifikasi (output gabungan 2 turn) ---
  const checks = [
    ["Stage 1 (Analisis Domain) disebut", /stage 1|analisis domain|aturan finance/i.test(out)],
    ["Stage 2 (Requirement & Desain) disebut", /stage 2|requirement|desain sistem|data model/i.test(out)],
    ["Stage 3 (Panduan Implementasi) disebut", /stage 3|implementasi|skema database|api/i.test(out)],
    ["Stage 4 (Test Plan & Dokumen) disebut", /stage 4|test plan|dokumentasi|unit test/i.test(out)],
    ["Knowledge pajak dipakai (PPh 21)", /pph 21/i.test(out)],
    ["Knowledge pajak dipakai (PPN)", /\bppn\b/i.test(out)],
    ["Knowledge akuntansi dipakai (CoA/SAK)", /coa|chart of account|sak|akuntansi/i.test(out)],
    ["Sumber resmi disebut (DJP/OJK)", /djp|ojk|pajak\.go\.id/i.test(out)],
    ["Berurutan (Stage 1 sebelum Stage 4)", (() => {
      const idx = (re) => { const m = out.toLowerCase().match(re); return m ? m.index : -1; };
      const s1 = idx(/stage 1|analisis domain/);
      const s4 = idx(/stage 4|test plan/);
      return s1 >= 0 && s4 >= 0 && s1 < s4;
    })()],
    ["Gak ngarang — nanya user kalau kurang info", /tanya|klarifikasi|asumsi|open question/i.test(out)],
  ];

  console.log("\n===== HASIL VERIFIKASI =====");
  let pass = 0;
  for (const [label, ok] of checks) {
    console.log(`${ok ? "✅" : "❌"} ${label}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${checks.length} lolos`);
  process.exit(pass >= 8 ? 0 : 1);
}

async function chat(messages) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 8000,
    }),
  });
  if (!res.ok) {
    console.error("LLM error:", res.status, await res.text());
    process.exit(1);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
