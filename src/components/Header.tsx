import React, { useState, useEffect, useRef } from "react";
import { UserPresence, ViewMode, ToolType, ShapeType, BoardElement, BoardMetadata } from "../types";
import { Logo } from "./Logo";
import { THEME } from "../theme";
import { AppMenuDrawer } from "./AppMenuDrawer";
import {
  Undo2,
  Redo2,
  Plus,
  Share2,
  Download,
  Upload,
  RotateCcw,
  HelpCircle,
  Users,
  Check,
  Sparkles,
  Layers,
  Code2,
  Sun,
  Moon,
  History,
  Wand2,
  Search,
  Sliders,
  ChevronDown,
  ChevronRight,
  Star,
  Copy,
  Folder,
  Archive,
  Trash2,
  Grid,
  Magnet,
  Maximize2,
  Eye,
  FileDown,
  MoreHorizontal,
  Lock,
  Unlock,
  Group,
  Ungroup,
  PenTool,
  Square,
  Circle,
  StickyNote,
  Type,
  ArrowUpRight,
  ImageIcon,
  Link,
  MessageSquare,
  Edit2,
  CheckCircle2,
  X,
} from "lucide-react";

export interface HeaderProps {
  boardId?: string;
  boardTitle: string;
  setBoardTitle: (title: string) => void;
  boardsList?: BoardMetadata[];
  onSelectBoard?: (boardId: string) => void;
  onNewBoard?: () => void;
  onDeleteBoard?: (boardId: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  activeUsers: Record<string, UserPresence>;
  currentUser: { id: string; name: string; color: string; email?: string };
  onJumpToUser: (userId: string) => void;
  connectionStatus: "connected" | "connecting" | "offline";
  onExportPng: () => void;
  onExportJson: () => void;
  onImportJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetBoard: () => void;
  onOpenShortcuts: () => void;
  onOpenTemplates: () => void;
  isTilted3D?: boolean;
  onToggleTilt3D?: () => void;
  viewMode?: ViewMode;
  onSelectViewMode?: (mode: ViewMode) => void;
  onOpenHistory?: () => void;
  onOpenComments?: () => void;
  unresolvedCommentsCount?: number;
  onOpenAiAssistant?: () => void;
  onOpenHtmlUpload?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onOpenSearch?: () => void;
  onTogglePropertiesPanel?: () => void;
  isPropertiesPanelOpen?: boolean;
  followingUserId?: string | null;
  onFollowUser?: (userId: string | null) => void;
  showPeerCursors?: boolean;
  onToggleShowPeerCursors?: () => void;
  onOpenSettings?: () => void;

  // Rich Menu commands
  selectedElements?: BoardElement[];
  onSelectAll?: () => void;
  onDeleteSelected?: () => void;
  onDuplicateSelected?: () => void;
  onGroupSelected?: () => void;
  onUngroupSelected?: () => void;
  onLockSelected?: () => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onAlign?: (dir: "left" | "center" | "right" | "top" | "middle" | "bottom") => void;
  onDistribute?: (axis: "horizontal" | "vertical") => void;
  onInsertTool?: (tool: ToolType, shapeType?: ShapeType) => void;
  gridEnabled?: boolean;
  onToggleGrid?: () => void;
  snapEnabled?: boolean;
  onToggleSnap?: () => void;
  guidesEnabled?: boolean;
  onToggleGuides?: () => void;
  showMinimap?: boolean;
  onToggleMinimap?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  onFitBoard?: () => void;
  isCleanBoardMode?: boolean;
  onToggleCleanBoard?: () => void;
  onExportSvg?: () => void;
  onOpenExportModal?: () => void;
  onConvertToVector?: () => void;
  onRasterize?: () => void;
  onApplyAiResult?: (action: string, result: any) => void;
}

export const Header: React.FC<HeaderProps> = ({
  boardId,
  boardTitle,
  setBoardTitle,
  boardsList,
  onSelectBoard,
  onNewBoard,
  onDeleteBoard,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  activeUsers,
  currentUser,
  onJumpToUser,
  connectionStatus,
  onExportPng,
  onExportJson,
  onImportJson,
  onResetBoard,
  onOpenShortcuts,
  onOpenTemplates,
  isTilted3D,
  onToggleTilt3D,
  viewMode = "flat",
  onSelectViewMode,
  onOpenHistory,
  onOpenComments,
  unresolvedCommentsCount = 0,
  onOpenAiAssistant,
  onOpenHtmlUpload,
  isDarkMode = false,
  onToggleDarkMode,
  onOpenSearch,
  onTogglePropertiesPanel,
  isPropertiesPanelOpen = false,
  followingUserId = null,
  onFollowUser,
  showPeerCursors = true,
  onToggleShowPeerCursors,
  onOpenSettings,

  selectedElements = [],
  onSelectAll,
  onDeleteSelected,
  onDuplicateSelected,
  onGroupSelected,
  onUngroupSelected,
  onLockSelected,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  onAlign,
  onDistribute,
  onInsertTool,
  gridEnabled = true,
  onToggleGrid,
  snapEnabled = true,
  onToggleSnap,
  guidesEnabled = true,
  onToggleGuides,
  showMinimap = true,
  onToggleMinimap,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitBoard,
  isCleanBoardMode = false,
  onToggleCleanBoard,
  onExportSvg,
  onOpenExportModal,
  onConvertToVector,
  onRasterize,
  onApplyAiResult,
}) => {
  // Navigation states
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false);
  const [isBoardMenuOpen, setIsBoardMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null); // "file" | "edit" | "view" | "insert" | "arrange" | "collaborate" | "help" | null
  const [isAiMenuOpen, setIsAiMenuOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isCollabMenuOpen, setIsCollabMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const usersList: UserPresence[] = Object.values(activeUsers);
  const totalUsers = usersList.length + 1; // including current user

  // Close menus on outside click or Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveMenu(null);
        setIsBoardMenuOpen(false);
        setIsAiMenuOpen(false);
        setIsCollabMenuOpen(false);
        setIsMoreMenuOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#desktop-menu-bar") && !target.closest("#board-title-menu") && !target.closest("#ai-quick-trigger") && !target.closest("#more-quick-trigger") && !target.closest("#collab-trigger")) {
        setActiveMenu(null);
        setIsBoardMenuOpen(false);
        setIsAiMenuOpen(false);
        setIsCollabMenuOpen(false);
        setIsMoreMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const closeAllMenus = () => {
    setActiveMenu(null);
    setIsBoardMenuOpen(false);
    setIsAiMenuOpen(false);
    setIsCollabMenuOpen(false);
    setIsMoreMenuOpen(false);
  };

  const menuButtonClass = (menuName: string) => `
    px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer select-none
    ${activeMenu === menuName ? "bg-[#202327] text-[#F5F5F5]" : "text-[#8B929C] hover:text-[#F5F5F5] hover:bg-[#202327]"}
  `;

  const dropdownContainerClass = `
    absolute top-full left-0 mt-1 min-w-[200px] py-1.5 rounded-xl border shadow-2xl backdrop-blur-md z-50 text-xs select-none animate-in fade-in zoom-in-95
  `;

  const menuItemClass = `
    w-full px-3 py-1.5 flex items-center justify-between text-xs text-left cursor-pointer transition-colors
    text-[#F5F5F5] hover:bg-[#202327]
  `;

  const kbdClass = "font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/20 text-[#8B929C] ml-4";

  return (
    <>
      <header
        id="canvas-main-header"
        className="fixed top-0 left-0 right-0 z-[180] h-12 px-3 border-b flex items-center justify-between select-none transition-colors duration-150"
        style={{
          backgroundColor: THEME.mainBar,
          borderColor: THEME.borderMain,
          color: THEME.mainText,
        }}
      >
        {/* ================= LEFT SIDE: FOUNDRY ICON + BOARD NAME ▼ + DESKTOP MENUS ================= */}
        <div className="flex items-center gap-2">
          {/* FOUNDRY ICON & LOGO BUTTON -> OPENS APP MENU DRAWER */}
          <button
            onClick={() => setIsAppMenuOpen(true)}
            className="flex items-center gap-2 px-2 py-1 rounded-md transition-colors cursor-pointer group"
            style={{ color: THEME.mainText }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = THEME.menuHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            title="Open Foundry Workspace Menu"
          >
            <Logo className="w-5 h-5 transition-transform group-hover:scale-105" showText={false} />
            <span className="font-bold text-xs tracking-wide uppercase hidden sm:inline" style={{ color: THEME.mainText }}>
              Foundry
            </span>
          </button>

          <span className="text-stone-600 select-none">|</span>

          {/* BOARD NAME ▼ (WITH ACTIONS DROPDOWN) */}
          <div id="board-title-menu" className="relative">
            <button
              onClick={() => {
                setIsBoardMenuOpen(!isBoardMenuOpen);
                setActiveMenu(null);
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer max-w-[160px] sm:max-w-[220px] md:max-w-[280px]"
              style={{
                backgroundColor: isBoardMenuOpen ? THEME.menuHover : "transparent",
                color: THEME.mainText,
              }}
              onMouseEnter={(e) => {
                if (!isBoardMenuOpen) e.currentTarget.style.backgroundColor = THEME.menuHover;
              }}
              onMouseLeave={(e) => {
                if (!isBoardMenuOpen) e.currentTarget.style.backgroundColor = "transparent";
              }}
              title="Board Actions"
            >
              <span className="truncate">{boardTitle}</span>
              {isFavorite && <Star size={11} className="fill-[#B58C5B] text-[#B58C5B] shrink-0" />}
              <ChevronDown size={13} className="text-[#8B929C] shrink-0" />
            </button>

            {/* Board Name Actions Dropdown */}
            {isBoardMenuOpen && (
              <div
                className={dropdownContainerClass}
                style={{
                  backgroundColor: THEME.menuPanel,
                  borderColor: THEME.borderMain,
                  left: 0,
                  width: 240,
                }}
              >
                <div className="px-3 py-1.5 border-b" style={{ borderColor: THEME.borderMain }}>
                  {isEditingTitle ? (
                    <div className="flex items-center gap-1">
                      <input
                        ref={titleInputRef}
                        type="text"
                        value={boardTitle}
                        onChange={(e) => setBoardTitle(e.target.value)}
                        onBlur={() => setIsEditingTitle(false)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setIsEditingTitle(false);
                        }}
                        autoFocus
                        className="w-full bg-black/30 border border-[#292C30] px-2 py-1 rounded text-xs text-[#F5F5F5] outline-hidden"
                      />
                      <button
                        onClick={() => setIsEditingTitle(false)}
                        className="p-1 rounded bg-[#BCE5F8] text-[#0B0D0F] cursor-pointer"
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold truncate text-[#F5F5F5]">{boardTitle}</span>
                      <button
                        onClick={() => setIsEditingTitle(true)}
                        className="p-1 rounded hover:bg-[#202327] text-[#8B929C] hover:text-[#F5F5F5] cursor-pointer"
                        title="Rename"
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setIsEditingTitle(true);
                    }}
                    className={menuItemClass}
                  >
                    <span>Rename</span>
                    <kbd className={kbdClass}>Enter</kbd>
                  </button>

                  <button
                    onClick={() => {
                      closeAllMenus();
                      if (onDuplicateSelected && selectedElements.length > 0) {
                        onDuplicateSelected();
                      } else {
                        setBoardTitle(`${boardTitle} (Copy)`);
                      }
                    }}
                    className={menuItemClass}
                  >
                    <span>Duplicate</span>
                    <kbd className={kbdClass}>⌘D</kbd>
                  </button>

                  <button
                    onClick={() => {
                      setIsFavorite(!isFavorite);
                      closeAllMenus();
                    }}
                    className={menuItemClass}
                  >
                    <span>{isFavorite ? "Remove from Favorites" : "Add to Favorites"}</span>
                    <Star size={13} className={isFavorite ? "fill-[#B58C5B] text-[#B58C5B]" : "text-[#8B929C]"} />
                  </button>
                </div>

                <div className="my-1 border-t" style={{ borderColor: THEME.borderMain }} />

                <div className="py-1">
                  {onOpenHistory && (
                    <button
                      onClick={() => {
                        closeAllMenus();
                        onOpenHistory();
                      }}
                      className={menuItemClass}
                    >
                      <div className="flex items-center gap-2">
                        <History size={13} className="text-[#8B929C]" />
                        <span>Board History</span>
                      </div>
                    </button>
                  )}

                  {onOpenExportModal ? (
                    <button
                      onClick={() => {
                        closeAllMenus();
                        onOpenExportModal();
                      }}
                      className={menuItemClass}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <FileDown size={13} className="text-blue-500" />
                          <span className="font-semibold text-blue-600 dark:text-blue-400">Export Board (HD, SVG, JSON)...</span>
                        </div>
                        <kbd className={kbdClass}>⇧⌘E</kbd>
                      </div>
                    </button>
                  ) : null}

                  <button
                    onClick={() => {
                      closeAllMenus();
                      if (onOpenExportModal) onOpenExportModal();
                      else onExportPng();
                    }}
                    className={menuItemClass}
                  >
                    <div className="flex items-center gap-2">
                      <FileDown size={13} className="text-[#8B929C]" />
                      <span>Quick Export PNG</span>
                    </div>
                  </button>

                  {onExportSvg && (
                    <button
                      onClick={() => {
                        closeAllMenus();
                        onExportSvg();
                      }}
                      className={menuItemClass}
                    >
                      <div className="flex items-center gap-2">
                        <FileDown size={13} className="text-[#8B929C]" />
                        <span>Export SVG Vector</span>
                      </div>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      closeAllMenus();
                      onExportJson();
                    }}
                    className={menuItemClass}
                  >
                    <div className="flex items-center gap-2">
                      <FileDown size={13} className="text-[#8B929C]" />
                      <span>Export Board File (JSON)</span>
                    </div>
                  </button>
                </div>

                <div className="my-1 border-t" style={{ borderColor: THEME.borderMain }} />

                <div className="py-1">
                  <button
                    onClick={() => {
                      closeAllMenus();
                      onResetBoard();
                    }}
                    className={`${menuItemClass} text-[#96594B] hover:bg-[#96594B]/15`}
                  >
                    <div className="flex items-center gap-2">
                      <RotateCcw size={13} />
                      <span>Reset to Default</span>
                    </div>
                  </button>
                </div>

                {boardsList && boardsList.length > 0 && (
                  <>
                    <div className="my-1 border-t" style={{ borderColor: THEME.borderMain }} />
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8B929C]">
                      Switch Board
                    </div>
                    <div className="py-1 max-h-40 overflow-y-auto">
                      {boardsList.map((b) => {
                        const isCurrent = boardId ? b.id === boardId : b.title === boardTitle;
                        return (
                          <button
                            key={b.id}
                            onClick={() => {
                              closeAllMenus();
                              if (onSelectBoard) onSelectBoard(b.id);
                            }}
                            className={`${menuItemClass} ${isCurrent ? "font-semibold text-white bg-[#202327]" : ""}`}
                          >
                            <span className="truncate">{b.title}</span>
                            {isCurrent && <Check size={12} className="text-[#3b82f6] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    {onNewBoard && (
                      <button
                        onClick={() => {
                          closeAllMenus();
                          onNewBoard();
                        }}
                        className={`${menuItemClass} text-[#3b82f6] hover:bg-[#3b82f6]/10`}
                      >
                        <div className="flex items-center gap-2">
                          <Plus size={13} />
                          <span>New Board</span>
                        </div>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ================= DESKTOP-STYLE MENUS: FILE EDIT VIEW INSERT ARRANGE COLLABORATE HELP ================= */}
          <div id="desktop-menu-bar" className="hidden lg:flex items-center gap-0.5 ml-1">
            {/* 1. FILE MENU */}
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === "file" ? null : "file")}
                className={menuButtonClass("file")}
              >
                File
              </button>

              {activeMenu === "file" && (
                <div
                  className={dropdownContainerClass}
                  style={{ backgroundColor: THEME.menuPanel, borderColor: THEME.borderMain, width: 220 }}
                >
                  <button
                    onClick={() => {
                      closeAllMenus();
                      setIsAppMenuOpen(true);
                    }}
                    className={menuItemClass}
                  >
                    <span>New Board</span>
                    <kbd className={kbdClass}>⌘N</kbd>
                  </button>
                  <button
                    onClick={() => {
                      closeAllMenus();
                      setIsAppMenuOpen(true);
                    }}
                    className={menuItemClass}
                  >
                    <span>Open Board...</span>
                    <kbd className={kbdClass}>⌘O</kbd>
                  </button>
                  <button
                    onClick={() => {
                      closeAllMenus();
                      setBoardTitle(`${boardTitle} (Duplicate)`);
                    }}
                    className={menuItemClass}
                  >
                    <span>Duplicate Board</span>
                  </button>

                  <div className="my-1 border-t" style={{ borderColor: THEME.borderMain }} />

                  {/* Imports */}
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8B929C]">Import</div>
                  {onOpenHtmlUpload && (
                    <button
                      onClick={() => {
                        closeAllMenus();
                        onOpenHtmlUpload();
                      }}
                      className={menuItemClass}
                    >
                      <span>HTML / Code Card</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      closeAllMenus();
                      fileInputRef.current?.click();
                    }}
                    className={menuItemClass}
                  >
                    <span>Board File (JSON)</span>
                  </button>

                  <div className="my-1 border-t" style={{ borderColor: THEME.borderMain }} />

                  {/* Exports */}
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8B929C]">Export</div>
                  {onOpenExportModal && (
                    <button
                      onClick={() => {
                        closeAllMenus();
                        onOpenExportModal();
                      }}
                      className={menuItemClass}
                    >
                      <span className="font-semibold text-blue-500">Export Board (HD / SVG)...</span>
                      <kbd className={kbdClass}>⇧⌘E</kbd>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      closeAllMenus();
                      if (onOpenExportModal) onOpenExportModal();
                      else onExportPng();
                    }}
                    className={menuItemClass}
                  >
                    <span>Export as PNG</span>
                  </button>
                  {onExportSvg && (
                    <button
                      onClick={() => {
                        closeAllMenus();
                        onExportSvg();
                      }}
                      className={menuItemClass}
                    >
                      <span>Export as SVG</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      closeAllMenus();
                      onExportJson();
                    }}
                    className={menuItemClass}
                  >
                    <span>Export Board File</span>
                  </button>

                  <div className="my-1 border-t" style={{ borderColor: THEME.borderMain }} />

                  <button
                    onClick={() => {
                      closeAllMenus();
                      onResetBoard();
                    }}
                    className={`${menuItemClass} text-[#96594B] hover:bg-[#96594B]/15`}
                  >
                    <span>Reset Board</span>
                  </button>
                </div>
              )}
            </div>

            {/* 2. EDIT MENU */}
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === "edit" ? null : "edit")}
                className={menuButtonClass("edit")}
              >
                Edit
              </button>

              {activeMenu === "edit" && (
                <div
                  className={dropdownContainerClass}
                  style={{ backgroundColor: THEME.menuPanel, borderColor: THEME.borderMain, width: 200 }}
                >
                  <button
                    onClick={() => {
                      closeAllMenus();
                      onUndo();
                    }}
                    disabled={!canUndo}
                    className={`${menuItemClass} disabled:opacity-40`}
                  >
                    <span>Undo</span>
                    <kbd className={kbdClass}>⌘Z</kbd>
                  </button>

                  <button
                    onClick={() => {
                      closeAllMenus();
                      onRedo();
                    }}
                    disabled={!canRedo}
                    className={`${menuItemClass} disabled:opacity-40`}
                  >
                    <span>Redo</span>
                    <kbd className={kbdClass}>⌘Y</kbd>
                  </button>

                  <div className="my-1 border-t" style={{ borderColor: THEME.borderMain }} />

                  <button
                    onClick={() => {
                      closeAllMenus();
                      if (onDuplicateSelected) onDuplicateSelected();
                    }}
                    disabled={selectedElements.length === 0}
                    className={`${menuItemClass} disabled:opacity-40`}
                  >
                    <span>Duplicate</span>
                    <kbd className={kbdClass}>⌘D</kbd>
                  </button>

                  <button
                    onClick={() => {
                      closeAllMenus();
                      if (onSelectAll) onSelectAll();
                    }}
                    className={menuItemClass}
                  >
                    <span>Select All</span>
                    <kbd className={kbdClass}>⌘A</kbd>
                  </button>

                  <button
                    onClick={() => {
                      closeAllMenus();
                      if (onDeleteSelected) onDeleteSelected();
                    }}
                    disabled={selectedElements.length === 0}
                    className={`${menuItemClass} disabled:opacity-40 text-[#96594B] hover:bg-[#96594B]/15`}
                  >
                    <span>Delete</span>
                    <kbd className={kbdClass}>Del</kbd>
                  </button>

                  <div className="my-1 border-t" style={{ borderColor: THEME.borderMain }} />

                  {onOpenSearch && (
                    <button
                      onClick={() => {
                        closeAllMenus();
                        onOpenSearch();
                      }}
                      className={menuItemClass}
                    >
                      <span>Find Objects...</span>
                      <kbd className={kbdClass}>⌘K</kbd>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 3. VIEW MENU */}
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === "view" ? null : "view")}
                className={menuButtonClass("view")}
              >
                View
              </button>

              {activeMenu === "view" && (
                <div
                  className={dropdownContainerClass}
                  style={{ backgroundColor: THEME.menuPanel, borderColor: THEME.borderMain, width: 230 }}
                >
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8B929C]">Canvas Mode</div>
                  <button
                    onClick={() => {
                      if (onSelectViewMode) onSelectViewMode("flat");
                      closeAllMenus();
                    }}
                    className={menuItemClass}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3 text-xs">{viewMode === "flat" ? "✓" : ""}</span>
                      <span>Flat (2D Canvas)</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      if (onSelectViewMode) onSelectViewMode("soft-3d");
                      closeAllMenus();
                    }}
                    className={menuItemClass}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3 text-xs">{viewMode === "soft-3d" || viewMode === "deep-3d" ? "✓" : ""}</span>
                      <span>Perspective (3D)</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      if (onSelectViewMode) onSelectViewMode("presentation");
                      closeAllMenus();
                    }}
                    className={menuItemClass}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3 text-xs">{viewMode === "presentation" ? "✓" : ""}</span>
                      <span>Presentation (Slides)</span>
                    </div>
                  </button>

                  <div className="my-1 border-t" style={{ borderColor: THEME.borderMain }} />

                  {onToggleGrid && (
                    <button
                      onClick={() => {
                        onToggleGrid();
                        closeAllMenus();
                      }}
                      className={menuItemClass}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-3 text-xs">{gridEnabled ? "✓" : ""}</span>
                        <span>Grid Dots</span>
                      </div>
                      <kbd className={kbdClass}>G</kbd>
                    </button>
                  )}

                  {onToggleSnap && (
                    <button
                      onClick={() => {
                        onToggleSnap();
                        closeAllMenus();
                      }}
                      className={menuItemClass}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-3 text-xs">{snapEnabled ? "✓" : ""}</span>
                        <span>Snap to Objects</span>
                      </div>
                      <kbd className={kbdClass}>S</kbd>
                    </button>
                  )}

                  {onToggleGuides && (
                    <button
                      onClick={() => {
                        onToggleGuides();
                        closeAllMenus();
                      }}
                      className={menuItemClass}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-3 text-xs">{guidesEnabled ? "✓" : ""}</span>
                        <span>Smart Guides</span>
                      </div>
                    </button>
                  )}

                  {onToggleMinimap && (
                    <button
                      onClick={() => {
                        onToggleMinimap();
                        closeAllMenus();
                      }}
                      className={menuItemClass}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-3 text-xs">{showMinimap ? "✓" : ""}</span>
                        <span>Minimap</span>
                      </div>
                      <kbd className={kbdClass}>M</kbd>
                    </button>
                  )}

                  <div className="my-1 border-t" style={{ borderColor: THEME.borderMain }} />

                  {onZoomIn && (
                    <button
                      onClick={() => {
                        onZoomIn();
                        closeAllMenus();
                      }}
                      className={menuItemClass}
                    >
                      <span>Zoom In</span>
                      <kbd className={kbdClass}>⌘+</kbd>
                    </button>
                  )}

                  {onZoomOut && (
                    <button
                      onClick={() => {
                        onZoomOut();
                        closeAllMenus();
                      }}
                      className={menuItemClass}
                    >
                      <span>Zoom Out</span>
                      <kbd className={kbdClass}>⌘-</kbd>
                    </button>
                  )}

                  {onResetZoom && (
                    <button
                      onClick={() => {
                        onResetZoom();
                        closeAllMenus();
                      }}
                      className={menuItemClass}
                    >
                      <span>Zoom to 100%</span>
                      <kbd className={kbdClass}>0</kbd>
                    </button>
                  )}

                  {onFitBoard && (
                    <button
                      onClick={() => {
                        onFitBoard();
                        closeAllMenus();
                      }}
                      className={menuItemClass}
                    >
                      <span>Fit Board</span>
                      <kbd className={kbdClass}>⇧1</kbd>
                    </button>
                  )}

                  <div className="my-1 border-t" style={{ borderColor: THEME.borderMain }} />

                  {onToggleCleanBoard && (
                    <button
                      onClick={() => {
                        onToggleCleanBoard();
                        closeAllMenus();
                      }}
                      className={menuItemClass}
                    >
                      <span>Clean Board Mode</span>
                      <kbd className={kbdClass}>Tab</kbd>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 4. INSERT MENU */}
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === "insert" ? null : "insert")}
                className={menuButtonClass("insert")}
              >
                Insert
              </button>

              {activeMenu === "insert" && (
                <div
                  className={dropdownContainerClass}
                  style={{ backgroundColor: THEME.menuPanel, borderColor: THEME.borderMain, width: 220 }}
                >
                  <button
                    onClick={() => {
                      if (onInsertTool) onInsertTool("sticky");
                      closeAllMenus();
                    }}
                    className={menuItemClass}
                  >
                    <div className="flex items-center gap-2">
                      <StickyNote size={13} style={{ color: THEME.warmHighlight }} />
                      <span>Sticky Note</span>
                    </div>
                    <kbd className={kbdClass}>N</kbd>
                  </button>

                  <button
                    onClick={() => {
                      if (onInsertTool) onInsertTool("text");
                      closeAllMenus();
                    }}
                    className={menuItemClass}
                  >
                    <div className="flex items-center gap-2">
                      <Type size={13} />
                      <span>Text</span>
                    </div>
                    <kbd className={kbdClass}>T</kbd>
                  </button>

                  <div className="my-1 border-t" style={{ borderColor: THEME.borderMain }} />

                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8B929C]">Shapes</div>
                  <button
                    onClick={() => {
                      if (onInsertTool) onInsertTool("shape", "rectangle");
                      closeAllMenus();
                    }}
                    className={menuItemClass}
                  >
                    <div className="flex items-center gap-2">
                      <Square size={13} />
                      <span>Rectangle</span>
                    </div>
                    <kbd className={kbdClass}>R</kbd>
                  </button>

                  <button
                    onClick={() => {
                      if (onInsertTool) onInsertTool("shape", "circle");
                      closeAllMenus();
                    }}
                    className={menuItemClass}
                  >
                    <div className="flex items-center gap-2">
                      <Circle size={13} />
                      <span>Ellipse</span>
                    </div>
                    <kbd className={kbdClass}>O</kbd>
                  </button>

                  <button
                    onClick={() => {
                      if (onInsertTool) onInsertTool("shape", "diamond");
                      closeAllMenus();
                    }}
                    className={menuItemClass}
                  >
                    <span>Diamond</span>
                  </button>

                  <button
                    onClick={() => {
                      if (onInsertTool) onInsertTool("shape", "triangle");
                      closeAllMenus();
                    }}
                    className={menuItemClass}
                  >
                    <span>Triangle</span>
                  </button>

                  <button
                    onClick={() => {
                      if (onInsertTool) onInsertTool("shape", "star");
                      closeAllMenus();
                    }}
                    className={menuItemClass}
                  >
                    <span>Star</span>
                  </button>

                  <div className="my-1 border-t" style={{ borderColor: THEME.borderMain }} />

                  <button
                    onClick={() => {
                      if (onInsertTool) onInsertTool("vector-pen");
                      closeAllMenus();
                    }}
                    className={menuItemClass}
                  >
                    <div className="flex items-center gap-2">
                      <PenTool size={13} style={{ color: THEME.selected }} />
                      <span>Vector Path</span>
                    </div>
                    <kbd className={kbdClass}>P</kbd>
                  </button>

                  <button
                    onClick={() => {
                      if (onInsertTool) onInsertTool("draw");
                      closeAllMenus();
                    }}
                    className={menuItemClass}
                  >
                    <span>Drawing / Ink</span>
                    <kbd className={kbdClass}>D</kbd>
                  </button>

                  <button
                    onClick={() => {
                      if (onInsertTool) onInsertTool("connector");
                      closeAllMenus();
                    }}
                    className={menuItemClass}
                  >
                    <div className="flex items-center gap-2">
                      <ArrowUpRight size={13} />
                      <span>Connector</span>
                    </div>
                    <kbd className={kbdClass}>C</kbd>
                  </button>

                  <button
                    onClick={() => {
                      if (onInsertTool) onInsertTool("frame");
                      closeAllMenus();
                    }}
                    className={menuItemClass}
                  >
                    <div className="flex items-center gap-2">
                      <Layers size={13} style={{ color: THEME.warmHighlight }} />
                      <span>Frame / Section</span>
                    </div>
                    <kbd className={kbdClass}>F</kbd>
                  </button>

                  <div className="my-1 border-t" style={{ borderColor: THEME.borderMain }} />

                  {onOpenHtmlUpload && (
                    <button
                      onClick={() => {
                        closeAllMenus();
                        onOpenHtmlUpload();
                      }}
                      className={menuItemClass}
                    >
                      <div className="flex items-center gap-2">
                        <Code2 size={13} style={{ color: THEME.warmHighlight }} />
                        <span>HTML Card</span>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 5. ARRANGE MENU */}
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === "arrange" ? null : "arrange")}
                className={menuButtonClass("arrange")}
              >
                Arrange
              </button>

              {activeMenu === "arrange" && (
                <div
                  className={dropdownContainerClass}
                  style={{ backgroundColor: THEME.menuPanel, borderColor: THEME.borderMain, width: 220 }}
                >
                  <button
                    onClick={() => {
                      if (onBringToFront) onBringToFront();
                      closeAllMenus();
                    }}
                    disabled={selectedElements.length === 0}
                    className={`${menuItemClass} disabled:opacity-40`}
                  >
                    <span>Bring to Front</span>
                    <kbd className={kbdClass}>⇧⌘]</kbd>
                  </button>

                  <button
                    onClick={() => {
                      if (onBringForward) onBringForward();
                      closeAllMenus();
                    }}
                    disabled={selectedElements.length === 0}
                    className={`${menuItemClass} disabled:opacity-40`}
                  >
                    <span>Bring Forward</span>
                    <kbd className={kbdClass}>⌘]</kbd>
                  </button>

                  <button
                    onClick={() => {
                      if (onSendBackward) onSendBackward();
                      closeAllMenus();
                    }}
                    disabled={selectedElements.length === 0}
                    className={`${menuItemClass} disabled:opacity-40`}
                  >
                    <span>Send Backward</span>
                    <kbd className={kbdClass}>⌘[</kbd>
                  </button>

                  <button
                    onClick={() => {
                      if (onSendToBack) onSendToBack();
                      closeAllMenus();
                    }}
                    disabled={selectedElements.length === 0}
                    className={`${menuItemClass} disabled:opacity-40`}
                  >
                    <span>Send to Back</span>
                    <kbd className={kbdClass}>⇧⌘[</kbd>
                  </button>

                  <div className="my-1 border-t" style={{ borderColor: THEME.borderMain }} />

                  {/* Alignment */}
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8B929C]">Align</div>
                  <div className="grid grid-cols-3 gap-1 px-3 py-1">
                    <button
                      onClick={() => {
                        if (onAlign) onAlign("left");
                        closeAllMenus();
                      }}
                      className="p-1 rounded text-center hover:bg-[#202327] text-[11px]"
                    >
                      Left
                    </button>
                    <button
                      onClick={() => {
                        if (onAlign) onAlign("center");
                        closeAllMenus();
                      }}
                      className="p-1 rounded text-center hover:bg-[#202327] text-[11px]"
                    >
                      Center
                    </button>
                    <button
                      onClick={() => {
                        if (onAlign) onAlign("right");
                        closeAllMenus();
                      }}
                      className="p-1 rounded text-center hover:bg-[#202327] text-[11px]"
                    >
                      Right
                    </button>
                    <button
                      onClick={() => {
                        if (onAlign) onAlign("top");
                        closeAllMenus();
                      }}
                      className="p-1 rounded text-center hover:bg-[#202327] text-[11px]"
                    >
                      Top
                    </button>
                    <button
                      onClick={() => {
                        if (onAlign) onAlign("middle");
                        closeAllMenus();
                      }}
                      className="p-1 rounded text-center hover:bg-[#202327] text-[11px]"
                    >
                      Middle
                    </button>
                    <button
                      onClick={() => {
                        if (onAlign) onAlign("bottom");
                        closeAllMenus();
                      }}
                      className="p-1 rounded text-center hover:bg-[#202327] text-[11px]"
                    >
                      Bottom
                    </button>
                  </div>

                  <div className="my-1 border-t" style={{ borderColor: THEME.borderMain }} />

                  <button
                    onClick={() => {
                      if (onGroupSelected) onGroupSelected();
                      closeAllMenus();
                    }}
                    disabled={selectedElements.length < 2}
                    className={`${menuItemClass} disabled:opacity-40`}
                  >
                    <span>Group</span>
                    <kbd className={kbdClass}>⌘G</kbd>
                  </button>

                  <button
                    onClick={() => {
                      if (onUngroupSelected) onUngroupSelected();
                      closeAllMenus();
                    }}
                    disabled={selectedElements.length === 0}
                    className={`${menuItemClass} disabled:opacity-40`}
                  >
                    <span>Ungroup</span>
                    <kbd className={kbdClass}>⇧⌘G</kbd>
                  </button>

                  <button
                    onClick={() => {
                      if (onLockSelected) onLockSelected();
                      closeAllMenus();
                    }}
                    disabled={selectedElements.length === 0}
                    className={`${menuItemClass} disabled:opacity-40`}
                  >
                    <span>Lock / Unlock</span>
                    <kbd className={kbdClass}>⌘L</kbd>
                  </button>

                  {onConvertToVector && (
                    <button
                      onClick={() => {
                        onConvertToVector();
                        closeAllMenus();
                      }}
                      disabled={selectedElements.length === 0}
                      className={`${menuItemClass} disabled:opacity-40`}
                    >
                      <span>Convert to Vector</span>
                    </button>
                  )}

                  {onRasterize && (
                    <button
                      onClick={() => {
                        onRasterize();
                        closeAllMenus();
                      }}
                      disabled={selectedElements.length === 0}
                      className={`${menuItemClass} disabled:opacity-40`}
                    >
                      <span>Rasterize to Image</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 6. COLLABORATE MENU */}
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === "collaborate" ? null : "collaborate")}
                className={menuButtonClass("collaborate")}
              >
                Collaborate
              </button>

              {activeMenu === "collaborate" && (
                <div
                  className={dropdownContainerClass}
                  style={{ backgroundColor: THEME.menuPanel, borderColor: THEME.borderMain, width: 230 }}
                >
                  <button
                    onClick={() => {
                      closeAllMenus();
                      setIsShareModalOpen(true);
                    }}
                    className={menuItemClass}
                  >
                    <span>Invite People...</span>
                  </button>

                  <button
                    onClick={() => {
                      handleCopyLink();
                      closeAllMenus();
                    }}
                    className={menuItemClass}
                  >
                    <span>Copy Board Link</span>
                    <kbd className={kbdClass}>{copiedLink ? "Copied!" : "⌘C"}</kbd>
                  </button>

                  <div className="my-1 border-t" style={{ borderColor: THEME.borderMain }} />

                  <button
                    onClick={() => {
                      setIsCollabMenuOpen(true);
                      closeAllMenus();
                    }}
                    className={menuItemClass}
                  >
                    <span>People on Board ({totalUsers})</span>
                  </button>

                  {onToggleShowPeerCursors && (
                    <button
                      onClick={() => {
                        onToggleShowPeerCursors();
                        closeAllMenus();
                      }}
                      className={menuItemClass}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-3 text-xs">{showPeerCursors ? "✓" : ""}</span>
                        <span>Show Multiplayer Cursors</span>
                      </div>
                    </button>
                  )}

                  <div className="my-1 border-t" style={{ borderColor: THEME.borderMain }} />

                  {onOpenHistory && (
                    <button
                      onClick={() => {
                        closeAllMenus();
                        onOpenHistory();
                      }}
                      className={menuItemClass}
                    >
                      <span>Activity History & Timeline</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 7. HELP MENU */}
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === "help" ? null : "help")}
                className={menuButtonClass("help")}
              >
                Help
              </button>

              {activeMenu === "help" && (
                <div
                  className={dropdownContainerClass}
                  style={{ backgroundColor: THEME.menuPanel, borderColor: THEME.borderMain, width: 210 }}
                >
                  <button
                    onClick={() => {
                      closeAllMenus();
                      onOpenShortcuts();
                    }}
                    className={menuItemClass}
                  >
                    <span>Keyboard Shortcuts</span>
                    <kbd className={kbdClass}>?</kbd>
                  </button>

                  <button
                    onClick={() => {
                      closeAllMenus();
                      onOpenTemplates();
                    }}
                    className={menuItemClass}
                  >
                    <span>Starter Templates</span>
                  </button>

                  <div className="my-1 border-t" style={{ borderColor: THEME.borderMain }} />

                  <div className="px-3 py-1.5 text-[11px] text-[#8B929C]">
                    <div className="font-semibold text-[#F5F5F5]">Foundry Workspace</div>
                    <div>Version 3.0 (Modular AI-Ready)</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= RIGHT SIDE: SEARCH | ● 3 ONLINE | VIEW: FLAT ▾ | AI | SHARE | ••• ================= */}
        <div className="flex items-center gap-2">
          {/* SEARCH BUTTON */}
          {onOpenSearch && (
            <button
              onClick={onOpenSearch}
              className="p-1.5 rounded-md transition-colors cursor-pointer text-[#8B929C] hover:text-[#F5F5F5] hover:bg-[#202327]"
              title="Search board objects (⌘K)"
            >
              <Search size={15} />
            </button>
          )}

          {/* ● 3 ONLINE STATUS PILL */}
          <div id="collab-trigger" className="relative">
            <button
              onClick={() => setIsCollabMenuOpen(!isCollabMenuOpen)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border"
              style={{
                backgroundColor: isCollabMenuOpen ? THEME.menuHover : "transparent",
                borderColor: THEME.borderMain,
                color: THEME.mainText,
              }}
              onMouseEnter={(e) => {
                if (!isCollabMenuOpen) e.currentTarget.style.backgroundColor = THEME.menuHover;
              }}
              onMouseLeave={(e) => {
                if (!isCollabMenuOpen) e.currentTarget.style.backgroundColor = "transparent";
              }}
              title="Collaborators on board"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: connectionStatus === "connected" ? THEME.selected : THEME.warmHighlight,
                }}
              />
              <span className="hidden sm:inline font-medium">{totalUsers} online</span>
            </button>

            {/* Collaborators Popover */}
            {isCollabMenuOpen && (
              <div
                className="absolute top-full right-0 mt-1 w-64 p-2 rounded-xl border shadow-2xl backdrop-blur-md z-50 text-xs animate-in fade-in zoom-in-95"
                style={{ backgroundColor: THEME.menuPanel, borderColor: THEME.borderMain, color: THEME.mainText }}
              >
                <div className="pb-1.5 px-1 border-b text-[11px] font-bold uppercase tracking-wider text-[#8B929C]">
                  People on Board
                </div>

                <div className="py-1 space-y-1">
                  {/* Host User */}
                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#202327]">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                        style={{ backgroundColor: currentUser.color }}
                      >
                        {currentUser.name.charAt(0)}
                      </span>
                      <span className="font-semibold text-xs text-[#F5F5F5]">{currentUser.name} (You)</span>
                    </div>
                    <span className="text-[10px] text-[#39E58C] font-semibold uppercase">Host</span>
                  </div>

                  {/* Connected Peers */}
                  {usersList.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-[#202327]">
                      <div
                        onClick={() => {
                          onJumpToUser(user.id);
                          setIsCollabMenuOpen(false);
                        }}
                        className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                      >
                        <span
                          className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                          style={{ backgroundColor: user.color }}
                        >
                          {user.name.charAt(0)}
                        </span>
                        <div className="truncate">
                          <span className="font-medium text-xs block text-[#F5F5F5] truncate">{user.name}</span>
                          {user.activeTool && (
                            <span className="text-[10px] text-[#8B929C] capitalize block">
                              Tool: {user.activeTool}
                            </span>
                          )}
                        </div>
                      </div>

                      {onFollowUser && (
                        <button
                          onClick={() => {
                            onFollowUser(followingUserId === user.id ? null : user.id);
                            setIsCollabMenuOpen(false);
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer"
                          style={{
                            backgroundColor: followingUserId === user.id ? THEME.warmHighlight : THEME.menuHover,
                            color: followingUserId === user.id ? "#0B1117" : THEME.mainText,
                          }}
                        >
                          {followingUserId === user.id ? "Following" : "Follow"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* VIEW MODE: FLAT ▾ */}
          {onSelectViewMode && (
            <div className="relative">
              <select
                value={viewMode}
                onChange={(e) => onSelectViewMode(e.target.value as ViewMode)}
                className="text-xs font-semibold px-2 py-1 rounded-md border outline-hidden cursor-pointer transition-colors"
                style={{
                  backgroundColor: THEME.menuHover,
                  borderColor: THEME.borderMain,
                  color: THEME.mainText,
                }}
              >
                <option value="flat">View: Flat</option>
                <option value="soft-3d">View: 3D Tilt</option>
                <option value="deep-3d">View: Deep 3D</option>
                <option value="presentation">View: Slides</option>
              </select>
            </div>
          )}

          {/* COMMENTS & DISCUSSIONS BUTTON */}
          {onOpenComments && (
            <button
              onClick={onOpenComments}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer border"
              style={{
                backgroundColor: THEME.menuHover,
                borderColor: THEME.borderMain,
                color: THEME.mainText,
              }}
              title="Comments & Discussion Threads (C)"
            >
              <MessageSquare size={13} style={{ color: THEME.selected }} />
              <span className="hidden sm:inline font-semibold">Comments</span>
              {unresolvedCommentsCount > 0 && (
                <span className="px-1.5 py-0.2 min-w-4 text-center rounded-full bg-blue-500 text-white text-[9px] font-bold shadow-2xs">
                  {unresolvedCommentsCount}
                </span>
              )}
            </button>
          )}

          {/* PRIMARY AI BUTTON (routed directly to Education Controller openAI) */}
          <div id="ai-quick-trigger" className="relative">
            <button
              onClick={() => {
                closeAllMenus();
                if (onOpenAiAssistant) onOpenAiAssistant();
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer border"
              style={{
                backgroundColor: THEME.menuHover,
                borderColor: THEME.borderMain,
                color: THEME.mainText,
              }}
              title="Open Foundry AI Chat"
            >
              <Wand2 size={13} style={{ color: THEME.selected }} />
              <span className="font-semibold">AI</span>
            </button>
          </div>

          {/* SHARE BUTTON */}
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer shadow-xs"
            style={{
              backgroundColor: THEME.selected,
              color: "#0B0D0F",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.06)")}
            onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
            title="Share & Invite"
          >
            <Share2 size={13} />
            <span className="hidden sm:inline font-bold">SHARE</span>
          </button>

          {/* ••• MORE ACTIONS MENU */}
          <div id="more-quick-trigger" className="relative">
            <button
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              className="p-1.5 rounded-md transition-colors cursor-pointer text-[#8B929C] hover:text-[#F5F5F5] hover:bg-[#202327]"
              title="More settings and tools"
            >
              <MoreHorizontal size={16} />
            </button>

            {isMoreMenuOpen && (
              <div
                className="absolute top-full right-0 mt-1 w-56 py-1.5 rounded-xl border shadow-2xl backdrop-blur-md z-50 text-xs animate-in fade-in zoom-in-95"
                style={{ backgroundColor: THEME.menuPanel, borderColor: THEME.borderMain, color: THEME.mainText }}
              >
                {onTogglePropertiesPanel && (
                  <button
                    onClick={() => {
                      onTogglePropertiesPanel();
                      setIsMoreMenuOpen(false);
                    }}
                    className={menuItemClass}
                  >
                    <div className="flex items-center gap-2">
                      <Sliders size={13} style={{ color: isPropertiesPanelOpen ? THEME.selected : THEME.secondaryText }} />
                      <span>Properties Panel</span>
                    </div>
                    <span className="text-[10px] opacity-60">{isPropertiesPanelOpen ? "Open" : "Closed"}</span>
                  </button>
                )}

                {onToggleDarkMode && (
                  <button
                    onClick={() => {
                      onToggleDarkMode();
                      setIsMoreMenuOpen(false);
                    }}
                    className={menuItemClass}
                  >
                    <div className="flex items-center gap-2">
                      {isDarkMode ? <Sun size={13} style={{ color: THEME.warmHighlight }} /> : <Moon size={13} />}
                      <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
                    </div>
                  </button>
                )}

                {onToggleMinimap && (
                  <button
                    onClick={() => {
                      onToggleMinimap();
                      setIsMoreMenuOpen(false);
                    }}
                    className={menuItemClass}
                  >
                    <div className="flex items-center gap-2">
                      <Layers size={13} />
                      <span>Minimap View</span>
                    </div>
                    <span className="text-[10px] opacity-60">{showMinimap ? "On" : "Off"}</span>
                  </button>
                )}

                {onToggleCleanBoard && (
                  <button
                    onClick={() => {
                      onToggleCleanBoard();
                      setIsMoreMenuOpen(false);
                    }}
                    className={menuItemClass}
                  >
                    <div className="flex items-center gap-2">
                      <Eye size={13} />
                      <span>Clean Board Mode</span>
                    </div>
                    <kbd className={kbdClass}>Tab</kbd>
                  </button>
                )}

                <div className="my-1 border-t" style={{ borderColor: THEME.borderMain }} />

                <button
                  onClick={() => {
                    onResetBoard();
                    setIsMoreMenuOpen(false);
                  }}
                  className={`${menuItemClass} text-[#96594B] hover:bg-[#96594B]/15`}
                >
                  <div className="flex items-center gap-2">
                    <RotateCcw size={13} />
                    <span>Reset Board to Default</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Hidden File Input for Board JSON Import */}
        <input ref={fileInputRef} type="file" accept=".json" onChange={onImportJson} className="hidden" />
      </header>

      {/* ================= SLATE WHITEBOARD NAVIGATION DRAWER ================= */}
      <AppMenuDrawer
        isOpen={isAppMenuOpen}
        onClose={() => setIsAppMenuOpen(false)}
        currentBoardId={boardId}
        currentBoardTitle={boardTitle}
        boardsList={boardsList}
        onSelectBoard={(idOrTitle) => {
          if (onSelectBoard) onSelectBoard(idOrTitle);
          else setBoardTitle(idOrTitle);
        }}
        onNewBoard={() => {
          if (onNewBoard) onNewBoard();
          else {
            onResetBoard();
            setBoardTitle("Untitled Board");
          }
        }}
        onDeleteBoard={onDeleteBoard}
        onOpenTemplates={onOpenTemplates}
        onOpenShortcuts={onOpenShortcuts}
        onOpenImports={() => {
          if (onOpenHtmlUpload) onOpenHtmlUpload();
        }}
        currentUser={currentUser}
      />

      {/* ================= SHARE MODAL ================= */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-md p-5 rounded-2xl border shadow-2xl animate-in zoom-in-95"
            style={{
              backgroundColor: THEME.menuPanel,
              borderColor: THEME.borderMain,
              color: THEME.mainText,
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: THEME.borderMain }}>
              <div className="flex items-center gap-2">
                <Share2 size={16} style={{ color: THEME.selected }} />
                <h3 className="font-bold text-sm">Share "{boardTitle}"</h3>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="p-1 rounded hover:opacity-80 transition-opacity cursor-pointer"
                style={{ color: THEME.secondaryText }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-semibold block mb-1" style={{ color: THEME.secondaryText }}>
                  Direct Collaboration Link
                </label>
                <div
                  className="flex items-center gap-2 p-1.5 rounded-lg border"
                  style={{ backgroundColor: THEME.mainBar, borderColor: THEME.borderMain }}
                >
                  <input
                    type="text"
                    readOnly
                    value={window.location.href}
                    className="w-full bg-transparent border-none outline-hidden text-xs truncate"
                    style={{ color: THEME.mainText }}
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-1 rounded text-xs font-semibold cursor-pointer shrink-0"
                    style={{ backgroundColor: THEME.selected, color: "#0B0D0F" }}
                  >
                    {copiedLink ? "Copied!" : "Copy Link"}
                  </button>
                </div>
              </div>

              <div>
                <span className="font-semibold block mb-1" style={{ color: THEME.secondaryText }}>
                  Board Permissions
                </span>
                <div
                  className="p-3 rounded-lg border space-y-2"
                  style={{ backgroundColor: THEME.mainBar, borderColor: THEME.borderMain }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold block">Anyone with the link</span>
                      <span className="text-[11px] opacity-70">Can edit and add notes in real-time</span>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#39E58C]/15 text-[#39E58C]">
                      Editor
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                style={{ backgroundColor: THEME.menuHover, color: THEME.mainText }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
