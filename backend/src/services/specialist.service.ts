import type Database from "better-sqlite3";
import type { Specialist, SpecialistSummary } from "../domain/types.js";
import { specialistCreateSchema, specialistUpdateSchema } from "../domain/schemas.js";

export class SpecialistService {
  constructor(private readonly db: Database.Database) {}

  list(): SpecialistSummary[] {
    return this.db
      .prepare(
        `SELECT s.*,
          (SELECT COUNT(*) FROM tools t WHERE t.specialist_id = s.id) AS tool_count,
          (SELECT COUNT(*) FROM procedures p WHERE p.specialist_id = s.id) AS procedure_count,
          (SELECT COUNT(*) FROM knowledge k WHERE k.specialist_id = s.id) AS knowledge_count
         FROM specialists s ORDER BY s.id`
      )
      .all() as SpecialistSummary[];
  }

  get(id: number): Specialist {
    const row = this.db.prepare("SELECT * FROM specialists WHERE id = ?").get(id) as Specialist | undefined;
    if (!row) throw new Error("Specialist tidak ditemukan");
    return row;
  }

  create(input: unknown): Specialist {
    const data = specialistCreateSchema.parse(input);
    const result = this.db
      .prepare("INSERT INTO specialists (name, description) VALUES (?, ?)")
      .run(data.name, data.description);
    return this.get(Number(result.lastInsertRowid));
  }

  update(id: number, input: unknown): Specialist {
    this.get(id);
    const data = specialistUpdateSchema.parse(input);
    this.db.prepare("UPDATE specialists SET name = ?, description = ? WHERE id = ?").run(data.name, data.description, id);
    return this.get(id);
  }

  remove(id: number): void {
    this.get(id);
    this.db.prepare("DELETE FROM specialists WHERE id = ?").run(id);
  }
}
