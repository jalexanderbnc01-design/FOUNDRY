import React from "react";
import { BoardElement, Viewport, LineStyle, HtmlCardState } from "../types";
import { worldToScreen } from "../utils/canvasMath";
import { THEME } from "../theme";
import {
  Copy,
  Trash2,
  Lock,
  Unlock,
  BringToFront,
  SendToBack,
  Smile,
  Minus,
  Plus,
  Group,
  Ungroup,
  Wand2,
  PenTool,
  Image as ImageIcon,
  Compass,
  Code2,
  Sliders,
  Maximize2,
  Combine,
  Scissors,
  Check,
  MessageSquare,
} from "lucide-react";

interface PropertyBarProps {
  selectedElements: BoardElement[];
  viewport: Viewport;
  onUpdate: (id: string, partial: Partial<BoardElement>) => void;
  onBatchUpdate: (updated: BoardElement[]) => void;
  onDelete: (ids: string[]) => void;
  onDuplicate: (elements: BoardElement[]) => void;
  onAddReaction: (id: string, emoji: string) => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onConvertToVector?: (id: string) => void;
  onConvertToPath?: (id: string) => void;
  onEditNodes?: (id: string) => void;
  onRasterize?: (elements: BoardElement[]) => void;
  onEditHtml?: (id: string) => void;
  onTogglePropertiesPanel?: () => void;
  isDarkMode?: boolean;
}

const STICKY_COLORS = [
  "#fef08a", // yellow
  "#bae6fd", // sky
  "#bbf7d0", // mint
  "#fbcfe8", // pink
  "#fed7aa", // orange
  "#ffffff", // white
];

const SHAPE_COLORS = [
  "#ffffff",
  "#F2EFE7",
  "#7E9B78", // sage
  "#B87557", // clay
  "#C7AE82", // sand
  "#151D1E", // charcoal
];

const STROKE_COLORS = [
  "#0D1418",
  "#37423E",
  "#7E9B78",
  "#B58C5B",
  "#96594B",
  "#557C7B",
];

export const PropertyBar: React.FC<PropertyBarProps> = ({
  selectedElements,
  viewport,
  onUpdate,
  onBatchUpdate,
  onDelete,
  onDuplicate,
  onAddReaction,
  onGroup,
  onUngroup,
  onConvertToVector,
  onConvertToPath,
  onEditNodes,
  onRasterize,
  onEditHtml,
  onTogglePropertiesPanel,
  isDarkMode = false,
}) => {
  if (selectedElements.length === 0) return null;

  // Position above the first selected element
  const primary = selectedElements[0];
  const screenPos = worldToScreen(primary.x, primary.y, viewport);

  // Group status
  const isEntireGroup =
    selectedElements.length > 1 &&
    selectedElements.every(
      (el) => !!el.groupId && el.groupId === selectedElements[0].groupId
    );
  const hasGroupedElements = selectedElements.some((el) => !!el.groupId);
  const canGroup = selectedElements.length >= 2;

  // Keep bar on screen bounds
  const barX = Math.max(80, Math.min(window.innerWidth - 450, screenPos.x));
  const barY = Math.max(60, screenPos.y - 54);

  const isHtmlCard = primary.type === "html";
  const isVector = primary.type === "vectorPath";
  const isSticky = primary.type === "sticky";
  const isShape = primary.type === "shape";
  const isText = primary.type === "text";
  const isConnector = primary.type === "connector";
  const isComment = primary.type === "comment";
  const isLocked = primary.locked;

  const handleColorChange = (color: string) => {
    if (isSticky) {
      selectedElements.forEach((el) => onUpdate(el.id, { color }));
    } else if (isShape || isVector) {
      selectedElements.forEach((el) => onUpdate(el.id, { fillColor: color }));
    } else if (isText) {
      selectedElements.forEach((el) => onUpdate(el.id, { color }));
    }
  };

  const handleStrokeColorChange = (strokeColor: string) => {
    selectedElements.forEach((el) => onUpdate(el.id, { strokeColor }));
  };

  const handleStrokeWidthChange = (delta: number) => {
    const current = primary.strokeWidth || 2;
    const nextWidth = Math.max(1, Math.min(16, current + delta));
    selectedElements.forEach((el) => onUpdate(el.id, { strokeWidth: nextWidth }));
  };

  const handleHtmlStateChange = (htmlCardState: HtmlCardState) => {
    selectedElements.forEach((el) => onUpdate(el.id, { htmlCardState }));
  };

  const handleFontSizeChange = (delta: number) => {
    const currentSize = primary.fontSize || 14;
    const newSize = Math.max(10, Math.min(72, currentSize + delta));
    selectedElements.forEach((el) => onUpdate(el.id, { fontSize: newSize }));
  };

  const handleLineStyleChange = (lineStyle: LineStyle) => {
    selectedElements.forEach((el) => onUpdate(el.id, { lineStyle }));
  };

  const toggleLock = () => {
    selectedElements.forEach((el) => onUpdate(el.id, { locked: !isLocked }));
  };

  const handleZIndex = (direction: "front" | "back") => {
    const updated = selectedElements.map((el) => ({
      ...el,
      zIndex: direction === "front" ? el.zIndex + 10 : Math.max(1, el.zIndex - 10),
    }));
    onBatchUpdate(updated);
  };

  const btnHoverClass = "text-[#909891] hover:text-[#E7E1D6] hover:bg-[#222C29]";
  const dividerClass = "border-[#37423E]";

  return (
    <div
      id="canvas-property-bar"
      className="fixed z-[250] flex items-center gap-1.5 px-2.5 py-1.5 backdrop-blur-md rounded-xl border shadow-2xl animate-in fade-in zoom-in-95 duration-100 select-none text-xs"
      style={{
        left: `${barX}px`,
        top: `${barY}px`,
        backgroundColor: THEME.menuPanel,
        borderColor: THEME.borderMain,
        color: THEME.mainText,
      }}
    >
      {/* ================= SPECIAL MODE 1: HTML CARD SELECTED ================= */}
      {isHtmlCard ? (
        <>
          {/* Badge */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#667B63]/20 border border-[#667B63]/40 text-[#7E9B78] font-bold text-[10px] tracking-wider uppercase">
            <Code2 size={12} />
            <span>HTML CARD</span>
          </div>

          <div className={`h-4 border-r ${dividerClass} mx-0.5`} />

          {/* Render Mode: LIVE / SNAPSHOT / IMAGE */}
          <div className="flex items-center bg-[#0D1418] rounded-lg p-0.5 border border-[#37423E]">
            <button
              onClick={() => handleHtmlStateChange("live")}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                primary.htmlCardState === "live" || !primary.htmlCardState
                  ? "bg-[#667B63] text-white"
                  : "text-[#909891] hover:text-[#E7E1D6]"
              }`}
              title="Interactive Live DOM Mode"
            >
              LIVE
            </button>
            <button
              onClick={() => handleHtmlStateChange("snapshot")}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                primary.htmlCardState === "snapshot"
                  ? "bg-[#667B63] text-white"
                  : "text-[#909891] hover:text-[#E7E1D6]"
              }`}
              title="Static Snapshot Mode"
            >
              SNAPSHOT
            </button>
            <button
              onClick={() => handleHtmlStateChange("image")}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                primary.htmlCardState === "image"
                  ? "bg-[#667B63] text-white"
                  : "text-[#909891] hover:text-[#E7E1D6]"
              }`}
              title="Static Rendered Image Mode"
            >
              IMAGE
            </button>
          </div>

          <div className={`h-4 border-r ${dividerClass} mx-0.5`} />

          {/* RASTERIZE */}
          {onRasterize && (
            <button
              onClick={() => onRasterize(selectedElements)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#222C29] hover:bg-[#37423E] text-[#E7E1D6] text-[11px] font-semibold transition-colors cursor-pointer"
              title="Rasterize / Flatten HTML card into a lightweight image"
            >
              <ImageIcon size={12} style={{ color: THEME.warmHighlight }} />
              <span>RASTERIZE</span>
            </button>
          )}

          {/* EDIT HTML */}
          {onEditHtml && (
            <button
              onClick={() => onEditHtml(primary.id)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#222C29] hover:bg-[#37423E] text-[#E7E1D6] text-[11px] font-semibold transition-colors cursor-pointer"
              title="Open code editor to edit HTML markup"
            >
              <Code2 size={12} style={{ color: THEME.selected }} />
              <span>EDIT HTML</span>
            </button>
          )}

          {/* PROPERTIES */}
          {onTogglePropertiesPanel && (
            <button
              onClick={onTogglePropertiesPanel}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#222C29] hover:bg-[#37423E] text-[#E7E1D6] text-[11px] font-semibold transition-colors cursor-pointer"
              title="Show properties inspector"
            >
              <Sliders size={12} />
              <span>PROPERTIES</span>
            </button>
          )}
        </>
      ) : isVector ? (
        /* ================= SPECIAL MODE 2: VECTOR PATH SELECTED ================= */
        <>
          {/* Badge: VECTOR */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#667B63]/20 border border-[#667B63]/40 text-[#7E9B78] font-bold text-[10px] tracking-wider uppercase">
            <PenTool size={12} />
            <span>VECTOR</span>
          </div>

          <div className={`h-4 border-r ${dividerClass} mx-0.5`} />

          {/* NODE: Edit Nodes button */}
          {onEditNodes && (
            <button
              onClick={() => onEditNodes(primary.id)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#667B63] hover:bg-[#556952] text-white text-[11px] font-semibold transition-colors cursor-pointer shadow-xs"
              title="Edit Bezier nodes and curve anchors (Shortcut: A)"
            >
              <Compass size={12} />
              <span>NODE</span>
            </button>
          )}

          {/* FILL: color swatch */}
          <div className="flex items-center gap-1 px-1">
            <span className="text-[10px] font-bold text-[#909891] uppercase">Fill</span>
            <div className="flex items-center gap-1">
              {SHAPE_COLORS.slice(0, 4).map((c) => (
                <button
                  key={c}
                  onClick={() => handleColorChange(c)}
                  className="w-4 h-4 rounded-full border border-black/20 hover:scale-115 transition-transform cursor-pointer"
                  style={{ backgroundColor: c }}
                  title={`Fill ${c}`}
                />
              ))}
            </div>
          </div>

          <div className={`h-4 border-r ${dividerClass} mx-0.5`} />

          {/* STROKE: color swatch */}
          <div className="flex items-center gap-1 px-1">
            <span className="text-[10px] font-bold text-[#909891] uppercase">Stroke</span>
            <div className="flex items-center gap-1">
              {STROKE_COLORS.slice(0, 4).map((c) => (
                <button
                  key={c}
                  onClick={() => handleStrokeColorChange(c)}
                  className="w-4 h-4 rounded-full border border-black/20 hover:scale-115 transition-transform cursor-pointer"
                  style={{ backgroundColor: c }}
                  title={`Stroke ${c}`}
                />
              ))}
            </div>
          </div>

          <div className={`h-4 border-r ${dividerClass} mx-0.5`} />

          {/* 2px: Stroke Width */}
          <div className="flex items-center gap-1 bg-[#0D1418] px-1.5 py-0.5 rounded border border-[#37423E]">
            <button
              onClick={() => handleStrokeWidthChange(-1)}
              className="text-[#909891] hover:text-[#E7E1D6] p-0.5 cursor-pointer"
              title="Decrease stroke width"
            >
              <Minus size={11} />
            </button>
            <span className="text-[11px] font-mono font-bold text-[#E7E1D6] min-w-4 text-center">
              {primary.strokeWidth || 2}px
            </span>
            <button
              onClick={() => handleStrokeWidthChange(1)}
              className="text-[#909891] hover:text-[#E7E1D6] p-0.5 cursor-pointer"
              title="Increase stroke width"
            >
              <Plus size={11} />
            </button>
          </div>

          {/* BOOLEAN: Union / Subtract operations */}
          <button
            onClick={() => {
              // Quick boolean merge/flatten feedback
              if (onRasterize && selectedElements.length > 1) {
                onRasterize(selectedElements);
              }
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#222C29] hover:bg-[#37423E] text-[#E7E1D6] text-[10px] font-bold tracking-wide transition-colors cursor-pointer"
            title="Boolean shape operation"
          >
            <Combine size={12} style={{ color: THEME.warmHighlight }} />
            <span>BOOLEAN</span>
          </button>
        </>
      ) : (
        /* ================= STANDARD TOOLS: STICKY, SHAPE, TEXT, CONNECTOR ================= */
        <>
          {/* Color Picker Swatches */}
          {(isSticky || isShape || isText) && (
            <div className={`flex items-center gap-1 pr-1 border-r ${dividerClass}`}>
              {(isSticky ? STICKY_COLORS : SHAPE_COLORS).slice(0, 5).map((c) => (
                <button
                  key={c}
                  onClick={() => handleColorChange(c)}
                  className="w-4 h-4 rounded-full border border-black/15 shadow-2xs hover:scale-115 transition-transform cursor-pointer"
                  style={{ backgroundColor: c }}
                  title={`Color ${c}`}
                />
              ))}
            </div>
          )}

          {/* Stroke Color for Shapes & Connectors */}
          {(isShape || isConnector) && (
            <div className={`flex items-center gap-1 pr-1 border-r ${dividerClass}`}>
              <span className="text-[10px] font-semibold uppercase px-1 text-[#909891]">Border</span>
              {STROKE_COLORS.slice(0, 3).map((c) => (
                <button
                  key={c}
                  onClick={() => handleStrokeColorChange(c)}
                  className="w-3.5 h-3.5 rounded-full border border-black/20 hover:scale-115 transition-transform cursor-pointer"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}

          {/* Line Style for Connectors */}
          {isConnector && (
            <div className={`flex items-center gap-0.5 pr-1 border-r ${dividerClass} text-xs font-medium`}>
              <button
                onClick={() => handleLineStyleChange("curved")}
                className={`px-1.5 py-0.5 rounded cursor-pointer text-[11px] ${
                  primary.lineStyle === "curved" ? "bg-[#667B63] text-white" : "hover:bg-[#222C29] text-[#909891]"
                }`}
              >
                Curved
              </button>
              <button
                onClick={() => handleLineStyleChange("straight")}
                className={`px-1.5 py-0.5 rounded cursor-pointer text-[11px] ${
                  primary.lineStyle === "straight" ? "bg-[#667B63] text-white" : "hover:bg-[#222C29] text-[#909891]"
                }`}
              >
                Straight
              </button>
            </div>
          )}

          {/* Font Size (+ / -) */}
          {(isText || isSticky || isShape) && (
            <div className={`flex items-center gap-1 pr-1 border-r ${dividerClass} text-xs`}>
              <button
                onClick={() => handleFontSizeChange(-2)}
                className={`p-1 rounded cursor-pointer ${btnHoverClass}`}
                title="Decrease font size"
              >
                <Minus size={12} />
              </button>
              <span className="font-semibold min-w-4 text-center text-[#E7E1D6]">
                {primary.fontSize || (isSticky ? 14 : 16)}
              </span>
              <button
                onClick={() => handleFontSizeChange(2)}
                className={`p-1 rounded cursor-pointer ${btnHoverClass}`}
                title="Increase font size"
              >
                <Plus size={12} />
              </button>
            </div>
          )}

          {/* Convert Freehand Drawing to Vector Path */}
          {(primary.type === "draw" || primary.type === "freehand") && onConvertToVector && (
            <button
              onClick={() => onConvertToVector(primary.id)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#667B63] hover:bg-[#556952] text-white text-[11px] font-semibold transition-colors cursor-pointer"
              title="Convert freehand drawing to editable vector path with Bezier handles"
            >
              <Wand2 size={12} />
              <span>Convert to Vector</span>
            </button>
          )}

          {/* Convert Primitive Shape to Vector Path */}
          {primary.type === "shape" && onConvertToPath && (
            <button
              onClick={() => onConvertToPath(primary.id)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#667B63] hover:bg-[#556952] text-white text-[11px] font-semibold transition-colors cursor-pointer"
              title="Convert shape into editable vector path with corner and curve nodes"
            >
              <PenTool size={12} />
              <span>Convert to Path</span>
            </button>
          )}
          {/* Comment Thread Actions */}
          {isComment && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onUpdate(primary.id, { commentResolved: !primary.commentResolved })}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border ${
                  primary.commentResolved
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30"
                    : "bg-slate-700/60 text-[#E7E1D6] border-slate-600 hover:bg-slate-600"
                }`}
                title={primary.commentResolved ? "Reopen comment thread" : "Resolve comment thread"}
              >
                <Check size={12} strokeWidth={primary.commentResolved ? 3 : 2} />
                <span>{primary.commentResolved ? "Resolved" : "Resolve"}</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* ================= COMMON ACTIONS: GROUP, DUPLICATE, Z-INDEX, LOCK, DELETE ================= */}
      <div className={`h-4 border-r ${dividerClass} mx-0.5`} />

      {/* Quick Emoji Reaction */}
      <button
        onClick={() => {
          const emojis = ["🔥", "👍", "❤️", "💡", "🚀", "🎉"];
          const emoji = emojis[Math.floor(Math.random() * emojis.length)];
          onAddReaction(primary.id, emoji);
        }}
        className={`p-1 rounded-md cursor-pointer transition-colors ${btnHoverClass}`}
        title="Quick emoji reaction"
      >
        <Smile size={14} />
      </button>

      {/* Group Indicator / Buttons */}
      {isEntireGroup && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#667B63]/20 border border-[#667B63]/40 text-[#7E9B78] font-bold text-[10px]">
          <Group size={11} />
          <span>Group</span>
        </div>
      )}

      {canGroup && onGroup && (
        <button
          onClick={onGroup}
          className={`flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors text-xs font-semibold ${btnHoverClass}`}
          title="Group objects together (⌘G)"
        >
          <Group size={13} />
          <span>Group</span>
        </button>
      )}

      {hasGroupedElements && onUngroup && (
        <button
          onClick={onUngroup}
          className={`flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors text-xs font-semibold ${btnHoverClass}`}
          title="Ungroup objects (⇧⌘G)"
        >
          <Ungroup size={13} />
          <span>Ungroup</span>
        </button>
      )}

      {/* Duplicate */}
      <button
        onClick={() => onDuplicate(selectedElements)}
        className={`p-1 rounded-md cursor-pointer transition-colors ${btnHoverClass}`}
        title="Duplicate (⌘D)"
      >
        <Copy size={14} />
      </button>

      {/* Bring to Front / Send to Back */}
      <button
        onClick={() => handleZIndex("front")}
        className={`p-1 rounded-md cursor-pointer transition-colors ${btnHoverClass}`}
        title="Bring to Front"
      >
        <BringToFront size={14} />
      </button>

      <button
        onClick={() => handleZIndex("back")}
        className={`p-1 rounded-md cursor-pointer transition-colors ${btnHoverClass}`}
        title="Send to Back"
      >
        <SendToBack size={14} />
      </button>

      {/* Lock/Unlock */}
      <button
        onClick={toggleLock}
        className={`p-1 rounded-md cursor-pointer transition-colors ${
          isLocked ? "text-[#B58C5B] bg-[#B58C5B]/20" : btnHoverClass
        }`}
        title={isLocked ? "Unlock element" : "Lock element"}
      >
        {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
      </button>

      {/* Delete */}
      <button
        onClick={() => onDelete(selectedElements.map((el) => el.id))}
        className="p-1 rounded-md cursor-pointer transition-colors text-[#909891] hover:text-[#96594B] hover:bg-[#96594B]/20"
        title="Delete (Delete / Backspace)"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};
