import type Database from "better-sqlite3";
import type { Procedure } from "../domain/types.js";
import { procedureCreateSchema, procedureUpdateSchema } from "../domain/schemas.js";

export class ProcedureService {
  constructor(private readonly db: Database.Database) {}

  listBySpecialist(specialistId: number): Procedure[] {
    return this.db
      .prepare("SELECT * FROM procedures WHERE specialist_id = ? ORDER BY id")
      .all(specialistId) as Procedure[];
  }

  get(id: number): Procedure {
    const row = this.db.prepare("SELECT * FROM procedures WHERE id = ?").get(id) as Procedure | undefined;
    if (!row) throw new Error("Procedure tidak ditemukan");
    return row;
  }

  create(specialistId: number, input: unknown): Procedure {
    const data = procedureCreateSchema.parse(input);
    const result = this.db
      .prepare("INSERT INTO procedures (specialist_id, name, description, template) VALUES (?, ?, ?, ?)")
      .run(specialistId, data.name, data.description, data.template);
    return this.get(Number(result.lastInsertRowid));
  }

  update(id: number, input: unknown): Procedure {
    this.get(id);
    const data = procedureUpdateSchema.parse(input);
    this.db
      .prepare("UPDATE procedures SET name = ?, description = ?, template = ? WHERE id = ?")
      .run(data.name, data.description, data.template, id);
    return this.get(id);
  }

  remove(id: number): void {
    this.get(id);
    this.db.prepare("DELETE FROM procedures WHERE id = ?").run(id);
  }
}
