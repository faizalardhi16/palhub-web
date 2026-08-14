import type Database from "better-sqlite3";
import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import type { KnowledgeService } from "./knowledge.service.js";
import type { SpecialistService } from "./specialist.service.js";
import { config } from "../config.js";

export type SearchMode = "hybrid" | "keyword" | "semantic";

export interface HybridHit {
  id: number;
  specialist_id: number;
  title: string;
  content: string;
  source: string;
  created_at: string;
  score: number;
  method: "keyword" | "semantic" | "hybrid";
}

const EMBED_BATCH = 8;
const EMBED_TEXT_MAX = 2500;

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * EmbeddingService — semantic/hybrid search dengan model embedding LOKAL
 * (transformers.js, multilingual MiniLM q8, ~120MB). Zero infra tambahan:
 * vector disimpan di SQLite, cosine dihitung JS. Kalau model gagal load
 * (offline/network), semua method graceful fallback ke keyword search.
 */
export class EmbeddingService {
  private model: FeatureExtractionPipeline | null = null;
  private loading: Promise<FeatureExtractionPipeline | null> | null = null;
  private loadError: string | null = null;
  private backfillStarted = false;

  constructor(
    private readonly db: Database.Database,
    private readonly knowledge: KnowledgeService,
    private readonly specialists: SpecialistService
  ) {}

  get enabled(): boolean {
    return config.embedding.enabled;
  }

  get modelName(): string {
    return config.embedding.model;
  }

  isReady(): boolean {
    return this.model !== null;
  }

  /** Load model (lazy, async). Returns null kalau gagal. */
  async load(): Promise<FeatureExtractionPipeline | null> {
    if (this.model) return this.model;
    if (this.loadError) return null;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      try {
        this.model = (await pipeline("feature-extraction", this.modelName, {
          dtype: "q8",
          device: "cpu",
        })) as FeatureExtractionPipeline;
        return this.model;
      } catch (error) {
        this.loadError = (error as Error).message;
        console.error(`⚠️ Embedding model gagal dimuat (${this.loadError}) — fallback keyword search.`);
        return null;
      } finally {
        this.loading = null;
      }
    })();

    return this.loading;
  }

  private textFor(k: { title: string; content: string }): string {
    const content = (k.content || "").slice(0, EMBED_TEXT_MAX);
    return `${k.title}\n${content}`;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const m = await this.load();
    if (!m) throw new Error("embedding model unavailable");
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += EMBED_BATCH) {
      const batch = texts.slice(i, i + EMBED_BATCH);
      // NOTE: pipeline(batch) balikin SATU Tensor shape [batch, dim] — bukan
      // array. Harus di-slice per baris, kalau nggak vector-nya ketuker.
      const res = await m(batch, { pooling: "mean", normalize: true });
      const data = Array.from(res.data as Float32Array);
      const rows = res.dims?.[0] ?? batch.length;
      const dim = res.dims?.[1] ?? (rows > 0 ? data.length / rows : 0);
      for (let r = 0; r < rows; r++) {
        out.push(data.slice(r * dim, (r + 1) * dim));
      }
    }
    return out;
  }

  async embedOne(text: string): Promise<number[]> {
    const [vec] = await this.embed([text]);
    return vec;
  }

  // -------------------------------------------------------------------------
  // Backfill + persistence
  // -------------------------------------------------------------------------

  /** Jumlah knowledge yang belum punya embedding. */
  countMissing(): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS c FROM knowledge k
         LEFT JOIN knowledge_embeddings e ON e.knowledge_id = k.id
         WHERE e.knowledge_id IS NULL`
      )
      .get() as { c: number };
    return row.c;
  }

  /**
   * Backfill embedding untuk semua knowledge yang belum punya. Idempotent.
   * Jalan async di background pas server start; baru nge-embed kalau model
   * berhasil dimuat. Bisa dipanggil ulang kapan aja.
   */
  async backfill(): Promise<{ processed: number; skipped: number; error?: string }> {
    const model = await this.load();
    if (!model) {
      return { processed: 0, skipped: 0, error: this.loadError ?? "model unavailable" };
    }

    const rows = this.db
      .prepare(
        `SELECT k.id, k.title, k.content FROM knowledge k
         LEFT JOIN knowledge_embeddings e ON e.knowledge_id = k.id
         WHERE e.knowledge_id IS NULL
         ORDER BY k.id`
      )
      .all() as Array<{ id: number; title: string; content: string }>;

    let processed = 0;
    for (let i = 0; i < rows.length; i += EMBED_BATCH) {
      const batch = rows.slice(i, i + EMBED_BATCH);
      const texts = batch.map((r) => this.textFor(r));
      try {
        const vectors = await this.embed(texts);
        const upsert = this.db.prepare(
          `INSERT INTO knowledge_embeddings (knowledge_id, model, vector, updated_at)
           VALUES (?, ?, ?, datetime('now'))
           ON CONFLICT(knowledge_id) DO UPDATE SET vector = excluded.vector, model = excluded.model, updated_at = excluded.updated_at`
        );
        this.db.transaction(() => {
          batch.forEach((r, j) => upsert.run(r.id, this.modelName, JSON.stringify(vectors[j])));
        })();
        processed += batch.length;
        console.log(`🧠 Embedding backfill: ${processed}/${rows.length}`);
      } catch (error) {
        return { processed, skipped: rows.length - processed, error: (error as Error).message };
      }
    }
    return { processed, skipped: 0 };
  }

  /** Pastikan backfill ke-trigger sekali (dari server.ts). */
  async ensureBackfill(): Promise<void> {
    if (this.backfillStarted) return;
    this.backfillStarted = true;
    try {
      const missing = this.countMissing();
      if (missing > 0) {
        console.log(`🧠 Backfill embedding: ${missing} knowledge belum di-embed...`);
        const result = await this.backfill();
        console.log(
          result.error
            ? `⚠️ Backfill embedding: ${result.processed} ok, error: ${result.error}`
            : `✅ Backfill embedding selesai: ${result.processed} dokumen`
        );
      } else {
        console.log("🧠 Embedding: semua knowledge sudah punya vector.");
      }
    } catch (error) {
      console.error("⚠️ Backfill embedding error:", (error as Error).message);
    }
  }

  // -------------------------------------------------------------------------
  // Hybrid search
  // -------------------------------------------------------------------------

  /**
   * Search knowledge pakai keyword (FTS5/BM25) + semantic (cosine), digabung
   * weighted. `specialistId` opsional (null = semua specialist).
   */
  async search(
    query: string,
    opts: { specialistId?: number | null; limit?: number; mode?: SearchMode } = {}
  ): Promise<HybridHit[]> {
    const limit = opts.limit ?? 5;
    const mode = opts.mode ?? "hybrid";
    const specialistId = opts.specialistId ?? null;
    const modelReady = mode !== "keyword" && (await this.load()) !== null;
    const wantKeyword = mode === "hybrid" || mode === "keyword";
    const wantSemantic = (mode === "hybrid" || mode === "semantic") && modelReady;

    // Dua list ranking terpisah (keyword + semantic), di-fusion pake RRF.
    const kwHits: HybridHit[] = wantKeyword ? this.keywordSearch(query, specialistId, limit * 4) : [];
    let vecHits: HybridHit[] = [];
    if (wantSemantic) {
      try {
        vecHits = await this.vectorSearch(query, specialistId, limit * 4);
      } catch (error) {
        console.warn("⚠️ Semantic search gagal:", (error as Error).message);
      }
    }

    // RRF (Reciprocal Rank Fusion): skor = Σ 1/(K + rank). Skala keyword
    // (term-ratio 0.4-0.9) vs semantic (cosine 0.2-0.4) beda jauh — kalau
    // di-blend pake skor mentah, semantic match (yang justru paling relevan)
    // selalu kalah rank sama keyword-lucky doc. RRF pakai RANK, jadi dua
    // sinyal setara; doc yang muncul di dua-duanya menang natural.
    const K = 60;
    const SEMANTIC_MIN = 0.22;
    type Entry = {
      hit: HybridHit;
      rrf: number;
      inKw: boolean;
      inVec: boolean;
      kwScore?: number;
      vecScore?: number;
    };
    const entries = new Map<number, Entry>();
    const add = (rank: number, h: HybridHit, list: "kw" | "vec"): void => {
      const cur = entries.get(h.id);
      if (cur) {
        cur.rrf += 1 / (K + rank);
        if (list === "kw") {
          cur.inKw = true;
          cur.kwScore = h.score;
        } else {
          cur.inVec = true;
          cur.vecScore = h.score;
        }
      } else {
        entries.set(h.id, {
          hit: h,
          rrf: 1 / (K + rank),
          inKw: list === "kw",
          inVec: list === "vec",
          kwScore: list === "kw" ? h.score : undefined,
          vecScore: list === "vec" ? h.score : undefined,
        });
      }
    };
    kwHits.forEach((h, i) => add(i + 1, h, "kw"));
    vecHits.forEach((h, i) => add(i + 1, h, "vec"));

    const ranked = [...entries.values()]
      // Semantic-only noise floor: doc yang relevansi semantiknya rendah
      // gak boleh masuk cuma gara-gara dapet rank (RRF nilai absolut kecil).
      .filter((e) => e.inKw || (e.vecScore ?? 0) >= SEMANTIC_MIN)
      .sort((a, b) => b.rrf - a.rrf)
      .slice(0, limit);

    return ranked.map((e) => {
      const method: HybridHit["method"] =
        e.inKw && e.inVec ? "hybrid" : e.inVec ? "semantic" : "keyword";
      // Display score: skala lama biar %-nya tetap meaningful di UI,
      // urutan tetap berdasarkan RRF.
      const score =
        method === "hybrid"
          ? 0.4 * (e.kwScore ?? 0) + 0.6 * (e.vecScore ?? 0)
          : method === "semantic"
            ? (e.vecScore ?? 0)
            : (e.kwScore ?? 0);
      return { ...e.hit, score, method };
    });
  }

  /** Keyword-only (FTS5). Pakai OR antar term biar query gak ke-kunci AND. */
  private keywordSearch(query: string, specialistId: number | null, limit: number): HybridHit[] {
    const terms = query
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `"${t.replace(/"/g, '""')}"`);
    if (terms.length === 0) return [];
    const matchExpr = terms.join(" OR ");

    let rows: Array<{ id: number; specialist_id: number; title: string; content: string; source: string; created_at: string; rank: number }>;
    try {
      rows = specialistId
        ? (this.db
            .prepare(
              `SELECT k.id, k.specialist_id, k.title, k.content, k.source, k.created_at, rank
               FROM knowledge_fts f JOIN knowledge k ON k.id = f.rowid
               WHERE knowledge_fts MATCH ? AND k.specialist_id = ?
               ORDER BY rank LIMIT ?`
            )
            .all(matchExpr, specialistId, limit) as typeof rows)
        : (this.db
            .prepare(
              `SELECT k.id, k.specialist_id, k.title, k.content, k.source, k.created_at, rank
               FROM knowledge_fts f JOIN knowledge k ON k.id = f.rowid
               WHERE knowledge_fts MATCH ?
               ORDER BY rank LIMIT ?`
            )
            .all(matchExpr, limit) as typeof rows);
    } catch {
      return [];
    }

    // Keyword score = term-ratio (0..1): berapa term query yang beneran ADA
    // di title+content (awal). BM25 rank cuma dipakai sebagai tiebreak —
    // di korpus kecil, OR-match BM25 itu sinyal lemah.
    return rows
      .map((r) => {
        const hay = `${r.title} ${r.content.slice(0, 800)}`.toLowerCase();
        const hitTerms = terms.filter((t) => hay.includes(t.replace(/^"|"$/g, "").toLowerCase())).length;
        if (hitTerms === 0) return null;
        const ratio = hitTerms / terms.length;
        const neg = Math.max(0, -r.rank);
        const bm25 = 1 - 1 / (1 + neg / 2);
        return {
          id: r.id,
          specialist_id: r.specialist_id,
          title: r.title,
          content: r.content,
          source: r.source,
          created_at: r.created_at,
          score: ratio, // ranking utama; BM25 dipakai stabilizer kecil
          _bm25: bm25,
          method: "keyword" as const,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => (b.score - a.score) || (b._bm25! - a._bm25!))
      .map(({ _bm25, ...rest }) => rest);
  }

  /** Semantic-only: cosine similarity ke semua vector yang ada. */
  private async vectorSearch(query: string, specialistId: number | null, limit: number): Promise<HybridHit[]> {
    const qvec = await this.embedOne(query.slice(0, EMBED_TEXT_MAX));
    const rows = specialistId
      ? (this.db
          .prepare(
            `SELECT k.id, k.specialist_id, k.title, k.content, k.source, k.created_at, e.vector
             FROM knowledge k JOIN knowledge_embeddings e ON e.knowledge_id = k.id
             WHERE k.specialist_id = ?`
          )
          .all(specialistId) as Array<{ id: number; specialist_id: number; title: string; content: string; source: string; created_at: string; vector: string }>)
      : (this.db
          .prepare(
            `SELECT k.id, k.specialist_id, k.title, k.content, k.source, k.created_at, e.vector
             FROM knowledge k JOIN knowledge_embeddings e ON e.knowledge_id = k.id`
          )
          .all() as Array<{ id: number; specialist_id: number; title: string; content: string; source: string; created_at: string; vector: string }>);

    const scored = rows
      .map((r) => {
        let vec: number[];
        try {
          vec = JSON.parse(r.vector) as number[];
        } catch {
          return null;
        }
        const sim = Math.max(0, cosine(qvec, vec)); // clamp ke [0,1]
        return { r, sim };
      })
      .filter((x): x is { r: (typeof rows)[number]; sim: number } => x !== null)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, limit);

    return scored.map(({ r, sim }) => ({
      id: r.id,
      specialist_id: r.specialist_id,
      title: r.title,
      content: r.content,
      source: r.source,
      created_at: r.created_at,
      score: sim,
      method: "semantic" as const,
    }));
  }
}
