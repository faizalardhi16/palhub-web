import type { FastifyInstance } from "fastify";
import type { PlaygroundService } from "../services/playground.service.js";
import { playgroundSchema } from "../domain/schemas.js";

export function registerPlaygroundRoutes(app: FastifyInstance, playground: PlaygroundService): void {
  app.post("/api/specialists/:id/playground", async (request, reply) => {
    try {
      const specialistId = Number((request.params as { id: string }).id);
      const body = playgroundSchema.parse(request.body);
      const result = await playground.run(specialistId, body.tool_id, body.input);
      return result;
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });
}
