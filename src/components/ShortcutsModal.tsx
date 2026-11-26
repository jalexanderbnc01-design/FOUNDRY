import React, { useState } from "react";
import { X, Keyboard, Search } from "lucide-react";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
}

interface ShortcutCategory {
  title: string;
  items: { key: string; action: string; badge?: string }[];
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: "Core Tools",
    items: [
      { key: "V", action: "Select & Move tool" },
      { key: "H", action: "Hand / Pan tool" },
      { key: "B", action: "Drawing / Brush tool" },
      { key: "P", action: "Vector Pen (Bézier tool)" },
      { key: "A", action: "Vector Node Edit tool" },
      { key: "E", action: "Eraser tool (Hold E for temporary erase)" },
      { key: "T", action: "Text Box tool" },
      { key: "N", action: "Sticky Note (or S)" },
      { key: "R", action: "Rectangle shape" },
      { key: "O", action: "Ellipse / Circle shape" },
      { key: "L", action: "Line / Connector tool (or C)" },
      { key: "F", action: "Frame / Slide Section" },
      { key: "K", action: "Collaborative Laser Pointer (Hold / Drag)", badge: "Multiplayer" },
      { key: "I", action: "Eyedropper tool (Sample color from canvas)" },
      { key: "Ctrl / ⌘ + K", action: "Search whiteboard objects and jump to element" },
      { key: "Ctrl / ⌘ + Shift + E", action: "Export Board dialog (PNG / SVG / JSON)", badge: "Export" },
      { key: "Q", action: "Hold Q for 8-Way Quick Tool Radial Menu", badge: "Slate" },
    ],
  },
  {
    title: "Drawing & Vector Mode",
    items: [
      { key: "Shift + B", action: "Cycle Brush (Pen → Pencil → Marker → Highlighter)" },
      { key: "[ / ]", action: "Decrease / Increase brush size" },
      { key: "Hold E", action: "Temporarily switch to eraser (returns on release)" },
      { key: "Enter", action: "Finish open vector path" },
      { key: "Alt + Drag Handle", action: "Break Bézier handles symmetry (independent handles)" },
      { key: "Double-Click Node", action: "Toggle Corner ↔ Smooth Bézier curves" },
      { key: "Double-Click Path", action: "Enter Vector Node Edit mode" },
      { key: "Delete / Backspace", action: "Delete selected vector node or elements" },
    ],
  },
  {
    title: "Navigation & Viewport",
    items: [
      { key: "Mouse Wheel", action: "Spatial zoom toward cursor" },
      { key: "Ctrl / ⌘ + Wheel", action: "Precision zoom" },
      { key: "Shift + Wheel", action: "Horizontal pan" },
      { key: "Hold Space + Drag", action: "Temporary Pan canvas" },
      { key: "Middle-Mouse Drag", action: "Pan anytime" },
      { key: "Shift + 1", action: "Zoom to entire board (Fit all)" },
      { key: "Shift + 2", action: "Zoom to current selection" },
      { key: "0", action: "Reset zoom to 100%" },
      { key: "Alt + Middle Drag", action: "Tilt / Orbit in 3D Perspective mode", badge: "3D" },
      { key: "Double Middle-Click", action: "Reset 3D camera angle to default", badge: "3D" },
      { key: "Tab", action: "Toggle Clean Board Mode (Zen canvas)", badge: "Zen" },
      { key: "Shift + Tab", action: "Toggle Presentation / Slide Mode" },
    ],
  },
  {
    title: "Selection & Manipulation",
    items: [
      { key: "Ctrl / ⌘ + A", action: "Select all elements" },
      { key: "Shift + Click", action: "Toggle add/remove object from selection" },
      { key: "Ctrl / ⌘ + Click", action: "Drill-through cycle overlapping objects" },
      { key: "Alt + Drag", action: "Duplicate object while dragging" },
      { key: "Shift + Drag", action: "Constrain movement to straight axis or 1:1 shape" },
      { key: "Shift + Alt + Drag", action: "Create centered perfect circle or square" },
      { key: "Arrow Keys", action: "Nudge selected elements by 1 px" },
      { key: "Shift + Arrow Keys", action: "Nudge selected elements by 10 px" },
      { key: "Ctrl / ⌘ + D", action: "Duplicate selection" },
      { key: "Ctrl / ⌘ + C / V", action: "Copy and Paste" },
      { key: "Ctrl / ⌘ + Z", action: "Undo" },
      { key: "Ctrl / ⌘ + Shift + Z", action: "Redo (or Ctrl / ⌘ + Y)" },
      { key: "Ctrl / ⌘ + G", action: "Group selected objects" },
      { key: "Ctrl / ⌘ + Shift + G", action: "Ungroup selected objects" },
      { key: "Ctrl / ⌘ + L", action: "Toggle Lock / Unlock selection" },
      { key: "Ctrl / ⌘ + ]", action: "Bring Forward (+1 layer)" },
      { key: "Ctrl / ⌘ + [", action: "Send Backward (-1 layer)" },
      { key: "Ctrl / ⌘ + Shift + ]", action: "Bring to Front" },
      { key: "Ctrl / ⌘ + Shift + [", action: "Send to Back" },
      { key: "Esc", action: "Deselect, exit node editing, or exit follow mode" },
    ],
  },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  isOpen,
  onClose,
  isDarkMode = false,
}) => {
  const [search, setSearch] = useState("");

  if (!isOpen) return null;

  const filteredCategories = SHORTCUT_CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (item) =>
        item.action.toLowerCase().includes(search.toLowerCase()) ||
        item.key.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((cat) => cat.items.length > 0);

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div
        className={`rounded-2xl max-w-2xl w-full p-5 shadow-2xl border flex flex-col max-h-[85vh] ${
          isDarkMode
            ? "bg-slate-900 border-slate-800 text-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.7)]"
            : "bg-white border-slate-200 text-slate-900 shadow-2xl"
        }`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between pb-3 border-b ${
            isDarkMode ? "border-slate-800" : "border-slate-100"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isDarkMode ? "bg-blue-950/80 text-blue-400 border border-blue-900" : "bg-blue-50 text-blue-600 border border-blue-100"
              }`}
            >
              <Keyboard size={20} />
            </div>
            <div>
              <h3 className={`font-bold text-base ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
                Keyboard & Mouse Controls
              </h3>
              <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Figma + Illustrator + Miro + Slate workflow shortcuts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isDarkMode
                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search filter */}
        <div className="py-2.5 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search shortcut (e.g., zoom, duplicate, pen, alt)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-8 pr-3 py-1.5 rounded-xl text-xs outline-none border transition-all ${
              isDarkMode
                ? "bg-slate-800/80 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-blue-500"
                : "bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-500"
            }`}
          />
        </div>

        {/* Shortcuts list */}
        <div
          className={`flex-1 overflow-y-auto space-y-4 pr-1 text-xs divide-y ${
            isDarkMode ? "divide-slate-800/80" : "divide-slate-100"
          }`}
        >
          {filteredCategories.map((cat) => (
            <div key={cat.title} className="pt-3 first:pt-0">
              <div className="font-semibold text-[11px] uppercase tracking-wider text-blue-500 mb-1.5 flex items-center gap-1.5">
                <span>{cat.title}</span>
                <span className="text-[10px] font-normal text-slate-400">({cat.items.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5">
                {cat.items.map(({ key, action, badge }) => (
                  <div
                    key={key + action}
                    className={`py-1.5 px-2 rounded-lg flex items-center justify-between gap-2 transition-colors ${
                      isDarkMode ? "hover:bg-slate-800/50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={`truncate ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                        {action}
                      </span>
                      {badge && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/20 uppercase tracking-wider">
                          {badge}
                        </span>
                      )}
                    </div>
                    <kbd
                      className={`shrink-0 px-2 py-0.5 border rounded-md font-mono font-semibold text-[11px] shadow-2xs whitespace-nowrap ${
                        isDarkMode
                          ? "bg-slate-800 border-slate-700 text-slate-200"
                          : "bg-slate-100 border-slate-200 text-slate-800"
                      }`}
                    >
                      {key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className={`pt-3 mt-2 border-t flex items-center justify-between text-xs ${
            isDarkMode ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-500"
          }`}
        >
          <span>Tip: Press <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">?</kbd> anytime to toggle this modal</span>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 font-semibold text-xs rounded-xl transition-colors cursor-pointer ${
              isDarkMode
                ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};


