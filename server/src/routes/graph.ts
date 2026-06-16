import { Router, Request, Response } from "express";
import { loadGraph, saveGraph, syncContextMD, GraphData, setCurrentFile, getFilePath, pushEvent } from "../store.js";
import { generateSNL } from "../compiler/dfsParser.js";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..");

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  const data = loadGraph();
  res.json(data);
});

router.put("/", (req: Request, res: Response) => {
  const data = req.body as GraphData;
  if (!data || !data.modules || !data.edges) {
    res.status(400).json({ error: "Invalid graph data" });
    return;
  }
  saveGraph(data);
  res.json({ ok: true, currentFile: getFilePath().replace(ROOT + "\\", "").replace(ROOT + "/", "") });
});

router.post("/load", (req: Request, res: Response) => {
  const { filename } = req.body as { filename: string };
  if (!filename) {
    res.status(400).json({ error: "Missing filename" });
    return;
  }
  setCurrentFile(filename);
  const data = loadGraph();
  res.json(data);
});

router.post("/save", (req: Request, res: Response) => {
  const { filename } = req.body as { filename?: string };
  const data = req.body as GraphData;
  if (!data || !data.modules || !data.edges) {
    res.status(400).json({ error: "Invalid graph data" });
    return;
  }
  if (filename) {
    setCurrentFile(filename);
  }
  saveGraph(data);
  res.json({ ok: true });
});

router.post("/import", (req: Request, res: Response) => {
  const { content, filename } = req.body as { content: string; filename?: string };
  if (!content) {
    res.status(400).json({ error: "Missing content" });
    return;
  }
  let targetFile = filename;
  if (!targetFile) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    targetFile = `imported_${ts}.json`;
  }
  writeFileSync(join(ROOT, targetFile), content, "utf-8");
  setCurrentFile(targetFile);
  const data = loadGraph();
  res.json(data);
});

router.get("/context", (_req: Request, res: Response) => {
  syncContextMD();
  res.json({ ok: true, message: "CONTEXT.MD synced" });
});

router.post("/compile", (req: Request, res: Response) => {
  const { rootModuleId } = req.body as { rootModuleId?: string };
  const data = loadGraph();
  if (rootModuleId) {
    const exists = data.modules.some((m) => m.id === rootModuleId);
    if (!exists) {
      res.status(404).json({ error: `Root module "${rootModuleId}" not found` });
      return;
    }
  }
  const snl = generateSNL(data, rootModuleId || undefined);
  res.json({ snl });
});

router.post("/events", (req: Request, res: Response) => {
  const { intent, message } = req.body as { intent?: string; message?: string };
  if (!intent || !message) {
    res.status(400).json({ error: "Missing intent or message" });
    return;
  }
  const ev = pushEvent(intent, message);
  res.json({ ok: true, event: ev });
});

export default router;
