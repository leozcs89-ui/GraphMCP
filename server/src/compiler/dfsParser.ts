interface GraphNode {
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

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

interface GraphData {
  project: string;
  version: string;
  modules: GraphNode[];
  edges: GraphEdge[];
}

function flattenModules(modules: GraphNode[]): GraphNode[] {
  const result: GraphNode[] = [];
  const walk = (list: GraphNode[]) => {
    for (const m of list) {
      result.push(m);
      if (m.children) walk(m.children);
    }
  };
  walk(modules);
  return result;
}

function findNode(modules: GraphNode[], id: string): GraphNode | undefined {
  for (const m of modules) {
    if (m.id === id) return m;
    if (m.children) {
      const found = findNode(m.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function topologicalSort(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  const flat = flattenModules(nodes);
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of flat) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    const neighbors = adjacency.get(edge.source) || [];
    neighbors.push(edge.target);
    adjacency.set(edge.source, neighbors);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: GraphNode[] = [];
  const nodeMap = new Map(flat.map((n) => [n.id, n]));
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentNode = nodeMap.get(currentId);
    if (currentNode) sorted.push(currentNode);

    for (const neighborId of adjacency.get(currentId) || []) {
      const newDegree = (inDegree.get(neighborId) || 1) - 1;
      inDegree.set(neighborId, newDegree);
      if (newDegree === 0) queue.push(neighborId);
    }
  }

  return sorted;
}

function dfsGenerate(
  nodeId: string,
  modules: GraphNode[],
  edges: GraphEdge[],
  visited: Set<string>,
  depth: number,
  lines: string[]
): void {
  if (visited.has(nodeId)) return;
  visited.add(nodeId);

  const node = findNode(modules, nodeId);
  if (!node) return;

  const indent = "  ".repeat(depth);
  const showStatus = node.type === "workflow" || node.type === "structure";
  const statusIcon = showStatus
    ? node.status === "completed" ? "[x]" :
      node.status === "in_progress" ? "[~]" : "[ ]"
    : "";

  let lineLabel = node.label;
  if (node.type === "condition" && node.operator) {
    const unaryOps = ["isNull", "isNotNull", "isEmpty", "isNotEmpty"];
    if (unaryOps.includes(node.operator)) {
      lineLabel += `  →  ${node.operator}(${node.leftOperand || "?"})`;
    } else {
      lineLabel += `  →  ${node.leftOperand || "?"} ${node.operator} ${node.rightOperand || "?"}`;
    }
  }

  const prefix = showStatus ? `${statusIcon} ` : "";
  lines.push(`${indent}${prefix}[${node.type}] ${lineLabel}`);

  if (node.children) {
    for (const child of node.children) {
      dfsGenerate(child.id, modules, edges, visited, depth + 1, lines);
    }
  }

  const outEdges = edges.filter((e) => e.source === nodeId);
  const hasHandles = outEdges.some((e) => e.sourceHandle === "true" || e.sourceHandle === "false");

  if (hasHandles) {
    const trueEdges = outEdges.filter((e) => e.sourceHandle === "true");
    const falseEdges = outEdges.filter((e) => e.sourceHandle === "false");
    const otherEdges = outEdges.filter(
      (e) => e.sourceHandle !== "true" && e.sourceHandle !== "false"
    );

    if (trueEdges.length > 0) {
      lines.push(`${indent}  → true:`);
      for (const e of trueEdges) {
        dfsGenerate(e.target, modules, edges, visited, depth + 2, lines);
      }
    }
    if (falseEdges.length > 0) {
      lines.push(`${indent}  → false:`);
      for (const e of falseEdges) {
        dfsGenerate(e.target, modules, edges, visited, depth + 2, lines);
      }
    }
    for (const e of otherEdges) {
      dfsGenerate(e.target, modules, edges, visited, depth + 1, lines);
    }
  } else {
    for (const e of outEdges) {
      const targetNode = findNode(modules, e.target);
      const isFlowLink = node.type === "workflow" && targetNode?.type === "workflow";
      if (isFlowLink) {
        lines.push(`${indent}↓`);
      }
      dfsGenerate(
        e.target,
        modules,
        edges,
        visited,
        isFlowLink ? depth : depth + 1,
        lines
      );
    }
  }
}

export function generateSNL(data: GraphData, rootModuleId?: string): string {
  const { modules, edges } = data;
  const visited = new Set<string>();
  const lines: string[] = [];

  if (rootModuleId) {
    dfsGenerate(rootModuleId, modules, edges, visited, 0, lines);
  } else {
    const roots = modules.filter((m) => !m.parentId);
    for (const root of roots) {
      dfsGenerate(root.id, modules, edges, visited, 0, lines);
    }
  }

  return lines.join("\n");
}

export function dataToContextMD(data: GraphData): string {
  const flat = flattenModules(data.modules);
  const total = flat.length;
  const completed = flat.filter((m) => m.status === "completed").length;
  const inProgress = flat.filter((m) => m.status === "in_progress").length;
  const todo = flat.filter((m) => m.status === "todo").length;

  const sorted = topologicalSort(data.modules, data.edges);
  const snl = generateSNL(data);

  return `# graphMCP - Project Status

> Auto-generated from graph_logic.json. Last synced at runtime.

## Progress Overview
| Status | Count |
|--------|-------|
| Completed | ${completed} |
| In Progress | ${inProgress} |
| Todo | ${todo} |
| **Total** | **${total}** |

## Module Pipeline (Topological Order)
${sorted.map((m, i) => {
  const icon = m.status === "completed" ? "✅" : m.status === "in_progress" ? "🔄" : "⬜";
  return `${i + 1}. ${icon} \`${m.id}\` [${m.type}] ${m.label}`;
}).join("\n")}

## Structured Natural Language (SNL)
\`\`\`
${snl}
\`\`\`

## Edges
${data.edges.map((e) => `- ${e.source} → ${e.target}`).join("\n")}
`;
}
