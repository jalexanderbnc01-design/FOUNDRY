import React, { useState } from "react";
import {
  Download,
  X,
  FileImage,
  FileCode,
  FileJson,
  Check,
  Maximize,
  Crop,
  Layers,
  Sparkles,
  Sliders,
} from "lucide-react";
import { BoardElement, Viewport, ExportOptions } from "../types";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  elements: BoardElement[];
  selectedIds: string[];
  viewport: Viewport;
  onExport: (options: ExportOptions) => void;
  boardTitle: string;
  isDarkMode?: boolean;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  elements,
  selectedIds,
  viewport,
  onExport,
  boardTitle,
  isDarkMode = false,
}) => {
  const [format, setFormat] = useState<"png" | "svg" | "json">("png");
  const [scale, setScale] = useState<1 | 2 | 3>(2);
  const [scope, setScope] = useState<"all" | "viewport" | "selected">(
    selectedIds.length > 0 ? "selected" : "all"
  );
  const [transparentBg, setTransparentBg] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const selectedCount = selectedIds.length;
  const totalCount = elements.length;

  const handleTriggerExport = () => {
    setIsExporting(true);
    try {
      onExport({
        format,
        scale,
        scope,
        transparentBg,
      });
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 300);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-lg rounded-3xl p-6 shadow-2xl border transition-all ${
          isDarkMode
            ? "bg-slate-900 border-slate-800 text-slate-100"
            : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 dark:bg-blue-500/20">
              <Download size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Export Board</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Download {boardTitle || "your whiteboard"} in high quality
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {/* Format Selection */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5 block">
              File Format
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setFormat("png")}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  format === "png"
                    ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <FileImage size={20} />
                  {format === "png" && <Check size={16} />}
                </div>
                <div className="mt-3">
                  <div className="text-xs font-bold">PNG Image</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Raster graphic</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat("svg")}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  format === "svg"
                    ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <FileCode size={20} />
                  {format === "svg" && <Check size={16} />}
                </div>
                <div className="mt-3">
                  <div className="text-xs font-bold">SVG Vector</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Crisp scalable paths</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat("json")}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  format === "json"
                    ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <FileJson size={20} />
                  {format === "json" && <Check size={16} />}
                </div>
                <div className="mt-3">
                  <div className="text-xs font-bold">Board JSON</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Full backup file</div>
                </div>
              </button>
            </div>
          </div>

          {/* Scope Selection */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5 block">
              Export Scope
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setScope("all")}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  scope === "all"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-sm"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <Layers size={14} />
                <span>Entire Board ({totalCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setScope("viewport")}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  scope === "viewport"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-sm"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <Maximize size={14} />
                <span>View Area</span>
              </button>

              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => setScope("selected")}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  selectedCount === 0 ? "opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-800 text-slate-400" : ""
                } ${
                  scope === "selected"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-sm"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <Crop size={14} />
                <span>Selected ({selectedCount})</span>
              </button>
            </div>
          </div>

          {/* Resolution Scale (for PNG) */}
          {format === "png" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Resolution Scale
                </label>
                <span className="text-[11px] font-medium text-blue-500">
                  {scale === 1 ? "Standard (1x)" : scale === 2 ? "Retina HD (2x)" : "Ultra-HD 4K (3x)"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScale(s as 1 | 2 | 3)}
                    className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      scale === s
                        ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Transparent Background Toggle */}
          {format !== "json" && (
            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 cursor-pointer select-none">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Transparent Background
              </span>
              <input
                type="checkbox"
                checked={transparentBg}
                onChange={(e) => setTransparentBg(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </label>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={handleTriggerExport}
            className="px-5 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Download size={15} />
            <span>{isExporting ? "Generating..." : `Export ${format.toUpperCase()}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
