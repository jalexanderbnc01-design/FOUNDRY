import React, { useState } from "react";
import { BoardElement, Viewport, ToolType, ViewMode } from "../types";
import {
  Grid,
  Magnet,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Map,
  Layers,
  Box,
  MonitorPlay,
  RotateCcw,
  Wifi,
  Sparkles,
  MousePointer,
  Paintbrush,
  Compass,
  Sliders,
  ChevronUp,
  HelpCircle,
} from "lucide-react";

interface StatusBarProps {
  viewport: Viewport;
  setViewport: React.Dispatch<React.SetStateAction<Viewport>>;
  elements: BoardElement[];
  selectedElements: BoardElement[];
  activeTool: ToolType;
  cursorWorldPos?: { x: number; y: number };
  gridEnabled: boolean;
  setGridEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  snapEnabled: boolean;
  setSnapEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  guidesEnabled: boolean;
  setGuidesEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  showMinimap: boolean;
  setShowMinimap: React.Dispatch<React.SetStateAction<boolean>>;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  cameraPitch?: number;
  setCameraPitch?: (pitch: number) => void;
  connectionStatus: "connected" | "connecting" | "offline";
  activeUsersCount: number;
  onFitToScreen: () => void;
  onResetZoom: () => void;
  onToggleShortcuts?: () => void;
  isDarkMode?: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  viewport,
  setViewport,
  elements,
  selectedElements,
  activeTool,
  cursorWorldPos = { x: 0, y: 0 },
  gridEnabled,
  setGridEnabled,
  snapEnabled,
  setSnapEnabled,
  guidesEnabled,
  setGuidesEnabled,
  showMinimap,
  setShowMinimap,
  viewMode,
  setViewMode,
  cameraPitch = 32,
  setCameraPitch,
  connectionStatus,
  activeUsersCount,
  onFitToScreen,
  onResetZoom,
  onToggleShortcuts,
  isDarkMode = false,
}) => {
  const [showPerspectiveSettings, setShowPerspectiveSettings] = useState(false);

  // Zoom helpers
  const handleZoom = (factor: number) => {
    setViewport((prev) => {
      const newZoom = Math.max(0.1, Math.min(4.0, prev.zoom * factor));
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      return {
        zoom: newZoom,
        x: cx - (cx - prev.x) * (newZoom / prev.zoom),
        y: cy - (cy - prev.y) * (newZoom / prev.zoom),
      };
    });
  };

  const getToolDisplayName = (tool: ToolType) => {
    switch (tool) {
      case "select":
        return "Select (V)";
      case "hand":
        return "Pan Hand (H)";
      case "draw":
        return "Draw Brush (B)";
      case "eraser":
        return "Eraser (E)";
      case "vector-node":
        return "Vector Node Edit (A)";
      case "vector-pen":
        return "Bézier Pen (P)";
      case "vector-line":
        return "Vector Line (L)";
      case "vector-rect":
        return "Vector Rectangle (R)";
      case "vector-ellipse":
        return "Vector Ellipse (O)";
      case "sticky":
        return "Sticky Note (S)";
      case "shape":
        return "Shape (R)";
      case "connector":
        return "Connector (C)";
      case "text":
        return "Text Box (T)";
      case "frame":
        return "Frame Container (F)";
      case "comment":
        return "Comment Pin (C)";
      case "eyedropper":
        return "Eyedropper (I)";
      default:
        return tool;
    }
  };

  const syncColor =
    connectionStatus === "connected"
      ? "#39E58C"
      : connectionStatus === "connecting"
      ? "#F59E0B"
      : "#F87171";
  const syncLabel =
    connectionStatus === "connected"
      ? "Sync: Realtime"
      : connectionStatus === "connecting"
      ? "Sync: Connecting"
      : "Sync: Offline";

  return (
    <div
      id="canvas-bottom-dock"
      className="fixed bottom-4 inset-x-5 z-40 flex items-center justify-between pointer-events-none select-none"
    >
      {/* Left Bar: Status & Coordinates Bar */}
      <div
        className={`pointer-events-auto flex items-center gap-3 px-3.5 py-1.5 rounded-lg border backdrop-blur-md shadow-lg text-xs transition-colors ${
          isDarkMode
            ? "bg-[#101214]/95 border-[#292C30] text-[#8B929C] shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
            : "bg-[#F2EFE7]/90 border-[#C7AE82]/60 text-[#121A1F] shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
        }`}
      >
        {/* Active Tool Badge */}
        <div className="flex items-center gap-1.5 font-medium">
          <span className="w-2 h-2 rounded-full bg-[#39E58C]" />
          <span className={`font-semibold ${isDarkMode ? "text-[#F5F5F5]" : "text-[#121A1F]"}`}>
            {getToolDisplayName(activeTool)}
          </span>
        </div>

        <span className="opacity-30">|</span>

        {/* Selected Objects Info */}
        <div className="text-[11px] text-[#8B929C] tabular-nums">
          {selectedElements.length === 0
            ? "No selection"
            : selectedElements.length === 1
            ? `1 item (${selectedElements[0].type})`
            : `${selectedElements.length} items selected`}
        </div>

        <span className="opacity-30">|</span>

        {/* Canvas World Coordinates */}
        <div className="font-mono text-[11px] text-[#8B929C] tabular-nums hidden sm:block">
          X: {Math.round(cursorWorldPos.x)} Y: {Math.round(cursorWorldPos.y)}
        </div>

        <span className="opacity-30 hidden sm:inline">|</span>

        {/* Truthful Sync status */}
        <div className="flex items-center gap-1.5 text-[11px] font-medium hidden md:flex">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: syncColor }} />
          <span style={{ color: syncColor }}>{syncLabel}</span>
          <span className="text-[#8B929C] tabular-nums">({activeUsersCount} on board)</span>
        </div>

        {/* Quick Shortcut Hint */}
        {onToggleShortcuts && (
          <button
            onClick={onToggleShortcuts}
            className="p-1 rounded-md hover:bg-[#202327] text-[#8B929C] hover:text-[#F5F5F5] transition-colors cursor-pointer"
            title="Keyboard Shortcuts & Hints (?)"
          >
            <HelpCircle size={13} />
          </button>
        )}
      </div>

      {/* Right Control Bar: GRID | SNAP | GUIDES | ZOOM | MINIMAP | VIEW MODE */}
      <div className="pointer-events-auto flex items-center gap-2">
        {/* Perspective Tilt Controls Popover (when in 3D Mode) */}
        {(viewMode === "soft-3d" || viewMode === "deep-3d") && showPerspectiveSettings && setCameraPitch && (
          <div
            className={`absolute bottom-12 right-0 p-3 rounded-lg border backdrop-blur-md shadow-xl text-xs w-64 space-y-2 animate-in fade-in slide-in-from-bottom-2 ${
              isDarkMode ? "bg-[#17191C] border-[#292C30] text-[#F5F5F5]" : "bg-[#F2EFE7] border-[#C7AE82] text-[#121A1F]"
            }`}
          >
            <div className="flex items-center justify-between font-semibold">
              <span>3D Perspective Tilt</span>
              <span className="font-mono text-[#BCE5F8] tabular-nums">{cameraPitch}°</span>
            </div>
            <input
              type="range"
              min={10}
              max={65}
              value={cameraPitch}
              onChange={(e) => setCameraPitch(parseInt(e.target.value, 10))}
              className="w-full accent-[#BCE5F8] h-1.5 bg-[#202327] rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-[#8B929C]">
              Tip: Hold <kbd className="font-mono bg-[#202327] px-1 py-0.5 rounded">Shift + Middle Mouse</kbd> to orbit freely!
            </p>
          </div>
        )}

        <div
          className={`flex items-center gap-1 p-1 rounded-lg border backdrop-blur-md shadow-lg text-xs transition-colors ${
            isDarkMode
              ? "bg-[#101214]/95 border-[#292C30] text-[#8B929C] shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
              : "bg-[#F2EFE7]/90 border-[#C7AE82]/60 text-[#121A1F] shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
          }`}
        >
          {/* GRID toggle button */}
          <button
            onClick={() => setGridEnabled((prev) => !prev)}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              gridEnabled
                ? "bg-[#BCE5F8] text-[#0B0D0F] shadow-xs"
                : "text-[#8B929C] hover:text-[#F5F5F5] hover:bg-[#202327]"
            }`}
            title="Toggle Canvas Grid Dots"
          >
            <Grid size={13} />
            <span className="text-[11px]">GRID</span>
          </button>

          {/* SNAP toggle button */}
          <button
            onClick={() => setSnapEnabled((prev) => !prev)}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              snapEnabled
                ? "bg-[#BCE5F8] text-[#0B0D0F] shadow-xs"
                : "text-[#8B929C] hover:text-[#F5F5F5] hover:bg-[#202327]"
            }`}
            title="Toggle Snapping to Elements & Grid"
          >
            <Magnet size={13} />
            <span className="text-[11px]">SNAP</span>
          </button>

          {/* GUIDES toggle button */}
          <button
            onClick={() => setGuidesEnabled((prev) => !prev)}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              guidesEnabled
                ? "bg-[#BCE5F8] text-[#0B0D0F] shadow-xs"
                : "text-[#8B929C] hover:text-[#F5F5F5] hover:bg-[#202327]"
            }`}
            title="Toggle Smart Alignment Guides"
          >
            <span className="text-[11px]">GUIDES</span>
          </button>

          <span className="opacity-20 mx-0.5">|</span>

          {/* Zoom Out [-] */}
          <button
            onClick={() => handleZoom(0.8)}
            className="p-1.5 rounded-md hover:bg-[#202327] text-[#8B929C] hover:text-[#F5F5F5] transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut size={13} />
          </button>

          {/* 100% / Reset Zoom Clickable Label */}
          <button
            onClick={onResetZoom}
            className={`px-2 py-0.5 text-xs font-mono font-bold hover:bg-[#202327] rounded-md transition-colors cursor-pointer tabular-nums ${
              isDarkMode ? "text-[#F5F5F5]" : "text-[#121A1F]"
            }`}
            title="Reset Zoom to 100% (0)"
          >
            {Math.round(viewport.zoom * 100)}%
          </button>

          {/* Zoom In [+] */}
          <button
            onClick={() => handleZoom(1.25)}
            className="p-1.5 rounded-md hover:bg-[#202327] text-[#8B929C] hover:text-[#F5F5F5] transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn size={13} />
          </button>

          {/* Fit Screen */}
          <button
            onClick={onFitToScreen}
            className="p-1.5 rounded-md hover:bg-[#202327] text-[#8B929C] hover:text-[#F5F5F5] transition-colors cursor-pointer"
            title="Fit to Content (Shift+1)"
          >
            <Maximize2 size={13} />
          </button>

          <span className="opacity-20 mx-0.5">|</span>

          {/* MINIMAP Toggle */}
          <button
            onClick={() => setShowMinimap((prev) => !prev)}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              showMinimap
                ? "bg-[#BCE5F8] text-[#0B0D0F] shadow-xs"
                : "text-[#8B929C] hover:text-[#F5F5F5] hover:bg-[#202327]"
            }`}
            title="Toggle Minimap View"
          >
            <Map size={13} />
            <span className="text-[11px]">MINIMAP</span>
          </button>

          <span className="opacity-20 mx-0.5">|</span>

          {/* View Mode: FLAT | PERSPECTIVE | SLIDES */}
          <div className="flex items-center gap-0.5 bg-[#17191C] p-0.5 rounded-md text-[11px] font-semibold border border-[#292C30]">
            <button
              onClick={() => setViewMode("flat")}
              className={`px-2.5 py-0.5 rounded transition-all cursor-pointer ${
                viewMode === "flat"
                  ? "bg-[#202327] text-[#F5F5F5] shadow-xs"
                  : "text-[#8B929C] hover:text-[#F5F5F5]"
              }`}
              title="2D Canvas Flat Mode"
            >
              FLAT
            </button>
            <button
              onClick={() => {
                if (viewMode === "flat") setViewMode("soft-3d");
                setShowPerspectiveSettings(!showPerspectiveSettings);
              }}
              className={`px-2.5 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === "soft-3d" || viewMode === "deep-3d"
                  ? "bg-[#BCE5F8] text-[#0B0D0F] shadow-xs font-bold"
                  : "text-[#8B929C] hover:text-[#F5F5F5]"
              }`}
              title="3D Perspective Mode (Click for tilt angle)"
            >
              <span>PERSPECTIVE</span>
              {(viewMode === "soft-3d" || viewMode === "deep-3d") && (
                <ChevronUp size={11} className={showPerspectiveSettings ? "rotate-180 transition-transform" : ""} />
              )}
            </button>
            <button
              onClick={() => setViewMode("presentation")}
              className={`px-2.5 py-0.5 rounded transition-all cursor-pointer ${
                viewMode === "presentation"
                  ? "bg-[#39E58C] text-[#0B0D0F] shadow-xs font-bold"
                  : "text-[#8B929C] hover:text-[#F5F5F5]"
              }`}
              title="Slide Deck Presentation Mode"
            >
              SLIDES
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
