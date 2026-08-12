import type { FastifyInstance } from "fastify";
import type { KnowledgeService } from "../services/knowledge.service.js";

export function registerKnowledgeRoutes(app: FastifyInstance, knowledge: KnowledgeService): void {
  app.get("/api/specialists/:id/knowledge", async (request) =>
    knowledge.listBySpecialist(Number((request.params as { id: string }).id))
  );

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
