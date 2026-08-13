import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import type { PlaygroundDeps } from "../services/playground.service.js";
import { slugify } from "../util.js";

interface McpSession {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
}

/**
 * PalhubMcpServer — exposes every specialist's tools as MCP tools
 * over Streamable HTTP. Tool name: <specialist>_<tool> (e.g. finance_crawl).
 * Consumed by Cursor / Codex / Claude Code / OpenCode etc.
 *
 * IMPORTANT: one McpServer instance can connect to only ONE transport
 * (the SDK throws "Already connected"). So each client session gets its
 * own McpServer + transport pair, stored in `sessions` by session id.
 */
export class PalhubMcpServer {
  private readonly sessions = new Map<string, McpSession>();

  constructor(private readonly deps: PlaygroundDeps) {}

  private createServer(): McpServer {
    const server = new McpServer({ name: "palhub", version: "0.1.0" });
    const tools = this.deps.toolService.listAll();

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

    return server;
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
