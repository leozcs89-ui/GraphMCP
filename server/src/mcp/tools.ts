import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadGraph, saveGraph, syncContextMD, drainEvents } from "../store.js";

export function registerAllTools(server: McpServer): void {
  server.tool(
    "inspect_project_structure",
    "Read macro module relationships and overall progress for global task planning",
    {},
    async () => {
      const data = loadGraph();
      const summary = {
        project: data.project,
        modules: data.modules.map((m) => ({
          id: m.id,
          type: m.type,
          label: m.label,
          status: m.status,
          parentId: m.parentId,
        })),
        edges: data.edges.map((e) => ({
          source: e.source,
          target: e.target,
        })),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      };
    }
  );

  server.tool(
    "fetch_module_logic",
    "Read the micro SNL control flow within a specific module for precise coding",
    {
      moduleId: z.string().describe("The ID of the module to fetch"),
    },
    async ({ moduleId }) => {
      const data = loadGraph();
      const module = data.modules.find((m) => m.id === moduleId);
      if (!module) {
        return {
          content: [{ type: "text", text: `Module "${moduleId}" not found.` }],
        };
      }
      const children = module.children || [];
      const childIds = new Set(children.map((c) => c.id));
      const relevantEdges = data.edges.filter(
        (e) => childIds.has(e.source) || childIds.has(e.target)
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { module, children, edges: relevantEdges },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "update_node_progress",
    "Update node status after coding or testing (e.g. mark as completed)",
    {
      nodeId: z.string().describe("The ID of the node to update"),
      status: z
        .enum(["todo", "in_progress", "completed"])
        .describe("The new status"),
    },
    async ({ nodeId, status }) => {
      const data = loadGraph();
      const updateNode = (nodes: typeof data.modules): boolean => {
        for (const n of nodes) {
          if (n.id === nodeId) {
            n.status = status;
            return true;
          }
          if (n.children && updateNode(n.children)) return true;
        }
        return false;
      };
      const found = updateNode(data.modules);
      if (!found) {
        return {
          content: [{ type: "text", text: `Node "${nodeId}" not found.` }],
        };
      }
      saveGraph(data);
      syncContextMD(data);
      return {
        content: [
          {
            type: "text",
            text: `Node "${nodeId}" status updated to "${status}". CONTEXT.MD synced.`,
          },
        ],
      };
    }
  );

  server.tool(
    "check_pending_events",
    "Read messages sent from the web UI to the agent. Call this periodically to receive user feedback and requests.",
    {},
    async () => {
      const events = drainEvents();
      return {
        content: [
          {
            type: "text",
            text:
              events.length > 0
                ? `You have ${events.length} pending message(s) from the user:\n\n${events.map((e) => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.intent}: ${e.message}`).join("\n")}`
                : "No pending messages from the user.",
          },
        ],
      };
    }
  );
}
