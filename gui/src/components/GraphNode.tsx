import { memo, useState, useCallback } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { cn } from "../utils/cn";

const STATUS_COLORS: Record<string, string> = {
  todo: "border-red-400",
  in_progress: "border-yellow-400",
  completed: "border-green-400",
};

const TYPE_COLORS: Record<string, string> = {
  module: "bg-blue-500",
  action: "bg-teal-500",
  condition: "bg-orange-500",
  variable: "bg-purple-500",
  workflow: "bg-cyan-500",
  structure: "bg-indigo-500",
};

const OPERATOR_OPTIONS = [
  "==", "!=", "===", "!==", ">", "<", ">=", "<=",
  "isNull", "isNotNull", "isEmpty", "isNotEmpty",
  "contains", "startsWith", "endsWith", "matches",
] as const;

type Operator = typeof OPERATOR_OPTIONS[number];

const UNARY_OPERATORS: Operator[] = ["isNull", "isNotNull", "isEmpty", "isNotEmpty"];

export interface GraphNodeData {
  label: string;
  status: "todo" | "in_progress" | "completed";
  nodeType: "module" | "action" | "condition" | "variable" | "workflow" | "structure";
  direction?: "vertical" | "horizontal";
  // Variable
  varType?: "string" | "number" | "enum" | "array" | "map";
  varValue?: string;
  enumValues?: string;
  // Boolean
  trueLabel?: string;
  falseLabel?: string;
  // Logic
  inputVars?: string;
  conditionExpr?: string;
  // Condition
  leftOperand?: string;
  operator?: Operator;
  rightOperand?: string;
  // Handlers
  onDelete?: (id: string) => void;
  onLabelChange?: (id: string, label: string) => void;
  onDataChange?: (id: string, data: Partial<GraphNodeData>) => void;
}

const VAR_TYPE_OPTIONS = ["string", "number", "enum", "array", "map"] as const;

function GraphNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as GraphNodeData;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nodeData.label);

  const handleDoubleClick = useCallback(() => {
    setDraft(nodeData.label);
    setEditing(true);
  }, [nodeData.label]);

  const commitLabel = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== nodeData.label) {
      nodeData.onLabelChange?.(id, trimmed);
    }
  }, [draft, nodeData, id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") commitLabel();
      if (e.key === "Escape") {
        setDraft(nodeData.label);
        setEditing(false);
      }
    },
    [commitLabel, nodeData.label]
  );

  const isHorizontal = nodeData.direction === "horizontal";
  const statusBorder = STATUS_COLORS[nodeData.status] || "border-gray-400";
  const typeBadge = TYPE_COLORS[nodeData.nodeType] || "bg-gray-500";
  const isVariable = nodeData.nodeType === "variable";
  const isCondition = nodeData.nodeType === "condition";
  const hasDualOutput = isCondition;
  const currentOp = nodeData.operator || "==";
  const isUnary = UNARY_OPERATORS.includes(currentOp);

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 bg-white shadow-md transition-shadow",
        isHorizontal ? "min-h-[120px]" : "min-w-[180px]",
        statusBorder,
        selected ? "shadow-lg ring-2 ring-blue-300" : ""
      )}
    >
      <Handle
        type="target"
        position={isHorizontal ? Position.Left : Position.Top}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />

      <div className="flex items-center gap-1 px-3 pt-2">
        <span
          className={cn(
            "inline-block w-2 h-2 rounded-full flex-shrink-0",
            typeBadge
          )}
        />
        <span className="text-[10px] uppercase tracking-wider text-gray-400">
          {nodeData.nodeType}
        </span>
      </div>

      {/* Label */}
      <div className="px-3 pb-1">
        {editing ? (
          <input
            autoFocus
            className="w-full text-sm font-medium text-gray-800 bg-gray-100 rounded px-1 py-0.5 outline-none border border-blue-300"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <div
            className="text-sm font-medium text-gray-800 cursor-text py-0.5 min-h-[20px] break-words"
            onDoubleClick={handleDoubleClick}
          >
            {nodeData.label}
          </div>
        )}
      </div>

      {/* Variable node: type + value */}
      {isVariable && (
        <div className="px-3 pb-2 space-y-1.5">
          <select
            value={nodeData.varType || "string"}
            onChange={(e) =>
              nodeData.onDataChange?.(id, { varType: e.target.value as GraphNodeData["varType"] })
            }
            className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-0.5 outline-none bg-gray-50"
            onClick={(e) => e.stopPropagation()}
          >
            {VAR_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {nodeData.varType === "enum" && (
            <input
              value={nodeData.enumValues || ""}
              onChange={(e) =>
                nodeData.onDataChange?.(id, { enumValues: e.target.value })
              }
              placeholder="options (A, B, C)..."
              className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-blue-300"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <input
            value={nodeData.varValue || ""}
            onChange={(e) =>
              nodeData.onDataChange?.(id, { varValue: e.target.value })
            }
            placeholder={nodeData.varType === "array" ? "[\"a\", \"b\"]" : nodeData.varType === "map" ? "{\"key\": \"val\"}" : "value..."}
            className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-blue-300"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Condition node: left operand + operator + right operand */}
      {isCondition && (
        <div className="px-3 pb-2 space-y-1.5">
          <input
            value={nodeData.leftOperand || ""}
            onChange={(e) =>
              nodeData.onDataChange?.(id, { leftOperand: e.target.value })
            }
            placeholder="left operand..."
            className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-blue-300 font-mono"
            onClick={(e) => e.stopPropagation()}
          />
          <select
            value={currentOp}
            onChange={(e) =>
              nodeData.onDataChange?.(id, { operator: e.target.value as Operator })
            }
            className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-0.5 outline-none bg-gray-50"
            onClick={(e) => e.stopPropagation()}
          >
            {OPERATOR_OPTIONS.map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
          {!isUnary && (
            <input
              value={nodeData.rightOperand || ""}
              onChange={(e) =>
                nodeData.onDataChange?.(id, { rightOperand: e.target.value })
              }
              placeholder="right operand..."
              className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-blue-300 font-mono"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          nodeData.onDelete?.(id);
        }}
        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] leading-none flex items-center justify-center opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity"
        style={{ opacity: selected ? 1 : undefined }}
      >
        ×
      </button>

      {/* Dual output: condition node (false=left/top, true=right/bottom) */}
      {hasDualOutput && (
        <>
          <Handle
            id="false"
            type="source"
            position={isHorizontal ? Position.Top : Position.Left}
            className="!w-3 !h-3 !bg-red-400 !border-2 !border-white"
          />
          <span
            className={cn(
              "absolute text-[9px] text-gray-500",
              isHorizontal ? "top-0 left-2" : "-left-1 top-3"
            )}
          >
            false
          </span>
          <Handle
            id="true"
            type="source"
            position={isHorizontal ? Position.Bottom : Position.Right}
            className="!w-3 !h-3 !bg-green-400 !border-2 !border-white"
          />
          <span
            className={cn(
              "absolute text-[9px] text-gray-500",
              isHorizontal ? "bottom-0 right-2" : "-right-1 bottom-3"
            )}
          >
            true
          </span>
        </>
      )}

      {/* Non-dual: single source handle */}
      {!hasDualOutput && (
        <Handle
          type="source"
          position={isHorizontal ? Position.Right : Position.Bottom}
          className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
        />
      )}
    </div>
  );
}

export default memo(GraphNode);
