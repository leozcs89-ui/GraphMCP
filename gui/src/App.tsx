import { useCallback, useState, useRef, useEffect } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  type Connection,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import GraphNode, { GraphNodeData } from "./components/GraphNode";
import SNLPanel from "./components/SNLPanel";
import NodeCreationMenu from "./components/NodeCreationMenu";
import FileMenu from "./components/FileMenu";
import { useGraphData } from "./hooks/useGraphData";
import { cn } from "./utils/cn";

const nodeTypes = {
  graphNode: GraphNode,
};

interface MenuState {
  visible: boolean;
  x: number;
  y: number;
  sourceNodeId?: string;
  sourceHandleId?: string | null;
}

export default function App() {
  const {
    nodes,
    edges,
    loaded,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    deleteNode,
    updateNodeLabel,
    updateNodeData,
    connectNodes,
    copyNode,
    currentFile,
    loadFile,
    saveAs,
    newFile,
  } = useGraphData();

  const [showSNL, setShowSNL] = useState(false);
  const [direction, setDirection] = useState<"vertical" | "horizontal">("vertical");
  const [eventMsg, setEventMsg] = useState("");
  const [mcpConnected, setMcpConnected] = useState(false);
  const [menu, setMenu] = useState<MenuState>({ visible: false, x: 0, y: 0 });
  const rfInstanceRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const connectingRef = useRef<{ source: string; handleId: string | null } | null>(null);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      wsRef.current = new WebSocket("ws://localhost:3001");
      wsRef.current.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "mcp_status") {
            setMcpConnected(msg.connected);
          }
        } catch {}
      };
      wsRef.current.onclose = () => {
        setMcpConnected(false);
        wsRef.current = null;
        reconnectTimer = setTimeout(connect, 3000);
      };
      wsRef.current.onerror = () => {
        wsRef.current?.close();
      };
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      rfInstanceRef.current?.fitView({ duration: 300 });
    }, 100);
    return () => clearTimeout(timer);
  }, [currentFile]);

  const handleDownload = useCallback(() => {
    const currentNodes = nodes;
    const currentEdges = edges;
    const data = {
      project: "graphMCP",
      version: "1.0.0",
      modules: currentNodes.map((n) => {
        const nd = n.data as Record<string, unknown>;
        return {
          id: n.id,
          type: nd.nodeType,
          label: nd.label,
          status: nd.status,
          x: n.position.x,
          y: n.position.y,
          parentId: n.parentId || undefined,
        };
      }),
      edges: currentEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentFile;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, currentFile]);

  const closeMenu = useCallback(() => {
    setMenu({ visible: false, x: 0, y: 0 });
    connectingRef.current = null;
  }, []);

  const shiftDragRef = useRef(false);
  const dragOriginRef = useRef<Record<string, { x: number; y: number }>>({});

  const onNodeDragStart = useCallback((event: any, node: any) => {
    shiftDragRef.current = (event?.ctrlKey || event?.metaKey) ?? false;
    if (shiftDragRef.current) {
      dragOriginRef.current[node.id] = { x: node.position.x, y: node.position.y };
    }
  }, []);

  const onNodeDragStop = useCallback(
    (_event: any, node: any) => {
      if (shiftDragRef.current && node.id) {
        copyNode(node.id);
        const origin = dragOriginRef.current[node.id];
        if (origin) {
          onNodesChange([{ type: "position", id: node.id, position: origin, dragging: false }]);
        }
      }
      shiftDragRef.current = false;
    },
    [copyNode, onNodesChange]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "c") {
        const selectedNodes = nodes.filter((n) => n.selected);
        if (selectedNodes.length > 0) {
          event.preventDefault();
          selectedNodes.forEach((n) => copyNode(n.id, 30, 30));
        }
      }
    },
    [nodes, copyNode]
  );

  const sendEvent = useCallback(() => {
    const msg = eventMsg.trim();
    if (!msg) return;
    // Persist to queue (fallback)
    fetch("/api/graph/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "user_message", message: msg }),
    }).catch(console.error);
    // Real-time via WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "user_event", message: msg }));
    }
    setEventMsg("");
  }, [eventMsg]);

  const handleEventKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") sendEvent();
    },
    [sendEvent]
  );

  const handleMenuSelect = useCallback(
    (nodeType: GraphNodeData["nodeType"]) => {
      const { x, y, sourceNodeId, sourceHandleId } = menu;
      const instance = rfInstanceRef.current;
      if (!instance) return;

      const pos = instance.screenToFlowPosition({ x, y });
      const newId = addNode(pos.x, pos.y, nodeType);
      closeMenu();

      if (sourceNodeId && newId) {
        connectNodes(sourceNodeId, sourceHandleId ?? null, newId);
      }
    },
    [menu, addNode, closeMenu, connectNodes]
  );

  const onDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest(".react-flow__node")) return;
      connectingRef.current = null;
      setMenu({
        visible: true,
        x: event.clientX,
        y: event.clientY,
      });
    },
    []
  );

  const onConnectStart = useCallback(
    (_event: any, params: { nodeId: string | null; handleId: string | null }) => {
      if (params.nodeId) {
        connectingRef.current = { source: params.nodeId, handleId: params.handleId };
      }
    },
    []
  );

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: { isValid: boolean | null }) => {
      if (!connectingRef.current || connectionState.isValid === true) return;
      const mouseEvent = event as MouseEvent;
      setMenu({
        visible: true,
        x: mouseEvent.clientX,
        y: mouseEvent.clientY,
        sourceNodeId: connectingRef.current.source,
        sourceHandleId: connectingRef.current.handleId,
      });
      connectingRef.current = null;
    },
    []
  );

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      const srcNode = nodes.find((n) => n.id === connection.source);
      const tgtNode = nodes.find((n) => n.id === connection.target);
      if (!srcNode || !tgtNode) return true;
      const srcType = (srcNode.data as any).nodeType;
      const tgtType = (tgtNode.data as any).nodeType;
      if (srcType === "workflow" && tgtType !== "workflow") return false;
      if (tgtType === "workflow" && srcType !== "workflow") return false;
      return true;
    },
    [nodes]
  );

  const nodesWithHandlers = nodes.map((n) => ({
    ...n,
    data: {
      ...(n.data as Record<string, unknown>),
      direction,
      onDelete: deleteNode,
      onLabelChange: updateNodeLabel,
      onDataChange: updateNodeData,
    },
  }));

  return (
    <div className="w-screen h-screen relative">
      {/* Toolbar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-white/90 backdrop-blur rounded-lg shadow border border-gray-200 px-3 py-2">
        <span className="text-xs text-gray-500 font-medium">graphMCP</span>
        <span
          className={cn(
            "inline-block w-2 h-2 rounded-full flex-shrink-0",
            mcpConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
          )}
          title={mcpConnected ? "Agent connected" : "Agent disconnected"}
        />
        <span className="text-gray-300">|</span>
        <FileMenu
          currentFile={currentFile}
          onLoadFile={loadFile}
          onSaveAs={saveAs}
          onNewFile={newFile}
          onDownload={handleDownload}
        />
        <span className="text-gray-300">|</span>
        <button
          onClick={() => setDirection((d) => (d === "vertical" ? "horizontal" : "vertical"))}
          className="text-xs px-3 py-1 rounded bg-gray-50 text-gray-600 hover:bg-gray-100 transition font-medium"
        >
          {direction === "vertical" ? "↓ V" : "→ H"}
        </button>
        <span className="text-gray-300">|</span>
        <button
          onClick={() => setShowSNL((v) => !v)}
          className="text-xs px-3 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition font-medium"
        >
          {showSNL ? "Hide SNL" : "Compile SNL"}
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-[11px] text-gray-400">
          {nodes.length} nodes · Double-click or drag pin to add
        </span>
        <span className="text-gray-300">|</span>
        <input
          value={eventMsg}
          onChange={(e) => setEventMsg(e.target.value)}
          onKeyDown={handleEventKeyDown}
          placeholder="Message agent..."
          className="text-[11px] border border-gray-200 rounded px-2 py-0.5 outline-none focus:border-blue-300 w-[130px]"
        />
        <button
          onClick={sendEvent}
          disabled={!eventMsg.trim()}
          className="text-[11px] px-2 py-0.5 rounded bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-30 transition font-medium"
        >
          Send
        </button>
      </div>

      {/* Canvas */}
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onKeyDown={onKeyDown}
        zoomOnDoubleClick={false}
        onDoubleClick={onDoubleClick}
        onInit={(instance) => { rfInstanceRef.current = instance; }}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode={["Delete"]}
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>

      {/* Node creation menu */}
      <NodeCreationMenu
        x={menu.x}
        y={menu.y}
        visible={menu.visible}
        onSelect={handleMenuSelect}
        onClose={closeMenu}
      />

      {/* SNL Panel */}
      <SNLPanel
        nodes={nodes}
        edges={edges}
        visible={showSNL}
        onClose={() => setShowSNL(false)}
      />

      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-40">
          <span className="text-sm text-gray-400">Loading...</span>
        </div>
      )}
    </div>
  );
}
