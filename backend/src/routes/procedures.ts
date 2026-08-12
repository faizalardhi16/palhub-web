import type { FastifyInstance } from "fastify";
import type { ProcedureService } from "../services/procedure.service.js";

export function registerProcedureRoutes(app: FastifyInstance, procedures: ProcedureService): void {
  app.get("/api/specialists/:id/procedures", async (request) =>
    procedures.listBySpecialist(Number((request.params as { id: string }).id))
  );

  app.post("/api/specialists/:id/procedures", async (request, reply) => {
    try {
      const created = procedures.create(Number((request.params as { id: string }).id), request.body);
      return reply.code(201).send(created);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.put("/api/procedures/:id", async (request, reply) => {
    try {
      return procedures.update(Number((request.params as { id: string }).id), request.body);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.delete("/api/procedures/:id", async (request, reply) => {
    try {
      procedures.remove(Number((request.params as { id: string }).id));
      return { ok: true };
    } catch (error) {
      return reply.code(404).send({ error: (error as Error).message });
    }
  });
}
