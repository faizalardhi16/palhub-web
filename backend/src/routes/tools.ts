import type { FastifyInstance } from "fastify";
import type { ToolService } from "../services/tool.service.js";

export function registerToolRoutes(app: FastifyInstance, tools: ToolService): void {
  app.get("/api/specialists/:id/tools", async (request) =>
    tools.listBySpecialist(Number((request.params as { id: string }).id))
  );

  app.post("/api/specialists/:id/tools", async (request, reply) => {
    try {
      const created = tools.create(Number((request.params as { id: string }).id), request.body);
      return reply.code(201).send(created);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.put("/api/tools/:id", async (request, reply) => {
    try {
      return tools.update(Number((request.params as { id: string }).id), request.body);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.delete("/api/tools/:id", async (request, reply) => {
    try {
      tools.remove(Number((request.params as { id: string }).id));
      return { ok: true };
    } catch (error) {
      return reply.code(404).send({ error: (error as Error).message });
    }
  });
}
