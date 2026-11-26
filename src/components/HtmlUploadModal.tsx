import React, { useState, useRef, useMemo } from "react";
import DOMPurify from "dompurify";
import {
  X,
  Upload,
  Code2,
  Sparkles,
  Check,
  Eye,
  ShieldCheck,
  RotateCcw,
  Copy,
  Layers,
} from "lucide-react";

interface HtmlUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertHtml: (html: string, title?: string) => void;
  isDarkMode?: boolean;
}

interface TemplateItem {
  name: string;
  desc: string;
  badge: string;
  html: string;
}

const SAMPLE_HTML_TEMPLATES: TemplateItem[] = [
  {
    name: "Product Feature Card",
    badge: "UI Card",
    desc: "Header, pill badge, bullet list, and button",
    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 4px;">
  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
    <span style="font-size: 11px; font-weight: 700; background: #e0f2fe; color: #0284c7; padding: 3px 8px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.04em;">Release v2.4</span>
    <span style="font-size: 11px; color: #64748b;">Live Preview</span>
  </div>
  <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 700; color: #0f172a;">Real-Time Collaborative Engine</h3>
  <p style="margin: 0 0 12px 0; font-size: 13px; color: #475569; line-height: 1.5;">
    Broadcast pointer vectors and document operations across zero-latency WebSockets with conflict-free state merging.
  </p>
  <ul style="margin: 0 0 14px 0; padding-left: 18px; font-size: 12px; color: #334155; line-height: 1.6;">
    <li>Multiplayer presence & live cursor paths</li>
    <li>Interactive live DOM synchronization</li>
    <li>One-click rasterization snapshot</li>
  </ul>
  <div style="display: flex; gap: 8px;">
    <button style="background: #2563eb; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
      Explore Docs &rarr;
    </button>
  </div>
</div>`,
  },
  {
    name: "Metrics & Data Table",
    badge: "Analytics Table",
    desc: "Clean data table with target metrics and growth badges",
    html: `<div style="font-family: system-ui, -apple-system, sans-serif; padding: 2px;">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
    <strong style="font-size: 14px; color: #1e293b;">Q3 Whiteboard Performance</strong>
    <span style="font-size: 11px; background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 9999px; font-weight: 700;">+24.8% YoY</span>
  </div>
  <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
    <thead>
      <tr style="border-bottom: 2px solid #e2e8f0; color: #64748b;">
        <th style="padding: 6px 4px;">Metric</th>
        <th style="padding: 6px 4px;">Target</th>
        <th style="padding: 6px 4px;">Actual</th>
        <th style="padding: 6px 4px;">Status</th>
      </tr>
    </thead>
    <tbody style="color: #334155;">
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 6px 4px; font-weight: 500;">Active Sessions</td>
        <td style="padding: 6px 4px;">12,000</td>
        <td style="padding: 6px 4px; font-weight: 600; color: #0284c7;">14,350</td>
        <td style="padding: 6px 4px;"><span style="color: #16a34a; font-weight: 600;">● Exceeded</span></td>
      </tr>
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 6px 4px; font-weight: 500;">Sync Latency</td>
        <td style="padding: 6px 4px;">&lt; 50ms</td>
        <td style="padding: 6px 4px; font-weight: 600; color: #0284c7;">28ms</td>
        <td style="padding: 6px 4px;"><span style="color: #16a34a; font-weight: 600;">● Nominal</span></td>
      </tr>
      <tr>
        <td style="padding: 6px 4px; font-weight: 500;">Canvas Render FPS</td>
        <td style="padding: 6px 4px;">60 FPS</td>
        <td style="padding: 6px 4px; font-weight: 600; color: #0284c7;">60 FPS</td>
        <td style="padding: 6px 4px;"><span style="color: #16a34a; font-weight: 600;">● Smooth</span></td>
      </tr>
    </tbody>
  </table>
</div>`,
  },
  {
    name: "Cyber Callout Banner",
    badge: "3D Callout",
    desc: "Dark mode banner with high contrast typography",
    html: `<div style="font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; padding: 16px; border-radius: 10px; border: 1px solid #334155;">
  <div style="display: flex; gap: 12px; align-items: flex-start;">
    <div style="font-size: 24px; line-height: 1;">⚡</div>
    <div style="flex: 1;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #38bdf8; font-weight: 700; margin-bottom: 4px;">Simulated CSS3D Perspective</div>
      <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 6px;">3D Canvas Layer Ready</div>
      <p style="font-size: 12px; color: #94a3b8; margin: 0 0 10px 0; line-height: 1.5;">
        Toggle the <b>3D TILT</b> switch in the canvas HUD to tilt this HTML card into 3D space with genuine perspective and depth.
      </p>
      <span style="font-size: 11px; background: #1e293b; color: #5eead4; border: 1px solid #0f766e; padding: 2px 8px; border-radius: 4px; font-family: monospace;">
        rotateX(36deg) rotateZ(-3deg)
      </span>
    </div>
  </div>
</div>`,
  },
];

export const HtmlUploadModal: React.FC<HtmlUploadModalProps> = ({
  isOpen,
  onClose,
  onInsertHtml,
  isDarkMode = false,
}) => {
  const [htmlCode, setHtmlCode] = useState(SAMPLE_HTML_TEMPLATES[0].html);
  const [cardTitle, setCardTitle] = useState("Product Feature Card");
  const [isDragging, setIsDragging] = useState(false);
  const [previewBg, setPreviewBg] = useState<"canvas" | "white" | "dark">("canvas");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time sanitized HTML preview calculation via DOMPurify instantly as user types
  const sanitizedPreview = useMemo(() => {
    if (!htmlCode.trim()) return "";
    return DOMPurify.sanitize(htmlCode, {
      ADD_ATTR: ["target", "rel", "style", "class"],
      ADD_TAGS: ["style", "iframe"],
    });
  }, [htmlCode]);

  const lineCount = useMemo(() => {
    return htmlCode.split("\n").length;
  }, [htmlCode]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readAndSetFile(file);
  };

  const readAndSetFile = (file: File) => {
    const cleanName = file.name.replace(/\.[^/.]+$/, "");
    setCardTitle(cleanName);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setHtmlCode(content);
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      readAndSetFile(file);
    }
  };

  const handleInsert = () => {
    if (!htmlCode.trim()) return;
    onInsertHtml(htmlCode, cardTitle.trim() || "HTML Card");
    onClose();
  };

  const handleSelectTemplate = (tmpl: TemplateItem) => {
    setHtmlCode(tmpl.html);
    setCardTitle(tmpl.name);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(htmlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[90vh] max-h-[850px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Code2 size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-800">
                  HTML Card Creator
                </h2>
                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Layers size={11} />
                  Split-Pane Real-Time Preview
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Input raw HTML on the left and see the sanitized layout rendered live on the right as you type.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Subheader: Templates & Card Title */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 border-b border-slate-200 bg-white shrink-0">
          {/* Quick Starter Templates */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium text-[11px] flex items-center gap-1">
              <Sparkles size={12} className="text-amber-500" />
              Templates:
            </span>
            <div className="flex items-center gap-1.5">
              {SAMPLE_HTML_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.name}
                  onClick={() => handleSelectTemplate(tmpl)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    cardTitle === tmpl.name
                      ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200 shadow-2xs"
                      : "text-slate-600 hover:bg-slate-100 border border-transparent"
                  }`}
                  title={tmpl.desc}
                >
                  {tmpl.badge}
                </button>
              ))}
            </div>
          </div>

          {/* Card Title Input */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Card Title:
            </label>
            <input
              type="text"
              value={cardTitle}
              onChange={(e) => setCardTitle(e.target.value)}
              placeholder="e.g. Product Feature Card"
              className="px-2.5 py-1 text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden w-48 sm:w-60"
            />
          </div>
        </div>

        {/* ================= SPLIT-PANE LAYOUT ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 flex-1 overflow-hidden">
          {/* ================= LEFT PANE: RAW HTML TEXTAREA ================= */}
          <div
            className={`flex flex-col h-full overflow-hidden bg-slate-50/50 relative ${
              isDragging ? "ring-2 ring-blue-500 ring-inset bg-blue-50/30" : ""
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Hidden file input for uploading */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm,.txt"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Left Pane Header */}
            <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Code2 size={15} className="text-blue-600" />
                <span className="text-xs font-bold text-slate-800">Raw HTML Input</span>
                <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                  {lineCount} {lineCount === 1 ? "line" : "lines"} · {htmlCode.length} chars
                </span>
              </div>

              {/* Toolbar actions for textarea */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2 py-1 text-[11px] font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                  title="Upload .html file from computer"
                >
                  <Upload size={12} className="text-blue-500" />
                  <span>Upload .html</span>
                </button>
                <button
                  onClick={handleCopyCode}
                  className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                  title="Copy raw markup to clipboard"
                >
                  {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
                <button
                  onClick={() => setHtmlCode("")}
                  className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                  title="Clear input"
                >
                  <RotateCcw size={12} />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            {/* Raw HTML Textarea Area */}
            <div className="flex-1 p-3 flex flex-col min-h-0 relative">
              <div className="flex-1 relative border border-slate-300 rounded-xl overflow-hidden shadow-2xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 bg-white flex flex-col">
                <textarea
                  value={htmlCode}
                  onChange={(e) => setHtmlCode(e.target.value)}
                  placeholder="Type or paste your raw HTML here... (e.g. <div><h2>Welcome</h2><p>Interactive DOM</p></div>)"
                  className="w-full flex-1 p-3.5 font-mono text-xs text-slate-800 bg-white outline-hidden resize-none leading-relaxed overflow-y-auto selection:bg-blue-100"
                  spellCheck={false}
                  autoFocus
                />
              </div>

              {/* Left Pane Status & Drag/Drop Notice */}
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Live updating as you type</span>
                </span>
                <span className="hidden sm:inline text-slate-400">
                  Tip: Drag & drop any .html file onto this pane
                </span>
              </div>
            </div>
          </div>

          {/* ================= RIGHT PANE: REAL-TIME PREVIEW WINDOW ================= */}
          <div className="flex flex-col h-full overflow-hidden bg-slate-100/70">
            {/* Right Pane Header */}
            <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Eye size={15} className="text-blue-600" />
                <span className="text-xs font-bold text-slate-800">Real-Time Preview</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <ShieldCheck size={11} className="text-emerald-600" />
                  <span>DOMPurify Sanitized</span>
                </span>
              </div>

              {/* Backdrop Style Switcher */}
              <div className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
                <span className="text-slate-400 mr-1 text-[10px]">Backdrop:</span>
                <button
                  onClick={() => setPreviewBg("canvas")}
                  className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                    previewBg === "canvas"
                      ? "bg-slate-200 text-slate-900 font-semibold"
                      : "hover:bg-slate-100 text-slate-600"
                  }`}
                  title="Canvas dot grid"
                >
                  Dots
                </button>
                <button
                  onClick={() => setPreviewBg("white")}
                  className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                    previewBg === "white"
                      ? "bg-slate-200 text-slate-900 font-semibold"
                      : "hover:bg-slate-100 text-slate-600"
                  }`}
                  title="Clean white background"
                >
                  Light
                </button>
                <button
                  onClick={() => setPreviewBg("dark")}
                  className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                    previewBg === "dark"
                      ? "bg-slate-800 text-white font-semibold"
                      : "hover:bg-slate-100 text-slate-600"
                  }`}
                  title="Dark slate background"
                >
                  Dark
                </button>
              </div>
            </div>

            {/* Preview Viewport Stage */}
            <div
              className={`flex-1 p-4 overflow-y-auto flex items-center justify-center relative transition-colors ${
                previewBg === "canvas"
                  ? "bg-[#f8fafc]"
                  : previewBg === "white"
                  ? "bg-white"
                  : "bg-slate-900"
              }`}
              style={
                previewBg === "canvas"
                  ? {
                      backgroundImage:
                        "radial-gradient(circle, #cbd5e1 1.2px, transparent 1.2px)",
                      backgroundSize: "20px 20px",
                    }
                  : undefined
              }
            >
              {sanitizedPreview ? (
                /* Simulated Whiteboard Card Frame */
                <div className="w-full max-w-md bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.12)] border border-slate-300/80 overflow-hidden flex flex-col max-h-[460px] animate-in fade-in zoom-in-98 duration-100">
                  {/* Simulated Card Header matching canvas card */}
                  <div className="h-8 px-3 bg-slate-900 text-slate-200 text-[11px] font-mono font-medium flex items-center justify-between select-none border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-bold text-white tracking-wider truncate">
                        PASTED · HTML
                      </span>
                      <span className="text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded truncate">
                        {cardTitle || "LIVE DOM"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <span className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">
                        LIVE DOM
                      </span>
                    </div>
                  </div>

                  {/* Sanitized HTML Live Output Container */}
                  <div className="p-4 overflow-y-auto flex-1 text-slate-800 text-xs selection:bg-blue-100">
                    <div
                      dangerouslySetInnerHTML={{ __html: sanitizedPreview }}
                      className="html-live-rendered-preview break-words leading-relaxed"
                    />
                  </div>

                  {/* Card Simulation Footer */}
                  <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-600 flex items-center justify-between shrink-0 font-mono">
                    <span>Simulated Size: 440×320</span>
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <ShieldCheck size={11} />
                      Safe Sanitized Render
                    </span>
                  </div>
                </div>
              ) : (
                /* Empty / Awaiting Input State */
                <div className="text-center p-8 max-w-xs select-none">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-200/80 text-slate-400 flex items-center justify-center">
                    <Code2 size={24} />
                  </div>
                  <h4 className="text-xs font-bold text-slate-700 mb-1">
                    Awaiting Raw HTML
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                    Type or paste markup in the left textarea, or choose a template above to see the sanitized output rendered here instantly.
                  </p>
                  <button
                    onClick={() => handleSelectTemplate(SAMPLE_HTML_TEMPLATES[0])}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-semibold text-blue-600 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Sparkles size={13} className="text-amber-500" />
                    <span>Load Sample Template</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="hidden sm:inline">Tip: You can also copy HTML from any webpage and press</span>
            <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-700 font-mono text-[10px] shadow-2xs">
              Ctrl+V
            </kbd>
            <span>directly on the canvas</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleInsert}
              disabled={!htmlCode.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none rounded-xl shadow-xs hover:shadow transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check size={14} />
              <span>Insert HTML Card to Canvas</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
