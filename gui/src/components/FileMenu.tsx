import { useState, useEffect, useRef, useCallback } from "react";

interface FileMenuProps {
  currentFile: string;
  onLoadFile: (filename: string) => void;
  onSaveAs: (filename: string) => void;
  onNewFile: () => void;
  onDownload: () => void;
}

export default function FileMenu({ currentFile, onLoadFile, onSaveAs, onNewFile, onDownload }: FileMenuProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [saveInput, setSaveInput] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/files")
      .then((r) => r.json())
      .then((d) => setFiles(d.files || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch("/api/files")
      .then((r) => r.json())
      .then((d) => setFiles(d.files || []))
      .catch(() => {});
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowSaveInput(false);
      }
    };
    setTimeout(() => document.addEventListener("click", h), 0);
    return () => document.removeEventListener("click", h);
  }, [open]);

  const handleSaveAs = useCallback(() => {
    const name = saveInput.trim();
    if (!name) return;
    const filename = name.endsWith(".json") ? name : `${name}.json`;
    onSaveAs(filename);
    setSaveInput("");
    setShowSaveInput(false);
    setOpen(false);
  }, [saveInput, onSaveAs]);

  const handleFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      e.target.value = "";
      fetch("/api/graph/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, filename: file.name }),
      })
        .then((r) => r.json())
        .then(() => {
          onLoadFile(file.name);
          setOpen(false);
        })
        .catch(console.error);
    };
    reader.onerror = () => {
      e.target.value = "";
      console.error("Failed to read file");
    };
    reader.readAsText(file);
  }, [onLoadFile]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs px-3 py-1 rounded bg-gray-50 text-gray-600 hover:bg-gray-100 transition font-medium"
      >
        File
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFilePick}
      />

      {open && (
        <div
          className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px] z-50"
        >
          <div className="px-3 py-1 text-[10px] text-gray-400 uppercase border-b border-gray-100">
            Open
          </div>
          {files.map((f) => (
            <button
              key={f}
              className={cn(
                "w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 transition",
                f === currentFile ? "text-blue-600 font-medium bg-blue-50" : "text-gray-700"
              )}
              onClick={() => {
                onLoadFile(f);
                setOpen(false);
              }}
            >
              {f === currentFile ? "▸ " : "  "}{f}
            </button>
          ))}
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 transition border-t border-gray-100"
            onClick={() => { fileInputRef.current?.click(); }}
          >
            Open from disk...
          </button>
          {files.length === 0 && (
            <div className="px-3 py-1.5 text-[11px] text-gray-400">No .json files found</div>
          )}

          <div className="border-t border-gray-100 mt-1 pt-1">
            <div className="px-3 py-1 text-[10px] text-gray-400 uppercase">Save</div>

            {showSaveInput ? (
              <div className="px-3 py-1 flex items-center gap-1">
                <input
                  autoFocus
                  value={saveInput}
                  onChange={(e) => setSaveInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveAs();
                    if (e.key === "Escape") { setShowSaveInput(false); setSaveInput(""); }
                  }}
                  placeholder="filename..."
                  className="flex-1 text-[11px] border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-blue-300"
                />
                <span className="text-[10px] text-gray-400">.json</span>
              </div>
            ) : (
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 transition"
                onClick={() => { setShowSaveInput(true); setSaveInput(""); }}
              >
                Save As...
              </button>
            )}

            <button
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 transition"
              onClick={() => { onNewFile(); setOpen(false); }}
            >
              New
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 transition"
              onClick={() => { onDownload(); setOpen(false); }}
            >
              Download .json
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
