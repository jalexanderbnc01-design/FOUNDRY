import React from "react";
import { ToolType, BooleanOperation } from "../types";
import {
  MousePointer,
  Compass,
  PenTool,
  Minus,
  Square,
  Circle,
  Star,
  Combine,
  Scissors,
  Layers,
  Sparkles,
  X,
  Split,
} from "lucide-react";

interface VectorToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  fillColor: string | null;
  setFillColor: (color: string | null) => void;
  strokeColor: string;
  setStrokeColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  strokeCap: "round" | "butt" | "square";
  setStrokeCap: (cap: "round" | "butt" | "square") => void;
  strokeJoin: "round" | "miter" | "bevel";
  setStrokeJoin: (join: "round" | "miter" | "bevel") => void;
  onBooleanOp?: (op: BooleanOperation) => void;
  onConvertToPath?: () => void;
  canConvertToPath?: boolean;
  canPerformBoolean?: boolean;
  onClose?: () => void;
  isDarkMode?: boolean;
}

const PALETTE = [
  "#0f172a", // Obsidian
  "#3b82f6", // Blue
  "#10b981", // Green
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#ffffff", // White
];

export const VectorToolbar: React.FC<VectorToolbarProps> = ({
  activeTool,
  setActiveTool,
  fillColor,
  setFillColor,
  strokeColor,
  setStrokeColor,
  strokeWidth,
  setStrokeWidth,
  strokeCap,
  setStrokeCap,
  strokeJoin,
  setStrokeJoin,
  onBooleanOp,
  onConvertToPath,
  canConvertToPath = false,
  canPerformBoolean = false,
  onClose,
  isDarkMode = false,
}) => {
  return (
    <div
      id="vector-mode-toolbar"
      className={`fixed left-20 top-1/2 -translate-y-1/2 z-40 w-72 p-3.5 backdrop-blur-xl rounded-2xl border shadow-2xl transition-all duration-200 animate-in fade-in slide-in-from-left-4 ${
        isDarkMode
          ? "bg-slate-900/95 border-slate-800 text-slate-100 shadow-[0_16px_40px_rgba(0,0,0,0.6)]"
          : "bg-white/95 border-slate-200 text-slate-800 shadow-[0_16px_36px_rgba(0,0,0,0.12)]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <PenTool size={15} className="text-purple-500" />
          <span className="text-xs font-bold uppercase tracking-wider">Vector Mode</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Vector Sub-tools */}
      <div className="grid grid-cols-7 gap-1 p-1 mb-3 rounded-xl bg-slate-100 dark:bg-slate-800/80">
        <button
          onClick={() => setActiveTool("select")}
          className={`flex items-center justify-center p-2 rounded-lg text-xs font-medium transition-all ${
            activeTool === "select"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          title="Select / Move Object (V)"
        >
          <MousePointer size={15} />
        </button>

        <button
          onClick={() => setActiveTool("vector-node")}
          className={`flex items-center justify-center p-2 rounded-lg text-xs font-medium transition-all ${
            activeTool === "vector-node"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          title="Node Select & Bezier Edit (A)"
        >
          <Compass size={15} />
        </button>

        <button
          onClick={() => setActiveTool("vector-pen")}
          className={`flex items-center justify-center p-2 rounded-lg text-xs font-medium transition-all ${
            activeTool === "vector-pen"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          title="Pen / Bezier Tool (P)"
        >
          <PenTool size={15} />
        </button>

        <button
          onClick={() => setActiveTool("vector-line")}
          className={`flex items-center justify-center p-2 rounded-lg text-xs font-medium transition-all ${
            activeTool === "vector-line"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          title="Line Tool"
        >
          <Minus size={15} />
        </button>

        <button
          onClick={() => setActiveTool("vector-rect")}
          className={`flex items-center justify-center p-2 rounded-lg text-xs font-medium transition-all ${
            activeTool === "vector-rect"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          title="Rectangle"
        >
          <Square size={15} />
        </button>

        <button
          onClick={() => setActiveTool("vector-ellipse")}
          className={`flex items-center justify-center p-2 rounded-lg text-xs font-medium transition-all ${
            activeTool === "vector-ellipse"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          title="Ellipse"
        >
          <Circle size={15} />
        </button>

        <button
          onClick={() => setActiveTool("vector-star")}
          className={`flex items-center justify-center p-2 rounded-lg text-xs font-medium transition-all ${
            activeTool === "vector-star"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          title="Star"
        >
          <Star size={15} />
        </button>
      </div>

      {/* Fill Color */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
          <span>Fill</span>
          <button
            onClick={() => setFillColor(fillColor ? null : "#3b82f6")}
            className="text-[10px] text-blue-500 hover:underline"
          >
            {fillColor ? "Clear (None)" : "Set Color"}
          </button>
        </div>
        <div className="flex items-center justify-between gap-1">
          <button
            onClick={() => setFillColor(null)}
            className={`w-6 h-6 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center relative overflow-hidden ${
              fillColor === null ? "ring-2 ring-purple-500 ring-offset-1 dark:ring-offset-slate-900" : ""
            }`}
            title="Transparent"
          >
            <div className="w-full h-0.5 bg-red-500 rotate-45" />
          </button>
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setFillColor(c)}
              className={`w-6 h-6 rounded-full transition-transform border ${
                fillColor === c ? "scale-115 ring-2 ring-purple-500 ring-offset-1 dark:ring-offset-slate-900" : "hover:scale-105"
              } ${c === "#ffffff" ? "border-slate-300 dark:border-slate-600" : "border-transparent"}`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* Stroke Color */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
          <span>Stroke</span>
          <div className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: strokeColor }} />
        </div>
        <div className="flex items-center justify-between gap-1">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setStrokeColor(c)}
              className={`w-6 h-6 rounded-full transition-transform border ${
                strokeColor === c ? "scale-115 ring-2 ring-purple-500 ring-offset-1 dark:ring-offset-slate-900" : "hover:scale-105"
              } ${c === "#ffffff" ? "border-slate-300 dark:border-slate-600" : "border-transparent"}`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* Stroke Width Slider */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
          <span>Stroke Width</span>
          <span className="font-mono text-[10px]">{strokeWidth}px</span>
        </div>
        <input
          type="range"
          min="1"
          max="20"
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
        />
      </div>

      {/* Join & Cap Selectors */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Cap</span>
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-[10px]">
            {(["round", "butt", "square"] as const).map((cap) => (
              <button
                key={cap}
                onClick={() => setStrokeCap(cap)}
                className={`flex-1 py-1 rounded capitalize ${
                  strokeCap === cap ? "bg-white dark:bg-slate-700 font-semibold shadow-xs" : "text-slate-500"
                }`}
              >
                {cap}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Join</span>
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-[10px]">
            {(["round", "miter", "bevel"] as const).map((join) => (
              <button
                key={join}
                onClick={() => setStrokeJoin(join)}
                className={`flex-1 py-1 rounded capitalize ${
                  strokeJoin === join ? "bg-white dark:bg-slate-700 font-semibold shadow-xs" : "text-slate-500"
                }`}
              >
                {join}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Boolean Operations (Union, Subtract, Intersect, Exclude) */}
      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
          Boolean Tools
        </span>
        <div className="grid grid-cols-4 gap-1">
          <button
            onClick={() => onBooleanOp && onBooleanOp("union")}
            className="flex flex-col items-center justify-center p-1.5 rounded-lg text-[10px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Union: Combine shapes into one"
          >
            <Combine size={14} className="text-purple-500 mb-0.5" />
            <span>Union</span>
          </button>

          <button
            onClick={() => onBooleanOp && onBooleanOp("subtract")}
            className="flex flex-col items-center justify-center p-1.5 rounded-lg text-[10px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Subtract: Cut top shape from bottom"
          >
            <Scissors size={14} className="text-rose-500 mb-0.5" />
            <span>Subtract</span>
          </button>

          <button
            onClick={() => onBooleanOp && onBooleanOp("intersect")}
            className="flex flex-col items-center justify-center p-1.5 rounded-lg text-[10px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Intersect: Keep overlapping area"
          >
            <Layers size={14} className="text-blue-500 mb-0.5" />
            <span>Intersect</span>
          </button>

          <button
            onClick={() => onBooleanOp && onBooleanOp("exclude")}
            className="flex flex-col items-center justify-center p-1.5 rounded-lg text-[10px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Exclude: XOR overlap region"
          >
            <Split size={14} className="text-amber-500 mb-0.5" />
            <span>Exclude</span>
          </button>
        </div>
      </div>

      {/* Convert to Path Button */}
      {canConvertToPath && onConvertToPath && (
        <button
          onClick={onConvertToPath}
          className="w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-semibold transition-all shadow-xs"
        >
          <Sparkles size={14} />
          <span>Convert Selected to Vector Path</span>
        </button>
      )}
    </div>
  );
};
