import React, { useState } from "react";
import {
  Sparkles,
  X,
  Layers,
  GitMerge,
  CheckSquare,
  Copy,
  PlusCircle,
  ArrowRight,
  Loader2,
  Wand2,
  ListTree,
  Search,
} from "lucide-react";
import { BoardElement } from "../types";

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedElements: BoardElement[];
  onApplyAiResult: (action: string, result: any) => void;
  isDarkMode?: boolean;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  selectedElements,
  onApplyAiResult,
  isDarkMode = false,
}) => {
  const [selectedAction, setSelectedAction] = useState<
    | "summarize"
    | "cluster"
    | "flowchart"
    | "action_items"
    | "find_duplicates"
    | "generate_notes"
  >(selectedElements.length > 0 ? "summarize" : "generate_notes");

  const [userPrompt, setUserPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExecute = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const response = await fetch("/api/ai/whiteboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: selectedAction,
          selectedElements,
          userPrompt,
          boardTitle: "Slate Collaborative Whiteboard",
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "AI assistant returned an error.");
      }

      onApplyAiResult(selectedAction, data.result);
      onClose();
    } catch (err: any) {
      console.error("AI execution error:", err);
      setErrorMsg(err.message || "Failed to execute AI request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const actionCards = [
    {
      id: "summarize",
      title: "Summarize Notes",
      desc: "Synthesize selected notes into key takeaways and a summary card.",
      icon: <Sparkles size={18} className="text-amber-500" />,
      requiresSelection: true,
    },
    {
      id: "cluster",
      title: "Auto-Cluster Ideas",
      desc: "Group scattered notes into thematic categories with color coding.",
      icon: <Layers size={18} className="text-blue-500" />,
      requiresSelection: true,
    },
    {
      id: "flowchart",
      title: "Create Flowchart",
      desc: "Convert steps or processes into linked shapes with connectors.",
      icon: <GitMerge size={18} className="text-emerald-500" />,
      requiresSelection: false,
    },
    {
      id: "action_items",
      title: "Extract Action Items",
      desc: "Turn brainstormed thoughts into prioritized action tasks.",
      icon: <CheckSquare size={18} className="text-purple-500" />,
      requiresSelection: false,
    },
    {
      id: "find_duplicates",
      title: "Find Duplicate Ideas",
      desc: "Identify overlapping concepts and recommendations to merge.",
      icon: <Search size={18} className="text-rose-500" />,
      requiresSelection: true,
    },
    {
      id: "generate_notes",
      title: "Brainstorm Sticky Notes",
      desc: "Generate 4–6 creative notes from your custom prompt or goal.",
      icon: <Wand2 size={18} className="text-cyan-500" />,
      requiresSelection: false,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ${
          isDarkMode
            ? "bg-slate-900 border-slate-700 text-slate-100"
            : "bg-white border-slate-200 text-slate-900"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isDarkMode ? "border-slate-800 bg-slate-950/70" : "border-slate-100 bg-slate-50/70"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500/20 to-blue-500/20 border border-amber-500/30 text-amber-500">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                Whiteboard AI Assistant
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  Gemini 2.5 Flash
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedElements.length > 0
                  ? `${selectedElements.length} object${selectedElements.length > 1 ? "s" : ""} selected for AI processing`
                  : "Select an AI action or enter a prompt to generate notes"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Action selection grid */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2.5">
              Select AI Action
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {actionCards.map((act) => {
                const isChosen = selectedAction === act.id;
                const isDimmed = act.requiresSelection && selectedElements.length === 0;

                return (
                  <button
                    key={act.id}
                    onClick={() => setSelectedAction(act.id as any)}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                      isChosen
                        ? isDarkMode
                          ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50"
                          : "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500/40"
                        : isDarkMode
                        ? "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    } ${isDimmed ? "opacity-60" : ""}`}
                  >
                    <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                      {act.icon}
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>{act.title}</span>
                        {act.requiresSelection && selectedElements.length === 0 && (
                          <span className="text-[9px] text-amber-500 font-mono">(Needs Selection)</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                        {act.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt input field */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
              {selectedAction === "generate_notes"
                ? "Topic or Goal for Sticky Notes"
                : "Additional Instructions (Optional)"}
            </label>
            <input
              type="text"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder={
                selectedAction === "generate_notes"
                  ? "e.g. Onboarding sprint ideas, micro-interactions, user pain points"
                  : "e.g. Focus on mobile usability and performance bottlenecks"
              }
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs outline-hidden transition-colors ${
                isDarkMode
                  ? "bg-slate-950 border-slate-700 text-slate-100 focus:border-blue-500"
                  : "bg-slate-50 border-slate-300 text-slate-800 focus:border-blue-500 focus:bg-white"
              }`}
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-t ${
            isDarkMode ? "border-slate-800 bg-slate-950/70" : "border-slate-100 bg-slate-50/70"
          }`}
        >
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Generated objects appear directly on the canvas.
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleExecute}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Thinking...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Run AI Action</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
