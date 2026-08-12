import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import type { PlaygroundDeps } from "../services/playground.service.js";
import { slugify } from "../util.js";

/**
 * PalhubMcpServer — exposes every specialist's tools as MCP tools
 * over Streamable HTTP. Tool name: <specialist>_<tool> (e.g. finance_crawl).
 * Consumed by Cursor / Codex / Claude Code etc.
 */
export class PalhubMcpServer {
  private readonly server: McpServer;
  private readonly transports = new Map<string, StreamableHTTPServerTransport>();

  constructor(private readonly deps: PlaygroundDeps) {
    this.server = new McpServer({ name: "palhub", version: "0.1.0" });
    this.registerTools();
  }

  private registerTools(): void {
    const tools = this.deps.toolService.listAll();

    for (const tool of tools) {
      const specialist = this.deps.specialistService.get(tool.specialist_id);
      const name = `${slugify(specialist.name)}_${slugify(tool.name)}`;

      this.server.registerTool(
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
  }

  async handle(req: IncomingMessage, res: ServerResponse, body: unknown): Promise<void> {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport = sessionId ? this.transports.get(sessionId) : undefined;

    if (!transport) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          this.transports.set(id, transport!);
        },
      });
      await this.server.connect(transport);
    }

    await transport.handleRequest(req, res, body);
  }
}
