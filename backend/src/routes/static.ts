import type { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Serve the built React frontend (web/dist) from the backend origin,
 * so API + MCP + UI share one port (no CORS, minimal resources).
 */
export function registerStatic(app: FastifyInstance, webDist: string): void {
  if (!existsSync(webDist)) {
    app.log.warn(`web/dist tidak ditemukan di ${webDist} — static serving skip`);
    return;
  }

  app.register(fastifyStatic, {
    root: webDist,
    prefix: "/",
  });

  // SPA fallback: semua route non-API balikin index.html
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api") || request.url === "/mcp" || request.url.startsWith("/mcp")) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    reply.type("text/html").sendFile("index.html");
  });

  const distPath = join(webDist, "index.html");
  if (existsSync(distPath)) {
    app.log.info(`📦 Static frontend: ${webDist}`);
  }
}
