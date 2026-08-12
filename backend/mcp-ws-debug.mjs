import fs from "node:fs";
const log = (m) => fs.appendFileSync("/tmp/mcp-ws-debug.log", `${new Date().toISOString()} ${m}\n`);
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

log("start");
const transport = new StreamableHTTPClientTransport(new URL("http://localhost:8787/mcp"));
const client = new Client({ name: "test", version: "1.0" });
log("connecting...");
await client.connect(transport);
log("connected");
const res = await client.callTool({ name: "finance_web_search", arguments: { prompt: "tarif PPN 12 persen" } });
log("RESULT: " + JSON.stringify(res).slice(0, 500));
await client.close();
process.exit(0);
