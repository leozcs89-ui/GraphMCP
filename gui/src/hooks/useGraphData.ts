import { useState, useEffect, useCallback, useRef } from "react";
import {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeChange,
  EdgeChange,
} from "@xyflow/react";
import { GraphNodeData } from "../components/GraphNode";

interface BackendModule {
  id: string;
  type: "module" | "action" | "condition" | "variable" | "workflow" | "structure";
  label: string;
  status: "todo" | "in_progress" | "completed";
  parentId?: string;
  children?: BackendModule[];
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

interface BackendEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

interface BackendData {
  project: string;
  version: string;
  modules: BackendModule[];
  edges: BackendEdge[];
}

const SAVE_DELAY = 500;

function toReactFlowNodes(modules: BackendModule[]): Node[] {
  const nodeMap = new Map<string, BackendModule>();
  const walk = (list: BackendModule[]) => {
    for (const m of list) {
      nodeMap.set(m.id, m);
      if (m.children) walk(m.children);
    }
  };
  walk(modules);

  return Array.from(nodeMap.values()).map((m) => ({
    id: m.id,
    type: "graphNode",
    position: {
      x: m.x ?? Math.random() * 400,
      y: m.y ?? Math.random() * 400,
    },
    data: {
      label: m.label,
      status: m.status,
      nodeType: m.type,
      varType: m.varType as GraphNodeData["varType"],
      varValue: m.varValue,
      enumValues: m.enumValues,
      trueLabel: m.trueLabel,
      falseLabel: m.falseLabel,
      inputVars: m.inputVars,
      conditionExpr: m.conditionExpr,
      leftOperand: m.leftOperand,
      operator: m.operator as GraphNodeData["operator"],
      rightOperand: m.rightOperand,
    } satisfies GraphNodeData,
    parentId: m.parentId || undefined,
  }));
}

function toBackendModules(nodes: Node[]): BackendModule[] {
  const topNodes = nodes.filter((n) => !n.parentId);
  return topNodes.map((n) => {
    const data = n.data as unknown as GraphNodeData;
    return {
      id: n.id,
      type: data.nodeType,
      label: data.label,
      status: data.status,
      x: n.position.x,
      y: n.position.y,
      parentId: n.parentId || undefined,
      varType: data.varType,
      varValue: data.varValue,
      enumValues: data.enumValues,
      trueLabel: data.trueLabel,
      falseLabel: data.falseLabel,
      inputVars: data.inputVars,
      conditionExpr: data.conditionExpr,
      leftOperand: data.leftOperand,
      operator: data.operator,
      rightOperand: data.rightOperand,
      children: n.parentId
        ? undefined
        : nodes
            .filter((c) => c.parentId === n.id)
            .map((c) => {
              const cd = c.data as unknown as GraphNodeData;
              return {
                id: c.id,
                type: cd.nodeType,
                label: cd.label,
                status: cd.status,
                x: c.position.x,
                y: c.position.y,
                parentId: c.parentId || undefined,
                varType: cd.varType,
                varValue: cd.varValue,
                enumValues: cd.enumValues,
                trueLabel: cd.trueLabel,
                falseLabel: cd.falseLabel,
                inputVars: cd.inputVars,
                conditionExpr: cd.conditionExpr,
                leftOperand: cd.leftOperand,
                operator: cd.operator,
                rightOperand: cd.rightOperand,
              };
            }),
    };
  });
}

export function useGraphData() {
  const [nodes, setNodes, onNodesChangeRaw] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChangeRaw] = useEdgesState<Edge>([]);
  const [loaded, setLoaded] = useState(false);
  const [currentFile, setCurrentFile] = useState("graph_logic.json");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  nodesRef.current = nodes;
  edgesRef.current = edges;

  const loadData = useCallback(
    (data: BackendData) => {
      const rfn = toReactFlowNodes(data.modules);
      const rfe: Edge[] = data.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
      }));
      setNodes(rfn);
      setEdges(rfe);
    },
    [setNodes, setEdges]
  );

  useEffect(() => {
    fetch("/api/graph")
      .then((r) => r.json())
      .then((data: BackendData) => {
        loadData(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const save = useCallback(
    (filename?: string) => {
      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;
      const modules = toBackendModules(currentNodes);
      const backendEdges: BackendEdge[] = currentEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || undefined,
      }));
      return fetch(filename ? "/api/graph/save" : "/api/graph", {
        method: filename ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: "graphMCP",
          version: "1.0.0",
          modules,
          edges: backendEdges,
          ...(filename ? { filename } : {}),
        }),
      })
        .then((r) => r.json())
        .catch(console.error);
    },
    []
  );

  const debouncedSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(), SAVE_DELAY);
  }, [save]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChangeRaw(changes);
      const hasStructural = changes.some(
        (c) => c.type === "position" || c.type === "remove"
      );
      if (hasStructural) debouncedSave();
    },
    [onNodesChangeRaw, debouncedSave]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChangeRaw(changes);
      debouncedSave();
    },
    [onEdgesChangeRaw, debouncedSave]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
      debouncedSave();
    },
    [setEdges, debouncedSave]
  );

  const addNode = useCallback(
    (x: number, y: number, nodeType: GraphNodeData["nodeType"] = "action") => {
      const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newNode: Node = {
        id,
        type: "graphNode",
        position: { x, y },
        data: {
          label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1),
          status: "todo" as const,
          nodeType,
        },
      };
      setNodes((nds) => [...nds, newNode]);
      debouncedSave();
      return id;
    },
    [setNodes, debouncedSave]
  );

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) =>
        eds.filter((e) => e.source !== id && e.target !== id)
      );
      debouncedSave();
    },
    [setNodes, setEdges, debouncedSave]
  );

  const updateNodeLabel = useCallback(
    (id: string, label: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, label } }
            : n
        )
      );
      debouncedSave();
    },
    [setNodes, debouncedSave]
  );

  const updateNodeData = useCallback(
    (id: string, patch: Partial<GraphNodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, ...patch } }
            : n
        )
      );
      debouncedSave();
    },
    [setNodes, debouncedSave]
  );

  const connectNodes = useCallback(
    (sourceId: string, sourceHandleId: string | null, targetId: string) => {
      const edgeId = `e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newEdge: Edge = {
        id: edgeId,
        source: sourceId,
        sourceHandle: sourceHandleId || undefined,
        target: targetId,
      };
      setEdges((eds) => [...eds, newEdge]);
      debouncedSave();
    },
    [setEdges, debouncedSave]
  );

  const copyNode = useCallback(
    (nodeId: string, offsetX = 50, offsetY = 50) => {
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return null;
      const newId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newNode: Node = {
        ...node,
        id: newId,
        position: { x: node.position.x + offsetX, y: node.position.y + offsetY },
        selected: false,
        data: { ...node.data },
      };
      setNodes((nds) => [...nds, newNode]);
      debouncedSave();
      return newId;
    },
    [setNodes, debouncedSave]
  );

  const loadFile = useCallback(
    (filename: string) => {
      fetch("/api/graph/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      })
        .then((r) => r.json())
        .then((data: BackendData) => {
          loadData(data);
          setCurrentFile(filename);
        })
        .catch(console.error);
    },
    [loadData]
  );

  const saveAs = useCallback(
    (filename: string) => {
      save(filename).then((res: any) => {
        if (res?.ok) setCurrentFile(filename);
      });
    },
    [save]
  );

  const newFile = useCallback(() => {
    save().then(() => {
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const filename = `project_${ts}.json`;
      save(filename).then((res: any) => {
        if (res?.ok) {
          setNodes([]);
          setEdges([]);
          setCurrentFile(filename);
        }
      });
    });
  }, [save, setNodes, setEdges]);

  return {
    nodes,
    edges,
    loaded,
    currentFile,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    deleteNode,
    updateNodeLabel,
    updateNodeData,
    connectNodes,
    copyNode,
    loadFile,
    saveAs,
    newFile,
    save,
  };
}
