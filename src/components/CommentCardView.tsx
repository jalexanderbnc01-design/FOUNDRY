import React, { useState, useRef, useEffect } from "react";
import { BoardElement, CommentReply } from "../types";
import {
  MessageSquare,
  Check,
  RotateCcw,
  Trash2,
  Send,
  Smile,
  Edit2,
  X,
  CornerDownRight,
} from "lucide-react";

interface CommentCardViewProps {
  element: BoardElement;
  isSelected: boolean;
  isEditing: boolean;
  currentUser?: { id: string; name: string; color: string };
  onStartEditing: (id: string) => void;
  onUpdateElement?: (id: string, partial: Partial<BoardElement>) => void;
  onDeleteElement?: (id: string) => void;
  onAddReaction?: (id: string, emoji: string) => void;
  onNotify?: (msg: string) => void;
  isDarkMode?: boolean;
}

export const CommentCardView: React.FC<CommentCardViewProps> = ({
  element,
  isSelected,
  isEditing,
  currentUser,
  onStartEditing,
  onUpdateElement,
  onDeleteElement,
  onAddReaction,
  onNotify,
  isDarkMode = false,
}) => {
  const [localContent, setLocalContent] = useState(element.content || "");
  const [replyText, setReplyText] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalContent(element.content || "");
  }, [element.content]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const authorName = element.commentAuthor || element.authorName || "Collaborator";
  const authorInitial = authorName.charAt(0).toUpperCase();
  const authorColor = element.color || (element.metadata?.authorColor) || "#6366f1";
  const replies = element.commentReplies || [];
  const isResolved = Boolean(element.commentResolved);

  const formatRelativeTime = (timestamp?: number) => {
    if (!timestamp) return "Recently";
    const diff = Date.now() - timestamp;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const handleSaveContent = () => {
    if (localContent.trim() !== (element.content || "")) {
      onUpdateElement?.(element.id, { content: localContent.trim() });
    }
    // Exit edit mode by triggering onUpdateElement or blur
  };

  const handleAddReply = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const trimmed = replyText.trim();
    if (!trimmed) return;

    const newReply: CommentReply = {
      id: `reply_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      author: currentUser?.name || "Collaborator",
      authorColor: currentUser?.color || "#3b82f6",
      authorId: currentUser?.id,
      text: trimmed,
      timestamp: Date.now(),
    };

    const updatedReplies = [...replies, newReply];
    onUpdateElement?.(element.id, {
      commentReplies: updatedReplies,
      // If thread was resolved, replying automatically reopens it
      commentResolved: false,
    });

    setReplyText("");
    onNotify?.("Reply added to thread");
  };

  const handleDeleteReply = (replyId: string) => {
    const updated = replies.filter((r) => r.id !== replyId);
    onUpdateElement?.(element.id, { commentReplies: updated });
  };

  const handleToggleResolve = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !isResolved;
    onUpdateElement?.(element.id, { commentResolved: nextState });
    onNotify?.(nextState ? "Comment thread resolved" : "Comment thread reopened");
  };

  const handleDeleteComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete this comment thread?")) {
      onDeleteElement?.(element.id);
    }
  };

  // ----------------------------------------------------
  // COMPACT PIN MODE (When unfocused & not editing)
  // ----------------------------------------------------
  if (!isSelected && !isEditing) {
    return (
      <div
        className="w-full h-full flex items-center justify-center relative cursor-pointer select-none"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={`${authorName}: ${element.content || "Comment pin"}`}
      >
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border shadow-lg backdrop-blur-md transition-all duration-200 transform ${
            isHovered ? "scale-110 shadow-xl ring-2 ring-blue-500/50" : "scale-100"
          } ${
            isResolved
              ? isDarkMode
                ? "bg-slate-900/90 border-emerald-500/40 text-slate-400"
                : "bg-emerald-50/95 border-emerald-300 text-emerald-800"
              : isDarkMode
              ? "bg-[#161f26]/95 border-[#39433F] text-slate-100"
              : "bg-white/95 border-slate-300 text-slate-900 shadow-md"
          }`}
        >
          {/* Avatar Dot */}
          <div
            className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-2xs"
            style={{ backgroundColor: authorColor }}
          >
            {authorInitial}
          </div>

          <MessageSquare size={13} className={isResolved ? "text-emerald-500" : "text-blue-500"} />

          {/* Snippet / preview */}
          <span className="text-[11px] font-medium max-w-[120px] truncate">
            {element.content ? element.content : "Comment"}
          </span>

          {/* Status Badge */}
          {isResolved ? (
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px]">
              <Check size={9} strokeWidth={3} />
            </span>
          ) : replies.length > 0 ? (
            <span className="px-1.5 py-0.2 rounded-full bg-blue-500 text-white text-[9px] font-bold">
              {replies.length}
            </span>
          ) : null}
        </div>

        {/* Hover Tooltip Preview */}
        {isHovered && (
          <div
            className={`absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-3 py-2 rounded-xl border shadow-2xl z-50 w-56 text-left pointer-events-none animate-in fade-in zoom-in-95 duration-100 ${
              isDarkMode
                ? "bg-slate-900 border-slate-700 text-slate-100"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span className="font-bold truncate text-slate-300">{authorName}</span>
              <span>{formatRelativeTime(element.metadata?.createdAt)}</span>
            </div>
            <p className="text-xs line-clamp-3 leading-relaxed">
              {element.content || "(No comment text yet. Double-click to write)"}
            </p>
            {replies.length > 0 && (
              <div className="mt-1.5 pt-1 border-t border-slate-500/20 text-[10px] text-blue-400 font-medium">
                {replies.length} {replies.length === 1 ? "reply" : "replies"} · Click to view thread
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------
  // EXPANDED THREAD DISCUSSION CARD (When selected or editing)
  // ----------------------------------------------------
  return (
    <div
      className={`w-full min-h-full p-3.5 rounded-2xl border shadow-2xl flex flex-col justify-between transition-all duration-200 backdrop-blur-md select-none ${
        isResolved
          ? isDarkMode
            ? "bg-slate-900/95 border-emerald-600/30 text-slate-400"
            : "bg-white/95 border-emerald-200 text-slate-600"
          : isDarkMode
          ? "bg-[#141C21]/95 border-[#39433F] text-slate-100 ring-2 ring-[#557C7B]/60"
          : "bg-white/98 border-slate-200 text-slate-900 ring-2 ring-blue-500/40"
      }`}
      style={{
        width: Math.max(280, element.width),
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* 1. Header Bar: Author, Timestamp, Actions */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/50 dark:border-slate-800/80">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-2xs"
            style={{ backgroundColor: authorColor }}
          >
            {authorInitial}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold truncate leading-tight">{authorName}</h4>
            <span className="text-[10px] text-slate-400 block leading-tight">
              {formatRelativeTime(element.metadata?.createdAt)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Resolve / Reopen Button */}
          <button
            onClick={handleToggleResolve}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer border ${
              isResolved
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30"
                : "bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20 hover:text-slate-200"
            }`}
            title={isResolved ? "Reopen comment thread" : "Mark thread as resolved"}
          >
            {isResolved ? (
              <>
                <Check size={10} strokeWidth={3} />
                <span>Resolved</span>
              </>
            ) : (
              <>
                <Check size={10} />
                <span>Resolve</span>
              </>
            )}
          </button>

          {/* Delete Button */}
          <button
            onClick={handleDeleteComment}
            className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Delete comment thread"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* 2. Main Comment Content Body */}
      <div className="my-2.5 flex-1 overflow-y-auto max-h-48 pr-1">
        {isEditing ? (
          <div className="space-y-1.5">
            <textarea
              ref={textareaRef}
              value={localContent}
              onChange={(e) => setLocalContent(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  handleSaveContent();
                  onUpdateElement?.(element.id, { content: localContent.trim() });
                } else if (e.key === "Escape") {
                  setLocalContent(element.content || "");
                }
              }}
              className={`w-full p-2 text-xs rounded-xl border outline-hidden resize-none leading-relaxed transition-colors ${
                isDarkMode
                  ? "bg-slate-950 border-slate-700 text-slate-100 focus:border-blue-500"
                  : "bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500"
              }`}
              rows={3}
              placeholder="Write a comment or feedback for your team..."
            />
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Press ⌘+Enter to save</span>
              <button
                onClick={() => {
                  onUpdateElement?.(element.id, { content: localContent.trim() });
                }}
                className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Save Comment
              </button>
            </div>
          </div>
        ) : (
          <div
            className="text-xs leading-relaxed break-words whitespace-pre-wrap cursor-text group"
            onDoubleClick={(e) => {
              e.stopPropagation();
              onStartEditing(element.id);
            }}
          >
            {element.content ? (
              element.content
            ) : (
              <span className="text-slate-400 italic">
                (Empty comment. Double-click to write your thoughts.)
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartEditing(element.id);
              }}
              className="ml-2 inline-flex opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-blue-500 transition-opacity"
              title="Edit comment text"
            >
              <Edit2 size={11} />
            </button>
          </div>
        )}

        {/* 3. Threaded Replies Stream */}
        {replies.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-800/80 space-y-2">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <CornerDownRight size={11} />
              <span>{replies.length} {replies.length === 1 ? "Reply" : "Replies"}</span>
            </div>

            {replies.map((reply) => (
              <div
                key={reply.id}
                className={`p-2 rounded-xl text-xs flex items-start gap-2 group transition-colors ${
                  isDarkMode ? "bg-slate-950/50 border border-slate-800/60" : "bg-slate-50 border border-slate-200/60"
                }`}
              >
                <div
                  className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: reply.authorColor || "#3b82f6" }}
                >
                  {reply.author.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] truncate text-slate-200 dark:text-slate-200">
                      {reply.author}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {formatRelativeTime(reply.timestamp)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-300 dark:text-slate-300 leading-normal break-words whitespace-pre-wrap">
                    {reply.text}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteReply(reply.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-rose-500 transition-opacity cursor-pointer"
                  title="Delete reply"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Quick Reaction Emojis Row */}
      <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          {["👍", "❤️", "💡", "🔥", "🎉"].map((emoji) => {
            const count = element.reactions?.[emoji] || 0;
            return (
              <button
                key={emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddReaction?.(element.id, emoji);
                }}
                className={`px-1.5 py-0.5 rounded-lg text-xs flex items-center gap-1 transition-transform hover:scale-115 cursor-pointer ${
                  count > 0
                    ? "bg-blue-500/15 text-blue-400 border border-blue-500/30 font-bold"
                    : "text-slate-400 hover:bg-slate-500/10"
                }`}
                title={`React with ${emoji}`}
              >
                <span>{emoji}</span>
                {count > 0 && <span className="text-[10px]">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Reply Input Box */}
      <form
        onSubmit={handleAddReply}
        className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/80 flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={replyInputRef}
          type="text"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && !e.shiftKey) {
              handleAddReply(e);
            }
          }}
          placeholder="Reply to thread..."
          className={`flex-1 px-2.5 py-1.5 text-xs rounded-xl border outline-hidden transition-colors ${
            isDarkMode
              ? "bg-slate-950 border-slate-800 text-slate-100 focus:border-blue-500 placeholder-slate-500"
              : "bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500 placeholder-slate-400"
          }`}
        />
        <button
          type="submit"
          disabled={!replyText.trim()}
          className="p-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-all cursor-pointer shadow-2xs"
          title="Send reply"
        >
          <Send size={12} />
        </button>
      </form>
    </div>
  );
};
