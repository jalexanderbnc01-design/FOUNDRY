import React from "react";
import { BrushType } from "../types";
import {
  Pen,
  Pencil,
  Highlighter,
  Eraser,
  Sparkles,
  Sliders,
  Paintbrush,
  X,
} from "lucide-react";

interface DrawingToolbarProps {
  brush: BrushType;
  setBrush: (brush: BrushType) => void;
  size: number;
  setSize: (size: number) => void;
  opacity: number;
  setOpacity: (opacity: number) => void;
  smooth: number;
  setSmooth: (smooth: number) => void;
  color: string;
  setColor: (color: string) => void;
  pressure: boolean;
  setPressure: (val: boolean | ((prev: boolean) => boolean)) => void;
  stabilize: boolean;
  setStabilize: (val: boolean | ((prev: boolean) => boolean)) => void;
  onClose?: () => void;
  isDarkMode?: boolean;
}

const BRUSH_COLORS = [
  "#0f172a", // Obsidian black
  "#ef4444", // Crimson red
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#0ea5e9", // Sky blue
  "#6366f1", // Indigo
  "#ec4899", // Magenta
  "#ffffff", // White
];

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  brush,
  setBrush,
  size,
  setSize,
  opacity,
  setOpacity,
  smooth,
  setSmooth,
  color,
  setColor,
  pressure,
  setPressure,
  stabilize,
  setStabilize,
  onClose,
  isDarkMode = false,
}) => {
  return (
    <div
      id="drawing-mode-toolbar"
      className={`fixed left-20 top-1/2 -translate-y-1/2 z-40 w-64 p-3.5 backdrop-blur-xl rounded-2xl border shadow-2xl transition-all duration-200 animate-in fade-in slide-in-from-left-4 ${
        isDarkMode
          ? "bg-slate-900/95 border-slate-800 text-slate-100 shadow-[0_16px_40px_rgba(0,0,0,0.6)]"
          : "bg-white/95 border-slate-200 text-slate-800 shadow-[0_16px_36px_rgba(0,0,0,0.12)]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <Paintbrush size={15} className="text-blue-500" />
          <span className="text-xs font-bold uppercase tracking-wider">Drawing Mode</span>
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

      {/* Brush Type Selector */}
      <div className="grid grid-cols-5 gap-1 p-1 mb-3 rounded-xl bg-slate-100 dark:bg-slate-800/80">
        <button
          onClick={() => setBrush("pen")}
          className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-xs font-medium transition-all ${
            brush === "pen"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          title="Pen (Smooth, fast ink)"
        >
          <Pen size={15} />
          <span className="text-[10px] mt-0.5">Pen</span>
        </button>

        <button
          onClick={() => setBrush("pencil")}
          className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-xs font-medium transition-all ${
            brush === "pencil"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          title="Pencil (Textured, light sketching)"
        >
          <Pencil size={15} />
          <span className="text-[10px] mt-0.5">Pencil</span>
        </button>

        <button
          onClick={() => setBrush("marker")}
          className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-xs font-medium transition-all ${
            brush === "marker"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          title="Marker (Bold round lines)"
        >
          <div className="w-3.5 h-3.5 rounded-full bg-current flex items-center justify-center" />
          <span className="text-[10px] mt-0.5">Marker</span>
        </button>

        <button
          onClick={() => setBrush("highlighter")}
          className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-xs font-medium transition-all ${
            brush === "highlighter"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          title="Highlighter (Semi-transparent accent wash)"
        >
          <Highlighter size={15} />
          <span className="text-[10px] mt-0.5">Highlight</span>
        </button>

        <button
          onClick={() => setBrush("eraser")}
          className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-xs font-medium transition-all ${
            brush === "eraser"
              ? "bg-rose-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          title="Eraser (Erase full stroke on touch)"
        >
          <Eraser size={15} />
          <span className="text-[10px] mt-0.5">Eraser</span>
        </button>
      </div>

      {/* Color Palette (disabled if eraser) */}
      {brush !== "eraser" && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            <span>Ink Color</span>
            <div className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: color }} />
          </div>
          <div className="flex items-center justify-between gap-1">
            {BRUSH_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition-transform border ${
                  color === c ? "scale-115 ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-900" : "hover:scale-105"
                } ${c === "#ffffff" ? "border-slate-300 dark:border-slate-600" : "border-transparent"}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>
      )}

      {/* Size Slider */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
          <span>Brush Size</span>
          <span className="font-mono text-[10px]">{size}px</span>
        </div>
        <input
          type="range"
          min="1"
          max="40"
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      {/* Opacity Slider (if not eraser) */}
      {brush !== "eraser" && (
        <div className="mb-2.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <span>Opacity</span>
            <span className="font-mono text-[10px]">{Math.round(opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>
      )}

      {/* Smoothing Slider */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
          <span>Stroke Smoothing</span>
          <span className="font-mono text-[10px]">{smooth.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="6.0"
          step="0.5"
          value={smooth}
          onChange={(e) => setSmooth(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      {/* Toggles: Pressure & Stabilizer */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
        <button
          onClick={() => setPressure((prev) => !prev)}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-[11px] font-medium transition-all ${
            pressure
              ? "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
              : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          title="Toggle stylus pressure sensitivity"
        >
          <Sparkles size={12} />
          <span>Pressure {pressure ? "✓" : "off"}</span>
        </button>

        <button
          onClick={() => setStabilize((prev) => !prev)}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-[11px] font-medium transition-all ${
            stabilize
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
              : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          title="Toggle line stabilizer (trailing smooth cursor)"
        >
          <Sliders size={12} />
          <span>Stabilizer {stabilize ? "✓" : "off"}</span>
        </button>
      </div>
    </div>
  );
};
