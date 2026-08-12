import type { FastifyInstance } from "fastify";
import type { SpecialistService } from "../services/specialist.service.js";

export function registerSpecialistRoutes(app: FastifyInstance, specialists: SpecialistService): void {
  app.get("/api/specialists", async () => specialists.list());

  app.post("/api/specialists", async (request, reply) => {
    const created = specialists.create(request.body);
    return reply.code(201).send(created);
  });

  app.get("/api/specialists/:id", async (request, reply) => {
    try {
      return specialists.get(Number((request.params as { id: string }).id));
    } catch (error) {
      return reply.code(404).send({ error: (error as Error).message });
    }
  });

  app.put("/api/specialists/:id", async (request, reply) => {
    try {
      return specialists.update(Number((request.params as { id: string }).id), request.body);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.delete("/api/specialists/:id", async (request, reply) => {
    try {
      specialists.remove(Number((request.params as { id: string }).id));
      return { ok: true };
    } catch (error) {
      return reply.code(404).send({ error: (error as Error).message });
    }
  });
}
