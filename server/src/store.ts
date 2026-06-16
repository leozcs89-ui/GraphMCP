import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { dataToContextMD } from "./compiler/dfsParser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = join(__dirname, "..", "..");
let currentFilePath = join(ROOT, "graph_logic.json");
const CONTEXT_PATH = join(ROOT, "CONTEXT.MD");
const SYNC_PATH = join(ROOT, ".mcp_sync.json");
const EVENTS_PATH = join(ROOT, ".mcp_events.json");

export interface McpEvent {
  id: string;
  intent: string;
  message: string;
  timestamp: number;
}

function resolveFilePath(): string {
  try {
    if (existsSync(SYNC_PATH)) {
      const sync = JSON.parse(readFileSync(SYNC_PATH, "utf-8"));
      if (sync.currentFile) {
        const resolved = join(ROOT, sync.currentFile);
        if (existsSync(resolved)) {
          currentFilePath = resolved;
        }
      }
    }
  } catch {}
  return currentFilePath;
}

export interface GraphNode {
  id: string;
  type: "module" | "action" | "condition" | "variable" | "workflow" | "structure";
  label: string;
  status: "todo" | "in_progress" | "completed";
  parentId?: string;
  children?: GraphNode[];
  x?: number;
  y?: number;
  varType?: string;
  varValue?: string;
  enumValues?: string;
  trueLabel?: string;
  falseLabel?: string;
  inputVars?: string;
  conditionExpr?: string;
  leftOperand?: string;
  operator?: string;
  rightOperand?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

export interface GraphData {
  project: string;
  version: string;
  modules: GraphNode[];
  edges: GraphEdge[];
}

const DEFAULT_DATA: GraphData = {
  project: "graphMCP",
  version: "1.0.0",
  modules: [],
  edges: [],
};

export function getCurrentFile(): string {
  return basename(currentFilePath);
}

export function getFilePath(): string {
  return currentFilePath;
}

export function setCurrentFile(filename: string): void {
  currentFilePath = join(ROOT, filename);
  writeFileSync(SYNC_PATH, JSON.stringify({ currentFile: filename }), "utf-8");
}

export function listGraphFiles(): string[] {
  return readdirSync(ROOT)
    .filter((f) => f.endsWith(".json") && f !== "package-lock.json")
    .sort();
}

export function loadGraph(): GraphData {
  resolveFilePath();
  if (!existsSync(currentFilePath)) {
    return { ...DEFAULT_DATA };
  }
  try {
    return JSON.parse(readFileSync(currentFilePath, "utf-8")) as GraphData;
  } catch {
    return { ...DEFAULT_DATA };
  }
}

export function saveGraph(data: GraphData): void {
  resolveFilePath();
  writeFileSync(currentFilePath, JSON.stringify(data, null, 2), "utf-8");
  syncContextMD(data);
}

export function syncContextMD(data?: GraphData): void {
  const g = data ?? loadGraph();
  const md = dataToContextMD(g);
  writeFileSync(CONTEXT_PATH, md, "utf-8");
}

export function pushEvent(intent: string, message: string): McpEvent {
  const events = drainEventsRaw();
  const ev: McpEvent = {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    intent,
    message,
    timestamp: Date.now(),
  };
  events.push(ev);
  writeFileSync(EVENTS_PATH, JSON.stringify(events, null, 2), "utf-8");
  return ev;
}

function drainEventsRaw(): McpEvent[] {
  if (!existsSync(EVENTS_PATH)) return [];
  try {
    return JSON.parse(readFileSync(EVENTS_PATH, "utf-8")) as McpEvent[];
  } catch {
    return [];
  }
}

export function drainEvents(): McpEvent[] {
  const events = drainEventsRaw();
  writeFileSync(EVENTS_PATH, "[]", "utf-8");
  return events;
}
