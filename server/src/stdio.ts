import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./mcp/tools.js";
import { WebSocket } from "ws";

const server = new McpServer({
  name: "graphMCP",
  version: "1.0.0",
});
registerAllTools(server);

// Connect WebSocket to notify Express server of MCP readiness
const ws = new WebSocket("ws://localhost:3001");
ws.on("open", () => {
  ws.send(JSON.stringify({ type: "mcp_ready" }));
});
ws.on("error", () => {});

const transport = new StdioServerTransport();
await server.connect(transport);
