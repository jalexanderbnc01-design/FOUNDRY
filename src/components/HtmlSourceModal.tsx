import React, { useState, useEffect } from "react";
import DOMPurify from "dompurify";
import { BoardElement } from "../types";
import { X, Code, Check, Copy } from "lucide-react";

interface HtmlSourceModalProps {
  element: BoardElement | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updatedHtml: string) => void;
}

export const HtmlSourceModal: React.FC<HtmlSourceModalProps> = ({
  element,
  isOpen,
  onClose,
  onSave,
}) => {
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (element) {
      setCode(element.rawHtml || element.content || "");
    }
  }, [element]);

  if (!isOpen || !element) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleSave = () => {
    const sanitized = DOMPurify.sanitize(code, {
      ADD_ATTR: ["target", "rel", "style", "class"],
      ADD_TAGS: ["style", "iframe"],
    });
    onSave(element.id, sanitized);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Code size={18} className="text-blue-600" />
            <h3 className="font-bold text-sm text-slate-800">
              HTML Card Source: {element.title || element.sourceName || "Card"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Raw HTML Markup</span>
            <button
              onClick={handleCopy}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>

          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={12}
            className="w-full p-3 font-mono text-xs text-slate-800 bg-slate-900 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden resize-y"
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Check size={14} />
            <span>Apply Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
