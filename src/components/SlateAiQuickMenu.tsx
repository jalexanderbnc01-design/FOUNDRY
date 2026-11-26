import React, { useState, useEffect, useRef } from "react";
import {
  Wand2,
  Sparkles,
  Layers,
  GitMerge,
  FileText,
  ListOrdered,
  Workflow,
  ArrowRight,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react";
import { THEME } from "../theme";
import { BoardElement } from "../types";

interface SlateAiQuickMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFullModal: () => void;
  selectedElements: BoardElement[];
  onApplyAiResult: (action: string, result: any) => void;
  boardTitle: string;
}

export const SlateAiQuickMenu: React.FC<SlateAiQuickMenuProps> = ({
  isOpen,
  onClose,
  onOpenFullModal,
  selectedElements,
  onApplyAiResult,
  boardTitle,
}) => {
  const [inquiry, setInquiry] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Esc or click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRunQuickAction = async (action: string, customPrompt?: string) => {
    try {
      setLoadingAction(action);
      setSuccessMsg(null);

      const response = await fetch("/api/ai/whiteboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          selectedElements,
          userPrompt: customPrompt || inquiry,
          boardTitle,
        }),
      });

      const data = await response.json();
      if (data.success && data.result) {
        onApplyAiResult(action, data.result);
        setSuccessMsg(`Applied ${action.replace("_", " ")}`);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        // If API key is not configured or failed, open full modal for interactive debugging
        onOpenFullModal();
        onClose();
      }
    } catch {
      onOpenFullModal();
      onClose();
    } finally {
      setLoadingAction(null);
    }
  };

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiry.trim()) return;
    handleRunQuickAction("generate_notes", inquiry);
  };

  return (
    <div
      ref={menuRef}
      className="absolute top-12 right-12 z-50 w-72 rounded-xl p-3 border shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 select-none"
      style={{
        backgroundColor: THEME.menuPanel, // #151D1E
        borderColor: THEME.borderMain, // #37423E
        color: THEME.mainText, // #E7E1D6
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: THEME.borderMain }}>
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md" style={{ backgroundColor: `${THEME.selected}33` }}>
            <Wand2 size={14} style={{ color: THEME.selected }} />
          </div>
          <span className="font-bold text-xs tracking-wide">SLATE AI</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:opacity-80 transition-opacity cursor-pointer"
          style={{ color: THEME.secondaryText }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Ask prompt input */}
      <form onSubmit={handleInquirySubmit} className="mt-2.5">
        <div
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-colors"
          style={{
            backgroundColor: THEME.mainBar, // #0D1418
            borderColor: THEME.borderMain,
          }}
        >
          <input
            type="text"
            value={inquiry}
            onChange={(e) => setInquiry(e.target.value)}
            placeholder="Ask about this board..."
            className="w-full bg-transparent border-none outline-hidden text-xs placeholder:text-[#909891]"
            style={{ color: THEME.mainText }}
            autoFocus
          />
          <button
            type="submit"
            disabled={!inquiry.trim() || !!loadingAction}
            className="p-1 rounded cursor-pointer disabled:opacity-40 transition-opacity"
            style={{ color: THEME.selected }}
          >
            {loadingAction === "generate_notes" ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
          </button>
        </div>
      </form>

      {/* Success Banner */}
      {successMsg && (
        <div
          className="mt-2 px-2 py-1 rounded text-[11px] flex items-center gap-1.5 font-medium"
          style={{ backgroundColor: `${THEME.selected}20`, color: THEME.selected }}
        >
          <CheckCircle2 size={13} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Quick Actions List */}
      <div className="mt-3">
        <div className="px-1 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: THEME.secondaryText }}>
          Quick Actions
        </div>

        <div className="space-y-0.5 mt-0.5">
          <button
            onClick={() => handleRunQuickAction("summarize")}
            disabled={!!loadingAction}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs text-left transition-colors cursor-pointer"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = THEME.menuHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <div className="flex items-center gap-2">
              <FileText size={13} style={{ color: THEME.warmHighlight }} />
              <span>Summarize</span>
            </div>
            {loadingAction === "summarize" && <Loader2 size={12} className="animate-spin" />}
          </button>

          <button
            onClick={() => handleRunQuickAction("cluster")}
            disabled={!!loadingAction}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs text-left transition-colors cursor-pointer"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = THEME.menuHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <div className="flex items-center gap-2">
              <Layers size={13} style={{ color: THEME.selected }} />
              <span>Cluster Ideas</span>
            </div>
            {loadingAction === "cluster" && <Loader2 size={12} className="animate-spin" />}
          </button>

          <button
            onClick={() => handleRunQuickAction("generate_notes", "Generate 5 new creative ideas related to this board")}
            disabled={!!loadingAction}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs text-left transition-colors cursor-pointer"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = THEME.menuHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={13} style={{ color: THEME.warmHighlight }} />
              <span>Generate Notes</span>
            </div>
            {loadingAction === "generate_notes" && <Loader2 size={12} className="animate-spin" />}
          </button>

          <button
            onClick={() => handleRunQuickAction("flowchart")}
            disabled={!!loadingAction}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs text-left transition-colors cursor-pointer"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = THEME.menuHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <div className="flex items-center gap-2">
              <Workflow size={13} style={{ color: THEME.coolUtility }} />
              <span>Create Flowchart</span>
            </div>
            {loadingAction === "flowchart" && <Loader2 size={12} className="animate-spin" />}
          </button>

          <button
            onClick={() => handleRunQuickAction("action_items")}
            disabled={!!loadingAction}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs text-left transition-colors cursor-pointer"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = THEME.menuHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <div className="flex items-center gap-2">
              <ListOrdered size={13} style={{ color: THEME.selected }} />
              <span>Create Action Items</span>
            </div>
            {loadingAction === "action_items" && <Loader2 size={12} className="animate-spin" />}
          </button>
        </div>
      </div>

      {/* Footer link to Advanced Modal */}
      <div className="mt-2.5 pt-2 border-t flex items-center justify-between" style={{ borderColor: THEME.borderMain }}>
        <button
          onClick={() => {
            onClose();
            onOpenFullModal();
          }}
          className="text-[11px] font-semibold hover:underline cursor-pointer flex items-center gap-1"
          style={{ color: THEME.secondaryText }}
        >
          <span>Open AI Assistant panel</span>
          <ArrowRight size={11} />
        </button>
        <span className="text-[10px] opacity-50 font-mono">⌘J</span>
      </div>
    </div>
  );
};
