import type Database from "better-sqlite3";
import type {
  Pipeline,
  PipelineDetail,
  PipelineEventKind,
  PipelineRun,
  PipelineRunDetail,
  PipelineRunEvent,
  PipelineStage,
  Specialist,
} from "../domain/types.js";
import {
  pipelineCreateSchema,
  pipelineStageCreateSchema,
  pipelineStageReorderSchema,
  pipelineStageUpdateSchema,
  pipelineUpdateSchema,
} from "../domain/schemas.js";
import type { SpecialistService } from "./specialist.service.js";
import type { KnowledgeService } from "./knowledge.service.js";
import type { LlmClient } from "../llm/client.js";

const NEED_MORE_RE = /NEED_MORE:\s*([^\n]+)/i;

export interface PipelineDeps {
  db: Database.Database;
  specialistService: SpecialistService;
  knowledge: KnowledgeService;
  llm: LlmClient;
}

export class PipelineService {
  constructor(private readonly deps: PipelineDeps) {}

  // -------------------------------------------------------------------------
  // CRUD Pipelines
  // -------------------------------------------------------------------------

  list(): Pipeline[] {
    return this.deps.db
      .prepare(
        `SELECT p.*,
          (SELECT COUNT(*) FROM pipeline_stages s WHERE s.pipeline_id = p.id) AS stage_count
         FROM pipelines p ORDER BY p.id DESC`
      )
      .all() as Pipeline[];
  }

  get(id: number): PipelineDetail {
    const row = this.deps.db.prepare("SELECT * FROM pipelines WHERE id = ?").get(id) as Pipeline | undefined;
    if (!row) throw new Error("Pipeline tidak ditemukan");
    const stages = this.deps.db
      .prepare("SELECT * FROM pipeline_stages WHERE pipeline_id = ? ORDER BY position ASC")
      .all(id) as PipelineStage[];
    return { ...row, stage_count: stages.length, stages };
  }

  create(input: unknown): Pipeline {
    const data = pipelineCreateSchema.parse(input);
    const result = this.deps.db
      .prepare("INSERT INTO pipelines (name, description) VALUES (?, ?)")
      .run(data.name, data.description);
    return this.get(Number(result.lastInsertRowid));
  }

  update(id: number, input: unknown): Pipeline {
    this.get(id);
    const data = pipelineUpdateSchema.parse(input);
    this.deps.db
      .prepare("UPDATE pipelines SET name = ?, description = ? WHERE id = ?")
      .run(data.name, data.description, id);
    return this.get(id);
  }

  remove(id: number): void {
    this.get(id);
    this.deps.db.prepare("DELETE FROM pipelines WHERE id = ?").run(id);
  }

  // -------------------------------------------------------------------------
  // Stages
  // -------------------------------------------------------------------------

  listStages(pipelineId: number): PipelineStage[] {
    this.get(pipelineId);
    return this.deps.db
      .prepare("SELECT * FROM pipeline_stages WHERE pipeline_id = ? ORDER BY position ASC")
      .all(pipelineId) as PipelineStage[];
  }

  addStage(pipelineId: number, input: unknown): PipelineStage {
    this.get(pipelineId);
    const data = pipelineStageCreateSchema.parse(input);
    // validasi specialist exists
    this.deps.specialistService.get(data.specialist_id);
    const pos = (this.deps.db
      .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM pipeline_stages WHERE pipeline_id = ?")
      .get(pipelineId) as { p: number }).p;
    const result = this.deps.db
      .prepare(
        `INSERT INTO pipeline_stages (pipeline_id, position, specialist_id, name, instruction, max_iterations)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(pipelineId, pos, data.specialist_id, data.name, data.instruction, data.max_iterations);
    return this.deps.db
      .prepare("SELECT * FROM pipeline_stages WHERE id = ?")
      .get(Number(result.lastInsertRowid)) as PipelineStage;
  }

  updateStage(id: number, input: unknown): PipelineStage {
    const existing = this.deps.db
      .prepare("SELECT * FROM pipeline_stages WHERE id = ?")
      .get(id) as PipelineStage | undefined;
    if (!existing) throw new Error("Stage tidak ditemukan");
    const data = pipelineStageUpdateSchema.parse(input);
    if (data.specialist_id !== undefined) this.deps.specialistService.get(data.specialist_id);
    this.deps.db
      .prepare(
        `UPDATE pipeline_stages SET
           specialist_id = COALESCE(?, specialist_id),
           name = COALESCE(?, name),
           instruction = COALESCE(?, instruction),
           max_iterations = COALESCE(?, max_iterations)
         WHERE id = ?`
      )
      .run(
        data.specialist_id ?? null,
        data.name ?? null,
        data.instruction ?? null,
        data.max_iterations ?? null,
        id
      );
    return this.deps.db.prepare("SELECT * FROM pipeline_stages WHERE id = ?").get(id) as PipelineStage;
  }

  removeStage(id: number): void {
    const existing = this.deps.db
      .prepare("SELECT * FROM pipeline_stages WHERE id = ?")
      .get(id) as PipelineStage | undefined;
    if (!existing) throw new Error("Stage tidak ditemukan");
    this.deps.db.prepare("DELETE FROM pipeline_stages WHERE id = ?").run(id);
    // renumber positions
    const stages = this.deps.db
      .prepare("SELECT id FROM pipeline_stages WHERE pipeline_id = ? ORDER BY position ASC")
      .all(existing.pipeline_id) as { id: number }[];
    const update = this.deps.db.prepare("UPDATE pipeline_stages SET position = ? WHERE id = ?");
    this.deps.db.transaction(() => {
      stages.forEach((s, i) => update.run(i, s.id));
    })();
  }

  reorderStages(pipelineId: number, input: unknown): void {
    this.get(pipelineId);
    const data = pipelineStageReorderSchema.parse(input);
    const existing = this.deps.db
      .prepare("SELECT id FROM pipeline_stages WHERE pipeline_id = ?")
      .all(pipelineId) as { id: number }[];
    const existingIds = new Set(existing.map((e) => e.id));
    if (data.stage_ids.length !== existingIds.size) {
      throw new Error("Jumlah stage_ids gak match dengan stages yang ada");
    }
    for (const id of data.stage_ids) {
      if (!existingIds.has(id)) throw new Error(`Stage ${id} bukan milik pipeline ini`);
    }
    const update = this.deps.db.prepare("UPDATE pipeline_stages SET position = ? WHERE id = ?");
    this.deps.db.transaction(() => {
      data.stage_ids.forEach((id, i) => update.run(i, id));
    })();
  }

  // -------------------------------------------------------------------------
  // Runs
  // -------------------------------------------------------------------------

  listRuns(pipelineId: number): PipelineRun[] {
    return this.deps.db
      .prepare("SELECT * FROM pipeline_runs WHERE pipeline_id = ? ORDER BY id DESC LIMIT 50")
      .all(pipelineId) as PipelineRun[];
  }

  getRun(runId: number): PipelineRunDetail {
    const row = this.deps.db.prepare("SELECT * FROM pipeline_runs WHERE id = ?").get(runId) as
      | PipelineRun
      | undefined;
    if (!row) throw new Error("Run tidak ditemukan");
    const events = this.deps.db
      .prepare("SELECT * FROM pipeline_run_events WHERE run_id = ? ORDER BY id ASC")
      .all(runId) as PipelineRunEvent[];
    return { ...row, events };
  }

  // -------------------------------------------------------------------------
  // Runtime — agentic loop
  // -------------------------------------------------------------------------

  async run(pipelineId: number): Promise<PipelineRun> {
    const pipeline = this.get(pipelineId);
    if (pipeline.stages.length === 0) throw new Error("Pipeline kosong — tambah stage dulu");

    const runId = Number(
      this.deps.db.prepare("INSERT INTO pipeline_runs (pipeline_id) VALUES (?)").run(pipelineId).lastInsertRowid
    );

    const buffer: string[] = [];
    let failed = false;
    let failReason = "";

    try {
      for (const stage of pipeline.stages) {
        this.emit(runId, stage.position, stage.specialist_id, "stage_start", `${stage.name}`);
        const specialist = this.deps.specialistService.get(stage.specialist_id);

        let attempt = 0;
        let done = false;
        while (attempt < stage.max_iterations && !done) {
          attempt++;
          const prompt = this.buildStagePrompt(stage, specialist, buffer);
          let output = "";
          try {
            output = await this.deps.llm.chat([{ role: "system", content: prompt }]);
          } catch (error) {
            this.emit(runId, stage.position, stage.specialist_id, "stage_failed", `LLM error: ${(error as Error).message}`);
            throw error;
          }

          const needMore = output.match(NEED_MORE_RE);
          if (needMore) {
            const question = needMore[1].trim();
            this.emit(runId, stage.position, stage.specialist_id, "need_more", question);
            const resolver = this.resolveSpecialist(question, stage.specialist_id);
            if (resolver) {
              this.emit(runId, stage.position, resolver.id, "resolve", `${resolver.name} dipanggil untuk menjawab`);
              const answer = await this.askSpecialist(resolver, question, buffer);
              buffer.push(`[Feedback dari ${resolver.name}] ${answer}`);
              this.emit(runId, stage.position, resolver.id, "answer", answer);
            } else {
              this.emit(runId, stage.position, null, "resolve", "Gak ada specialist yang cocok — lanjut dengan konteks existing");
              buffer.push(`[Unanswered: ${question}]`);
            }
            continue; // retry stage dengan buffer baru
          }

          // output final stage
          buffer.push(`[${stage.name}] ${output}`);
          this.emit(runId, stage.position, stage.specialist_id, "stage_done", output);
          done = true;
        }

        if (!done) {
          failed = true;
          failReason = `Stage ${stage.name} gagal setelah ${stage.max_iterations} iterasi (terus butuh info tambahan)`;
          this.emit(runId, stage.position, stage.specialist_id, "stage_failed", failReason);
          break;
        }
      }

      if (failed) {
        this.deps.db
          .prepare("UPDATE pipeline_runs SET status = 'failed', finished_at = datetime('now'), error = ? WHERE id = ?")
          .run(failReason, runId);
        this.emit(runId, null, null, "pipeline_failed", failReason);
      } else {
        this.deps.db
          .prepare("UPDATE pipeline_runs SET status = 'done', finished_at = datetime('now') WHERE id = ?")
          .run(runId);
        this.emit(runId, null, null, "pipeline_done", "Pipeline selesai");
      }
    } catch (error) {
      const message = (error as Error).message;
      this.deps.db
        .prepare("UPDATE pipeline_runs SET status = 'failed', finished_at = datetime('now'), error = ? WHERE id = ?")
        .run(message, runId);
      this.emit(runId, null, null, "pipeline_failed", message);
    }

    return this.getRun(runId);
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private emit(
    runId: number,
    stagePosition: number | null,
    specialistId: number | null,
    kind: PipelineEventKind,
    content: string
  ): void {
    this.deps.db
      .prepare(
        `INSERT INTO pipeline_run_events (run_id, stage_position, specialist_id, kind, content)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(runId, stagePosition, specialistId, kind, content);
  }

  private buildStagePrompt(stage: PipelineStage, specialist: Specialist, buffer: string[]): string {
    const context = buffer.length > 0 ? buffer.join("\n\n") : "(belum ada konteks — ini stage pertama)";
    return `Kamu adalah ${specialist.name}: ${specialist.description}

TUGAS STAGE: ${stage.name}
${stage.instruction}

KONTEKS (knowledge buffer dari stage sebelumnya):
${context}

Gunakan knowledge di atas untuk menyelesaikan tugas.
Kalau kamu butuh informasi TAMBAHAN dari specialist lain, akhiri output dengan baris:
NEED_MORE: <pertanyaan spesifik>
Kalau tidak, jawab langsung dengan hasil final.`;
  }

  private resolveSpecialist(question: string, excludeSpecialistId: number): Specialist | null {
    const specialists = this.deps.specialistService.list();
    const candidates = specialists
      .filter((s) => s.id !== excludeSpecialistId)
      .map((s) => {
        // score = keyword match antara question dan (name + description + knowledge titles)
        const q = question.toLowerCase();
        let score = 0;
        const name = s.name.toLowerCase();
        const desc = s.description.toLowerCase();
        const knowledge = this.deps.knowledge.listBySpecialist(s.id, 50);
        const titles = knowledge.map((k) => k.title.toLowerCase()).join(" ");

        const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
        for (const w of words) {
          if (name.includes(w)) score += 5;
          if (desc.includes(w)) score += 2;
          if (titles.includes(w)) score += 3;
        }
        // bonus kalau ada knowledge sama sekali (spesialis punya domain knowledge)
        if (knowledge.length > 0) score += 1;
        return { specialist: s, score };
      })
      .sort((a, b) => b.score - a.score);

    if (candidates.length === 0 || candidates[0].score <= 0) return null;
    return candidates[0].specialist;
  }

  private async askSpecialist(
    specialist: Specialist,
    question: string,
    buffer: string[]
  ): Promise<string> {
    const knowledge = this.deps.knowledge.listBySpecialist(specialist.id, 20);
    const domainContext =
      knowledge.length > 0
        ? knowledge.map((k) => `[${k.title}]\n${k.content}`).join("\n\n")
        : "(specialist ini belum punya knowledge tersimpan)";

    const prompt = `Kamu adalah ${specialist.name}: ${specialist.description}

Ada pertanyaan dari pipeline stage lain:
${question}

Konteks pipeline sejauh ini:
${buffer.length > 0 ? buffer.join("\n\n") : "(kosong)"}

Domain knowledge kamu:
${domainContext}

Jawab pertanyaan dengan knowledge kamu. Jawaban akan dipakai sebagai input stage lain.`;
    return this.deps.llm.chat([{ role: "system", content: prompt }]);
  }
}
