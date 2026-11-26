import React, { useEffect, useState } from "react";
import { ToolType } from "../types";
import {
  Type,
  StickyNote,
  Square,
  Image as ImageIcon,
  Layout,
  Code2,
  Paintbrush,
  PenTool,
} from "lucide-react";

export interface RadialToolItem {
  id: string;
  name: string;
  key: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  angleDeg: number; // -90 for up, 0 for right, etc.
  tool: ToolType;
  extra?: any;
}

export const RADIAL_TOOLS: RadialToolItem[] = [
  { id: "text", name: "TEXT", key: "T", icon: Type, angleDeg: -90, tool: "text" },
  { id: "note", name: "NOTE", key: "N", icon: StickyNote, angleDeg: -45, tool: "sticky" },
  { id: "shape", name: "SHAPE", key: "R", icon: Square, angleDeg: 0, tool: "shape" },
  { id: "file", name: "FILE", key: "Img", icon: ImageIcon, angleDeg: 45, tool: "image" },
  { id: "frame", name: "FRAME", key: "F", icon: Layout, angleDeg: 90, tool: "frame" },
  { id: "html", name: "HTML", key: "DOM", icon: Code2, angleDeg: 135, tool: "html" },
  { id: "draw", name: "DRAW", key: "B", icon: Paintbrush, angleDeg: 180, tool: "draw" },
  { id: "vector", name: "VECTOR", key: "P", icon: PenTool, angleDeg: -135, tool: "vector-pen" },
];

interface QuickToolRadialMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onSelect: (tool: ToolType, extra?: any) => void;
  onClose: () => void;
  isDarkMode?: boolean;
}

export const QuickToolRadialMenu: React.FC<QuickToolRadialMenuProps> = ({
  isOpen,
  position,
  onSelect,
  onClose,
  isDarkMode = false,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: position.x, y: position.y });

  useEffect(() => {
    if (!isOpen) {
      setHoveredId(null);
      return;
    }
    setMousePos({ x: position.x, y: position.y });

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      const dx = e.clientX - position.x;
      const dy = e.clientY - position.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 22) {
        setHoveredId(null);
        return;
      }

      // Convert angle to -180 to 180
      let deg = (Math.atan2(dy, dx) * 180) / Math.PI;

      // Find closest radial item
      let closestItem: RadialToolItem = RADIAL_TOOLS[0];
      let minDiff = 360;

      for (const item of RADIAL_TOOLS) {
        let diff = Math.abs(deg - item.angleDeg);
        if (diff > 180) diff = 360 - diff;
        if (diff < minDiff) {
          minDiff = diff;
          closestItem = item;
        }
      }

      setHoveredId(closestItem.id);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "q" || e.key === "Q") {
        if (hoveredId) {
          const item = RADIAL_TOOLS.find((t) => t.id === hoveredId);
          if (item) {
            onSelect(item.tool, item.extra);
          }
        }
        onClose();
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isOpen, position, hoveredId, onSelect, onClose]);

  if (!isOpen) return null;

  const RADIUS = 84;

  return (
    <div
      className="fixed inset-0 z-[250] pointer-events-none select-none"
      style={{ overflow: "hidden" }}
    >
      {/* Center hub */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
        style={{ left: position.x, top: position.y }}
      >
        {/* Outer radial background glow ring */}
        <div
          className={`absolute -inset-24 rounded-full pointer-events-none transition-opacity duration-300 blur-xl ${
            isDarkMode ? "bg-blue-600/15" : "bg-blue-400/20"
          }`}
        />

        {/* Backdrop wheel plate */}
        <div
          className={`w-52 h-52 -translate-x-1/2 -translate-y-1/2 absolute left-0 top-0 rounded-full border shadow-2xl backdrop-blur-xl transition-all duration-200 ${
            isDarkMode
              ? "bg-slate-900/90 border-slate-700/80 shadow-[0_0_50px_rgba(0,0,0,0.8)]"
              : "bg-white/92 border-slate-200/90 shadow-[0_12px_40px_rgba(0,0,0,0.15)]"
          }`}
        >
          {/* Subtle guide radial lines */}
          <svg className="w-full h-full absolute inset-0 opacity-15 pointer-events-none">
            <line x1="50%" y1="0%" x2="50%" y2="100%" stroke="currentColor" strokeWidth="1" />
            <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="currentColor" strokeWidth="1" />
            <line x1="15%" y1="15%" x2="85%" y2="85%" stroke="currentColor" strokeWidth="1" />
            <line x1="15%" y1="85%" x2="85%" y2="15%" stroke="currentColor" strokeWidth="1" />
          </svg>
        </div>

        {/* Center Pill / Q indicator */}
        <div
          className={`w-12 h-12 -translate-x-1/2 -translate-y-1/2 absolute left-0 top-0 rounded-full flex flex-col items-center justify-center font-bold shadow-lg border transition-all z-20 ${
            isDarkMode
              ? "bg-slate-800 border-slate-700 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
              : "bg-blue-50 border-blue-200 text-blue-600 shadow-sm"
          }`}
        >
          <span className="text-sm tracking-tight font-black leading-none">Q</span>
          <span className="text-[8px] font-medium opacity-60 leading-none mt-0.5">HOLD</span>
        </div>

        {/* Radial items */}
        {RADIAL_TOOLS.map((item) => {
          const rad = (item.angleDeg * Math.PI) / 180;
          const x = Math.round(Math.cos(rad) * RADIUS);
          const y = Math.round(Math.sin(rad) * RADIUS);
          const isHovered = hoveredId === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => {
                onSelect(item.tool, item.extra);
                onClose();
              }}
              style={{
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${
                  isHovered ? 1.15 : 1
                })`,
              }}
              className={`absolute left-0 top-0 w-11 h-11 rounded-2xl flex flex-col items-center justify-center transition-all duration-150 cursor-pointer pointer-events-auto z-30 group ${
                isHovered
                  ? "bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.6)] ring-2 ring-blue-400 border-transparent scale-110"
                  : isDarkMode
                  ? "bg-slate-800/90 text-slate-300 border border-slate-700 hover:text-white"
                  : "bg-white/90 text-slate-700 border border-slate-200 shadow-sm hover:text-slate-900"
              }`}
            >
              <Icon size={16} />
              <span className="text-[8px] font-bold tracking-wider leading-none mt-0.5">
                {item.name}
              </span>

              {/* Shortcut key tag tooltip */}
              {isHovered && (
                <span className="absolute -bottom-5 px-1.5 py-0.2 rounded bg-black/80 text-white text-[9px] font-mono whitespace-nowrap shadow-md pointer-events-none">
                  Key {item.key}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
