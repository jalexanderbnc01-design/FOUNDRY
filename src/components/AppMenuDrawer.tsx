import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  Search,
  Home,
  Clock,
  Star,
  Users,
  Folder,
  Sparkles,
  Layers,
  Upload,
  Trash2,
  Settings,
  HelpCircle,
  X,
  ChevronRight,
  FolderPlus,
  Check,
} from "lucide-react";
import { Logo } from "./Logo";
import { THEME } from "../theme";
import { BoardMetadata } from "../types";

export interface AppMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentBoardId?: string;
  currentBoardTitle: string;
  boardsList?: BoardMetadata[];
  onSelectBoard: (boardId: string) => void;
  onNewBoard: () => void;
  onDeleteBoard?: (boardId: string) => void;
  onOpenTemplates: () => void;
  onOpenShortcuts: () => void;
  onOpenImports: () => void;
  onOpenSettings?: () => void;
  currentUser: { name: string; color: string; email?: string };
}

interface BoardMeta {
  id: string;
  title: string;
  project: string;
  updatedAt: string;
  isFavorite?: boolean;
}

const SAMPLE_BOARDS: BoardMeta[] = [
  { id: "b1", title: "Sprint Brainstorm", project: "VIREHOLD", updatedAt: "Just now", isFavorite: true },
  { id: "b2", title: "System Architecture", project: "VIREHOLD", updatedAt: "2 hours ago", isFavorite: true },
  { id: "b3", title: "Slate UI Design System", project: "Slate UI", updatedAt: "Yesterday", isFavorite: false },
  { id: "b4", title: "Mobile UX Flow 2.0", project: "Research", updatedAt: "3 days ago", isFavorite: false },
  { id: "b5", title: "Quarterly Strategy Map", project: "VIREHOLD", updatedAt: "1 week ago", isFavorite: false },
];

function formatTimestamp(ts: number | string | undefined): string {
  if (!ts) return "Recently";
  if (typeof ts === "string") return ts;
  const diff = Date.now() - ts;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export const AppMenuDrawer: React.FC<AppMenuDrawerProps> = ({
  isOpen,
  onClose,
  currentBoardId,
  currentBoardTitle,
  boardsList,
  onSelectBoard,
  onNewBoard,
  onDeleteBoard,
  onOpenTemplates,
  onOpenShortcuts,
  onOpenImports,
  onOpenSettings,
  currentUser,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"home" | "recent" | "favorites" | "shared">("home");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projects, setProjects] = useState<string[]>(["VIREHOLD", "Slate UI", "Research"]);
  const [newProjectInput, setNewProjectInput] = useState("");
  const [isAddingProject, setIsAddingProject] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const activeBoards: BoardMeta[] =
    boardsList && boardsList.length > 0
      ? boardsList.map((b) => ({
          id: b.id,
          title: b.title,
          project: "VIREHOLD",
          updatedAt: formatTimestamp(b.updatedAt),
          isFavorite: b.isFavorite ?? false,
        }))
      : SAMPLE_BOARDS;

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
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

  const handleCreateProject = () => {
    const trimmed = newProjectInput.trim();
    if (trimmed && !projects.includes(trimmed)) {
      setProjects((prev) => [...prev, trimmed]);
      setSelectedProject(trimmed);
      setNewProjectInput("");
      setIsAddingProject(false);
    }
  };

  const filteredBoards = activeBoards.filter((b) => {
    if (searchQuery) {
      return b.title.toLowerCase().includes(searchQuery.toLowerCase());
    }
    if (selectedProject) {
      return b.project === selectedProject;
    }
    if (activeTab === "recent") return true;
    if (activeTab === "favorites") return b.isFavorite;
    if (activeTab === "shared") return b.project === "VIREHOLD";
    return true;
  });

  return (
    <div className="fixed inset-0 z-[200] flex pointer-events-auto bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        ref={drawerRef}
        className="w-72 sm:w-80 h-full flex flex-col border-r shadow-2xl animate-in slide-in-from-left duration-200 select-none overflow-hidden"
        style={{
          backgroundColor: THEME.menuPanel, // #151D1E
          borderColor: THEME.borderMain, // #37423E
          color: THEME.mainText, // #E7E1D6
        }}
      >
        {/* Drawer Header: SLATE WHITEBOARD logo */}
        <div
          className="p-3.5 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: THEME.borderMain }}
        >
          <div className="flex items-center gap-2.5">
            <Logo className="w-7 h-7" showText={false} />
            <div className="leading-tight">
              <span className="font-bold text-xs tracking-wider uppercase block" style={{ color: THEME.mainText }}>
                Foundry
              </span>
              <span className="text-[10px] tracking-wide" style={{ color: THEME.secondaryText }}>
                Workspace Foundation
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md transition-colors cursor-pointer"
            style={{ color: THEME.secondaryText }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = THEME.menuHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            title="Close menu (Esc)"
          >
            <X size={15} />
          </button>
        </div>

        {/* Primary Action: + NEW BOARD */}
        <div className="p-3 pb-2 shrink-0">
          <button
            onClick={() => {
              onNewBoard();
              onClose();
            }}
            className="w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
            style={{
              backgroundColor: THEME.selected, // #667B63 sage
              color: "#FFFFFF",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
          >
            <Plus size={15} strokeWidth={2.5} />
            <span className="tracking-wide">NEW BOARD</span>
          </button>
        </div>

        {/* Quick Search */}
        <div className="px-3 pb-2 shrink-0">
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-colors"
            style={{
              backgroundColor: THEME.mainBar, // #0D1418
              borderColor: THEME.borderMain,
              color: THEME.mainText,
            }}
          >
            <Search size={13} style={{ color: THEME.secondaryText }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search boards..."
              className="bg-transparent border-none outline-hidden w-full text-xs placeholder:text-[#909891]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-[11px] hover:opacity-80"
                style={{ color: THEME.secondaryText }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto px-2 space-y-4 text-xs">
          {/* SECTION: WORKSPACE */}
          <div>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: THEME.secondaryText }}>
              Workspace
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => {
                  setActiveTab("home");
                  setSelectedProject(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer"
                style={{
                  backgroundColor: activeTab === "home" && !selectedProject ? THEME.menuHover : "transparent",
                  color: activeTab === "home" && !selectedProject ? THEME.mainText : THEME.secondaryText,
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== "home" || selectedProject) e.currentTarget.style.backgroundColor = THEME.menuHover;
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== "home" || selectedProject) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: activeTab === "home" && !selectedProject ? THEME.selected : "transparent" }}
                />
                <Home size={14} />
                <span className="font-medium">Home</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("recent");
                  setSelectedProject(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer"
                style={{
                  backgroundColor: activeTab === "recent" && !selectedProject ? THEME.menuHover : "transparent",
                  color: activeTab === "recent" && !selectedProject ? THEME.mainText : THEME.secondaryText,
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== "recent" || selectedProject) e.currentTarget.style.backgroundColor = THEME.menuHover;
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== "recent" || selectedProject) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: activeTab === "recent" && !selectedProject ? THEME.selected : "transparent" }}
                />
                <Clock size={14} />
                <span className="font-medium">Recent</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("favorites");
                  setSelectedProject(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer"
                style={{
                  backgroundColor: activeTab === "favorites" && !selectedProject ? THEME.menuHover : "transparent",
                  color: activeTab === "favorites" && !selectedProject ? THEME.mainText : THEME.secondaryText,
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== "favorites" || selectedProject) e.currentTarget.style.backgroundColor = THEME.menuHover;
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== "favorites" || selectedProject) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: activeTab === "favorites" && !selectedProject ? THEME.selected : "transparent" }}
                />
                <Star size={14} />
                <span className="font-medium">Favorites</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("shared");
                  setSelectedProject(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer"
                style={{
                  backgroundColor: activeTab === "shared" && !selectedProject ? THEME.menuHover : "transparent",
                  color: activeTab === "shared" && !selectedProject ? THEME.mainText : THEME.secondaryText,
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== "shared" || selectedProject) e.currentTarget.style.backgroundColor = THEME.menuHover;
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== "shared" || selectedProject) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: activeTab === "shared" && !selectedProject ? THEME.selected : "transparent" }}
                />
                <Users size={14} />
                <span className="font-medium">Shared With Me</span>
              </button>
            </div>
          </div>

          {/* SECTION: PROJECTS */}
          <div>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between" style={{ color: THEME.secondaryText }}>
              <span>Projects</span>
              <button
                onClick={() => setIsAddingProject(!isAddingProject)}
                className="hover:text-white transition-colors cursor-pointer p-0.5 rounded"
                title="Add Project"
              >
                <Plus size={12} />
              </button>
            </div>

            <div className="space-y-0.5">
              {projects.map((proj) => (
                <button
                  key={proj}
                  onClick={() => {
                    setSelectedProject(selectedProject === proj ? null : proj);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer"
                  style={{
                    backgroundColor: selectedProject === proj ? THEME.menuHover : "transparent",
                    color: selectedProject === proj ? THEME.mainText : THEME.secondaryText,
                  }}
                  onMouseEnter={(e) => {
                    if (selectedProject !== proj) e.currentTarget.style.backgroundColor = THEME.menuHover;
                  }}
                  onMouseLeave={(e) => {
                    if (selectedProject !== proj) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Folder size={14} style={{ color: selectedProject === proj ? THEME.warmHighlight : THEME.secondaryText }} />
                    <span className="font-medium truncate">{proj}</span>
                  </div>
                  <ChevronRight size={12} className="opacity-40" />
                </button>
              ))}

              {isAddingProject && (
                <div className="p-1.5 flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newProjectInput}
                    onChange={(e) => setNewProjectInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                    placeholder="Project name..."
                    autoFocus
                    className="flex-1 px-2 py-1 text-xs rounded border bg-black/20 outline-hidden"
                    style={{ borderColor: THEME.borderMain, color: THEME.mainText }}
                  />
                  <button
                    onClick={handleCreateProject}
                    className="p-1 rounded text-xs cursor-pointer"
                    style={{ backgroundColor: THEME.selected, color: "#FFFFFF" }}
                  >
                    <Check size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ACTIVE BOARDS LIST */}
          <div className="border-t pt-2" style={{ borderColor: THEME.borderMain }}>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: THEME.secondaryText }}>
              {selectedProject ? `${selectedProject} Boards` : "Boards"}
            </div>
            <div className="space-y-0.5">
              {filteredBoards.map((board) => {
                const isActive = currentBoardId
                  ? board.id === currentBoardId
                  : board.title.toLowerCase() === currentBoardTitle.toLowerCase();
                return (
                  <div
                    key={board.id}
                    className="group flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors"
                    style={{
                      backgroundColor: isActive ? THEME.menuHover : "transparent",
                      color: isActive ? THEME.mainText : THEME.secondaryText,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = THEME.menuHover;
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <button
                      onClick={() => {
                        onSelectBoard(board.id);
                        onClose();
                      }}
                      className="flex-1 flex items-center gap-2 truncate text-left cursor-pointer mr-1"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: isActive ? THEME.selected : THEME.borderMain }}
                      />
                      <span className={`truncate text-xs ${isActive ? "font-semibold text-white" : ""}`}>
                        {board.title}
                      </span>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] opacity-60">{board.updatedAt}</span>
                      {onDeleteBoard && board.id !== "default" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete board "${board.title}"?`)) {
                              onDeleteBoard(board.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 rounded transition-opacity cursor-pointer text-stone-400"
                          title="Delete board"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION: RESOURCES */}
          <div className="border-t pt-2" style={{ borderColor: THEME.borderMain }}>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: THEME.secondaryText }}>
              Resources
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => {
                  onOpenTemplates();
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer"
                style={{ color: THEME.secondaryText }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = THEME.menuHover;
                  e.currentTarget.style.color = THEME.mainText;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = THEME.secondaryText;
                }}
              >
                <Sparkles size={14} style={{ color: THEME.warmHighlight }} />
                <span>Templates</span>
              </button>

              <button
                onClick={() => {
                  onOpenImports();
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer"
                style={{ color: THEME.secondaryText }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = THEME.menuHover;
                  e.currentTarget.style.color = THEME.mainText;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = THEME.secondaryText;
                }}
              >
                <Upload size={14} />
                <span>Imports (HTML & JSON)</span>
              </button>
            </div>
          </div>

          {/* SECTION: SYSTEM */}
          <div className="border-t pt-2" style={{ borderColor: THEME.borderMain }}>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: THEME.secondaryText }}>
              System
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => {
                  onOpenShortcuts();
                  onClose();
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer"
                style={{ color: THEME.secondaryText }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = THEME.menuHover;
                  e.currentTarget.style.color = THEME.mainText;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = THEME.secondaryText;
                }}
              >
                <div className="flex items-center gap-2">
                  <HelpCircle size={14} />
                  <span>Keyboard Shortcuts</span>
                </div>
                <kbd className="text-[10px] font-mono px-1 rounded bg-black/20">?</kbd>
              </button>

              <button
                onClick={() => {
                  if (onOpenSettings) onOpenSettings();
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer"
                style={{ color: THEME.secondaryText }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = THEME.menuHover;
                  e.currentTarget.style.color = THEME.mainText;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = THEME.secondaryText;
                }}
              >
                <Settings size={14} />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Profile Bar: User Avatar + Name + Settings Icon */}
        <div
          className="p-3 border-t flex items-center justify-between shrink-0"
          style={{
            borderColor: THEME.borderMain,
            backgroundColor: THEME.mainBar,
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 text-white shadow-xs"
              style={{ backgroundColor: currentUser.color || THEME.selected }}
            >
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "J"}
            </div>
            <div className="truncate">
              <span className="font-semibold text-xs truncate block" style={{ color: THEME.mainText }}>
                {currentUser.name || "Jaime"}
              </span>
              <span className="text-[10px] truncate block opacity-70" style={{ color: THEME.secondaryText }}>
                {currentUser.email || "Pro Workspace"}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              if (onOpenSettings) onOpenSettings();
              onClose();
            }}
            className="p-1.5 rounded-md transition-colors cursor-pointer"
            style={{ color: THEME.secondaryText }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = THEME.menuHover;
              e.currentTarget.style.color = THEME.mainText;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = THEME.secondaryText;
            }}
            title="Account & Board Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
