import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(new URL("http://localhost:8787/mcp"));
const client = new Client({ name: "test", version: "1.0" });
await client.connect(transport);
console.log("connected, calling knowledge_search...");
const res = await client.callTool({ name: "finance_knowledge_search", arguments: { prompt: "CoA" } });
console.log("RESULT:", JSON.stringify(res).slice(0, 300));
await client.close();
process.exit(0);
