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
    setHeaders: (reply, path) => {
      // Vite hashed assets (index-XXXX.css/js): nama file berubah kalau isi
      // berubah → boleh di-cache selamanya (immutable).
      if (path.includes(`${webDist}/assets/`)) {
        reply.header("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        // index.html & lainnya: selalu revalidate, supaya browser selalu
        // dapet referensi asset terbaru (nama file ter-hash).
        reply.header("Cache-Control", "no-cache");
      }
    },
  });

  // SPA fallback: semua route non-API balikin index.html.
  // CATATAN: request /assets/* yang gak ketemu (mis. nama file lama dari
  // HTML yang ke-cache) HARUS 404, bukan fallback ke index.html — kalau
  // dibalas HTML dengan label text/css atau application/javascript,
  // browser gagal parse dan UI jadi tanpa styling/JS.
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api") || request.url.startsWith("/mcp")) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    if (request.url.startsWith("/assets/")) {
      reply.code(404).send("Not found");
      return;
    }
    reply.type("text/html").sendFile("index.html");
  });

  const distPath = join(webDist, "index.html");
  if (existsSync(distPath)) {
    app.log.info(`📦 Static frontend: ${webDist}`);
  }
}
