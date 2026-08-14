/**
 * One-off catch-up backfill: embed semua knowledge yang belum punya embedding
 * (bug fix generate_doc — #113-115). Idempotent, aman dijalanin berulang.
 * Jalankan: set -a && source .env && set +a && npx tsx scripts/backfill-embedding.ts
 */
import Database from "better-sqlite3";
import { KnowledgeService } from "../src/services/knowledge.service.js";
import { SpecialistService } from "../src/services/specialist.service.js";
import { EmbeddingService } from "../src/services/embedding.service.js";
import { config } from "../src/config.js";

async function main() {
  console.log(`Embedding enabled: ${config.embedding.enabled}, model: ${config.embedding.model}`);
  const db = new Database(config.dataDir + "/palhub.db");
  const specialistService = new SpecialistService(db);
  const knowledge = new KnowledgeService(db);
  const embedding = new EmbeddingService(db, knowledge, specialistService);

  const missing = embedding.countMissing();
  console.log(`Knowledge tanpa embedding: ${missing}`);
  if (missing === 0) {
    console.log("✅ Semua udah ke-embed, gak ada yang perlu di-backfill.");
    return;
  }

  const t0 = Date.now();
  const result = await embedding.backfill();
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (result.error) {
    console.error(`❌ Backfill error setelah ${result.processed} diproses: ${result.error}`);
    process.exit(1);
  }
  console.log(`✅ Backfill selesai: ${result.processed} dokumen dalam ${secs}s`);
  console.log(`Sisa tanpa embedding: ${embedding.countMissing()}`);
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
