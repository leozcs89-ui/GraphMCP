import express from "express";
import cors from "cors";
import http from "http";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerAllTools } from "./mcp/tools.js";
import graphRoutes from "./routes/graph.js";
import { syncContextMD, getCurrentFile, listGraphFiles, pushEvent } from "./store.js";
import { WebSocketServer, WebSocket } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.PORT || "3001", 10);

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/graph", graphRoutes);

// Serve frontend in production
const distPath = join(__dirname, "..", "..", "gui", "dist");
app.use(express.static(distPath));
app.get("*", (_req, res, next) => {
  if (_req.path.startsWith("/api") || _req.path.startsWith("/mcp")) {
    return next();
  }
  res.sendFile(join(distPath, "index.html"), (err) => {
    if (err) next();
  });
});

// MCP Server (SSE)
const mcpServer = new McpServer({
  name: "graphMCP",
  version: "1.0.0",
});
registerAllTools(mcpServer);

const transports = new Map<string, SSEServerTransport>();

app.get("/mcp/sse", async (req, res) => {
  const transport = new SSEServerTransport("/mcp/messages", res);
  transports.set(transport.sessionId, transport);
  res.on("close", () => {
    transports.delete(transport.sessionId);
  });
  await mcpServer.connect(transport);
});

app.post("/mcp/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  await transport.handlePostMessage(req, res);
});

// WebSocket: real-time MCP status
const mcpConnected = true;
const frontendClients = new Set<WebSocket>();

function broadcastFrontend(msg: object) {
  const data = JSON.stringify(msg);
  for (const client of frontendClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

app.get("/api/status", (_req, res) => {
  res.json({ mcpConnected, currentFile: getCurrentFile() });
});

app.get("/api/files", (_req, res) => {
  res.json({ files: listGraphFiles() });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg: any;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === "user_event" && msg.message) {
      pushEvent("user_message", msg.message);
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN && client !== ws) {
          client.send(raw.toString());
        }
      }
    }
  });

  ws.on("close", () => {
    frontendClients.delete(ws);
  });

  // Assume unknown connections are frontend clients
  frontendClients.add(ws);
  ws.send(JSON.stringify({ type: "mcp_status", connected: true }));
});

// Initial sync
syncContextMD();

server.listen(PORT, () => {
  console.log(`graphMCP Server running on http://localhost:${PORT}`);
  console.log(`  Canvas API: http://localhost:${PORT}/api/graph`);
  console.log(`  MCP:        http://localhost:${PORT}/mcp`);
  console.log(`  WebSocket:  ws://localhost:${PORT}`);
});
