import { useEffect, useRef } from "react";
import { GraphNodeData } from "./GraphNode";

const NODE_TYPES: GraphNodeData["nodeType"][] = [
  "workflow",
  "structure",
  "action",
  "condition",
  "module",
  "variable",
];

interface NodeCreationMenuProps {
  x: number;
  y: number;
  visible: boolean;
  onSelect: (type: GraphNodeData["nodeType"]) => void;
  onClose: () => void;
}

export default function NodeCreationMenu({ x, y, visible, onSelect, onClose }: NodeCreationMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    setTimeout(() => {
      document.addEventListener("click", handleClick);
      document.addEventListener("keydown", handleKey);
    }, 0);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[130px]"
      style={{ left: x, top: y }}
    >
      {NODE_TYPES.map((t) => (
        <button
          key={t}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 transition"
          onClick={() => onSelect(t)}
        >
          + {t}
        </button>
      ))}
    </div>
  );
}
