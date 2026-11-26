import React, { useState } from "react";
import { BoardElement, Viewport, ElementType } from "../types";
import { THEME, EARTH_STICKY_COLORS, EARTH_BRUSH_COLORS, EARTH_VECTOR_COLORS } from "../theme";
import {
  X,
  Layers,
  Sliders,
  Layout,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  BringToFront,
  SendToBack,
  ArrowUp,
  ArrowDown,
  RotateCw,
  Maximize2,
  Group,
  Ungroup,
  PenTool,
  Wand2,
  Compass,
  MessageSquare,
  FileText,
  Code2,
  Check,
  Search,
  Sparkles,
  Palette,
  Square,
  Circle,
  HelpCircle,
} from "lucide-react";

interface PropertiesPanelProps {
  selectedElements: BoardElement[];
  elements: BoardElement[];
  viewport: Viewport;
  setViewport: React.Dispatch<React.SetStateAction<Viewport>>;
  onUpdateElement: (id: string, partial: Partial<BoardElement>) => void;
  onBatchUpdateElements: (updated: BoardElement[]) => void;
  onDeleteElements: (ids: string[]) => void;
  onDuplicateElements: (elements: BoardElement[]) => void;
  onGroupElements?: () => void;
  onUngroupElements?: () => void;
  onConvertToVector?: (id: string) => void;
  onConvertToPath?: (id: string) => void;
  onEditNodes?: (id: string) => void;
  onRasterize?: (elements: BoardElement[]) => void;
  setSelectedIds: (ids: string[]) => void;
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  isPerspectiveActive?: boolean;
}

const COLOR_SWATCHES = [
  "#E7E2D8", // Warm off-white
  "#C7AE82", // Sand
  "#E5D28E", // Sand sticky
  "#A7C5C2", // Mist
  "#B2C9A5", // Light Sage
  "#7E9B78", // Sage
  "#60745A", // Moss
  "#557C7B", // Muted ocean
  "#B87557", // Clay
  "#D3A08D", // Clay rose
  "#C4934B", // Ochre
  "#A55445", // Brick
  "#39433F", // Stone gray
  "#192126", // Warm graphite
  "#0B1117", // Charcoal navy
];

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedElements,
  elements,
  viewport,
  setViewport,
  onUpdateElement,
  onBatchUpdateElements,
  onDeleteElements,
  onDuplicateElements,
  onGroupElements,
  onUngroupElements,
  onConvertToVector,
  onConvertToPath,
  onEditNodes,
  onRasterize,
  setSelectedIds,
  isOpen,
  onClose,
  isDarkMode = false,
  isPerspectiveActive = false,
}) => {
  const [activeTab, setActiveTab] = useState<"properties" | "layers" | "frames">(
    selectedElements.length > 0 ? "properties" : "layers"
  );
  const [layerSearch, setLayerSearch] = useState("");
  const [layerFilter, setLayerFilter] = useState<string>("all");

  if (!isOpen) return null;

  const primary = selectedElements[0];
  const isMulti = selectedElements.length > 1;

  // Jump canvas to an element
  const jumpToElement = (el: BoardElement) => {
    setSelectedIds([el.id]);
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    setViewport((prev) => ({
      ...prev,
      x: cx - (el.x + el.width / 2) * prev.zoom,
      y: cy - (el.y + el.height / 2) * prev.zoom,
    }));
  };

  // Filtered layers list
  const framesList = elements.filter((el) => el.type === "frame");
  const filteredLayers = elements
    .filter((el) => {
      if (layerFilter === "frames") return el.type === "frame";
      if (layerFilter === "notes") return el.type === "sticky" || el.type === "text";
      if (layerFilter === "drawing") return el.type === "draw" || el.type === "freehand";
      if (layerFilter === "vectors") return el.type === "vectorPath" || el.type === "shape";
      if (layerFilter === "html") return el.type === "html";
      if (layerFilter === "comments") return el.type === "comment";
      return true;
    })
    .filter((el) => {
      if (!layerSearch.trim()) return true;
      const query = layerSearch.toLowerCase();
      return (
        (el.title && el.title.toLowerCase().includes(query)) ||
        (el.content && el.content.toLowerCase().includes(query)) ||
        el.type.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));

  const getElementTypeLabel = (el: BoardElement) => {
    if (el.type === "sticky") return "Sticky Note";
    if (el.type === "shape") return `Shape (${el.shapeType || "rect"})`;
    if (el.type === "draw" || el.type === "freehand") return "Freehand Stroke";
    if (el.type === "vectorPath") return "Vector Path";
    if (el.type === "frame") return "Frame Container";
    if (el.type === "html") return "HTML Card";
    if (el.type === "comment") return "Comment Pin";
    if (el.type === "connector") return "Connector / Arrow";
    if (el.type === "text") return "Text Block";
    if (el.type === "image") return "Image Asset";
    return el.type.toUpperCase();
  };

  return (
    <aside
      id="right-properties-panel"
      className={`fixed right-4 top-18 bottom-16 w-80 backdrop-blur-md rounded-2xl border shadow-2xl z-40 flex flex-col overflow-hidden select-none transition-all duration-200 animate-in fade-in slide-in-from-right-4 ${
        isDarkMode
          ? "bg-[#121A1F]/95 border-[#39433F] text-[#E7E2D8] shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
          : "bg-[#F2EFE7]/95 border-[#C7AE82]/60 text-[#121A1F] shadow-[0_12px_36px_rgba(0,0,0,0.12)]"
      }`}
    >
      {/* Top Header & Tab Navigation */}
      <div className={`flex items-center justify-between px-3.5 py-2.5 border-b ${isDarkMode ? "border-[#39433F]" : "border-[#C7AE82]/40"}`}>
        <div className={`flex items-center gap-1 p-0.5 rounded-xl text-xs font-semibold ${isDarkMode ? "bg-[#192126]" : "bg-[#E6E0D2]"}`}>
          <button
            onClick={() => setActiveTab("properties")}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              activeTab === "properties"
                ? isDarkMode
                  ? "bg-[#39433F] text-[#E7E2D8] shadow-xs"
                  : "bg-white text-[#121A1F] shadow-xs font-bold"
                : isDarkMode
                  ? "text-[#9A9D93] hover:text-[#E7E2D8]"
                  : "text-[#62685F] hover:text-[#121A1F]"
            }`}
          >
            Properties
          </button>
          <button
            onClick={() => setActiveTab("layers")}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === "layers"
                ? isDarkMode
                  ? "bg-[#39433F] text-[#E7E2D8] shadow-xs"
                  : "bg-white text-[#121A1F] shadow-xs font-bold"
                : isDarkMode
                  ? "text-[#9A9D93] hover:text-[#E7E2D8]"
                  : "text-[#62685F] hover:text-[#121A1F]"
            }`}
          >
            <span>Layers</span>
            <span className="text-[10px] opacity-70">({elements.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("frames")}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === "frames"
                ? isDarkMode
                  ? "bg-[#39433F] text-[#E7E2D8] shadow-xs"
                  : "bg-white text-[#121A1F] shadow-xs font-bold"
                : isDarkMode
                  ? "text-[#9A9D93] hover:text-[#E7E2D8]"
                  : "text-[#62685F] hover:text-[#121A1F]"
            }`}
          >
            <span>Frames</span>
            <span className="text-[10px] opacity-70">({framesList.length})</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className={`p-1 rounded-lg transition-colors cursor-pointer ${
            isDarkMode
              ? "hover:bg-[#192126] text-[#9A9D93] hover:text-[#E7E2D8]"
              : "hover:bg-[#E6E0D2] text-[#62685F] hover:text-[#121A1F]"
          }`}
          title="Close panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Tab 1: Contextual Properties Panel */}
      {activeTab === "properties" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {selectedElements.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#9A9D93]">
              <Sliders size={32} className="stroke-[1.5] mb-2 opacity-50" />
              <p className="font-semibold text-[#E7E2D8]">No object selected</p>
              <p className="text-[11px] text-[#9A9D93] mt-1 max-w-[200px]">
                Click any note, shape, vector, drawing, or frame on the board to view and edit its properties.
              </p>
            </div>
          ) : (
            <>
              {/* Type Badge & Quick Actions */}
              <div className="flex items-center justify-between pb-2 border-b border-[#39433F]/50">
                <span className="px-2 py-0.5 rounded-md font-mono font-bold tracking-wide uppercase text-[10px] bg-[#557C7B]/20 text-[#557C7B] border border-[#557C7B]/40">
                  {isMulti ? `${selectedElements.length} OBJECTS SELECTED` : getElementTypeLabel(primary)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const allLocked = selectedElements.every((el) => el.locked);
                      onBatchUpdateElements(
                        selectedElements.map((el) => ({ ...el, locked: !allLocked }))
                      );
                    }}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      selectedElements.some((el) => el.locked)
                        ? "bg-[#C4934B]/20 text-[#C4934B]"
                        : "hover:bg-[#192126] text-[#9A9D93]"
                    }`}
                    title={selectedElements.some((el) => el.locked) ? "Unlock" : "Lock"}
                  >
                    {selectedElements.some((el) => el.locked) ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                  <button
                    onClick={() => onDuplicateElements(selectedElements)}
                    className="p-1.5 rounded-lg hover:bg-[#192126] text-[#9A9D93] hover:text-[#E7E2D8] transition-colors cursor-pointer"
                    title="Duplicate (Ctrl+D)"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => onDeleteElements(selectedElements.map((el) => el.id))}
                    className="p-1.5 rounded-lg hover:bg-[#A55445]/20 text-[#9A9D93] hover:text-[#A55445] transition-colors cursor-pointer"
                    title="Delete (Del)"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Freehand Stroke: Convert to Vector Action Button */}
              {!isMulti && (primary.type === "draw" || primary.type === "freehand") && onConvertToVector && (
                <div className="p-2.5 rounded-xl bg-[#7E9B78]/15 border border-[#7E9B78]/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Compass size={16} className="text-[#7E9B78]" />
                    <div>
                      <h4 className="font-bold text-[11px] text-[#E7E2D8]">Convert to Vector</h4>
                      <p className="text-[10px] text-[#7E9B78]">Make stroke editable with Bézier points</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onConvertToVector(primary.id)}
                    className="px-2.5 py-1 bg-[#7E9B78] hover:bg-[#60745A] text-[#0B1117] font-bold rounded-lg transition-colors cursor-pointer text-[11px] shadow-xs"
                  >
                    Convert
                  </button>
                </div>
              )}

              {/* Vector Shape: Edit Nodes & Convert to Path Action */}
              {!isMulti && primary.type === "shape" && onConvertToPath && (
                <div className="p-2.5 rounded-xl bg-[#557C7B]/15 border border-[#557C7B]/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PenTool size={16} className="text-[#557C7B]" />
                    <div>
                      <h4 className="font-bold text-[11px] text-[#E7E2D8]">Convert to Path</h4>
                      <p className="text-[10px] text-[#557C7B]">Unlock node-level vector editing</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onConvertToPath(primary.id)}
                    className="px-2.5 py-1 bg-[#557C7B] hover:bg-[#557C7B]/80 text-[#E7E2D8] font-bold rounded-lg transition-colors cursor-pointer text-[11px] shadow-xs"
                  >
                    Convert
                  </button>
                </div>
              )}

              {/* Vector Path: Edit Nodes Button */}
              {!isMulti && primary.type === "vectorPath" && onEditNodes && (
                <button
                  onClick={() => onEditNodes(primary.id)}
                  className="w-full py-1.5 px-3 rounded-xl bg-[#7E9B78] hover:bg-[#60745A] text-[#0B1117] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <PenTool size={14} />
                  <span>Edit Vector Nodes (A)</span>
                </button>
              )}

              {/* Geometry: Position & Size */}
              <div className="space-y-2">
                <span className="font-bold uppercase tracking-wider text-[10px] text-[#9A9D93]">Layout & Transform</span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5 bg-[#192126] px-2 py-1.5 rounded-lg border border-[#39433F]/40">
                    <span className="text-[#9A9D93] font-mono font-bold text-[10px]">X</span>
                    <input
                      type="number"
                      value={Math.round(primary.x)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        onUpdateElement(primary.id, { x: val });
                      }}
                      className="w-full bg-transparent font-mono outline-hidden text-right text-[#E7E2D8]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#192126] px-2 py-1.5 rounded-lg border border-[#39433F]/40">
                    <span className="text-[#9A9D93] font-mono font-bold text-[10px]">Y</span>
                    <input
                      type="number"
                      value={Math.round(primary.y)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        onUpdateElement(primary.id, { y: val });
                      }}
                      className="w-full bg-transparent font-mono outline-hidden text-right text-[#E7E2D8]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#192126] px-2 py-1.5 rounded-lg border border-[#39433F]/40">
                    <span className="text-[#9A9D93] font-mono font-bold text-[10px]">W</span>
                    <input
                      type="number"
                      value={Math.round(primary.width)}
                      onChange={(e) => {
                        const val = Math.max(10, parseFloat(e.target.value) || 10);
                        onUpdateElement(primary.id, { width: val });
                      }}
                      className="w-full bg-transparent font-mono outline-hidden text-right text-[#E7E2D8]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#192126] px-2 py-1.5 rounded-lg border border-[#39433F]/40">
                    <span className="text-[#9A9D93] font-mono font-bold text-[10px]">H</span>
                    <input
                      type="number"
                      value={Math.round(primary.height)}
                      onChange={(e) => {
                        const val = Math.max(10, parseFloat(e.target.value) || 10);
                        onUpdateElement(primary.id, { height: val });
                      }}
                      className="w-full bg-transparent font-mono outline-hidden text-right text-[#E7E2D8]"
                    />
                  </div>
                </div>

                {/* Rotation and Corner Radius */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="flex items-center gap-1.5 bg-[#192126] px-2 py-1.5 rounded-lg border border-[#39433F]/40">
                    <RotateCw size={12} className="text-[#9A9D93]" />
                    <input
                      type="number"
                      value={Math.round(primary.rotation || 0)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        onUpdateElement(primary.id, { rotation: val % 360 });
                      }}
                      className="w-full bg-transparent font-mono outline-hidden text-right text-[#E7E2D8]"
                    />
                    <span className="text-[#9A9D93] font-mono text-[10px]">°</span>
                  </div>

                  {/* Corner Radius for rect / shape */}
                  <div className="flex items-center gap-1.5 bg-[#192126] px-2 py-1.5 rounded-lg border border-[#39433F]/40">
                    <span className="text-[#9A9D93] font-mono text-[10px]">R</span>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={primary.cornerRadius ?? 8}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(60, parseFloat(e.target.value) || 0));
                        onUpdateElement(primary.id, { cornerRadius: val });
                      }}
                      className="w-full bg-transparent font-mono outline-hidden text-right text-[#E7E2D8]"
                    />
                    <span className="text-[#9A9D93] font-mono text-[10px]">px</span>
                  </div>
                </div>
              </div>

              {/* 3D Depth / Elevation (Z value) */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-[#9A9D93] flex items-center gap-1">
                    <span>3D Elevation (Z-Depth)</span>
                    {isPerspectiveActive && <span className="w-1.5 h-1.5 rounded-full bg-[#557C7B] animate-pulse" />}
                  </span>
                  <span className="font-mono text-[#9A9D93]">{(primary.depth ?? 0) * 28}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={4}
                  step={0.25}
                  value={primary.depth ?? 0}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    onBatchUpdateElements(selectedElements.map((el) => ({ ...el, depth: val })));
                  }}
                  className="w-full accent-[#557C7B] h-1.5 bg-[#192126] rounded-lg cursor-pointer"
                />
              </div>

              {/* Color & Fill */}
              {primary.type !== "connector" && primary.type !== "image" && (
                <div className="space-y-2 pt-1">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-[#9A9D93]">Fill Color</span>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_SWATCHES.map((color) => {
                      const currentFill = primary.fillColor || primary.color;
                      return (
                        <button
                          key={color}
                          onClick={() => {
                            onBatchUpdateElements(
                              selectedElements.map((el) => ({
                                ...el,
                                fillColor: color,
                                color: el.type === "sticky" ? color : el.color,
                              }))
                            );
                          }}
                          className={`w-6 h-6 rounded-md border flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${
                            currentFill === color
                              ? "border-[#557C7B] ring-2 ring-[#557C7B]/50"
                              : "border-black/15 dark:border-white/15"
                          }`}
                          style={{ backgroundColor: color }}
                        >
                          {currentFill === color && (
                            <Check
                              size={12}
                              className={color === "#0B1117" || color === "#192126" || color === "#39433F" ? "text-[#E7E2D8]" : "text-[#0B1117]"}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stroke & Border */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-[#9A9D93]">Stroke</span>
                  <span className="font-mono text-[#9A9D93]">{primary.strokeWidth ?? 2}px</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_SWATCHES.map((color) => {
                    const currentStroke = primary.strokeColor || "#39433F";
                    return (
                      <button
                        key={color}
                        onClick={() => {
                          onBatchUpdateElements(
                            selectedElements.map((el) => ({ ...el, strokeColor: color }))
                          );
                        }}
                        className={`w-6 h-6 rounded-md border flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${
                          currentStroke === color
                            ? "border-[#557C7B] ring-2 ring-[#557C7B]/50"
                            : "border-black/15 dark:border-white/15"
                        }`}
                        style={{ backgroundColor: color }}
                      >
                        {currentStroke === color && (
                          <Check size={12} className={color === "#0B1117" || color === "#192126" || color === "#39433F" ? "text-[#E7E2D8]" : "text-[#0B1117]"} />
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* Stroke Width Slider */}
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={primary.strokeWidth ?? 2}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    onBatchUpdateElements(selectedElements.map((el) => ({ ...el, strokeWidth: val })));
                  }}
                  className="w-full accent-[#557C7B] h-1.5 bg-[#192126] rounded-lg cursor-pointer"
                />
              </div>

              {/* Opacity Slider */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-[#9A9D93]">Opacity</span>
                  <span className="font-mono text-[#9A9D93]">{Math.round((primary.opacity ?? 1) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={primary.opacity ?? 1}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    onBatchUpdateElements(selectedElements.map((el) => ({ ...el, opacity: val })));
                  }}
                  className="w-full accent-[#557C7B] h-1.5 bg-[#192126] rounded-lg cursor-pointer"
                />
              </div>

              {/* Layer Order Controls */}
              <div className="space-y-2 pt-2 border-t border-[#39433F]/40">
                <span className="font-bold uppercase tracking-wider text-[10px] text-[#9A9D93]">Layer Arrangement</span>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => {
                      const maxZ = Math.max(...elements.map((e) => e.zIndex || 0), 1);
                      onBatchUpdateElements(selectedElements.map((el) => ({ ...el, zIndex: maxZ + 1 })));
                    }}
                    className="p-2 rounded-lg bg-[#192126] hover:bg-[#39433F] transition-colors flex flex-col items-center gap-1 cursor-pointer text-[#E7E2D8]"
                    title="Bring to Front"
                  >
                    <BringToFront size={14} />
                    <span className="text-[9px] font-medium">To Front</span>
                  </button>
                  <button
                    onClick={() => {
                      onBatchUpdateElements(
                        selectedElements.map((el) => ({ ...el, zIndex: (el.zIndex || 0) + 1 }))
                      );
                    }}
                    className="p-2 rounded-lg bg-[#192126] hover:bg-[#39433F] transition-colors flex flex-col items-center gap-1 cursor-pointer text-[#E7E2D8]"
                    title="Bring Forward"
                  >
                    <ArrowUp size={14} />
                    <span className="text-[9px] font-medium">Forward</span>
                  </button>
                  <button
                    onClick={() => {
                      onBatchUpdateElements(
                        selectedElements.map((el) => ({ ...el, zIndex: Math.max(0, (el.zIndex || 0) - 1) }))
                      );
                    }}
                    className="p-2 rounded-lg bg-[#192126] hover:bg-[#39433F] transition-colors flex flex-col items-center gap-1 cursor-pointer text-[#E7E2D8]"
                    title="Send Backward"
                  >
                    <ArrowDown size={14} />
                    <span className="text-[9px] font-medium">Backward</span>
                  </button>
                  <button
                    onClick={() => {
                      onBatchUpdateElements(selectedElements.map((el) => ({ ...el, zIndex: 0 })));
                    }}
                    className="p-2 rounded-lg bg-[#192126] hover:bg-[#39433F] transition-colors flex flex-col items-center gap-1 cursor-pointer text-[#E7E2D8]"
                    title="Send to Back"
                  >
                    <SendToBack size={14} />
                    <span className="text-[9px] font-medium">To Back</span>
                  </button>
                </div>
              </div>

              {/* Grouping / Rasterize actions */}
              <div className="pt-2 flex items-center gap-2">
                {isMulti && onGroupElements && (
                  <button
                    onClick={onGroupElements}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#192126] hover:bg-[#39433F] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[#E7E2D8]"
                  >
                    <Group size={13} />
                    <span>Group</span>
                  </button>
                )}
                {selectedElements.some((el) => el.groupId) && onUngroupElements && (
                  <button
                    onClick={onUngroupElements}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#192126] hover:bg-[#39433F] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[#E7E2D8]"
                  >
                    <Ungroup size={13} />
                    <span>Ungroup</span>
                  </button>
                )}
                {onRasterize && (
                  <button
                    onClick={() => onRasterize(selectedElements)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#192126] hover:bg-[#39433F] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[#9A9D93] hover:text-[#E7E2D8]"
                    title="Flatten to Image Snapshot"
                  >
                    <span>Rasterize</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 2: Layers / Objects Panel */}
      {activeTab === "layers" && (
        <div className="flex-1 flex flex-col min-h-0 text-xs">
          {/* Layer Search & Quick Filter */}
          <div className={`p-3 border-b space-y-2 ${isDarkMode ? "border-[#39433F]/40" : "border-[#C7AE82]/40"}`}>
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border ${
              isDarkMode
                ? "bg-[#192126] border-[#39433F]/40 text-[#E7E2D8]"
                : "bg-white border-[#C7AE82]/60 text-[#121A1F]"
            }`}>
              <Search size={14} className={isDarkMode ? "text-[#9A9D93]" : "text-[#62685F]"} />
              <input
                type="text"
                value={layerSearch}
                onChange={(e) => setLayerSearch(e.target.value)}
                placeholder="Search board objects..."
                className={`w-full bg-transparent outline-hidden text-xs ${
                  isDarkMode ? "text-[#E7E2D8] placeholder-[#9A9D93]" : "text-[#121A1F] placeholder-[#62685F]"
                }`}
              />
              {layerSearch && (
                <button onClick={() => setLayerSearch("")} className={isDarkMode ? "text-[#9A9D93] hover:text-[#E7E2D8]" : "text-[#62685F] hover:text-[#121A1F]"}>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar text-[10px] font-semibold py-0.5">
              {[
                { id: "all", label: "All" },
                { id: "frames", label: "Frames" },
                { id: "notes", label: "Notes" },
                { id: "drawing", label: "Drawings" },
                { id: "vectors", label: "Vectors" },
                { id: "html", label: "HTML" },
                { id: "comments", label: "Comments" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setLayerFilter(pill.id)}
                  className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                    layerFilter === pill.id
                      ? "bg-[#557C7B] text-white shadow-xs"
                      : isDarkMode
                        ? "bg-[#192126] text-[#9A9D93] hover:text-[#E7E2D8]"
                        : "bg-[#E6E0D2] text-[#62685F] hover:text-[#121A1F]"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* List of elements */}
          <div className={`flex-1 overflow-y-auto divide-y ${isDarkMode ? "divide-[#39433F]/30" : "divide-[#C7AE82]/30"}`}>
            {filteredLayers.length === 0 ? (
              <div className={`p-6 text-center ${isDarkMode ? "text-[#9A9D93]" : "text-[#62685F]"}`}>
                <p>No objects found</p>
              </div>
            ) : (
              filteredLayers.map((el) => {
                const isSelected = selectedElements.some((s) => s.id === el.id);
                return (
                  <div
                    key={el.id}
                    onClick={() => jumpToElement(el)}
                    className={`px-3.5 py-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      isSelected
                        ? isDarkMode
                          ? "bg-[#557C7B]/25 text-[#E7E2D8] font-semibold"
                          : "bg-[#557C7B]/20 text-[#121A1F] font-semibold"
                        : isDarkMode
                          ? "text-[#E7E2D8] hover:bg-[#192126]"
                          : "text-[#121A1F] hover:bg-[#E6E0D2]/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* Icon per element type */}
                      <span className="shrink-0 text-[#9A9D93]">
                        {el.type === "frame" && <Layout size={14} className="text-[#C7AE82]" />}
                        {el.type === "sticky" && <Square size={14} className="text-[#C4934B]" />}
                        {el.type === "shape" && <Circle size={14} className="text-[#557C7B]" />}
                        {(el.type === "draw" || el.type === "freehand") && <PenTool size={14} className="text-[#B87557]" />}
                        {el.type === "vectorPath" && <Compass size={14} className="text-[#7E9B78]" />}
                        {el.type === "html" && <Code2 size={14} className="text-[#7E9B78]" />}
                        {el.type === "comment" && <MessageSquare size={14} className="text-[#D3A08D]" />}
                        {el.type === "text" && <span className="font-serif font-bold text-xs">T</span>}
                        {el.type === "connector" && <span>➔</span>}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs">
                          {el.title || el.content || getElementTypeLabel(el)}
                        </p>
                        <p className="text-[10px] text-[#9A9D93] flex items-center gap-1 font-mono">
                          <span>{Math.round(el.width)}×{Math.round(el.height)}</span>
                          <span>•</span>
                          <span>Z:{el.zIndex || 0}</span>
                        </p>
                      </div>
                    </div>

                    {/* Lock & Visibility controls */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onUpdateElement(el.id, { locked: !el.locked })}
                        className="p-1 rounded-md hover:bg-[#39433F] text-[#9A9D93] hover:text-[#E7E2D8] transition-colors"
                        title={el.locked ? "Unlock" : "Lock"}
                      >
                        {el.locked ? <Lock size={12} className="text-[#C4934B]" /> : <Unlock size={12} />}
                      </button>
                      <button
                        onClick={() => onUpdateElement(el.id, { hidden: !el.hidden })}
                        className="p-1 rounded-md hover:bg-[#39433F] text-[#9A9D93] hover:text-[#E7E2D8] transition-colors"
                        title={el.hidden ? "Show" : "Hide"}
                      >
                        {el.hidden ? <EyeOff size={12} className="text-[#9A9D93]" /> : <Eye size={12} />}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Frames Navigation */}
      {activeTab === "frames" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
          <div className={`pb-1 text-[11px] font-medium ${isDarkMode ? "text-[#9A9D93]" : "text-[#62685F]"}`}>
            Jump to any Frame container on the infinite board:
          </div>

          {framesList.length === 0 ? (
            <div className={`p-6 text-center ${isDarkMode ? "text-[#9A9D93]" : "text-[#62685F]"}`}>
              <Layout size={28} className="mx-auto mb-2 opacity-50 text-[#C7AE82]" />
              <p className={`font-semibold ${isDarkMode ? "text-[#E7E2D8]" : "text-[#121A1F]"}`}>No frames on board</p>
              <p className="text-[11px] mt-1">
                Press <kbd className={`font-mono px-1 py-0.5 rounded border ${isDarkMode ? "bg-[#192126] border-[#39433F]/40" : "bg-white border-[#C7AE82]/50"}`}>F</kbd> to draw a frame.
              </p>
            </div>
          ) : (
            framesList.map((frame, idx) => (
              <div
                key={frame.id}
                onClick={() => jumpToElement(frame)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                  isDarkMode
                    ? "border-[#39433F] hover:border-[#557C7B] bg-[#192126]/60 hover:bg-[#557C7B]/15"
                    : "border-[#C7AE82]/50 hover:border-[#557C7B] bg-white/70 hover:bg-[#557C7B]/10"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-md bg-[#C7AE82]/20 text-[#C7AE82] font-bold text-[10px] flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className={`font-bold text-xs group-hover:text-[#557C7B] transition-colors ${
                      isDarkMode ? "text-[#E7E2D8]" : "text-[#121A1F]"
                    }`}>
                      {frame.title || `Frame ${idx + 1}`}
                    </h4>
                    <p className={`text-[10px] font-mono ${isDarkMode ? "text-[#9A9D93]" : "text-[#62685F]"}`}>
                      {Math.round(frame.width)} × {Math.round(frame.height)} px
                    </p>
                  </div>
                </div>
                <Maximize2 size={13} className={`${isDarkMode ? "text-[#9A9D93]" : "text-[#62685F]"} group-hover:text-[#557C7B] transition-colors`} />
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
};
