import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import type { PlaygroundDeps } from "../services/playground.service.js";
import type { PipelineService } from "../services/pipeline.service.js";
import type { SkillExportService } from "../services/skill-export.service.js";
import { deriveTags } from "../services/skill-export.service.js";
import { slugify } from "../util.js";

interface McpSession {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
}

export interface McpDeps extends PlaygroundDeps {
  pipeline: PipelineService;
  skillExport?: SkillExportService;
}

/**
 * PalhubMcpServer — exposes specialist tools + pipeline orchestration tools
 * as MCP tools over Streamable HTTP. Consumed by Cursor / Codex /
 * Claude Code / OpenCode etc.
 *
 * Specialist tools: <specialist>_<tool> (e.g. finance_crawl).
 * Orchestrator tools: pipeline_list / pipeline_get / pipeline_run /
 * orchestrator_plan / knowledge_search — bikin agent bisa nge-run pipeline
 * dan dapet knowledge fresh via MCP, bukan cuma snapshot di skill.
 *
 * IMPORTANT: one McpServer instance can connect to only ONE transport
 * (the SDK throws "Already connected"). So each client session gets its
 * own McpServer + transport pair, stored in `sessions` by session id.
 */
export class PalhubMcpServer {
  private readonly sessions = new Map<string, McpSession>();

  constructor(private readonly deps: McpDeps) {}

  private createServer(): McpServer {
    const server = new McpServer({ name: "palhub", version: "0.2.0" });
    const tools = this.deps.toolService.listAll();

    // --- Specialist tools (existing behavior) ---
    for (const tool of tools) {
      const specialist = this.deps.specialistService.get(tool.specialist_id);
      const name = `${slugify(specialist.name)}_${slugify(tool.name)}`;

      server.registerTool(
        name,
        {
          title: `${specialist.name} — ${tool.name}`,
          description: `${tool.description} (type: ${tool.type})`,
          inputSchema: {
            prompt: z.string().describe("Prompt / pertanyaan untuk tool ini"),
          },
        },
        async (args) => {
          const procedure = tool.procedure_id
            ? this.deps.procedureService.get(tool.procedure_id)
            : undefined;
          const executor = this.deps.registry.get(tool.type);

          const result = await executor.execute({
            specialist,
            tool,
            input: { prompt: args.prompt },
            llm: this.deps.llm,
            knowledge: this.deps.knowledge,
            procedure,
            dataDir: this.deps.dataDir,
          });

          return { content: [{ type: "text", text: result.content }] };
        }
      );
    }

    // --- Orchestrator / pipeline tools ---
    this.registerOrchestratorTools(server);

    return server;
  }

  private registerOrchestratorTools(server: McpServer): void {
    const pipeline = this.deps.pipeline;

    // pipeline_list — daftar pipeline yang tersedia
    server.registerTool(
      "pipeline_list",
      {
        title: "List pipelines",
        description:
          "Daftar semua pipeline orchestrator yang tersedia (id, nama, deskripsi, jumlah stage). Gunakan buat milih pipeline sebelum run.",
        inputSchema: {},
      },
      async () => {
        const items = pipeline.list();
        const text = items.length
          ? items
              .map((p) => `#${p.id} ${p.name} — ${p.description || "-"} (${p.stage_count} stages)`)
              .join("\n")
          : "Belum ada pipeline.";
        return { content: [{ type: "text", text }] };
      }
    );

    // pipeline_get — detail pipeline + stages
    server.registerTool(
      "pipeline_get",
      {
        title: "Get pipeline detail",
        description:
          "Ambil detail pipeline: stages berurutan (specialist, instruksi, max iterasi). Input: pipeline_id.",
        inputSchema: {
          pipeline_id: z.number().int().positive().describe("ID pipeline (dari pipeline_list)"),
        },
      },
      async ({ pipeline_id }) => {
        const detail = pipeline.get(pipeline_id);
        const lines = [
          `# ${detail.name}`,
          detail.description || "",
          "",
          `Stages (${detail.stages.length}):`,
        ];
        detail.stages.forEach((s, i) => {
          const spec = this.deps.specialistService.get(s.specialist_id);
          lines.push(
            `${i + 1}. **${s.name}** — ${spec.name} | ${s.instruction || "-"} | max ${s.max_iterations} iterasi`
          );
        });
        return { content: [{ type: "text", text: lines.join("\n") }] };
      }
    );

    // pipeline_run — jalanin pipeline server-side (agentic loop penuh)
    server.registerTool(
      "pipeline_run",
      {
        title: "Run pipeline",
        description:
          "Jalankan pipeline secara penuh (agentic loop server-side: tiap stage di-eksekusi LLM, NEED_MORE di-resolve ke specialist, output stage jadi input stage berikutnya). Input: pipeline_id. Return: ringkasan run + event per stage. Bisa makan waktu beberapa menit.",
        inputSchema: {
          pipeline_id: z.number().int().positive().describe("ID pipeline (dari pipeline_list)"),
        },
      },
      async ({ pipeline_id }) => {
        const run = await pipeline.run(pipeline_id);
        const detail = pipeline.getRun(run.id);
        const lines = [
          `Pipeline run #${detail.id} — status: ${detail.status}`,
          detail.error ? `Error: ${detail.error}` : "",
          "",
        ];
        for (const ev of detail.events) {
          const spec = ev.specialist_id
            ? this.deps.specialistService.get(ev.specialist_id).name
            : null;
          const who = spec ? `[${spec}]` : "";
          const stage = ev.stage_position !== null ? `(stage ${ev.stage_position + 1})` : "";
          lines.push(`- ${ev.kind} ${who} ${stage}: ${ev.content.slice(0, 800)}`);
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      }
    );

    // orchestrator_plan — resolve pipeline + stages buat task user
    server.registerTool(
      "orchestrator_plan",
      {
        title: "Orchestrator plan",
        description:
          "Masukkan task user (misal 'develop aplikasi finance') → dapatkan rekomendasi pipeline mana yang cocok, stages-nya, specialist pemilik, dan pointer knowledge. Buat agent yang mau nge-orchestrate secara lokal.",
        inputSchema: {
          task: z.string().describe("Task / permintaan user"),
        },
      },
      async ({ task }) => {
        const plan = this.buildOrchestratorPlan(task);
        return { content: [{ type: "text", text: plan }] };
      }
    );

    // knowledge_topics — intip topik/daftar isi knowledge tanpa baca semua
    server.registerTool(
      "knowledge_topics",
      {
        title: "Knowledge topics (catalog)",
        description:
          "Daftar isi knowledge per specialist: nama, jumlah catatan, dan tags topik. Buat agent yang mau tau 'ada apa aja' sebelum search — hemat token, gak perlu baca semua index.",
        inputSchema: {},
      },
      async () => {
        const lines: string[] = ["## Knowledge Topics", ""];
        const specialists = this.deps.specialistService.list();
        for (const spec of specialists) {
          const notes = this.deps.knowledge.listBySpecialist(spec.id, 500);
          const tags = [...new Set(notes.flatMap((n) => deriveTags(n.title, n.source)))];
          lines.push(
            `**#${spec.id} ${spec.name}** (${notes.length} catatan)${tags.length ? ` — tags: ${tags.join(", ")}` : ""}`
          );
        }
        lines.push("");
        lines.push("Pakai `knowledge_search` dengan `specialist_id` kalau mau cari di cabang tertentu.");
        return { content: [{ type: "text", text: lines.join("\n") }] };
      }
    );

    // knowledge_search — RAG live ke knowledge store
    server.registerTool(
      "knowledge_search",
      {
        title: "Search knowledge (live RAG)",
        description:
          "Cari knowledge yang sudah di-crawl / disimpan di PalHub (fresh, bukan snapshot skill). Input: query + optional specialist_id / limit.",
        inputSchema: {
          query: z.string().describe("Pertanyaan / keyword yang dicari"),
          specialist_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Batasi ke specialist tertentu (opsional)"),
          limit: z.number().int().min(1).max(20).optional().describe("Maks hasil (default 5)"),
        },
      },
      async ({ query, specialist_id, limit }) => {
        const knowledge = this.deps.knowledge;
        const results = specialist_id
          ? knowledge.search(specialist_id, query, limit ?? 5)
          : this.searchAllSpecialists(query, limit ?? 5);
        if (results.length === 0) {
          return { content: [{ type: "text", text: "Tidak ada knowledge yang cocok." }] };
        }
        const lines = results.map((k, i) => {
          const spec = this.deps.specialistService.get(k.specialist_id).name;
          return `### ${i + 1}. ${k.title} (${spec})\nSumber: ${k.source || "unknown"} | ${k.created_at || ""}\n\n${k.content.slice(0, 1200)}`;
        });
        return { content: [{ type: "text", text: lines.join("\n\n---\n\n") }] };
      }
    );
  }

  /** Cari knowledge di semua specialist (untuk knowledge_search tanpa specialist_id). */
  private searchAllSpecialists(query: string, limit: number) {
    const out: Array<{ specialist_id: number; title: string; content: string; source: string; created_at: string }> = [];
    const all = this.deps.specialistService.list();
    for (const spec of all) {
      const hits = this.deps.knowledge.search(spec.id, query, 5);
      out.push(...hits);
      if (out.length >= limit * 3) break;
    }
    // Simple scoring: urutkan hasil paling pendek-konteks? Keep DB order per spec,
    // lalu potong ke limit.
    return out.slice(0, limit);
  }

  /**
   * Resolve task user → pipeline paling cocok + stages + knowledge pointers.
   * Scoring keyword sederhana: task vs nama/deskripsi pipeline, nama stage,
   * nama specialist, dan judul knowledge.
   */
  private buildOrchestratorPlan(task: string): string {
    const pipeline = this.deps.pipeline;
    const t = task.toLowerCase();
    const tokens = t.split(/[^a-z0-9]+/).filter((w) => w.length > 2);

    const scored: Array<{ pipeline: ReturnType<typeof pipeline.get>; score: number }> = [];
    for (const p of pipeline.list()) {
      const detail = pipeline.get(p.id);
      let score = 0;
      const hay: string[] = [detail.name, detail.description];
      for (const s of detail.stages) {
        hay.push(s.name, s.instruction);
        try {
          hay.push(this.deps.specialistService.get(s.specialist_id).name);
        } catch {
          /* skip */
        }
      }
      const hayStr = hay.join(" ").toLowerCase();
      for (const tok of tokens) {
        if (hayStr.includes(tok)) score += 2;
      }
      // Bonus: nama pipeline match langsung
      if (detail.name.toLowerCase().includes(t) || t.includes(detail.name.toLowerCase())) {
        score += 6;
      }
      if (score > 0) scored.push({ pipeline: detail, score });
    }
    scored.sort((a, b) => b.score - a.score);

    const lines: string[] = ["## Orchestrator Plan", ""];
    if (scored.length === 0) {
      lines.push("Tidak ada pipeline yang cocok dengan task ini.");
      lines.push("");
      lines.push("Kamu bisa: (1) eksekusi manual pakai specialist tools, atau");
      lines.push("(2) buat pipeline baru di PalHub Web, lalu run via `pipeline_run`.");
      return lines.join("\n");
    }

    const best = scored[0].pipeline;
    lines.push(`**Pipeline terbaik: #${best.id} ${best.name}** (score ${scored[0].score})`);
    lines.push("");
    lines.push("### Stages");
    best.stages.forEach((s, i) => {
      const spec = this.deps.specialistService.get(s.specialist_id);
      const kcount = this.deps.knowledge.listBySpecialist(s.specialist_id, 500).length;
      lines.push(
        `${i + 1}. **${s.name}** (${spec.name}, ${kcount} knowledge notes)\n   ${s.instruction || "-"}`
      );
    });
    lines.push("");
    lines.push("### Cara pakai");
    lines.push("- Jalankan otomatis: `pipeline_run` dengan `pipeline_id: " + best.id + "`.");
    lines.push("- Atau eksekusi manual stage demi stage; kalau butuh fakta fresh, panggil `knowledge_search`.");
    return lines.join("\n");
  }

  async handle(req: IncomingMessage, res: ServerResponse, body: unknown): Promise<void> {
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let session = sessionId ? this.sessions.get(sessionId) : undefined;

      if (!session) {
        let transport: StreamableHTTPServerTransport;
        let server: McpServer;

        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            const sess = { transport, server };
            this.sessions.set(id, sess);
            transport.onclose = () => {
              this.sessions.delete(id);
            };
          },
        });
        server = this.createServer();
        await server.connect(transport);
        session = { transport, server };
      }

      await session.transport.handleRequest(req, res, body);
    } catch (error) {
      // Reply is hijacked by Fastify — we must write the error ourselves,
      // otherwise the client hangs forever.
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: String(error) },
            id: null,
          })
        );
      } else {
        res.end();
      }
    }
  }
}
