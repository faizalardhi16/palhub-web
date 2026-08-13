import type Database from "better-sqlite3";
import type { Knowledge, KnowledgePage } from "../domain/types.js";
import { knowledgeCreateSchema } from "../domain/schemas.js";

export class KnowledgeService {
  constructor(private readonly db: Database.Database) {}

  listBySpecialist(specialistId: number, limit = 100): Knowledge[] {
    return this.db
      .prepare("SELECT * FROM knowledge WHERE specialist_id = ? ORDER BY id DESC LIMIT ?")
      .all(specialistId, limit) as Knowledge[];
  }

  listBySpecialistPaged(specialistId: number, page = 1, limit = 10): KnowledgePage {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;

    const total = (this.db
      .prepare("SELECT COUNT(*) AS c FROM knowledge WHERE specialist_id = ?")
      .get(specialistId) as { c: number }).c;

    const items = this.db
      .prepare(
        "SELECT * FROM knowledge WHERE specialist_id = ? ORDER BY id DESC LIMIT ? OFFSET ?"
      )
      .all(specialistId, safeLimit, offset) as Knowledge[];

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }

  get(id: number): Knowledge {
    const row = this.db.prepare("SELECT * FROM knowledge WHERE id = ?").get(id) as Knowledge | undefined;
    if (!row) throw new Error("Knowledge tidak ditemukan");
    return row;
  }

  create(specialistId: number, title: string, content: string, source = ""): Knowledge {
    const result = this.db
      .prepare("INSERT INTO knowledge (specialist_id, title, content, source) VALUES (?, ?, ?, ?)")
      .run(specialistId, title, content, source);
    return this.get(Number(result.lastInsertRowid));
  }

  createManual(specialistId: number, input: unknown): Knowledge {
    const data = knowledgeCreateSchema.parse(input);
    return this.create(specialistId, data.title, data.content, data.source);
  }

  remove(id: number): void {
    this.get(id);
    this.db.prepare("DELETE FROM knowledge WHERE id = ?").run(id);
  }

  search(specialistId: number, query: string, limit = 5): Knowledge[] {
    const terms = query
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `"${t.replace(/"/g, '""')}"`);
    if (terms.length === 0) return [];

    try {
      return this.db
        .prepare(
          `SELECT k.id, k.specialist_id, k.title, k.content, k.source, k.created_at
           FROM knowledge_fts f
           JOIN knowledge k ON k.id = f.rowid
           WHERE knowledge_fts MATCH ? AND k.specialist_id = ?
           ORDER BY rank LIMIT ?`
        )
        .all(terms.join(" AND "), specialistId, limit) as Knowledge[];
    } catch {
      // FTS fallback: simple LIKE (e.g. when query contains unsupported chars)
      const like = `%${query}%`;
      return this.db
        .prepare(
          `SELECT * FROM knowledge
           WHERE specialist_id = ? AND (title LIKE ? OR content LIKE ?)
           ORDER BY id DESC LIMIT ?`
        )
        .all(specialistId, like, like, limit) as Knowledge[];
    }
  }
}
