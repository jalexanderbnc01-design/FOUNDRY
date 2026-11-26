import React from "react";
import { X, History, Clock, ArrowLeft, RotateCcw, User, Layers } from "lucide-react";
import { ActivityLogItem } from "../types";

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: ActivityLogItem[];
  onUndoMyAction?: () => void;
  onUndoBoardAction?: () => void;
  isDarkMode?: boolean;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onUndoMyAction,
  onUndoBoardAction,
  isDarkMode = false,
}) => {
  if (!isOpen) return null;

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div className="fixed inset-y-0 right-0 z-[200] w-80 max-w-[90vw] shadow-2xl flex flex-col border-l transition-all animate-in slide-in-from-right duration-200">
      <div
        className={`w-full h-full flex flex-col ${
          isDarkMode
            ? "bg-slate-900 border-slate-700 text-slate-100"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Drawer Header */}
        <div
          className={`flex items-center justify-between px-4 py-3.5 border-b shrink-0 ${
            isDarkMode ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-2">
            <History size={16} className="text-blue-500" />
            <span className="text-xs font-bold">Board History & Activity</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Undo Quick Controls */}
        <div
          className={`px-4 py-2.5 border-b flex items-center justify-between gap-2 shrink-0 ${
            isDarkMode ? "border-slate-800 bg-slate-950/40" : "border-slate-100 bg-slate-50/50"
          }`}
        >
          <button
            onClick={onUndoMyAction}
            className="flex-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 dark:border-slate-700 border-slate-200"
          >
            <RotateCcw size={12} />
            <span>Undo Mine</span>
          </button>
          <button
            onClick={onUndoBoardAction}
            className="flex-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 dark:border-slate-700 border-slate-200"
          >
            <History size={12} />
            <span>Undo Board</span>
          </button>
        </div>

        {/* Chronological Activity List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-center text-slate-400 text-xs">
              <Clock size={24} className="mb-2 opacity-40" />
              <span>No activity recorded yet</span>
            </div>
          ) : (
            history
              .slice()
              .reverse()
              .map((item) => (
                <div
                  key={item.id}
                  className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
                    isDarkMode
                      ? "bg-slate-950/40 border-slate-800/80 hover:border-slate-700"
                      : "bg-slate-50/80 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white shadow-2xs mt-0.5"
                    style={{ backgroundColor: item.userColor || "#3b82f6" }}
                  >
                    {(item.userName || "U").charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-bold text-[11px] truncate">{item.userName}</span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {formatTime(item.timestamp)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug break-words">
                      {item.action}
                    </p>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};
