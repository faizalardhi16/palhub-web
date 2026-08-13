import type { FastifyInstance } from "fastify";
import type { KnowledgeService } from "../services/knowledge.service.js";

interface QueryParams {
  page?: string;
  limit?: string;
}

export function registerKnowledgeRoutes(app: FastifyInstance, knowledge: KnowledgeService): void {
  app.get("/api/specialists/:id/knowledge", async (request) => {
    const id = Number((request.params as { id: string }).id);
    const { page, limit } = request.query as QueryParams;

    // Pagination mode: ?page=1&limit=10 → { items, total, page, limit, totalPages }
    if (page !== undefined) {
      return knowledge.listBySpecialistPaged(id, Number(page) || 1, Number(limit) || 10);
    }
    // Legacy: full list (max 100)
    return knowledge.listBySpecialist(id);
  });

  app.get("/api/knowledge/:id", async (request, reply) => {
    try {
      return knowledge.get(Number((request.params as { id: string }).id));
    } catch (error) {
      return reply.code(404).send({ error: (error as Error).message });
    }
  });

  app.post("/api/specialists/:id/knowledge", async (request, reply) => {
    try {
      const created = knowledge.createManual(
        Number((request.params as { id: string }).id),
        request.body
      );
      return reply.code(201).send(created);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.delete("/api/knowledge/:id", async (request, reply) => {
    try {
      knowledge.remove(Number((request.params as { id: string }).id));
      return { ok: true };
    } catch (error) {
      return reply.code(404).send({ error: (error as Error).message });
    }
  });
}
