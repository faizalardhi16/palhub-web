import Fastify from "fastify";
import cors from "@fastify/cors";
import { join } from "node:path";
import { getDb } from "./db/connection.js";
import { seedIfEmpty, ensureSeedTools, ensureDevelopmentCycle } from "./db/seed.js";
import { config } from "./config.js";
import { OpenAiCompatibleLlmClient } from "./llm/client.js";
import { WebSearchService } from "./services/search.service.js";
import { SpecialistService } from "./services/specialist.service.js";
import { ProcedureService } from "./services/procedure.service.js";
import { ToolService } from "./services/tool.service.js";
import { KnowledgeService } from "./services/knowledge.service.js";
import { PlaygroundService } from "./services/playground.service.js";
import { PipelineService } from "./services/pipeline.service.js";
import { SkillExportService } from "./services/skill-export.service.js";
import { ToolExecutorRegistry } from "./engines/registry.js";
import { CrawlExecutor } from "./engines/crawl.executor.js";
import { GenerateDocExecutor } from "./engines/generate-doc.executor.js";
import { KnowledgeQueryExecutor } from "./engines/knowledge-query.executor.js";
import { WebSearchExecutor } from "./engines/web-search.executor.js";
import { PalhubMcpServer } from "./mcp/server.js";
import { registerSpecialistRoutes } from "./routes/specialists.js";
import { registerToolRoutes } from "./routes/tools.js";
import { registerProcedureRoutes } from "./routes/procedures.js";
import { registerKnowledgeRoutes } from "./routes/knowledge.js";
import { registerPlaygroundRoutes } from "./routes/playground.js";
import { registerPipelineRoutes } from "./routes/pipelines.js";
import { registerStatic } from "./routes/static.js";

async function main(): Promise<void> {
  const db = getDb();
  const seeded = seedIfEmpty(db);
  if (seeded.specialists > 0) {
    console.log(`🌱 Seed: ${seeded.specialists} specialist, ${seeded.procedures} procedure, ${seeded.tools} tool`);
  }
  const migratedTools = ensureSeedTools(db);
  if (migratedTools > 0) {
    console.log(`🧬 Migration: +${migratedTools} tool ditambahkan ke specialist existing`);
  }
  const seededPipeline = ensureDevelopmentCycle(db);
  if (seededPipeline > 0) {
    console.log(`🔄 Seed pipeline: Development Cycle ditambahkan`);
  }

  // --- Dependencies (DI graph) ---
  const specialistService = new SpecialistService(db);
  const procedureService = new ProcedureService(db);
  const toolService = new ToolService(db);
  const knowledge = new KnowledgeService(db);
  const llm = new OpenAiCompatibleLlmClient(config.llm);
  const search = new WebSearchService(config.search.provider, config.search.apiKey);
  console.log(`🔍 Web search provider: ${search.active}`);

  const registry = new ToolExecutorRegistry();
  registry.register(new CrawlExecutor(search));
  registry.register(new GenerateDocExecutor());
  registry.register(new KnowledgeQueryExecutor());
  registry.register(new WebSearchExecutor(search));

  const playground = new PlaygroundService({
    registry,
    specialistService,
    toolService,
    procedureService,
    knowledge,
    llm,
    dataDir: config.dataDir,
  });

  const pipeline = new PipelineService({ db, specialistService, knowledge, llm });
  const skillExport = new SkillExportService(db, pipeline, specialistService, knowledge);

  const mcp = new PalhubMcpServer({
    registry,
    specialistService,
    toolService,
    procedureService,
    knowledge,
    llm,
    dataDir: config.dataDir,
    pipeline,
    skillExport,
  });

  // --- HTTP server ---
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get("/api/health", async () => ({ ok: true, ts: new Date().toISOString() }));

  registerSpecialistRoutes(app, specialistService);
  registerToolRoutes(app, toolService);
  registerProcedureRoutes(app, procedureService);
  registerKnowledgeRoutes(app, knowledge);
  registerPlaygroundRoutes(app, playground);
  registerPipelineRoutes(app, pipeline, skillExport);

  // Static frontend (web/dist) — UI + API + MCP satu origin
  registerStatic(app, join(process.cwd(), "../web/dist"));

  // MCP over Streamable HTTP
  app.all("/mcp", async (request, reply) => {
    reply.hijack();
    await mcp.handle(request.raw, reply.raw, request.body);
  });

  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`🚀 PalHub API + MCP: http://localhost:${config.port}`);
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
