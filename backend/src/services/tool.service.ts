import type Database from "better-sqlite3";
import type { Tool } from "../domain/types.js";
import { toolCreateSchema, toolUpdateSchema } from "../domain/schemas.js";

export class ToolService {
  constructor(private readonly db: Database.Database) {}

  listBySpecialist(specialistId: number): Tool[] {
    return this.db.prepare("SELECT * FROM tools WHERE specialist_id = ? ORDER BY id").all(specialistId) as Tool[];
  }

  listAll(): Tool[] {
    return this.db.prepare("SELECT * FROM tools ORDER BY id").all() as Tool[];
  }

  get(id: number): Tool {
    const row = this.db.prepare("SELECT * FROM tools WHERE id = ?").get(id) as Tool | undefined;
    if (!row) throw new Error("Tool tidak ditemukan");
    return row;
  }

  create(specialistId: number, input: unknown): Tool {
    const data = toolCreateSchema.parse(input);
    if (data.procedure_id) {
      this.assertProcedure(data.procedure_id);
    }
    const result = this.db
      .prepare("INSERT INTO tools (specialist_id, name, description, type, procedure_id) VALUES (?, ?, ?, ?, ?)")
      .run(specialistId, data.name, data.description, data.type, data.procedure_id);
    return this.get(Number(result.lastInsertRowid));
  }

  update(id: number, input: unknown): Tool {
    this.get(id);
    const data = toolUpdateSchema.parse(input);
    if (data.procedure_id) {
      this.assertProcedure(data.procedure_id);
    }
    this.db
      .prepare("UPDATE tools SET name = ?, description = ?, type = ?, procedure_id = ? WHERE id = ?")
      .run(data.name, data.description, data.type, data.procedure_id, id);
    return this.get(id);
  }

  remove(id: number): void {
    this.get(id);
    this.db.prepare("DELETE FROM tools WHERE id = ?").run(id);
  }

  private assertProcedure(procedureId: number): void {
    const row = this.db.prepare("SELECT id FROM procedures WHERE id = ?").get(procedureId);
    if (!row) throw new Error("Procedure tidak ditemukan");
  }
}
