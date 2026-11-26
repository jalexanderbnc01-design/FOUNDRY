import React from "react";
import { BOARD_TEMPLATES } from "../data/templates";
import { Template, BoardElement } from "../types";
import { generateId } from "../utils/canvasMath";
import { Sparkles, Layout, GitBranch, ArrowRight, Server, X } from "lucide-react";

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate: (elements: BoardElement[], mode: "replace" | "add") => void;
  isDarkMode?: boolean;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  onApplyTemplate,
  isDarkMode = false,
}) => {
  if (!isOpen) return null;

  const handleSelect = (template: Template, mode: "replace" | "add") => {
    // Generate fresh unique IDs for all elements in template
    const idMap = new Map<string, string>();
    const instantiated: BoardElement[] = template.elements.map((el, i) => {
      const newId = generateId();
      idMap.set(`temp-${i}`, newId);
      return {
        ...el,
        id: newId,
      } as BoardElement;
    });

    onApplyTemplate(instantiated, mode);
    onClose();
  };

  const getIcon = (category: string) => {
    switch (category) {
      case "Agile":
        return <Layout className="text-blue-500" size={20} />;
      case "Brainstorming":
        return <Sparkles className="text-amber-500" size={20} />;
      case "Diagramming":
        return <GitBranch className="text-emerald-500" size={20} />;
      case "Architecture":
        return <Server className="text-purple-500" size={20} />;
      default:
        return <Layout size={20} />;
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className={`rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border animate-in fade-in zoom-in-95 ${
        isDarkMode
          ? "bg-slate-900 border-slate-800 text-slate-100"
          : "bg-white border-slate-100 text-slate-900"
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${
          isDarkMode ? "border-slate-800" : "border-slate-100"
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isDarkMode ? "bg-amber-950/70 text-amber-400" : "bg-amber-100 text-amber-600"
            }`}>
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className={`text-base font-bold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
                Miro Template Library
              </h2>
              <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Kickstart your board with production layouts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors cursor-pointer ${
              isDarkMode
                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Template Cards Grid */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {BOARD_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group ${
                isDarkMode
                  ? "bg-slate-950/60 border-slate-800 hover:border-blue-500/60 hover:bg-slate-850 shadow-xs"
                  : "bg-slate-50/50 border-slate-200 hover:border-blue-400 hover:shadow-md hover:bg-white"
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className={`p-2.5 rounded-xl shadow-xs border transition-transform group-hover:scale-105 ${
                  isDarkMode
                    ? "bg-slate-800 border-slate-700"
                    : "bg-white border-slate-200/80"
                }`}>
                  {getIcon(tmpl.category)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold text-sm ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
                      {tmpl.name}
                    </h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      isDarkMode
                        ? "bg-slate-800 text-slate-300"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {tmpl.category}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 leading-relaxed max-w-md ${
                    isDarkMode ? "text-slate-400" : "text-slate-500"
                  }`}>
                    {tmpl.description}
                  </p>
                  <span className={`text-[11px] font-medium mt-1 inline-block ${
                    isDarkMode ? "text-slate-500" : "text-slate-400"
                  }`}>
                    {tmpl.elements.length} components included
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => handleSelect(tmpl, "add")}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                    isDarkMode
                      ? "border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                      : "border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Insert on Board
                </button>
                <button
                  onClick={() => handleSelect(tmpl, "replace")}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <span>Use Template</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

};
