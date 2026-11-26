import React, { useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Layers,
  Zap,
  Clock,
  Radio,
  FileText,
} from "lucide-react";
import { BoardElement, ToolType } from "../types";

interface PresentationBarProps {
  frames: BoardElement[];
  currentSlideIndex: number;
  onSelectSlide: (index: number) => void;
  onExitPresentation: () => void;
  isDarkMode?: boolean;
  activeTool?: ToolType;
  onSelectTool?: (tool: ToolType) => void;
  onBroadcastSlide?: (slideIndex: number) => void;
}

export const PresentationBar: React.FC<PresentationBarProps> = ({
  frames,
  currentSlideIndex,
  onSelectSlide,
  onExitPresentation,
  isDarkMode = false,
  activeTool,
  onSelectTool,
  onBroadcastSlide,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playIntervalSec, setPlayIntervalSec] = useState<number>(5);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [isBroadcasting, setIsBroadcasting] = useState(true);
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentFrame = frames[currentSlideIndex];

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (e) {
      console.warn("Fullscreen toggle failed", e);
    }
  };

  // Listen to external fullscreen change
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Keyboard navigation for slides
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === "ArrowRight" || e.key === "PageDown" || e.code === "Space") {
        e.preventDefault();
        if (currentSlideIndex < frames.length - 1) {
          handleSlideChange(currentSlideIndex + 1);
        } else if (isPlaying) {
          // Loop to start
          handleSlideChange(0);
        }
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        if (currentSlideIndex > 0) {
          handleSlideChange(currentSlideIndex - 1);
        }
      } else if (e.key === "Escape") {
        onExitPresentation();
      } else if (e.key === "k" || e.key === "K") {
        if (onSelectTool) {
          onSelectTool(activeTool === "laser" ? "select" : "laser");
        }
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlideIndex, frames.length, isPlaying, activeTool]);

  // Slideshow auto-play timer
  useEffect(() => {
    if (isPlaying && frames.length > 0) {
      playTimerRef.current = setInterval(() => {
        onSelectSlide((prev) => {
          const next = (currentSlideIndex + 1) % frames.length;
          if (isBroadcasting && onBroadcastSlide) {
            onBroadcastSlide(next);
          }
          return next;
        });
      }, playIntervalSec * 1000);
    }
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, playIntervalSec, currentSlideIndex, frames.length, isBroadcasting]);

  const handleSlideChange = (idx: number) => {
    onSelectSlide(idx);
    if (isBroadcasting && onBroadcastSlide) {
      onBroadcastSlide(idx);
    }
  };

  if (frames.length === 0) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-4 py-2.5 rounded-full shadow-2xl border bg-slate-900/90 text-white border-slate-700 backdrop-blur-md">
        <span className="text-xs">No frames found on the board. Create frames to present as slides.</span>
        <button
          onClick={onExitPresentation}
          className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Slide Thumbnails Tray Modal */}
      {showThumbnails && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] w-[92vw] max-w-2xl bg-slate-950/95 backdrop-blur-md border border-slate-700/90 rounded-2xl p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-amber-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Slide Deck Overview</span>
              <span className="text-[10px] text-slate-400 font-medium">({frames.length} slides)</span>
            </div>
            <button
              onClick={() => setShowThumbnails(false)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 max-h-60 overflow-y-auto pr-1">
            {frames.map((frame, idx) => {
              const isCurrent = idx === currentSlideIndex;
              return (
                <button
                  key={frame.id}
                  onClick={() => {
                    handleSlideChange(idx);
                    setShowThumbnails(false);
                  }}
                  className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between h-20 ${
                    isCurrent
                      ? "bg-amber-500/20 border-amber-400/80 shadow-md ring-1 ring-amber-400/40"
                      : "bg-slate-900/80 border-slate-800 hover:border-slate-600 hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isCurrent ? "bg-amber-400 text-slate-950" : "bg-slate-800 text-slate-300"}`}>
                      #{idx + 1}
                    </span>
                    <span className="text-[9px] text-slate-500">{Math.round(frame.width)}x{Math.round(frame.height)}</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-200 truncate mt-1">
                    {frame.title || `Slide ${idx + 1}`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Slide Presenter Notes Drawer */}
      {showNotes && (
        <div className="fixed bottom-24 right-8 z-[200] w-80 bg-slate-950/95 backdrop-blur-md border border-slate-700/90 rounded-2xl p-4 shadow-2xl animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-blue-400" />
              <span className="text-xs font-bold text-white">Presenter Notes</span>
            </div>
            <button
              onClick={() => setShowNotes(false)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          <div className="mt-3 text-xs text-slate-300 leading-relaxed max-h-48 overflow-y-auto">
            {currentFrame?.content || (
              <span className="text-slate-500 italic">No notes attached to {currentFrame?.title || "this frame"}. Double-click the frame on canvas to add speaker notes.</span>
            )}
          </div>
        </div>
      )}

      {/* Main Floating Presentation Controller Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 rounded-full shadow-2xl border bg-slate-950/95 text-slate-100 border-slate-700/80 backdrop-blur-md animate-in slide-in-from-bottom duration-200">
        {/* Slide Info & Live Indicator */}
        <div className="flex items-center gap-2 pr-2 sm:pr-3 border-r border-slate-700 select-none">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-white tracking-wide whitespace-nowrap">
            {currentSlideIndex + 1} / {frames.length}
          </span>
          <span className="hidden md:inline text-xs text-slate-300 font-medium truncate max-w-[130px]">
            {currentFrame?.title || `Slide ${currentSlideIndex + 1}`}
          </span>
        </div>

        {/* Deck Grid Button */}
        <button
          onClick={() => setShowThumbnails((prev) => !prev)}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            showThumbnails ? "bg-amber-500/30 text-amber-300" : "hover:bg-slate-800 text-slate-300"
          }`}
          title="Slide Deck Overview"
        >
          <Layers size={16} />
        </button>

        {/* Navigation Arrows */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => handleSlideChange(Math.max(0, currentSlideIndex - 1))}
            disabled={currentSlideIndex === 0}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Previous slide (Left Arrow)"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => handleSlideChange(Math.min(frames.length - 1, currentSlideIndex + 1))}
            disabled={currentSlideIndex >= frames.length - 1}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Next slide (Right Arrow / Space)"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Auto-Play Slideshow Controls */}
        <div className="flex items-center gap-1 pl-1 border-l border-slate-800">
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isPlaying ? "bg-emerald-500 text-slate-950 font-bold" : "hover:bg-slate-800 text-slate-300"
            }`}
            title={isPlaying ? "Pause auto-advance" : `Auto-play (${playIntervalSec}s)`}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
          </button>
          {isPlaying && (
            <select
              value={playIntervalSec}
              onChange={(e) => setPlayIntervalSec(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] rounded px-1.5 py-0.5 outline-hidden cursor-pointer"
            >
              <option value={3}>3s</option>
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={15}>15s</option>
            </select>
          )}
        </div>

        {/* Presenter Laser Pointer Tool Toggle */}
        {onSelectTool && (
          <button
            onClick={() => onSelectTool(activeTool === "laser" ? "select" : "laser")}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
              activeTool === "laser"
                ? "bg-red-500/30 text-red-400 ring-1 ring-red-400"
                : "hover:bg-slate-800 text-slate-400 hover:text-red-400"
            }`}
            title="Presenter Laser Pointer (K) - Draw live fading trails"
          >
            <Zap size={15} />
            <span className="text-[10px] font-bold hidden sm:inline">Laser</span>
          </button>
        )}

        {/* Broadcast Live Sync Toggle */}
        {onBroadcastSlide && (
          <button
            onClick={() => setIsBroadcasting((b) => !b)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isBroadcasting ? "text-emerald-400 hover:bg-emerald-500/20" : "text-slate-500 hover:bg-slate-800"
            }`}
            title={isBroadcasting ? "Broadcasting slide position to audience" : "Sync disabled (presenting privately)"}
          >
            <Radio size={15} className={isBroadcasting ? "animate-pulse" : ""} />
          </button>
        )}

        {/* Presenter Notes Button */}
        <button
          onClick={() => setShowNotes((prev) => !prev)}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            showNotes ? "bg-blue-500/30 text-blue-300" : "hover:bg-slate-800 text-slate-400 hover:text-white"
          }`}
          title="Slide Notes"
        >
          <FileText size={15} />
        </button>

        {/* Fullscreen Mode Toggle */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Toggle Fullscreen (F)"
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>

        {/* Exit Presentation Button */}
        <button
          onClick={onExitPresentation}
          className="ml-1 pl-2.5 border-l border-slate-700 p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1 text-xs cursor-pointer"
          title="Exit Presentation Mode (Esc)"
        >
          <X size={15} />
          <span className="hidden sm:inline">Exit</span>
        </button>
      </div>
    </>
  );
};

