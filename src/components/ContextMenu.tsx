import React, { useEffect, useRef } from "react";
import { BoardElement } from "../types";
import {
  Copy,
  Trash2,
  Lock,
  Unlock,
  BringToFront,
  SendToBack,
  ArrowUp,
  ArrowDown,
  Layers,
  Group,
  Ungroup,
  PenTool,
  Sparkles,
  Image as ImageIcon,
  StickyNote,
  Square,
  Layout,
  Code2,
  Maximize2,
  RotateCcw,
  Eye,
  ClipboardPaste,
} from "lucide-react";

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  targetElement: BoardElement | null;
  selectedElements: BoardElement[];
  hasClipboard: boolean;
  onClose: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onToggleLock: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onConvertToVector?: (id: string) => void;
  onEditNodes?: (id: string) => void;
  onRasterize?: () => void;
  onPaste: () => void;
  onCreateSticky: () => void;
  onCreateShape: () => void;
  onCreateFrame: () => void;
  onCreateHtmlCard: () => void;
  onZoomFit: () => void;
  onResetZoom: () => void;
  onToggleCleanBoard: () => void;
  isDarkMode?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  position,
  targetElement,
  selectedElements,
  hasClipboard,
  onClose,
  onDuplicate,
  onDelete,
  onGroup,
  onUngroup,
  onToggleLock,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onConvertToVector,
  onEditNodes,
  onRasterize,
  onPaste,
  onCreateSticky,
  onCreateShape,
  onCreateFrame,
  onCreateHtmlCard,
  onZoomFit,
  onResetZoom,
  onToggleCleanBoard,
  isDarkMode = false,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Keep menu within screen boundaries
  const menuWidth = 240;
  const menuHeight = targetElement ? 360 : 300;
  const safeX = Math.min(position.x, window.innerWidth - menuWidth - 10);
  const safeY = Math.min(position.y, window.innerHeight - menuHeight - 10);

  const isElementMenu = targetElement !== null || selectedElements.length > 0;
  const isLocked = targetElement?.locked || selectedElements.every((el) => el.locked);

  const itemClass = `w-full px-3 py-1.5 flex items-center justify-between text-xs rounded-lg transition-colors cursor-pointer text-left ${
    isDarkMode
      ? "text-[#E7E2D8] hover:bg-[#192126] hover:text-white"
      : "text-[#121A1F] hover:bg-[#E7E2D8]"
  }`;

  const kbdClass = `font-mono text-[10px] px-1.5 py-0.5 rounded border ${
    isDarkMode
      ? "bg-[#192126] border-[#39433F] text-[#9A9D93]"
      : "bg-[#E7E2D8] border-[#C7AE82]/50 text-[#121A1F]"
  }`;

  return (
    <div
      ref={menuRef}
      style={{ left: safeX, top: safeY }}
      className={`fixed z-[250] w-60 rounded-2xl p-1.5 border shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 select-none ${
        isDarkMode
          ? "bg-[#121A1F]/95 border-[#39433F] shadow-[0_16px_40px_rgba(0,0,0,0.6)] text-[#E7E2D8]"
          : "bg-[#F2EFE7]/95 border-[#C7AE82] shadow-[0_12px_32px_rgba(0,0,0,0.14)] text-[#121A1F]"
      }`}
    >
      {isElementMenu ? (
        <>
          {/* Element Actions */}
          <button
            onClick={() => {
              onDuplicate();
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <Copy size={14} className="text-[#557C7B]" />
              <span>Duplicate</span>
            </div>
            <kbd className={kbdClass}>⌘D</kbd>
          </button>

          {selectedElements.length > 1 ? (
            <button
              onClick={() => {
                onGroup();
                onClose();
              }}
              className={itemClass}
            >
              <div className="flex items-center gap-2">
                <Group size={14} className="text-[#7E9B78]" />
                <span>Group Elements</span>
              </div>
              <kbd className={kbdClass}>⌘G</kbd>
            </button>
          ) : targetElement?.groupId ? (
            <button
              onClick={() => {
                onUngroup();
                onClose();
              }}
              className={itemClass}
            >
              <div className="flex items-center gap-2">
                <Ungroup size={14} className="text-[#C4934B]" />
                <span>Ungroup</span>
              </div>
              <kbd className={kbdClass}>⇧⌘G</kbd>
            </button>
          ) : null}

          <button
            onClick={() => {
              onToggleLock();
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              {isLocked ? (
                <Unlock size={14} className="text-[#C4934B]" />
              ) : (
                <Lock size={14} className="text-[#9A9D93]" />
              )}
              <span>{isLocked ? "Unlock Object" : "Lock Object"}</span>
            </div>
            <kbd className={kbdClass}>⌘L</kbd>
          </button>

          <div className={`my-1 h-px ${isDarkMode ? "bg-[#39433F]" : "bg-[#C7AE82]/40"}`} />

          {/* Layer Arrangement */}
          <button
            onClick={() => {
              onBringForward();
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <ArrowUp size={14} className="text-[#9A9D93]" />
              <span>Bring Forward</span>
            </div>
            <kbd className={kbdClass}>⌘]</kbd>
          </button>

          <button
            onClick={() => {
              onSendBackward();
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <ArrowDown size={14} className="text-[#9A9D93]" />
              <span>Send Backward</span>
            </div>
            <kbd className={kbdClass}>⌘[</kbd>
          </button>

          <button
            onClick={() => {
              onBringToFront();
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <BringToFront size={14} className="text-[#557C7B]" />
              <span>Bring to Front</span>
            </div>
            <kbd className={kbdClass}>⇧⌘]</kbd>
          </button>

          <button
            onClick={() => {
              onSendToBack();
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <SendToBack size={14} className="text-[#557C7B]" />
              <span>Send to Back</span>
            </div>
            <kbd className={kbdClass}>⇧⌘[</kbd>
          </button>

          {/* Type-Specific Converters */}
          {(targetElement?.type === "freehand" || targetElement?.type === "shape") && onConvertToVector && (
            <>
              <div className={`my-1 h-px ${isDarkMode ? "bg-[#39433F]" : "bg-[#C7AE82]/40"}`} />
              <button
                onClick={() => {
                  onConvertToVector(targetElement.id);
                  onClose();
                }}
                className={itemClass}
              >
                <div className="flex items-center gap-2">
                  <PenTool size={14} className="text-[#7E9B78]" />
                  <span>Convert to Vector Path</span>
                </div>
              </button>
            </>
          )}

          {targetElement?.type === "vectorPath" && onEditNodes && (
            <>
              <div className={`my-1 h-px ${isDarkMode ? "bg-[#39433F]" : "bg-[#C7AE82]/40"}`} />
              <button
                onClick={() => {
                  onEditNodes(targetElement.id);
                  onClose();
                }}
                className={itemClass}
              >
                <div className="flex items-center gap-2">
                  <PenTool size={14} className="text-[#7E9B78]" />
                  <span>Edit Vector Nodes</span>
                </div>
                <kbd className={kbdClass}>A</kbd>
              </button>
            </>
          )}

          {onRasterize && (
            <button
              onClick={() => {
                onRasterize();
                onClose();
              }}
              className={itemClass}
            >
              <div className="flex items-center gap-2">
                <ImageIcon size={14} className="text-[#7E9B78]" />
                <span>Rasterize to Image</span>
              </div>
            </button>
          )}

          <div className={`my-1 h-px ${isDarkMode ? "bg-[#39433F]" : "bg-[#C7AE82]/40"}`} />

          {/* Delete */}
          <button
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="w-full px-3 py-1.5 flex items-center justify-between text-xs rounded-lg transition-colors cursor-pointer text-left text-[#A55445] hover:bg-[#A55445]/15"
          >
            <div className="flex items-center gap-2">
              <Trash2 size={14} />
              <span>Delete</span>
            </div>
            <kbd className={kbdClass}>Del</kbd>
          </button>
        </>
      ) : (
        <>
          {/* Canvas Space Actions */}
          <button
            onClick={() => {
              onPaste();
              onClose();
            }}
            disabled={!hasClipboard}
            className={`${itemClass} ${!hasClipboard ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <div className="flex items-center gap-2">
              <ClipboardPaste size={14} className="text-[#557C7B]" />
              <span>Paste</span>
            </div>
            <kbd className={kbdClass}>⌘V</kbd>
          </button>

          <div className={`my-1 h-px ${isDarkMode ? "bg-[#39433F]" : "bg-[#C7AE82]/40"}`} />

          <button
            onClick={() => {
              onCreateSticky();
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <StickyNote size={14} className="text-[#C4934B]" />
              <span>New Sticky Note</span>
            </div>
            <kbd className={kbdClass}>N</kbd>
          </button>

          <button
            onClick={() => {
              onCreateShape();
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <Square size={14} className="text-[#557C7B]" />
              <span>Add Shape</span>
            </div>
            <kbd className={kbdClass}>R</kbd>
          </button>

          <button
            onClick={() => {
              onCreateFrame();
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <Layout size={14} className="text-[#7E9B78]" />
              <span>New Frame / Section</span>
            </div>
            <kbd className={kbdClass}>F</kbd>
          </button>

          <button
            onClick={() => {
              onCreateHtmlCard();
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <Code2 size={14} className="text-[#C4934B]" />
              <span>Add HTML Component</span>
            </div>
          </button>

          <div className={`my-1 h-px ${isDarkMode ? "bg-[#39433F]" : "bg-[#C7AE82]/40"}`} />

          <button
            onClick={() => {
              onZoomFit();
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <Maximize2 size={14} className="text-[#9A9D93]" />
              <span>Zoom to Fit Board</span>
            </div>
            <kbd className={kbdClass}>⇧1</kbd>
          </button>

          <button
            onClick={() => {
              onResetZoom();
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <RotateCcw size={14} className="text-[#9A9D93]" />
              <span>Reset Zoom to 100%</span>
            </div>
            <kbd className={kbdClass}>0</kbd>
          </button>

          <button
            onClick={() => {
              onToggleCleanBoard();
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <Eye size={14} className="text-[#9A9D93]" />
              <span>Clean Board Mode</span>
            </div>
            <kbd className={kbdClass}>Tab</kbd>
          </button>
        </>
      )}
    </div>
  );
};
