import React, { useState, useEffect, useRef } from "react";
import { BoardElement, Viewport } from "../types";
import {
  Search,
  X,
  Square,
  Layout,
  Code2,
  Compass,
  PenTool,
  MessageSquare,
  FileText,
  Type,
  ArrowUpRight,
  Circle,
  ArrowRight,
} from "lucide-react";

interface BoardSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  elements: BoardElement[];
  setViewport: React.Dispatch<React.SetStateAction<Viewport>>;
  setSelectedIds: (ids: string[]) => void;
  isDarkMode?: boolean;
}

export const BoardSearchModal: React.FC<BoardSearchModalProps> = ({
  isOpen,
  onClose,
  elements,
  setViewport,
  setSelectedIds,
  isDarkMode = false,
}) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const results = elements
    .filter((el) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        (el.title && el.title.toLowerCase().includes(q)) ||
        (el.content && el.content.toLowerCase().includes(q)) ||
        (el.fileName && el.fileName.toLowerCase().includes(q)) ||
        (el.sourceName && el.sourceName.toLowerCase().includes(q)) ||
        (el.commentAuthor && el.commentAuthor.toLowerCase().includes(q)) ||
        el.type.toLowerCase().includes(q)
      );
    })
    .slice(0, 15);

  const handleSelect = (el: BoardElement) => {
    setSelectedIds([el.id]);
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    setViewport((prev) => ({
      ...prev,
      x: cx - (el.x + el.width / 2) * prev.zoom,
      y: cy - (el.y + el.height / 2) * prev.zoom,
    }));
    onClose();
  };

  const getItemIcon = (el: BoardElement) => {
    switch (el.type) {
      case "frame":
        return <Layout size={16} className="text-amber-500" />;
      case "sticky":
        return <Square size={16} className="text-yellow-500" />;
      case "shape":
        return <Circle size={16} className="text-blue-500" />;
      case "html":
        return <Code2 size={16} className="text-indigo-500" />;
      case "draw":
      case "freehand":
        return <PenTool size={16} className="text-emerald-500" />;
      case "vectorPath":
        return <Compass size={16} className="text-purple-500" />;
      case "comment":
        return <MessageSquare size={16} className="text-pink-500" />;
      case "file":
        return <FileText size={16} className="text-blue-500" />;
      case "text":
        return <Type size={16} className="text-slate-500" />;
      case "connector":
        return <ArrowUpRight size={16} className="text-slate-400" />;
      default:
        return <Square size={16} className="text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-24 bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
      <div
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col transition-all ${
          isDarkMode
            ? "bg-slate-900 border-slate-700 text-slate-100 shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
            : "bg-white border-slate-200 text-slate-900 shadow-2xl"
        }`}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800 gap-3">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && results.length > 0) handleSelect(results[0]);
            }}
            placeholder="Search notes, frames, HTML cards, text, drawings..."
            className="w-full bg-transparent text-sm font-medium outline-hidden"
          />
          <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
            ESC
          </kbd>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 p-1">
          {results.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No matching whiteboard elements found.
            </div>
          ) : (
            results.map((el) => (
              <div
                key={el.id}
                onClick={() => handleSelect(el)}
                className="p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                    {getItemIcon(el)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold truncate group-hover:text-blue-500 transition-colors">
                      {el.title || el.content || `${el.type.toUpperCase()} object`}
                    </h4>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      Type: <span className="font-semibold capitalize">{el.type}</span> • Position: ({Math.round(el.x)}, {Math.round(el.y)})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 text-xs font-semibold">
                  <span>Jump</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
