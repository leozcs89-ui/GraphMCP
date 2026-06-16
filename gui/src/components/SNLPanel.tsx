import { useState, useCallback } from "react";
import { Node, Edge } from "@xyflow/react";
import { GraphNodeData } from "./GraphNode";
import { cn } from "../utils/cn";

interface SNLPanelProps {
  nodes: Node[];
  edges: Edge[];
  visible: boolean;
  onClose: () => void;
}

export default function SNLPanel({ nodes, edges, visible, onClose }: SNLPanelProps) {
  const [selectedRootId, setSelectedRootId] = useState<string>("");
  const [snl, setSnl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const compile = useCallback(async () => {
    if (!selectedRootId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/graph/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootModuleId: selectedRootId }),
      });
      if (!res.ok) throw new Error("Compile failed");
      const data = await res.json();
      setSnl(data.snl);
    } catch (err) {
      setSnl(`Error: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [selectedRootId]);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = snl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [snl]);

  if (!visible) return null;

  const rootNodes = nodes.filter((n) => !edges.some((e) => e.target === n.id));
  const nodeOptions = rootNodes.map((n) => ({
    id: n.id,
    label: (n.data as unknown as GraphNodeData).label,
  }));

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">SNL Compiler</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          ×
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        <label className="block text-xs text-gray-500 font-medium">
          Root Node
        </label>
        <select
          value={selectedRootId}
          onChange={(e) => setSelectedRootId(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-blue-400"
        >
          <option value="">-- Select root --</option>
          {nodeOptions.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))}
        </select>

        <button
          onClick={compile}
          disabled={!selectedRootId || loading}
          className={cn(
            "w-full py-1.5 rounded text-sm font-medium transition",
            !selectedRootId || loading
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-blue-500 text-white hover:bg-blue-600"
          )}
        >
          {loading ? "Compiling..." : "Compile SNL"}
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col px-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">Output</span>
          {snl && (
            <button
              onClick={copyToClipboard}
              className={cn(
                "text-xs px-2 py-0.5 rounded transition",
                copied
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              )}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>
        <pre className="flex-1 overflow-auto bg-gray-50 border border-gray-100 rounded p-3 text-xs font-mono text-gray-700 whitespace-pre-wrap break-all">
          {snl || "Select a root node and click Compile."}
        </pre>
      </div>
    </div>
  );
}
