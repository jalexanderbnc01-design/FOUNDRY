import React, { useState, useEffect } from "react";
import {
  ToolType,
  ShapeType,
  EditorRailMode,
  BrushType,
  BooleanOperation,
} from "../types";
import {
  MousePointer,
  Hand,
  StickyNote,
  Square,
  Type,
  ArrowUpRight,
  PenTool,
  Layout,
  Sparkles,
  Circle,
  Diamond,
  Triangle,
  Star,
  Cloud,
  Database,
  Check,
  Code2,
  Wand2,
  History,
  Paintbrush,
  Compass,
  MessageSquare,
  Pipette,
  Sliders,
  Pen,
  Pencil,
  Highlighter,
  Eraser,
  Combine,
  Scissors,
  Layers,
  Split,
  Minus,
  X,
  Zap,
  Smile,
} from "lucide-react";

import {
  EARTH_STICKY_COLORS,
  EARTH_BRUSH_COLORS,
  EARTH_VECTOR_COLORS,
} from "../theme";

interface ToolbarProps {
  railMode?: EditorRailMode;
  setRailMode?: (mode: EditorRailMode) => void;
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  selectedShapeType: ShapeType;
  setSelectedShapeType: (shape: ShapeType) => void;
  selectedStickyColor: string;
  setSelectedStickyColor: (color: string) => void;
  onOpenTemplates: () => void;
  onOpenHtmlUpload?: () => void;
  onOpenAiAssistant?: () => void;
  onOpenHistory?: () => void;
  onOpenComments?: () => void;
  unresolvedCommentsCount?: number;
  onSendReactionBurst?: (emoji: string) => void;

  // Drawing mode properties
  brush?: BrushType;
  setBrush?: (brush: BrushType) => void;
  brushSize?: number;
  setBrushSize?: (size: number) => void;
  brushOpacity?: number;
  setBrushOpacity?: (opacity: number) => void;
  brushSmooth?: number;
  setBrushSmooth?: (smooth: number) => void;
  brushColor?: string;
  setBrushColor?: (color: string) => void;
  brushPressure?: boolean;
  setBrushPressure?: (val: boolean | ((prev: boolean) => boolean)) => void;
  brushStabilize?: boolean;
  setBrushStabilize?: (val: boolean | ((prev: boolean) => boolean)) => void;

  // Vector mode properties
  vectorFillColor?: string | null;
  setVectorFillColor?: (color: string | null) => void;
  vectorStrokeColor?: string;
  setVectorStrokeColor?: (color: string) => void;
  vectorStrokeWidth?: number;
  setVectorStrokeWidth?: (width: number) => void;
  vectorStrokeCap?: "round" | "butt" | "square";
  setVectorStrokeCap?: (cap: "round" | "butt" | "square") => void;
  vectorStrokeJoin?: "round" | "miter" | "bevel";
  setVectorStrokeJoin?: (join: "round" | "miter" | "bevel") => void;
  onBooleanOp?: (op: BooleanOperation) => void;
  onConvertToPath?: () => void;
  canConvertToPath?: boolean;
  canPerformBoolean?: boolean;

  onToggleDrawingToolbar?: () => void;
  onToggleVectorToolbar?: () => void;
  showDrawingToolbar?: boolean;
  showVectorToolbar?: boolean;

  isDarkMode?: boolean;
}

const STICKY_COLORS = EARTH_STICKY_COLORS;

const SHAPES: { type: ShapeType; label: string; icon: React.ReactNode }[] = [
  { type: "rect", label: "Rectangle", icon: <Square size={16} /> },
  { type: "rounded-rect", label: "Rounded Rectangle", icon: <Square size={16} className="rounded-sm" /> },
  { type: "circle", label: "Circle", icon: <Circle size={16} /> },
  { type: "diamond", label: "Diamond (Decision)", icon: <Diamond size={16} /> },
  { type: "triangle", label: "Triangle", icon: <Triangle size={16} /> },
  { type: "cylinder", label: "Database Cylinder", icon: <Database size={16} /> },
  { type: "star", label: "Star", icon: <Star size={16} /> },
  { type: "cloud", label: "Cloud", icon: <Cloud size={16} /> },
];

const BRUSH_COLORS = EARTH_BRUSH_COLORS;

const VECTOR_COLORS = EARTH_VECTOR_COLORS;

export const Toolbar: React.FC<ToolbarProps> = ({
  railMode: propRailMode,
  setRailMode: propSetRailMode,
  activeTool,
  setActiveTool,
  selectedShapeType,
  setSelectedShapeType,
  selectedStickyColor,
  setSelectedStickyColor,
  onOpenTemplates,
  onOpenHtmlUpload,
  onOpenAiAssistant,
  onOpenHistory,
  onOpenComments,
  unresolvedCommentsCount = 0,
  brush = "pen",
  setBrush = (_b: BrushType) => {},
  brushSize = 4,
  setBrushSize = (_s: number) => {},
  brushOpacity = 1,
  setBrushOpacity = (_o: number) => {},
  brushSmooth = 2,
  setBrushSmooth = (_s: number) => {},
  brushColor = "#0f172a",
  setBrushColor = (_c: string) => {},
  brushPressure = true,
  setBrushPressure = (_p: boolean | ((prev: boolean) => boolean)) => {},
  brushStabilize = true,
  setBrushStabilize = (_s: boolean | ((prev: boolean) => boolean)) => {},
  vectorFillColor = null,
  setVectorFillColor = (_c: string | null) => {},
  vectorStrokeColor = "#0f172a",
  setVectorStrokeColor = (_c: string) => {},
  vectorStrokeWidth = 2,
  setVectorStrokeWidth = (_w: number) => {},
  vectorStrokeCap = "round",
  setVectorStrokeCap = (_c: "round" | "butt" | "square") => {},
  vectorStrokeJoin = "round",
  setVectorStrokeJoin = (_j: "round" | "miter" | "bevel") => {},
  onBooleanOp,
  onConvertToPath,
  canConvertToPath = false,
  canPerformBoolean = false,
  isDarkMode = false,
  onSendReactionBurst,
}) => {
  const [internalRailMode, setInternalRailMode] = useState<EditorRailMode>(() => {
    if (activeTool === "draw" || activeTool === "eraser") return "draw";
    if (activeTool.startsWith("vector")) return "vector";
    return "select";
  });

  const [showReactionsPopover, setShowReactionsPopover] = useState(false);

  const railMode = propRailMode ?? internalRailMode;
  const setRailMode = (mode: EditorRailMode) => {
    if (typeof propSetRailMode === "function") {
      propSetRailMode(mode);
    } else {
      setInternalRailMode(mode);
    }
  };

  useEffect(() => {
    if (activeTool === "draw" || activeTool === "eraser") {
      if (railMode !== "draw") {
        setRailMode("draw");
      }
    } else if (activeTool.startsWith("vector")) {
      if (railMode !== "vector") {
        setRailMode("vector");
      }
    }
  }, [activeTool]);

  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showStickyMenu, setShowStickyMenu] = useState(false);

  const handleToolSelect = (tool: ToolType) => {
    setActiveTool(tool);
    if (tool !== "shape") setShowShapeMenu(false);
    if (tool !== "sticky") setShowStickyMenu(false);
  };

  const getToolBtnClass = (tool: ToolType) => {
    if (activeTool === tool) {
      if (railMode === "draw") {
        return "bg-[#B87557] text-[#F5F5F5] shadow-xs";
      }
      if (railMode === "vector") {
        return "bg-[#39E58C] text-[#0B0D0F] font-bold shadow-xs";
      }
      return "bg-[#BCE5F8] text-[#0B0D0F] font-bold shadow-xs";
    }
    return isDarkMode
      ? "text-[#8B929C] hover:bg-[#202327] hover:text-[#F5F5F5]"
      : "text-[#39433F] hover:bg-stone-100 hover:text-[#0B0D0F]";
  };

  return (
    <div className="fixed left-5 top-1/2 -translate-y-1/2 z-40 flex items-start gap-2.5 pointer-events-none select-none">
      {/* 1. Primary Left Rail with Top Mode Switcher (SELECT | DRAW | VECTOR) */}
      <div
        id="main-canvas-toolbar"
        className={`pointer-events-auto flex flex-col items-center gap-1.5 p-2 backdrop-blur-md rounded-xl border shadow-xl transition-all duration-200 ${
          isDarkMode
            ? "bg-[#101214]/95 border-[#292C30] shadow-[0_12px_36px_rgba(0,0,0,0.6)]"
            : "bg-[#F2EFE7]/95 border-[#C7AE82]/60 shadow-[0_12px_32px_rgba(0,0,0,0.1)]"
        }`}
      >
        {/* Top 3-Way Mode Switcher: SELECT | DRAW | VECTOR */}
        <div className="flex flex-col items-center gap-1 p-1 mb-1 rounded-lg bg-[#17191C] w-full border border-[#292C30]">
          <button
            onClick={() => {
              setRailMode("select");
              if (activeTool === "draw" || activeTool.startsWith("vector")) {
                setActiveTool("select");
              }
            }}
            className={`w-full py-1 px-1.5 rounded-md text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
              railMode === "select"
                ? "bg-[#BCE5F8] text-[#0B0D0F] shadow-xs"
                : "text-[#8B929C] hover:text-[#F5F5F5]"
            }`}
            title="Whiteboard Selection & Organization Mode"
          >
            Select
          </button>
          <button
            onClick={() => {
              setRailMode("draw");
              setActiveTool("draw");
            }}
            className={`w-full py-1 px-1.5 rounded-md text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
              railMode === "draw"
                ? "bg-[#B87557] text-[#F5F5F5] shadow-xs"
                : "text-[#8B929C] hover:text-[#F5F5F5]"
            }`}
            title="Whiteboard Freehand Drawing Mode (B)"
          >
            Draw
          </button>
          <button
            onClick={() => {
              setRailMode("vector");
              setActiveTool("vector-node");
            }}
            className={`w-full py-1 px-1.5 rounded-md text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
              railMode === "vector"
                ? "bg-[#39E58C] text-[#0B0D0F] font-bold shadow-xs"
                : "text-[#8B929C] hover:text-[#F5F5F5]"
            }`}
            title="Precision Vector Mode (P / A)"
          >
            Vector
          </button>
        </div>

        <div className={`w-8 h-px mb-0.5 ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`} />

        {/* MODE 1: SELECT (Whiteboard Layout & Notes) */}
        {railMode === "select" && (
          <>
            {/* Select Tool */}
            <button
              onClick={() => handleToolSelect("select")}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${getToolBtnClass("select")}`}
              title="Select & Move (V)"
            >
              <MousePointer size={18} />
            </button>

            {/* Hand Tool (Pan) */}
            <button
              onClick={() => handleToolSelect("hand")}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${getToolBtnClass("hand")}`}
              title="Pan Canvas (H or Space + Drag)"
            >
              <Hand size={18} />
            </button>

            {/* Sticky Note Tool */}
            <div className="relative">
              <button
                onClick={() => {
                  handleToolSelect("sticky");
                  setShowStickyMenu(!showStickyMenu);
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${getToolBtnClass("sticky")}`}
                title="Sticky Note (S)"
              >
                <StickyNote size={18} />
                <span
                  className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border border-black/20"
                  style={{ backgroundColor: selectedStickyColor }}
                />
              </button>

              {/* Sticky Color Flyout Submenu */}
              {showStickyMenu && (
                <div className={`absolute left-12 top-0 backdrop-blur-md rounded-xl shadow-xl border p-2 flex gap-1.5 z-50 animate-in fade-in slide-in-from-left-2 ${
                  isDarkMode ? "bg-[#101214]/95 border-[#292C30] shadow-[0_8px_30px_rgba(0,0,0,0.6)]" : "bg-[#F2EFE7]/95 border-[#C7AE82]/60"
                }`}>
                  {STICKY_COLORS.map(({ color, label }) => (
                    <button
                      key={color}
                      onClick={() => {
                        setSelectedStickyColor(color);
                        setActiveTool("sticky");
                        setShowStickyMenu(false);
                      }}
                      className="w-7 h-7 rounded-lg border border-black/15 flex items-center justify-center hover:scale-115 transition-transform cursor-pointer"
                      style={{ backgroundColor: color }}
                      title={label}
                    >
                      {selectedStickyColor === color && <Check size={14} className="text-[#0B1117]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Shape Tool */}
            <div className="relative">
              <button
                onClick={() => {
                  handleToolSelect("shape");
                  setShowShapeMenu(!showShapeMenu);
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${getToolBtnClass("shape")}`}
                title="Shapes (R)"
              >
                <Square size={18} />
              </button>

              {showShapeMenu && (
                <div className={`absolute left-12 top-0 backdrop-blur-md rounded-xl shadow-xl border p-2 grid grid-cols-2 gap-1.5 w-48 z-50 animate-in fade-in slide-in-from-left-2 ${
                  isDarkMode ? "bg-[#101214]/95 border-[#292C30] text-[#F5F5F5] shadow-[0_8px_30px_rgba(0,0,0,0.6)]" : "bg-[#F2EFE7]/95 border-[#C7AE82]/60 text-[#101214]"
                }`}>
                  {SHAPES.map(({ type, label, icon }) => (
                    <button
                      key={type}
                      onClick={() => {
                        setSelectedShapeType(type);
                        setActiveTool("shape");
                        setShowShapeMenu(false);
                      }}
                      className={`p-2 rounded-lg flex items-center gap-2 text-xs font-medium cursor-pointer transition-colors ${
                        selectedShapeType === type
                          ? isDarkMode
                            ? "bg-[#557C7B]/30 text-[#557C7B] font-semibold border border-[#557C7B]/60"
                            : "bg-[#557C7B]/20 text-[#557C7B] font-semibold"
                          : isDarkMode
                          ? "text-[#8B929C] hover:bg-[#202327] hover:text-[#F5F5F5]"
                          : "text-[#292C30] hover:bg-stone-200/50"
                      }`}
                    >
                      {icon}
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Connector Line / Arrow */}
            <button
              onClick={() => handleToolSelect("connector")}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${getToolBtnClass("connector")}`}
              title="Connector Line / Arrow (L)"
            >
              <ArrowUpRight size={18} />
            </button>

            {/* Text Box */}
            <button
              onClick={() => handleToolSelect("text")}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${getToolBtnClass("text")}`}
              title="Text Box (T)"
            >
              <Type size={18} />
            </button>

            {/* Frame Tool */}
            <button
              onClick={() => handleToolSelect("frame")}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${getToolBtnClass("frame")}`}
              title="Frame Container (F)"
            >
              <Layout size={18} />
            </button>

            {/* Comments Tool (First Class!) */}
            <div className="relative">
              <button
                onClick={() => handleToolSelect("comment")}
                onContextMenu={(e) => {
                  if (onOpenComments) {
                    e.preventDefault();
                    onOpenComments();
                  }
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${getToolBtnClass("comment")}`}
                title="Add Collaborative Comment Pin (C) · Right-click to open Comments Panel"
              >
                <MessageSquare size={18} />
              </button>
              {unresolvedCommentsCount > 0 && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenComments) onOpenComments();
                  }}
                  className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-4 text-center rounded-full bg-blue-500 text-white text-[9px] font-bold shadow-xs cursor-pointer hover:bg-blue-600 transition-colors"
                  title={`${unresolvedCommentsCount} open comments - click to view`}
                >
                  {unresolvedCommentsCount}
                </span>
              )}
            </div>

            {/* Laser Pointer Tool */}
            <button
              onClick={() => handleToolSelect(activeTool === "laser" ? "select" : "laser")}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeTool === "laser"
                  ? "bg-red-500/20 text-red-500 ring-1 ring-red-500/40"
                  : getToolBtnClass("laser")
              }`}
              title="Laser Pointer (K) - Draw live fading trails for collaborators"
            >
              <Zap size={18} />
            </button>

            {/* Live Emoji Reaction Burst */}
            {onSendReactionBurst && (
              <div className="relative">
                <button
                  onClick={() => setShowReactionsPopover((p) => !p)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    showReactionsPopover
                      ? "bg-amber-500/20 text-amber-500"
                      : isDarkMode
                      ? "text-[#8B929C] hover:bg-[#202327] hover:text-[#F5F5F5]"
                      : "text-[#292C30] hover:bg-stone-100"
                  }`}
                  title="Send Live Emoji Reaction"
                >
                  <Smile size={18} />
                </button>
                {showReactionsPopover && (
                  <div className="absolute left-14 top-0 flex items-center gap-1.5 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                    {["🎉", "❤️", "🔥", "👏", "🚀", "💡", "💯"].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          onSendReactionBurst(emoji);
                          setShowReactionsPopover(false);
                        }}
                        className="w-8 h-8 flex items-center justify-center hover:scale-130 transition-transform text-lg cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* HTML Card Upload */}
            {onOpenHtmlUpload && (
              <button
                onClick={onOpenHtmlUpload}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  isDarkMode ? "text-[#8B929C] hover:bg-[#202327] hover:text-[#F5F5F5]" : "text-[#292C30] hover:bg-stone-100"
                }`}
                title="Embed HTML Card"
              >
                <Code2 size={18} />
              </button>
            )}

            {/* AI Assistant */}
            {onOpenAiAssistant && (
              <button
                onClick={onOpenAiAssistant}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  isDarkMode ? "text-[#BCE5F8] hover:bg-[#202327]" : "text-[#0B0D0F] hover:bg-stone-100"
                }`}
                title="Open Foundry AI Chat"
              >
                <Wand2 size={18} />
              </button>
            )}

            {/* Workspace Templates */}
            <button
              onClick={onOpenTemplates}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                isDarkMode ? "text-[#C4934B] hover:bg-[#202327]" : "text-[#C4934B] hover:bg-amber-50"
              }`}
              title="Explore Workspace Templates"
            >
              <Sparkles size={18} />
            </button>
          </>
        )}

        {/* MODE 2: DRAW (Freehand Whiteboard) */}
        {railMode === "draw" && (
          <>
            {/* Pen */}
            <button
              onClick={() => {
                setBrush("pen");
                setActiveTool("draw");
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeTool === "draw" && brush === "pen"
                  ? "bg-[#B87557] text-[#F5F5F5] shadow-xs"
                  : isDarkMode ? "text-[#8B929C] hover:bg-[#202327] hover:text-[#F5F5F5]" : "text-[#292C30] hover:bg-stone-100"
              }`}
              title="Whiteboard Pen (B)"
            >
              <Pen size={18} />
            </button>

            {/* Pencil */}
            <button
              onClick={() => {
                setBrush("pencil");
                setActiveTool("draw");
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeTool === "draw" && brush === "pencil"
                  ? "bg-[#B87557] text-[#F5F5F5] shadow-xs"
                  : isDarkMode ? "text-[#8B929C] hover:bg-[#202327] hover:text-[#F5F5F5]" : "text-[#292C30] hover:bg-stone-100"
              }`}
              title="Textured Pencil"
            >
              <Pencil size={18} />
            </button>

            {/* Marker */}
            <button
              onClick={() => {
                setBrush("marker");
                setActiveTool("draw");
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeTool === "draw" && brush === "marker"
                  ? "bg-[#B87557] text-[#F5F5F5] shadow-xs"
                  : isDarkMode ? "text-[#8B929C] hover:bg-[#202327] hover:text-[#F5F5F5]" : "text-[#292C30] hover:bg-stone-100"
              }`}
              title="Bold Marker"
            >
              <Paintbrush size={18} />
            </button>

            {/* Highlighter */}
            <button
              onClick={() => {
                setBrush("highlighter");
                setActiveTool("draw");
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeTool === "draw" && brush === "highlighter"
                  ? "bg-[#B87557] text-[#F5F5F5] shadow-xs"
                  : isDarkMode ? "text-[#8B929C] hover:bg-[#202327] hover:text-[#F5F5F5]" : "text-[#292C30] hover:bg-stone-100"
              }`}
              title="Semi-transparent Highlighter"
            >
              <Highlighter size={18} />
            </button>

            {/* Eraser */}
            <button
              onClick={() => {
                setBrush("eraser");
                setActiveTool("eraser");
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeTool === "eraser"
                  ? "bg-[#B87557] text-[#F5F5F5] shadow-xs"
                  : isDarkMode ? "text-[#8B929C] hover:bg-[#202327] hover:text-[#F5F5F5]" : "text-[#292C30] hover:bg-stone-100"
              }`}
              title="Eraser (E)"
            >
              <Eraser size={18} />
            </button>

            {/* Eyedropper Color Sampler */}
            <button
              onClick={() => handleToolSelect("eyedropper")}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${getToolBtnClass("eyedropper")}`}
              title="Sample Color from Element (I)"
            >
              <Pipette size={18} />
            </button>
          </>
        )}

        {/* MODE 3: VECTOR (Figma/Illustrator Paths & Shapes) */}
        {railMode === "vector" && (
          <>
            {/* Select in Vector */}
            <button
              onClick={() => handleToolSelect("select")}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${getToolBtnClass("select")}`}
              title="Select Objects (V)"
            >
              <MousePointer size={18} />
            </button>

            {/* Node Edit Tool (A) */}
            <button
              onClick={() => handleToolSelect("vector-node")}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeTool === "vector-node"
                  ? "bg-[#39E58C] text-[#0B0D0F] font-bold shadow-xs"
                  : isDarkMode ? "text-[#8B929C] hover:bg-[#202327] hover:text-[#F5F5F5]" : "text-[#292C30] hover:bg-stone-100"
              }`}
              title="Node Edit / Direct Selection (A)"
            >
              <PenTool size={18} />
            </button>

            {/* Bézier Pen (P) */}
            <button
              onClick={() => handleToolSelect("vector-pen")}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeTool === "vector-pen"
                  ? "bg-[#39E58C] text-[#0B0D0F] font-bold shadow-xs"
                  : isDarkMode ? "text-[#8B929C] hover:bg-[#202327] hover:text-[#F5F5F5]" : "text-[#292C30] hover:bg-stone-100"
              }`}
              title="Bézier Pen Tool (P)"
            >
              <Compass size={18} />
            </button>

            {/* Vector Line (L) */}
            <button
              onClick={() => handleToolSelect("vector-line")}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeTool === "vector-line"
                  ? "bg-[#39E58C] text-[#0B0D0F] font-bold shadow-xs"
                  : isDarkMode ? "text-[#8B929C] hover:bg-[#202327] hover:text-[#F5F5F5]" : "text-[#292C30] hover:bg-stone-100"
              }`}
              title="Vector Line (L)"
            >
              <Minus size={18} />
            </button>

            {/* Vector Rectangle */}
            <button
              onClick={() => handleToolSelect("vector-rect")}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeTool === "vector-rect"
                  ? "bg-[#39E58C] text-[#0B0D0F] font-bold shadow-xs"
                  : isDarkMode ? "text-[#8B929C] hover:bg-[#202327] hover:text-[#F5F5F5]" : "text-[#292C30] hover:bg-stone-100"
              }`}
              title="Vector Rectangle (R)"
            >
              <Square size={18} />
            </button>

            {/* Vector Ellipse */}
            <button
              onClick={() => handleToolSelect("vector-ellipse")}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeTool === "vector-ellipse"
                  ? "bg-[#39E58C] text-[#0B0D0F] font-bold shadow-xs"
                  : isDarkMode ? "text-[#8B929C] hover:bg-[#202327] hover:text-[#F5F5F5]" : "text-[#292C30] hover:bg-stone-100"
              }`}
              title="Vector Ellipse (O)"
            >
              <Circle size={18} />
            </button>

            {/* Vector Polygon */}
            <button
              onClick={() => handleToolSelect("vector-polygon")}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeTool === "vector-polygon"
                  ? "bg-[#39E58C] text-[#0B0D0F] font-bold shadow-xs"
                  : isDarkMode ? "text-[#8B929C] hover:bg-[#202327] hover:text-[#F5F5F5]" : "text-[#292C30] hover:bg-stone-100"
              }`}
              title="Vector Regular Polygon"
            >
              <Triangle size={18} />
            </button>

            {/* Vector Star */}
            <button
              onClick={() => handleToolSelect("vector-star")}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeTool === "vector-star"
                  ? "bg-[#39E58C] text-[#0B0D0F] font-bold shadow-xs"
                  : isDarkMode ? "text-[#8B929C] hover:bg-[#202327] hover:text-[#F5F5F5]" : "text-[#292C30] hover:bg-stone-100"
              }`}
              title="Vector Star"
            >
              <Star size={18} />
            </button>
          </>
        )}
      </div>

      {/* 2. Contextual Secondary Bar appearing beside the rail for DRAW Mode */}
      {railMode === "draw" && (
        <div
          id="contextual-draw-bar"
          className={`pointer-events-auto w-64 p-3 rounded-2xl border backdrop-blur-md shadow-2xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 space-y-2.5 text-xs ${
            isDarkMode
              ? "bg-[#101214]/95 border-[#292C30] text-[#F5F5F5] shadow-[0_12px_36px_rgba(0,0,0,0.6)]"
              : "bg-[#F2EFE7]/95 border-[#C7AE82]/60 text-[#101214] shadow-[0_12px_36px_rgba(0,0,0,0.12)]"
          }`}
        >
          {/* Active Brush Label */}
          <div className="flex items-center justify-between font-bold text-[11px] uppercase tracking-wider pb-1.5 border-b border-[#292C30]/40 dark:border-[#292C30]">
            <span className="flex items-center gap-1.5 text-[#B87557]">
              <Paintbrush size={14} />
              <span>Drawing: {brush}</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[#8B929C]">{brushSize}px</span>
              <button
                onClick={() => {
                  setRailMode("select");
                  if (activeTool === "draw" || activeTool === "eraser") {
                    setActiveTool("select");
                  }
                }}
                className="p-0.5 rounded text-[#8B929C] hover:text-[#F5F5F5] transition-colors cursor-pointer"
                title="Exit Drawing Mode"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Size presets & slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-[#8B929C] uppercase font-bold">
              <span>Size</span>
              <div className="flex items-center gap-1">
                {[2, 4, 8, 16, 24].map((s) => (
                  <button
                    key={s}
                    onClick={() => setBrushSize(s)}
                    className={`px-1.5 py-0.2 rounded text-[9px] font-mono cursor-pointer ${
                      brushSize === s ? "bg-[#B87557] text-[#F5F5F5] font-bold" : "bg-[#202327] text-[#8B929C]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
              className="w-full accent-[#B87557] h-1.5 bg-[#202327] rounded-lg cursor-pointer"
            />
          </div>

          {/* Opacity slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-[#8B929C] uppercase font-bold">
              <span>Opacity</span>
              <span className="font-mono">{Math.round(brushOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={brushOpacity}
              onChange={(e) => setBrushOpacity(parseFloat(e.target.value))}
              className="w-full accent-[#B87557] h-1.5 bg-[#202327] rounded-lg cursor-pointer"
            />
          </div>

          {/* Smooth / Stabilizer */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-[#8B929C] uppercase font-bold">
              <span>Stabilizer / Smooth</span>
              <span className="font-mono">{Math.round(brushSmooth * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={brushSmooth}
              onChange={(e) => setBrushSmooth(parseFloat(e.target.value))}
              className="w-full accent-[#B87557] h-1.5 bg-[#202327] rounded-lg cursor-pointer"
            />
          </div>

          {/* Pressure Dynamic Toggle */}
          <div className="flex items-center justify-between pt-1">
            <span className="font-bold text-[10px] uppercase text-[#8B929C]">Simulate Pressure</span>
            <button
              onClick={() => setBrushPressure((p) => !p)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                brushPressure ? "bg-[#B87557] text-[#F5F5F5]" : "bg-[#202327] text-[#8B929C]"
              }`}
            >
              {brushPressure ? "ON" : "OFF"}
            </button>
          </div>

          {/* Color swatches */}
          <div className="space-y-1 pt-1 border-t border-[#292C30]/40 dark:border-[#292C30]">
            <span className="font-bold text-[10px] uppercase text-[#8B929C]">Ink Color</span>
            <div className="flex flex-wrap gap-1">
              {BRUSH_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setBrushColor(c)}
                  className={`w-6 h-6 rounded-md border flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${
                    brushColor === c ? "border-[#B87557] ring-2 ring-[#B87557]/40" : "border-black/15 dark:border-white/15"
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {brushColor === c && <Check size={12} className={c === "#F5F5F5" ? "text-[#0B0D0F]" : "text-[#F5F5F5]"} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Contextual Secondary Bar appearing beside the rail for VECTOR Mode */}
      {railMode === "vector" && (
        <div
          id="contextual-vector-bar"
          className={`pointer-events-auto w-68 p-3 rounded-2xl border backdrop-blur-md shadow-2xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 space-y-2.5 text-xs ${
            isDarkMode
              ? "bg-[#101214]/95 border-[#292C30] text-[#F5F5F5] shadow-[0_12px_36px_rgba(0,0,0,0.6)]"
              : "bg-[#F2EFE7]/95 border-[#C7AE82]/60 text-[#101214] shadow-[0_12px_36px_rgba(0,0,0,0.12)]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between font-bold text-[11px] uppercase tracking-wider pb-1.5 border-b border-[#292C30]/40 dark:border-[#292C30]">
            <span className="flex items-center gap-1.5 text-[#7E9B78]">
              <Compass size={14} />
              <span>Vector: {activeTool.replace("vector-", "")}</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[#8B929C]">{vectorStrokeWidth}px</span>
              <button
                onClick={() => {
                  setRailMode("select");
                  if (activeTool.startsWith("vector")) {
                    setActiveTool("select");
                  }
                }}
                className="p-0.5 rounded text-[#8B929C] hover:text-[#F5F5F5] transition-colors cursor-pointer"
                title="Exit Vector Mode"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Fill Color */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-[#8B929C] uppercase font-bold">
              <span>Fill</span>
              <button
                onClick={() => setVectorFillColor(vectorFillColor ? null : "#7E9B78")}
                className="text-[10px] font-mono text-[#7E9B78] hover:underline cursor-pointer"
              >
                {vectorFillColor ? "Clear" : "Set Fill"}
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setVectorFillColor(null)}
                className={`w-6 h-6 rounded-md border flex items-center justify-center text-[9px] font-bold cursor-pointer ${
                  vectorFillColor === null ? "border-[#7E9B78] bg-[#7E9B78]/20 text-[#7E9B78]" : "border-[#292C30]"
                }`}
                title="None (Transparent)"
              >
                Ø
              </button>
              {VECTOR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setVectorFillColor(c)}
                  className={`w-6 h-6 rounded-md border flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${
                    vectorFillColor === c ? "border-[#7E9B78] ring-2 ring-[#7E9B78]/40" : "border-black/15 dark:border-white/15"
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {vectorFillColor === c && <Check size={12} className={c === "#F5F5F5" ? "text-[#0B0D0F]" : "text-[#F5F5F5]"} />}
                </button>
              ))}
            </div>
          </div>

          {/* Stroke Color & Width */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-[#8B929C] uppercase font-bold">
              <span>Stroke Color & Width</span>
              <span className="font-mono">{vectorStrokeWidth}px</span>
            </div>
            <div className="flex items-center gap-1">
              {VECTOR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setVectorStrokeColor(c)}
                  className={`w-6 h-6 rounded-md border flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${
                    vectorStrokeColor === c ? "border-[#7E9B78] ring-2 ring-[#7E9B78]/40" : "border-black/15 dark:border-white/15"
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {vectorStrokeColor === c && <Check size={12} className={c === "#F5F5F5" ? "text-[#0B0D0F]" : "text-[#F5F5F5]"} />}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 pt-1">
              {[1, 2, 3, 4, 8].map((w) => (
                <button
                  key={w}
                  onClick={() => setVectorStrokeWidth(w)}
                  className={`flex-1 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                    vectorStrokeWidth === w ? "bg-[#39E58C] text-[#0B0D0F] font-bold" : "bg-[#202327] text-[#8B929C]"
                  }`}
                >
                  {w}px
                </button>
              ))}
            </div>
          </div>

          {/* Boolean Operations (Union, Subtract, Intersect, Exclude) */}
          <div className="space-y-1 pt-1 border-t border-[#292C30]/40 dark:border-[#292C30]">
            <span className="font-bold text-[10px] uppercase text-[#8B929C]">Boolean Tools</span>
            <div className="grid grid-cols-4 gap-1">
              <button
                onClick={() => onBooleanOp?.("union")}
                disabled={!canPerformBoolean}
                className="p-1.5 rounded-lg bg-[#202327] hover:bg-[#292C30] disabled:opacity-30 disabled:pointer-events-none transition-colors flex flex-col items-center gap-0.5 cursor-pointer text-[#F5F5F5]"
                title="Union (Combine paths)"
              >
                <Combine size={13} />
                <span className="text-[9px]">Union</span>
              </button>
              <button
                onClick={() => onBooleanOp?.("subtract")}
                disabled={!canPerformBoolean}
                className="p-1.5 rounded-lg bg-[#202327] hover:bg-[#292C30] disabled:opacity-30 disabled:pointer-events-none transition-colors flex flex-col items-center gap-0.5 cursor-pointer text-[#F5F5F5]"
                title="Subtract (Cut top from bottom)"
              >
                <Scissors size={13} />
                <span className="text-[9px]">Subtract</span>
              </button>
              <button
                onClick={() => onBooleanOp?.("intersect")}
                disabled={!canPerformBoolean}
                className="p-1.5 rounded-lg bg-[#202327] hover:bg-[#292C30] disabled:opacity-30 disabled:pointer-events-none transition-colors flex flex-col items-center gap-0.5 cursor-pointer text-[#F5F5F5]"
                title="Intersect (Keep overlap)"
              >
                <Layers size={13} />
                <span className="text-[9px]">Intersect</span>
              </button>
              <button
                onClick={() => onBooleanOp?.("exclude")}
                disabled={!canPerformBoolean}
                className="p-1.5 rounded-lg bg-[#202327] hover:bg-[#292C30] disabled:opacity-30 disabled:pointer-events-none transition-colors flex flex-col items-center gap-0.5 cursor-pointer text-[#F5F5F5]"
                title="Exclude (Remove overlap)"
              >
                <Split size={13} />
                <span className="text-[9px]">Exclude</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
