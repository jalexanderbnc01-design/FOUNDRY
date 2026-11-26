import React, { useState, useRef, useMemo, useEffect } from "react";
import DOMPurify from "dompurify";
import html2canvas from "html2canvas";
import { BoardElement, HtmlCardState } from "../types";
import {
  Camera,
  Code,
  Copy,
  Trash2,
  Eye,
  RefreshCw,
  Check,
  Maximize2,
  Sparkles,
  Lock,
} from "lucide-react";

interface HtmlCardViewProps {
  element: BoardElement;
  isSelected: boolean;
  zoom?: number;
  onUpdateElement: (id: string, partial: Partial<BoardElement>) => void;
  onDeleteElement: (id: string) => void;
  onNotify?: (msg: string) => void;
  onOpenSourceModal?: (element: BoardElement) => void;
  isDarkMode?: boolean;
}

export const HtmlCardView: React.FC<HtmlCardViewProps> = ({
  element,
  isSelected,
  zoom = 1,
  onUpdateElement,
  onDeleteElement,
  onNotify,
  onOpenSourceModal,
  isDarkMode = false,
}) => {
  const [isRasterizing, setIsRasterizing] = useState(false);
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Active state: live, snapshot, image, or code view
  const currentState: HtmlCardState =
    element.htmlState || (element.isRasterized ? "image" : "live");

  // Sanitize raw or content HTML with DOMPurify
  const sanitizedHtml = useMemo(() => {
    const raw = element.content || element.rawHtml || "";
    return DOMPurify.sanitize(raw, {
      ADD_ATTR: ["target", "rel", "style", "class"],
      ADD_TAGS: ["style", "iframe"],
    });
  }, [element.content, element.rawHtml]);

  // Set card state
  const setCardState = (newState: HtmlCardState) => {
    if (newState === "image" && !element.rasterUrl) {
      handleRasterize();
      return;
    }

    onUpdateElement(element.id, {
      htmlState: newState,
      isRasterized: newState === "image",
    });

    const labelMap: Record<HtmlCardState, string> = {
      live: "Live interactive DOM mode active",
      snapshot: "Snapshot mode active (DOM frozen)",
      image: "Rasterized image mode active",
      code: "Source code preview active",
    };
    onNotify?.(labelMap[newState]);
  };

  // Rasterize card using html2canvas into a static PNG image
  const handleRasterize = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!bodyRef.current || isRasterizing) return;

    try {
      setIsRasterizing(true);
      onNotify?.("Rasterizing HTML card into static image...");

      const canvas = await html2canvas(bodyRef.current, {
        backgroundColor: isDarkMode ? "#0f172a" : "#f8fafc",
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const dataUrl = canvas.toDataURL("image/png");

      onUpdateElement(element.id, {
        htmlState: "image",
        isRasterized: true,
        rasterUrl: dataUrl,
      });

      setIsRasterizing(false);
      onNotify?.("Card rasterized to static image snapshot.");
    } catch (err) {
      console.error("Failed to rasterize HTML card:", err);
      setIsRasterizing(false);
      onNotify?.("Could not rasterize card. Ensure images are CORS-accessible.");
    }
  };

  // Copy HTML source to clipboard
  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    const code = element.rawHtml || element.content || "";
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
    onNotify?.("Copied HTML markup to clipboard.");
  };

  // Handle double click to activate LIVE DOM
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentState !== "live") {
      setCardState("live");
      onNotify?.("Activated live DOM from double-click.");
    }
  };

  // Dynamic Level of Detail (LOD) based on zoom:
  // Extremely far away (zoom < 0.25): Render ultra-minimal placeholder
  if (zoom < 0.25) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center rounded border p-2 text-center select-none ${
          isDarkMode
            ? "bg-[#121A1F] border-[#39433F] text-[#9A9D93]"
            : "bg-[#F2EFE7] border-[#C7AE82]/50 text-[#62685F]"
        }`}
      >
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#557C7B]">
          HTML CARD
        </span>
        <span className="text-[9px] truncate max-w-[90%] opacity-80">
          {element.title || element.sourceName || "Component"}
        </span>
      </div>
    );
  }

  const rawCode = element.rawHtml || element.content || "";

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className={`w-full h-full flex flex-col rounded-lg overflow-hidden transition-all duration-150 ${
        isDarkMode
          ? "bg-[#121A1F] text-[#E7E2D8] border border-[#39433F] shadow-[0_12px_36px_rgba(0,0,0,0.6)]"
          : "bg-white text-[#121A1F] border border-[#C7AE82]/50 shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
      } ${
        isSelected
          ? "ring-2 ring-[#557C7B] shadow-[0_0_0_1px_rgba(85,124,123,0.5),0_16px_40px_rgba(0,0,0,0.2)]"
          : ""
      }`}
    >
      {/* Retro-modern Whiteboard Card Header */}
      <div
        className={`flex items-center justify-between px-3 py-1.5 text-[11px] font-mono select-none border-b shrink-0 cursor-grab active:cursor-grabbing ${
          isDarkMode
            ? "bg-[#0D1418] text-[#E7E2D8] border-[#39433F]"
            : "bg-[#151D1E] text-[#E7E1D6] border-[#37423E]"
        }`}
      >
        <div className="flex items-center gap-2 truncate pr-2">
          {/* Status Indicator */}
          <span
            className={`w-2 h-2 rounded-full ${
              currentState === "live"
                ? "bg-[#7E9B78] animate-pulse"
                : currentState === "snapshot"
                ? "bg-[#C4934B]"
                : currentState === "image"
                ? "bg-[#557C7B]"
                : "bg-[#C7AE82]"
            }`}
          />
          <span className="font-bold tracking-wider uppercase text-[10px] text-[#C7AE82]">
            HTML CARD
          </span>
          <span
            className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold uppercase ${
              currentState === "live"
                ? "bg-[#7E9B78]/20 text-[#7E9B78] border border-[#7E9B78]/40"
                : currentState === "snapshot"
                ? "bg-[#C4934B]/20 text-[#C4934B] border border-[#C4934B]/40"
                : currentState === "image"
                ? "bg-[#557C7B]/20 text-[#557C7B] border border-[#557C7B]/40"
                : "bg-[#C7AE82]/20 text-[#C7AE82] border border-[#C7AE82]/40"
            }`}
          >
            {currentState}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {/* Rasterize Snapshot trigger */}
          <button
            onClick={handleRasterize}
            disabled={isRasterizing}
            className="px-1.5 py-0.5 rounded bg-[#557C7B]/30 hover:bg-[#557C7B]/50 text-[#E7E2D8] text-[9px] font-semibold tracking-normal flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
            title="Rasterize card into static image"
          >
            <Camera size={10} />
            <span>{isRasterizing ? "RENDERING..." : "RASTERIZE"}</span>
          </button>

          {/* Edit HTML Source Modal */}
          {onOpenSourceModal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenSourceModal(element);
              }}
              className="p-1 rounded hover:bg-white/10 text-[#C7AE82] cursor-pointer transition-colors"
              title="Edit Raw HTML in Code Modal"
            >
              <Code size={12} />
            </button>
          )}

          {/* Copy HTML Source */}
          <button
            onClick={handleCopyCode}
            className="p-1 rounded hover:bg-white/10 text-[#E7E2D8] cursor-pointer transition-colors"
            title="Copy HTML markup"
          >
            {copied ? <Check size={12} className="text-[#7E9B78]" /> : <Copy size={12} />}
          </button>

          {/* Delete Card */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteElement(element.id);
            }}
            className="p-1 rounded hover:bg-[#A55445]/20 text-[#A55445] cursor-pointer transition-colors"
            title="Delete card"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Card Body: Dynamic representation based on state */}
      <div
        className={`flex-1 w-full h-full overflow-auto relative p-3 text-[13px] leading-relaxed font-sans ${
          isDarkMode ? "bg-slate-900/90 text-slate-100" : "bg-[#f8fafc] text-slate-900"
        }`}
      >
        {/* STATE: IMAGE (Rasterized PNG) */}
        {currentState === "image" && element.rasterUrl && (
          <div className="w-full h-full flex flex-col items-center justify-center select-none">
            <img
              src={element.rasterUrl}
              alt="Rasterized snapshot"
              className="max-w-full max-h-full object-contain pointer-events-none block rounded shadow-xs"
            />
            <span className="mt-1 text-[10px] text-slate-400 font-mono">
              Static Cached Image · Double-click for Live DOM
            </span>
          </div>
        )}

        {/* STATE: CODE (Raw syntax display) */}
        {currentState === "code" && (
          <div className="w-full h-full overflow-auto font-mono text-[11px] p-2 bg-slate-950 text-cyan-300 rounded border border-slate-800 select-text leading-relaxed whitespace-pre-wrap">
            {rawCode}
          </div>
        )}

        {/* STATE: SNAPSHOT (Frozen DOM - pointer events disabled) */}
        {currentState === "snapshot" && (
          <div
            ref={bodyRef}
            className="w-full h-full pointer-events-none select-none overflow-auto opacity-95"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        )}

        {/* STATE: LIVE (Interactive DOM with DOMPurify) */}
        {currentState === "live" && (
          <div
            ref={bodyRef}
            className="interactive-live-dom w-full h-full pointer-events-auto select-text overflow-auto prose prose-sm max-w-none [&_a]:text-[#557C7B] [&_a]:underline [&_table]:border [&_table]:w-full [&_td]:border [&_td]:p-1.5 [&_th]:border [&_th]:p-1.5 [&_img]:max-w-full [&_img]:h-auto"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        )}
      </div>

      {/* State Switcher Bottom Pill Bar */}
      <div
        className={`flex items-center justify-between px-3 py-1 text-[10px] font-mono border-t shrink-0 select-none ${
          isDarkMode
            ? "bg-[#0D1418] border-[#39433F] text-[#9A9D93]"
            : "bg-[#F2EFE7] border-[#C7AE82]/40 text-[#62685F]"
        }`}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCardState("live");
            }}
            className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
              currentState === "live"
                ? "bg-[#7E9B78] text-white shadow-2xs"
                : isDarkMode
                ? "hover:text-[#E7E2D8] hover:bg-[#192126]"
                : "hover:text-[#121A1F] hover:bg-[#E6E0D2]"
            }`}
            title="Full interactive live DOM"
          >
            LIVE
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setCardState("snapshot");
            }}
            className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
              currentState === "snapshot"
                ? "bg-[#C4934B] text-white shadow-2xs"
                : isDarkMode
                ? "hover:text-[#E7E2D8] hover:bg-[#192126]"
                : "hover:text-[#121A1F] hover:bg-[#E6E0D2]"
            }`}
            title="Frozen DOM state"
          >
            SNAPSHOT
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setCardState("image");
            }}
            className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
              currentState === "image"
                ? "bg-[#557C7B] text-white shadow-2xs"
                : isDarkMode
                ? "hover:text-[#E7E2D8] hover:bg-[#192126]"
                : "hover:text-[#121A1F] hover:bg-[#E6E0D2]"
            }`}
            title="Rasterized PNG image"
          >
            IMAGE
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setCardState("code");
            }}
            className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
              currentState === "code"
                ? "bg-[#B87557] text-white shadow-2xs"
                : isDarkMode
                ? "hover:text-[#E7E2D8] hover:bg-[#192126]"
                : "hover:text-[#121A1F] hover:bg-[#E6E0D2]"
            }`}
            title="View raw HTML source markup"
          >
            CODE
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-[9px] opacity-70 truncate">
          <span>{element.width}×{element.height}</span>
          <span>·</span>
          <span>Z:{element.zIndex}</span>
          {element.depth ? (
            <>
              <span>·</span>
              <span>D:{element.depth}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
