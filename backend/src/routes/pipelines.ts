import type { FastifyInstance } from "fastify";
import JSZip from "jszip";
import type { PipelineService } from "../services/pipeline.service.js";
import type { SkillExportService } from "../services/skill-export.service.js";
import {
  pipelineCreateSchema,
  pipelineStageCreateSchema,
  pipelineStageReorderSchema,
  pipelineStageUpdateSchema,
  pipelineUpdateSchema,
} from "../domain/schemas.js";

export function registerPipelineRoutes(
  app: FastifyInstance,
  pipeline: PipelineService,
  skillExport?: SkillExportService
): void {
  // CRUD pipelines
  app.get("/api/pipelines", async () => pipeline.list());

  app.post("/api/pipelines", async (request, reply) => {
    try {
      return pipeline.create(pipelineCreateSchema.parse(request.body));
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.get("/api/pipelines/:id", async (request, reply) => {
    try {
      return pipeline.get(Number((request.params as { id: string }).id));
    } catch (error) {
      return reply.code(404).send({ error: (error as Error).message });
    }
  });

  app.put("/api/pipelines/:id", async (request, reply) => {
    try {
      return pipeline.update(Number((request.params as { id: string }).id), pipelineUpdateSchema.parse(request.body));
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.delete("/api/pipelines/:id", async (request, reply) => {
    try {
      pipeline.remove(Number((request.params as { id: string }).id));
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  // Stages
  app.get("/api/pipelines/:id/stages", async (request, reply) => {
    try {
      return pipeline.listStages(Number((request.params as { id: string }).id));
    } catch (error) {
      return reply.code(404).send({ error: (error as Error).message });
    }
  });

  app.post("/api/pipelines/:id/stages", async (request, reply) => {
    try {
      return pipeline.addStage(Number((request.params as { id: string }).id), pipelineStageCreateSchema.parse(request.body));
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.put("/api/stages/:id", async (request, reply) => {
    try {
      return pipeline.updateStage(Number((request.params as { id: string }).id), pipelineStageUpdateSchema.parse(request.body));
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.delete("/api/stages/:id", async (request, reply) => {
    try {
      pipeline.removeStage(Number((request.params as { id: string }).id));
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.put("/api/pipelines/:id/stages/reorder", async (request, reply) => {
    try {
      pipeline.reorderStages(Number((request.params as { id: string }).id), pipelineStageReorderSchema.parse(request.body));
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  // Runs
  app.post("/api/pipelines/:id/run", async (request, reply) => {
    try {
      return await pipeline.run(Number((request.params as { id: string }).id));
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.get("/api/pipelines/:id/runs", async (request, reply) => {
    try {
      return pipeline.listRuns(Number((request.params as { id: string }).id));
    } catch (error) {
      return reply.code(404).send({ error: (error as Error).message });
    }
  });

  app.get("/api/runs/:id", async (request, reply) => {
    try {
      return pipeline.getRun(Number((request.params as { id: string }).id));
    } catch (error) {
      return reply.code(404).send({ error: (error as Error).message });
    }
  });

  // Skill export — pipeline → SKILL.md + knowledge bundle (untuk di-inject
  // ke Cursor/Codex/Claude Code/OpenCode; agent di tool yang menjalankannya).
  if (skillExport) {
    app.get("/api/pipelines/:id/export", async (request, reply) => {
      try {
        const id = Number((request.params as { id: string }).id);
        const exp = skillExport.exportPipeline(id);
        const format = (request.query as { format?: string }).format;
        if (format === "zip") {
          const zip = new JSZip();
          for (const file of exp.files) zip.file(file.path, file.content);
          const buffer = await zip.generateAsync({ type: "nodebuffer" });
          return reply
            .header("Content-Type", "application/zip")
            .header("Content-Disposition", `attachment; filename="${exp.skill_name}.zip"`)
            .send(buffer);
        }
        return exp;
      } catch (error) {
        return reply.code(400).send({ error: (error as Error).message });
      }
    });
  }
}
