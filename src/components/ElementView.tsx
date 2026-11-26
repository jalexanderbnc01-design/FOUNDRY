import React, { useState, useRef, useEffect } from "react";
import { BoardElement, Point } from "../types";
import { getConnectorPath, getSvgPathFromPoints, getAnchorPoint } from "../utils/canvasMath";
import { vectorNodesToSvgPath, getSvgPathFromStrokePoints } from "../utils/vectorMath";
import { HtmlCardView } from "./HtmlCardView";
import { CommentCardView } from "./CommentCardView";
import { FileText, Globe, ExternalLink, Lock, MessageSquare } from "lucide-react";
import { THEME } from "../theme";

interface ElementViewProps {
  element: BoardElement;
  isSelected: boolean;
  isEditing: boolean;
  allElements: BoardElement[];
  currentUser?: { id: string; name: string; color: string };
  zoom?: number;
  onStartEditing: (id: string) => void;
  onUpdateContent: (id: string, content: string) => void;
  onAddReaction?: (id: string, emoji: string) => void;
  onUpdateElement?: (id: string, partial: Partial<BoardElement>) => void;
  onDeleteElement?: (id: string) => void;
  onNotify?: (msg: string) => void;
  onOpenSourceModal?: (element: BoardElement) => void;
  isDarkMode?: boolean;
}

export const ElementView: React.FC<ElementViewProps> = ({
  element,
  isSelected,
  isEditing,
  allElements,
  currentUser,
  zoom = 1,
  onStartEditing,
  onUpdateContent,
  onAddReaction,
  onUpdateElement,
  onDeleteElement,
  onNotify,
  onOpenSourceModal,
  isDarkMode = false,
}) => {
  const [localContent, setLocalContent] = useState(
    element.type === "frame" ? (element.title || "Frame") : (element.content || "")
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalContent(
      element.type === "frame" ? (element.title || "Frame") : (element.content || "")
    );
  }, [element.content, element.title, element.type]);

  useEffect(() => {
    if (isEditing) {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      } else if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const handleBlur = () => {
    onUpdateContent(element.id, localContent);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" || (element.type === "frame" && e.key === "Enter")) {
      onUpdateContent(element.id, localContent);
    }
  };

  // Render Connector
  if (element.type === "connector") {
    let startPoint: Point = element.startPoint || { x: element.x, y: element.y };
    let endPoint: Point = element.endPoint || { x: element.x + element.width, y: element.y + element.height };

    // Resolve bindings dynamically to connected elements
    if (element.startBinding) {
      const boundEl = allElements.find((e) => e.id === element.startBinding?.elementId);
      if (boundEl) {
        startPoint = getAnchorPoint(boundEl, element.startBinding.anchor);
      }
    }

    if (element.endBinding) {
      const boundEl = allElements.find((e) => e.id === element.endBinding?.elementId);
      if (boundEl) {
        endPoint = getAnchorPoint(boundEl, element.endBinding.anchor);
      }
    }

    const pathData = getConnectorPath(startPoint, endPoint, element.lineStyle || "curved");
    const stroke = element.strokeColor || "#64748b";
    const strokeWidth = element.strokeWidth || 2;
    const markerId = `arrow-${element.id}`;

    return (
      <g className="pointer-events-auto cursor-pointer">
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={stroke} />
          </marker>
        </defs>

        {/* Thick invisible hit area for easy clicking */}
        <path
          d={pathData}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(16, strokeWidth + 12)}
        />

        {/* Visible line */}
        <path
          d={pathData}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={element.strokeStyle === "dashed" ? "6,6" : undefined}
          markerEnd={element.arrowEnd !== false ? `url(#${markerId})` : undefined}
          markerStart={element.arrowStart ? `url(#${markerId})` : undefined}
          className={`transition-all ${isSelected ? "stroke-blue-500 filter drop-shadow(0 0 4px rgba(59,130,246,0.5))" : ""}`}
        />

        {/* Text label on line if present */}
        {element.content && (
          <text
            x={(startPoint.x + endPoint.x) / 2}
            y={(startPoint.y + endPoint.y) / 2 - 8}
            textAnchor="middle"
            fill="#334155"
            fontSize="12"
            fontWeight="500"
            className="bg-white/80 select-none pointer-events-none"
          >
            {element.content}
          </text>
        )}
      </g>
    );
  }

  // Render Freehand drawing / Whiteboard Pen stroke
  if (element.type === "draw" || element.type === "freehand") {
    const pts = element.strokePoints || element.points || [];
    const pathData = getSvgPathFromStrokePoints(pts);
    const stroke = element.strokeColor || element.color || "#3b82f6";
    const strokeWidth = element.strokeWidth || (element.brush === "highlighter" ? 24 : element.brush === "marker" ? 8 : 3);
    const brush = element.brush || "pen";
    const opacity = element.opacity ?? (brush === "highlighter" ? 0.45 : brush === "pencil" ? 0.75 : 1);

    return (
      <g className="pointer-events-auto">
        <path
          d={pathData}
          fill="none"
          stroke="transparent"
          strokeWidth={strokeWidth + 14}
          className="cursor-pointer"
        />
        <path
          d={pathData}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap={brush === "highlighter" ? "square" : "round"}
          strokeLinejoin="round"
          opacity={opacity}
          style={{
            mixBlendMode: brush === "highlighter" ? (isDarkMode ? "screen" : "multiply") : "normal",
          }}
          className={`${isSelected ? "stroke-[#557C7B] filter drop-shadow(0 0 4px rgba(85,124,123,0.7))" : ""}`}
        />
      </g>
    );
  }

  // Render Vector Path (Figma/Illustrator precision editable paths)
  if (element.type === "vectorPath") {
    const pathData = vectorNodesToSvgPath(element.nodes || [], element.closed);
    const stroke = element.vectorStyle?.stroke || element.strokeColor || "#0B1117";
    const strokeWidth = element.vectorStyle?.strokeWidth || element.strokeWidth || 2;
    const fill = element.vectorStyle?.fill !== undefined ? element.vectorStyle.fill : (element.fillColor || "none");
    const strokeCap = element.vectorStyle?.strokeCap || "round";
    const strokeJoin = element.vectorStyle?.strokeJoin || "round";
    const opacity = element.vectorStyle?.opacity ?? element.opacity ?? 1;

    return (
      <g className="pointer-events-auto">
        {/* Invisible hit target */}
        <path
          d={pathData}
          fill={fill || "none"}
          stroke="transparent"
          strokeWidth={strokeWidth + 12}
          className="cursor-pointer"
        />
        {/* Visible vector path */}
        <path
          d={pathData}
          fill={fill || "none"}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap={strokeCap}
          strokeLinejoin={strokeJoin}
          opacity={opacity}
          className={`${isSelected ? "stroke-[#7E9B78] filter drop-shadow(0 0 4px rgba(126,155,120,0.7))" : ""}`}
        />
      </g>
    );
  }

  // Depth translation for 3D perspective layers
  const depthZ = element.depth !== undefined ? element.depth * 28 : (element.type === "html" ? 18 : 0);

  // Common wrapper for 2D rectangular / shape elements
  return (
    <foreignObject
      x={element.x}
      y={element.y}
      width={Math.max(30, element.width)}
      height={Math.max(30, element.height)}
      style={{
        transform: `${element.rotation ? `rotate(${element.rotation}deg)` : ""} ${
          depthZ ? `translateZ(${depthZ}px)` : ""
        }`.trim() || undefined,
        transformOrigin: "center center",
      }}
      className={`overflow-visible pointer-events-auto select-none ${element.locked ? "cursor-not-allowed" : "cursor-move"}`}
    >
      <div
        className="w-full h-full relative"
        onDoubleClick={(e) => {
          e.stopPropagation();
          onStartEditing(element.id);
        }}
      >
        {/* Locked badge if object is locked */}
        {element.locked && (
          <div className="absolute -top-3 -right-3 z-30 p-1 rounded-full bg-[#121A1F] text-[#C4934B] border border-[#39433F] shadow-md">
            <Lock size={12} />
          </div>
        )}

        {/* Frame Element */}
        {element.type === "frame" && (
          <div
            className={`w-full h-full rounded-md border-2 border-dashed relative transition-all ${
              isSelected
                ? "border-[#557C7B] bg-[#557C7B]/10 shadow-sm"
                : isDarkMode
                ? "border-[#39433F] bg-[#121A1F]/60"
                : "border-[#C7AE82] bg-white/40"
            }`}
            style={{
              borderColor: isSelected ? "#557C7B" : element.strokeColor || (isDarkMode ? "#39433F" : "#C7AE82"),
              backgroundColor: element.fillColor || (isDarkMode ? "rgba(18, 26, 31, 0.6)" : "#ffffff"),
            }}
          >
            {/* Frame Title Tab */}
            <div className={`absolute -top-7 left-0 px-2.5 py-1 text-xs font-semibold rounded-t-md shadow-xs flex items-center gap-1.5 select-none ${
              isDarkMode ? "bg-[#121A1F] border border-[#39433F] text-[#E7E2D8]" : "bg-[#192126] text-[#E7E2D8]"
            }`}>
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={localContent}
                  onChange={(e) => setLocalContent(e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  className="bg-transparent border-b border-white/60 text-xs font-semibold outline-hidden text-white w-28 px-0.5"
                  placeholder="Frame Title..."
                />
              ) : (
                <span
                  className="cursor-text"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onStartEditing(element.id);
                  }}
                >
                  {element.title || "Frame"}
                </span>
              )}
              <span className={`text-[10px] ${isDarkMode ? "text-[#9A9D93]" : "text-[#9A9D93]"}`}>
                {Math.round(element.width)}×{Math.round(element.height)}
              </span>
            </div>
          </div>
        )}

        {/* Sticky Note Element */}
        {element.type === "sticky" && (
          <div
            className={`w-full h-full p-3 rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.12)] flex flex-col justify-between transition-all duration-150 relative ${
              isSelected ? "ring-2 ring-[#557C7B] shadow-[0_8px_20px_rgba(85,124,123,0.35)]" : "hover:shadow-[0_6px_16px_rgba(0,0,0,0.18)]"
            }`}
            style={{
              backgroundColor: element.color || "#C7AE82",
              color: "#0B1117",
            }}
          >
            {/* Top Tape strip accent */}
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-10 h-3 bg-white/30 rounded-xs border-b border-black/5" />

            {/* Note text content */}
            <div className="w-full flex-1 overflow-hidden">
              {isEditing ? (
                <textarea
                  ref={textareaRef}
                  value={localContent}
                  onChange={(e) => setLocalContent(e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  className="w-full h-full bg-transparent resize-none border-none outline-hidden font-['Plus_Jakarta_Sans',sans-serif] text-sm leading-relaxed placeholder-black/40 cursor-text"
                  placeholder="Type a note..."
                />
              ) : (
                <p className="w-full h-full whitespace-pre-wrap break-words text-sm font-medium leading-relaxed select-none">
                  {element.content || <span className="text-black/30 italic">Empty sticky note</span>}
                </p>
              )}
            </div>

            {/* Footer with reactions and quick badge */}
            <div className="mt-1 flex items-center justify-between pt-1 border-t border-black/10 text-[11px]">
              <div className="flex items-center gap-1 flex-wrap">
                {element.reactions &&
                  Object.entries(element.reactions).map(([emoji, count]) => (
                    <button
                      key={emoji}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddReaction?.(element.id, emoji);
                      }}
                      className="px-1.5 py-0.5 rounded-full bg-black/10 hover:bg-black/20 text-[#0B1117] border border-black/10 shadow-2xs text-[10px] flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>{emoji}</span>
                      <span className="font-semibold">{count}</span>
                    </button>
                  ))}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const emojis = ["👍", "❤️", "🔥", "💡", "🎉"];
                    const random = emojis[Math.floor(Math.random() * emojis.length)];
                    onAddReaction?.(element.id, random);
                  }}
                  className="opacity-40 hover:opacity-100 hover:scale-110 transition-transform p-0.5 text-xs cursor-pointer"
                  title="React with emoji"
                >
                  ➕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Text Box Element */}
        {element.type === "text" && (
          <div
            className={`w-full h-full p-2 rounded flex items-center transition-all ${
              isSelected ? "ring-2 ring-[#557C7B] bg-[#557C7B]/10" : ""
            }`}
            style={{
              fontSize: `${element.fontSize || 16}px`,
              color: element.color || element.strokeColor || (isDarkMode ? "#f1f5f9" : "#1e293b"),
              textAlign: element.textAlign || "left",
            }}
          >
            {isEditing ? (
              <textarea
                ref={textareaRef}
                value={localContent}
                onChange={(e) => setLocalContent(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className={`w-full h-full bg-transparent resize-none border-none outline-hidden font-medium ${
                  isDarkMode ? "text-slate-100 placeholder-slate-500" : "text-slate-800 placeholder-slate-400"
                }`}
                placeholder="Add text..."
              />
            ) : (
              <div className="w-full h-full whitespace-pre-wrap break-words font-medium select-none">
                {element.content || (
                  <span className={`${isDarkMode ? "text-slate-600 italic" : "text-slate-300 italic"}`}>
                    Type text
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Shapes (Rect, Rounded Rect, Circle, Diamond, Triangle, Star, Cloud, Cylinder) */}
        {element.type === "shape" && (
          <div className="w-full h-full relative flex items-center justify-center">
            <svg
              className={`w-full h-full absolute inset-0 overflow-visible transition-all ${
                isSelected ? "filter drop-shadow(0 0 4px rgba(59,130,246,0.6))" : "drop-shadow-xs"
              }`}
              viewBox={`0 0 ${element.width} ${element.height}`}
            >
              {renderShapePath(element)}
            </svg>

            {/* Shape Text Label */}
            <div className="relative z-10 w-[85%] h-[80%] flex items-center justify-center p-2 text-center pointer-events-none">
              {isEditing ? (
                <textarea
                  ref={textareaRef}
                  value={localContent}
                  onChange={(e) => setLocalContent(e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  className="w-full h-full bg-transparent resize-none border-none outline-hidden font-medium text-center text-sm pointer-events-auto"
                  placeholder="Label shape..."
                />
              ) : (
                <span
                  className="text-xs font-semibold select-none break-words line-clamp-4"
                  style={{
                    color: element.color || "#1e293b",
                    fontSize: `${element.fontSize || 13}px`,
                  }}
                >
                  {element.content}
                </span>
              )}
            </div>
          </div>
        )}
        {/* HTML Card Element */}
        {element.type === "html" && (
          <HtmlCardView
            element={element}
            isSelected={isSelected}
            zoom={zoom}
            onUpdateElement={onUpdateElement || (() => {})}
            onDeleteElement={onDeleteElement || (() => {})}
            onNotify={onNotify}
            onOpenSourceModal={onOpenSourceModal}
            isDarkMode={isDarkMode}
          />
        )}

        {/* Image Element */}
        {element.type === "image" && (
          <div
            className={`w-full h-full rounded-lg overflow-hidden relative flex flex-col transition-all ${
              isSelected
                ? "ring-2 ring-blue-500 shadow-lg"
                : isDarkMode
                ? "border border-slate-700 bg-slate-900 shadow-md"
                : "border border-slate-200 bg-white shadow-sm"
            }`}
          >
            <div className="flex-1 w-full h-full overflow-hidden bg-slate-950/20 flex items-center justify-center">
              <img
                src={element.imageUrl || element.content || ""}
                alt={element.title || "Whiteboard Asset"}
                className="w-full h-full object-contain pointer-events-none select-none"
              />
            </div>
            {element.title && (
              <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 backdrop-blur-xs text-white text-[10px] px-2 py-1 truncate font-mono select-none">
                {element.title}
              </div>
            )}
          </div>
        )}

        {/* File Card Element */}
        {element.type === "file" && (
          <div
            className={`w-full h-full p-3.5 rounded-xl border flex flex-col justify-between transition-all select-none ${
              isDarkMode
                ? "bg-slate-900 border-slate-700 text-slate-100"
                : "bg-white border-slate-200 text-slate-900 shadow-sm"
            } ${isSelected ? "ring-2 ring-blue-500" : ""}`}
          >
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 shrink-0">
                <FileText size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold truncate">
                  {element.fileName || element.title || "Attached Document"}
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {element.fileSize || "1.4 MB"} · {element.fileType || "File"}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200/40 text-[10px]">
              <span className="font-mono text-slate-400">FILE CARD</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNotify?.(`Downloading ${element.fileName || "file"}...`);
                }}
                className="px-2 py-0.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 cursor-pointer"
              >
                Download
              </button>
            </div>
          </div>
        )}

        {/* Link Preview Card */}
        {element.type === "link" && (
          <div
            className={`w-full h-full p-3.5 rounded-xl border flex flex-col justify-between transition-all select-none ${
              isDarkMode
                ? "bg-slate-900 border-slate-700 text-slate-100"
                : "bg-white border-slate-200 text-slate-900 shadow-sm"
            } ${isSelected ? "ring-2 ring-blue-500" : ""}`}
          >
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
                <Globe size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                  LINK PREVIEW
                </span>
                <h4 className="text-xs font-bold truncate mt-0.5">
                  {element.linkTitle || element.title || "External Web Resource"}
                </h4>
                <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-normal">
                  {element.linkDescription || element.content || element.linkUrl}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200/40 text-[11px]">
              <span className="font-mono text-slate-400 text-[10px] truncate max-w-[180px]">
                {element.linkUrl || "https://..."}
              </span>
              <a
                href={element.linkUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 text-blue-500 hover:text-blue-600 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        )}

        {/* Comment Pin & Collaborative Thread Discussion */}
        {element.type === "comment" && (
          <CommentCardView
            element={element}
            isSelected={isSelected}
            isEditing={isEditing}
            currentUser={currentUser}
            onStartEditing={onStartEditing}
            onUpdateElement={onUpdateElement}
            onDeleteElement={onDeleteElement}
            onAddReaction={onAddReaction}
            onNotify={onNotify}
            isDarkMode={isDarkMode}
          />
        )}
      </div>
    </foreignObject>
  );
};

function renderShapePath(el: BoardElement) {
  const w = el.width;
  const h = el.height;
  const fill = el.fillColor || "#ffffff";
  const stroke = el.strokeColor || "#334155";
  const strokeWidth = el.strokeWidth || 2;
  const strokeDasharray = el.strokeStyle === "dashed" ? "5,5" : undefined;

  switch (el.shapeType) {
    case "circle":
      return (
        <ellipse
          cx={w / 2}
          cy={h / 2}
          rx={Math.max(1, w / 2 - strokeWidth)}
          ry={Math.max(1, h / 2 - strokeWidth)}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
        />
      );

    case "diamond":
      return (
        <polygon
          points={`${w / 2},${strokeWidth} ${w - strokeWidth},${h / 2} ${w / 2},${h - strokeWidth} ${strokeWidth},${h / 2}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
        />
      );

    case "triangle":
      return (
        <polygon
          points={`${w / 2},${strokeWidth} ${w - strokeWidth},${h - strokeWidth} ${strokeWidth},${h - strokeWidth}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
        />
      );

    case "star": {
      const cx = w / 2;
      const cy = h / 2;
      const spikes = 5;
      const outerRadius = Math.min(w, h) / 2 - strokeWidth;
      const innerRadius = outerRadius / 2.5;
      let points = "";
      let rot = (Math.PI / 2) * 3;
      const step = Math.PI / spikes;

      for (let i = 0; i < spikes; i++) {
        let x = cx + Math.cos(rot) * outerRadius;
        let y = cy + Math.sin(rot) * outerRadius;
        points += `${x},${y} `;
        rot += step;
        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        points += `${x},${y} `;
        rot += step;
      }
      return (
        <polygon
          points={points.trim()}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
        />
      );
    }

    case "cylinder": {
      const topH = Math.min(24, h * 0.25);
      return (
        <g>
          {/* Cylinder body */}
          <path
            d={`M ${strokeWidth} ${topH} L ${strokeWidth} ${h - topH} A ${w / 2 - strokeWidth} ${topH} 0 0 0 ${w - strokeWidth} ${h - topH} L ${w - strokeWidth} ${topH} Z`}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
          {/* Top cap */}
          <ellipse
            cx={w / 2}
            cy={topH}
            rx={w / 2 - strokeWidth}
            ry={topH - strokeWidth}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        </g>
      );
    }

    case "cloud": {
      return (
        <path
          d={`M ${w * 0.25} ${h * 0.75}
              A ${w * 0.15} ${h * 0.2} 0 0 1 ${w * 0.15} ${h * 0.45}
              A ${w * 0.18} ${h * 0.25} 0 0 1 ${w * 0.35} ${h * 0.2}
              A ${w * 0.25} ${h * 0.25} 0 0 1 ${w * 0.7} ${h * 0.2}
              A ${w * 0.2} ${h * 0.25} 0 0 1 ${w * 0.88} ${h * 0.45}
              A ${w * 0.16} ${h * 0.25} 0 0 1 ${w * 0.78} ${h * 0.75}
              Z`}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
        />
      );
    }

    case "rounded-rect": {
      const cr = el.cornerRadius !== undefined ? el.cornerRadius : 12;
      return (
        <rect
          x={strokeWidth}
          y={strokeWidth}
          width={Math.max(1, w - strokeWidth * 2)}
          height={Math.max(1, h - strokeWidth * 2)}
          rx={cr}
          ry={cr}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
        />
      );
    }

    case "rect":
    default: {
      const cr = el.cornerRadius !== undefined ? el.cornerRadius : 0;
      return (
        <rect
          x={strokeWidth}
          y={strokeWidth}
          width={Math.max(1, w - strokeWidth * 2)}
          height={Math.max(1, h - strokeWidth * 2)}
          rx={cr}
          ry={cr}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
        />
      );
    }
  }
}
