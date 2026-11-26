import React, { useState } from "react";
import { BoardElement, Viewport } from "../types";
import { ZoomIn, ZoomOut, Maximize2, MapPin, Compass } from "lucide-react";

interface MinimapProps {
  elements: BoardElement[];
  viewport: Viewport;
  setViewport: React.Dispatch<React.SetStateAction<Viewport>>;
  onFitToScreen: () => void;
  onResetZoom: () => void;
  isDarkMode?: boolean;
}

export const Minimap: React.FC<MinimapProps> = ({
  elements,
  viewport,
  setViewport,
  onFitToScreen,
  onResetZoom,
  isDarkMode = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Zoom controls
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

  // Compute bounding box of all elements for minimap scaling
  let minX = -1000;
  let minY = -800;
  let maxX = 1200;
  let maxY = 1000;

  if (elements.length > 0) {
    elements.forEach((el) => {
      minX = Math.min(minX, el.x - 200);
      minY = Math.min(minY, el.y - 200);
      maxX = Math.max(maxX, el.x + el.width + 200);
      maxY = Math.max(maxY, el.y + el.height + 200);
    });
  }

  const mapW = maxX - minX;
  const mapH = maxY - minY;
  const previewW = 180;
  const previewH = 120;
  const scale = Math.min(previewW / mapW, previewH / mapH);

  // Current camera view in world coordinates
  const viewWorldW = window.innerWidth / viewport.zoom;
  const viewWorldH = window.innerHeight / viewport.zoom;
  const viewWorldX = -viewport.x / viewport.zoom;
  const viewWorldY = -viewport.y / viewport.zoom;

  const viewRectX = (viewWorldX - minX) * scale;
  const viewRectY = (viewWorldY - minY) * scale;
  const viewRectW = Math.max(8, viewWorldW * scale);
  const viewRectH = Math.max(8, viewWorldH * scale);

  const handleMinimapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const targetWorldX = minX + clickX / scale;
    const targetWorldY = minY + clickY / scale;

    setViewport((prev) => ({
      ...prev,
      x: window.innerWidth / 2 - targetWorldX * prev.zoom,
      y: window.innerHeight / 2 - targetWorldY * prev.zoom,
    }));
  };

  const btnHoverClass = isDarkMode
    ? "text-[#E7E2D8] hover:bg-[#192126] hover:text-white"
    : "text-[#121A1F] hover:bg-[#E7E2D8]";

  return (
    <div
      id="canvas-minimap-controls"
      className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2 select-none"
    >
      {/* Minimap Preview Drawer */}
      {isOpen && (
        <div className={`p-2 rounded-2xl border animate-in fade-in zoom-in-95 backdrop-blur-md ${
          isDarkMode
            ? "bg-[#121A1F]/95 border-[#39433F] shadow-[0_12px_36px_rgba(0,0,0,0.6)]"
            : "bg-[#F2EFE7]/95 border-[#C7AE82]/90 shadow-xl"
        }`}>
          <div className={`flex items-center justify-between pb-1.5 px-1 border-b text-[11px] font-semibold ${
            isDarkMode ? "border-[#39433F] text-[#E7E2D8]" : "border-[#C7AE82]/40 text-[#121A1F]"
          }`}>
            <span>Canvas Overview</span>
            <span className={`text-[10px] ${isDarkMode ? "text-[#9A9D93]" : "text-[#9A9D93]"}`}>
              {elements.length} elements
            </span>
          </div>

          <div className={`w-[180px] h-[120px] rounded-lg overflow-hidden relative cursor-crosshair border mt-1 ${
            isDarkMode ? "bg-[#0B1117] border-[#39433F]" : "bg-[#E7E2D8]/60 border-[#C7AE82]/60"
          }`}>
            <svg
              className="w-full h-full"
              viewBox={`0 0 ${previewW} ${previewH}`}
              onClick={handleMinimapClick}
            >
              {/* Elements on minimap */}
              {elements.map((el) => {
                const ex = (el.x - minX) * scale;
                const ey = (el.y - minY) * scale;
                const ew = Math.max(2, el.width * scale);
                const eh = Math.max(2, el.height * scale);
                return (
                  <rect
                    key={el.id}
                    x={ex}
                    y={ey}
                    width={ew}
                    height={eh}
                    fill={el.color || el.fillColor || (isDarkMode ? "#60745A" : "#7E9B78")}
                    rx={1}
                    opacity={el.type === "frame" ? 0.3 : 0.8}
                  />
                );
              })}

              {/* Viewport camera boundary */}
              <rect
                x={viewRectX}
                y={viewRectY}
                width={viewRectW}
                height={viewRectH}
                fill={isDarkMode ? "rgba(85, 124, 123, 0.25)" : "rgba(85, 124, 123, 0.15)"}
                stroke="#557C7B"
                strokeWidth="1.5"
                rx={2}
                className="pointer-events-none"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Floating Bottom Right Zoom Controller Bar */}
      <div className={`flex items-center gap-1 p-1 backdrop-blur-md rounded-2xl border transition-colors ${
        isDarkMode
          ? "bg-[#121A1F]/95 border-[#39433F] shadow-[0_8px_28px_rgba(0,0,0,0.5)] text-[#E7E2D8]"
          : "bg-[#F2EFE7]/95 border-[#C7AE82]/80 shadow-[0_8px_24px_rgba(0,0,0,0.12)] text-[#121A1F]"
      }`}>
        <button
          onClick={() => handleZoom(0.8)}
          className={`p-2 rounded-xl transition-colors cursor-pointer ${btnHoverClass}`}
          title="Zoom Out (-)"
        >
          <ZoomOut size={16} />
        </button>

        <button
          onClick={onResetZoom}
          className={`px-2 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer min-w-12 text-center ${
            isDarkMode ? "text-[#E7E2D8] hover:bg-[#192126]" : "text-[#121A1F] hover:bg-[#E7E2D8]"
          }`}
          title="Reset Zoom to 100%"
        >
          {Math.round(viewport.zoom * 100)}%
        </button>

        <button
          onClick={() => handleZoom(1.25)}
          className={`p-2 rounded-xl transition-colors cursor-pointer ${btnHoverClass}`}
          title="Zoom In (+)"
        >
          <ZoomIn size={16} />
        </button>

        <div className={`w-px h-4 mx-0.5 ${isDarkMode ? "bg-[#39433F]" : "bg-[#C7AE82]/40"}`} />

        <button
          onClick={onFitToScreen}
          className={`p-2 rounded-xl transition-colors cursor-pointer ${btnHoverClass}`}
          title="Fit to Screen (Shift + 1)"
        >
          <Maximize2 size={16} />
        </button>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`p-2 rounded-xl transition-colors cursor-pointer ${
            isOpen
              ? isDarkMode
                ? "bg-[#557C7B]/30 text-[#557C7B] font-semibold"
                : "bg-[#557C7B]/20 text-[#557C7B] font-semibold"
              : btnHoverClass
          }`}
          title="Toggle Minimap Navigator"
        >
          <Compass size={16} />
        </button>
      </div>
    </div>
  );

};
