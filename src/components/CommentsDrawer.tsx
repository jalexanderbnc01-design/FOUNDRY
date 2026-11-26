import React, { useState } from "react";
import { BoardElement } from "../types";
import {
  MessageSquare,
  X,
  Check,
  RotateCcw,
  Trash2,
  Search,
  MapPin,
  Plus,
  CornerDownRight,
  Filter,
} from "lucide-react";

interface CommentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  elements: BoardElement[];
  onSelectComment: (comment: BoardElement) => void;
  onUpdateElement?: (id: string, partial: Partial<BoardElement>) => void;
  onDeleteElement?: (id: string) => void;
  onActivateCommentTool?: () => void;
  isDarkMode?: boolean;
}

type FilterTab = "all" | "open" | "resolved";

export const CommentsDrawer: React.FC<CommentsDrawerProps> = ({
  isOpen,
  onClose,
  elements,
  onSelectComment,
  onUpdateElement,
  onDeleteElement,
  onActivateCommentTool,
  isDarkMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  // Extract all comment elements
  const allComments = elements.filter((el) => el.type === "comment");
  const openComments = allComments.filter((el) => !el.commentResolved);
  const resolvedComments = allComments.filter((el) => Boolean(el.commentResolved));

  // Filter based on active tab and search query
  const filteredComments = allComments.filter((c) => {
    if (activeTab === "open" && c.commentResolved) return false;
    if (activeTab === "resolved" && !c.commentResolved) return false;

    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const contentMatch = (c.content || "").toLowerCase().includes(query);
    const authorMatch = (c.commentAuthor || c.authorName || "").toLowerCase().includes(query);
    const replyMatch = (c.commentReplies || []).some(
      (r) => r.text.toLowerCase().includes(query) || r.author.toLowerCase().includes(query)
    );
    return contentMatch || authorMatch || replyMatch;
  });

  const formatRelativeTime = (timestamp?: number) => {
    if (!timestamp) return "Recently";
    const diff = Date.now() - timestamp;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="fixed inset-y-0 right-0 z-[200] w-88 max-w-[92vw] shadow-2xl flex flex-col border-l transition-all animate-in slide-in-from-right duration-200">
      <div
        className={`w-full h-full flex flex-col ${
          isDarkMode
            ? "bg-[#0f171e] border-slate-800 text-slate-100"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* 1. Header */}
        <div
          className={`flex items-center justify-between px-4 py-3.5 border-b shrink-0 ${
            isDarkMode ? "border-slate-800 bg-[#0B1117]" : "border-slate-100 bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
              <MessageSquare size={16} />
            </div>
            <div>
              <div className="text-xs font-bold leading-none">Comments & Discussions</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {openComments.length} open · {resolvedComments.length} resolved
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onActivateCommentTool && (
              <button
                onClick={() => {
                  onActivateCommentTool();
                  onClose();
                }}
                className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                title="Drop a comment pin on the board"
              >
                <Plus size={12} />
                <span>New</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close drawer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 2. Filter Tabs & Search Bar */}
        <div
          className={`p-3 border-b space-y-2.5 shrink-0 ${
            isDarkMode ? "border-slate-800 bg-slate-950/40" : "border-slate-100 bg-slate-50/50"
          }`}
        >
          {/* Tab buttons */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-200/50 dark:bg-slate-800/60 text-xs">
            <button
              onClick={() => setActiveTab("all")}
              className={`flex-1 py-1 rounded-md font-semibold transition-all cursor-pointer text-center ${
                activeTab === "all"
                  ? "bg-white dark:bg-slate-900 shadow-2xs text-blue-600 dark:text-blue-400"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              All ({allComments.length})
            </button>
            <button
              onClick={() => setActiveTab("open")}
              className={`flex-1 py-1 rounded-md font-semibold transition-all cursor-pointer text-center ${
                activeTab === "open"
                  ? "bg-white dark:bg-slate-900 shadow-2xs text-blue-600 dark:text-blue-400"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Open ({openComments.length})
            </button>
            <button
              onClick={() => setActiveTab("resolved")}
              className={`flex-1 py-1 rounded-md font-semibold transition-all cursor-pointer text-center ${
                activeTab === "resolved"
                  ? "bg-white dark:bg-slate-900 shadow-2xs text-emerald-600 dark:text-emerald-400"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Resolved ({resolvedComments.length})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search comments or replies..."
              className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border outline-hidden transition-colors ${
                isDarkMode
                  ? "bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-blue-500"
                  : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500"
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* 3. Comments List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredComments.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-slate-400 text-xs">
              <MessageSquare size={28} className="mb-2.5 opacity-30 text-slate-400" />
              {allComments.length === 0 ? (
                <>
                  <p className="font-semibold text-slate-300 dark:text-slate-200">
                    No comments on this board
                  </p>
                  <p className="mt-1 text-[11px] max-w-[200px] leading-normal">
                    Press <kbd className="font-mono bg-slate-800 text-slate-200 px-1 py-0.5 rounded text-[10px]">C</kbd> or click New to place a comment pin anywhere.
                  </p>
                  {onActivateCommentTool && (
                    <button
                      onClick={() => {
                        onActivateCommentTool();
                        onClose();
                      }}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus size={13} />
                      <span>Add First Comment</span>
                    </button>
                  )}
                </>
              ) : (
                <p>No comments match your search filter</p>
              )}
            </div>
          ) : (
            filteredComments.map((comment) => {
              const author = comment.commentAuthor || comment.authorName || "Collaborator";
              const authorColor = comment.color || "#6366f1";
              const replies = comment.commentReplies || [];
              const isResolved = Boolean(comment.commentResolved);

              return (
                <div
                  key={comment.id}
                  onClick={() => onSelectComment(comment)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer group hover:shadow-md ${
                    isResolved
                      ? isDarkMode
                        ? "bg-slate-950/30 border-slate-800/60 opacity-70 hover:opacity-100"
                        : "bg-slate-50/60 border-slate-200/80 opacity-70 hover:opacity-100"
                      : isDarkMode
                      ? "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* Card Header: Author, Badge, Actions */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-2xs"
                        style={{ backgroundColor: authorColor }}
                      >
                        {author.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-bold truncate text-slate-200 dark:text-slate-200">
                        {author}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Resolution Toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateElement?.(comment.id, { commentResolved: !isResolved });
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                          isResolved
                            ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                            : "bg-slate-500/10 text-slate-400 hover:bg-slate-500/20"
                        }`}
                        title={isResolved ? "Reopen comment" : "Resolve comment"}
                      >
                        {isResolved ? (
                          <>
                            <Check size={9} strokeWidth={3} />
                            <span>Resolved</span>
                          </>
                        ) : (
                          <span>Resolve</span>
                        )}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm("Delete this comment?")) {
                            onDeleteElement?.(comment.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-rose-500 transition-opacity cursor-pointer"
                        title="Delete comment"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Comment Content Preview */}
                  <p className="text-xs text-slate-300 dark:text-slate-300 line-clamp-2 leading-relaxed break-words">
                    {comment.content || "(No comment message)"}
                  </p>

                  {/* Card Footer */}
                  <div className="mt-2 pt-1.5 border-t border-slate-200/40 dark:border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <span>{formatRelativeTime(comment.metadata?.createdAt)}</span>
                      {replies.length > 0 && (
                        <span className="flex items-center gap-0.5 text-blue-400 font-medium">
                          <CornerDownRight size={10} />
                          {replies.length} {replies.length === 1 ? "reply" : "replies"}
                        </span>
                      )}
                    </div>

                    <span className="flex items-center gap-1 text-slate-400 group-hover:text-blue-400 transition-colors font-medium">
                      <MapPin size={10} />
                      <span>View on Board</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
