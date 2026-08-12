import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(new URL("http://localhost:8787/mcp"));
const client = new Client({ name: "test", version: "1.0" });
await client.connect(transport);
const res = await client.callTool({ name: "finance_web_search", arguments: { prompt: "batas waktu pelaporan SPT tahunan" } });
console.log("RESULT:", res.content[0].text.slice(0, 400));
await client.close();
process.exit(0);
