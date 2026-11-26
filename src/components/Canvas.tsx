import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import DOMPurify from "dompurify";
import { Box, Code2, Sparkles } from "lucide-react";
import {
  BoardElement,
  Viewport,
  ToolType,
  ShapeType,
  Point,
  StrokePoint,
  VectorNode,
  BrushType,
  UserPresence,
  ViewMode,
  BoardOperation,
  LaserPoint,
  ReactionBurst,
} from "../types";
import {
  createOperationId,
  createTransactionId,
} from "../utils/undoManager";
import {
  screenToWorld,
  worldToScreen,
  getNearestAnchor,
  computeSelectionBounds,
  isElementInBox,
  generateId,
} from "../utils/canvasMath";
import {
  simplifyPoints,
  getSvgPathFromStrokePoints,
  vectorNodesToSvgPath,
  shapeToVectorNodes,
  computeVectorBounds,
} from "../utils/vectorMath";
import { ElementView } from "./ElementView";
import { HtmlSourceModal } from "./HtmlSourceModal";
import { ContextMenu } from "./ContextMenu";
import { QuickToolRadialMenu } from "./QuickToolRadialMenu";

interface CanvasProps {
  elements: BoardElement[];
  viewport: Viewport;
  setViewport: React.Dispatch<React.SetStateAction<Viewport>>;
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  selectedShapeType: ShapeType;
  selectedStickyColor: string;
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onCreateElement: (element: BoardElement) => void;
  onUpdateElement: (id: string, partial: Partial<BoardElement>, recordHistory?: boolean) => void;
  onBatchUpdateElements: (updated: BoardElement[], recordHistory?: boolean) => void;
  onCommitOperation?: (op: BoardOperation) => void;
  onDeleteElements: (ids: string[]) => void;
  onDuplicateElements: (elements: BoardElement[]) => void;
  onGroupElements?: (ids?: string[]) => void;
  onUngroupElements?: (ids?: string[]) => void;
  onSendCursor: (point: Point | null, selectedIds: string[]) => void;
  activeUsers: Record<string, UserPresence>;
  currentUser: { id: string; name: string; color: string };
  onAddReaction: (id: string, emoji: string) => void;
  isTilted3D?: boolean;
  setIsTilted3D?: React.Dispatch<React.SetStateAction<boolean>>;
  viewMode?: ViewMode;
  setViewMode?: (mode: ViewMode) => void;
  onNotify?: (msg: string) => void;
  onOpenUploadModal?: () => void;
  brush?: BrushType;
  brushSize?: number;
  brushOpacity?: number;
  brushSmooth?: number;
  brushColor?: string;
  brushPressure?: boolean;
  brushStabilize?: boolean;
  vectorFillColor?: string | null;
  vectorStrokeColor?: string;
  vectorStrokeWidth?: number;
  vectorStrokeCap?: "round" | "butt" | "square";
  vectorStrokeJoin?: "round" | "miter" | "bevel";
  selectedNodeIndex?: number | null;
  setSelectedNodeIndex?: (idx: number | null) => void;
  isDarkMode?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onOpenShortcuts?: () => void;
  onToggleCleanBoard?: () => void;
  isCleanBoardMode?: boolean;
  setBrush?: (brush: BrushType) => void;
  setBrushSize?: React.Dispatch<React.SetStateAction<number>> | ((size: number | ((prev: number) => number)) => void);
  setBrushColor?: (color: string) => void;
  setVectorStrokeColor?: (color: string) => void;
  onConvertToVector?: (id: string) => void;
  onConvertToPath?: (id: string) => void;
  onRasterize?: (elements: BoardElement[]) => void;
  followingUserId?: string | null;
  setFollowingUserId?: (id: string | null) => void;
  showPeerCursors?: boolean;
  onOpenSearch?: () => void;
  onOpenExportModal?: () => void;
  peerLaserPoints?: LaserPoint[];
  onSendLaserPoint?: (point: Point) => void;
  activeReactions?: ReactionBurst[];
  onSendReactionBurst?: (emoji: string, point?: Point) => void;
  gridEnabled?: boolean;
  snapEnabled?: boolean;
  guidesEnabled?: boolean;
}

type DragMode =
  | "none"
  | "pan"
  | "orbit_3d"
  | "move_elements"
  | "resize_element"
  | "rotate_element"
  | "marquee_select"
  | "create_connector"
  | "freehand_draw"
  | "eraser"
  | "laser"
  | "vector_draw_shape"
  | "vector_pen_draw"
  | "move_vector_node"
  | "move_vector_handle";

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  viewport,
  setViewport,
  activeTool,
  setActiveTool,
  selectedShapeType,
  selectedStickyColor,
  selectedIds,
  setSelectedIds,
  editingId,
  setEditingId,
  onCreateElement,
  onUpdateElement,
  onBatchUpdateElements,
  onCommitOperation,
  onDeleteElements,
  onDuplicateElements,
  onGroupElements,
  onUngroupElements,
  onSendCursor,
  activeUsers,
  currentUser,
  onAddReaction,
  isTilted3D,
  setIsTilted3D,
  viewMode,
  setViewMode,
  onNotify,
  onOpenUploadModal,
  brush = "pen",
  brushSize = 3,
  brushOpacity = 1,
  brushSmooth = 2,
  brushColor = "#0f172a",
  brushPressure = true,
  brushStabilize = true,
  vectorFillColor = null,
  vectorStrokeColor = "#0f172a",
  vectorStrokeWidth = 2,
  vectorStrokeCap = "round",
  vectorStrokeJoin = "round",
  selectedNodeIndex,
  setSelectedNodeIndex,
  isDarkMode = false,
  gridEnabled = true,
  snapEnabled = true,
  guidesEnabled = true,
  onUndo,
  onRedo,
  onOpenShortcuts,
  onToggleCleanBoard,
  isCleanBoardMode = false,
  setBrush,
  setBrushSize,
  setBrushColor,
  setVectorStrokeColor,
  onConvertToVector,
  onConvertToPath,
  onRasterize,
  followingUserId: propFollowingUserId,
  setFollowingUserId: propSetFollowingUserId,
  showPeerCursors = true,
  onOpenSearch,
  onOpenExportModal,
  peerLaserPoints = [],
  onSendLaserPoint,
  activeReactions = [],
  onSendReactionBurst,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalTilted, setInternalTilted] = useState(false);

  // Collaborative Laser Pointer local trailing points
  const [localLaserPoints, setLocalLaserPoints] = useState<{ x: number; y: number; timestamp: number }[]>([]);

  // Periodically fade/purge old local laser trail points
  useEffect(() => {
    if (localLaserPoints.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setLocalLaserPoints((prev) => (prev.length === 0 ? prev : prev.filter((p) => now - p.timestamp < 1200)));
    }, 100);
    return () => clearInterval(timer);
  }, [localLaserPoints.length]);
  const is3D = viewMode === "soft-3d" || viewMode === "deep-3d" || (isTilted3D !== undefined ? isTilted3D : internalTilted);
  const isDeep3D = viewMode === "deep-3d";
  const currentTilted = is3D;
  const toggleTilt = () => {
    if (setViewMode) {
      setViewMode(is3D ? "flat" : "soft-3d");
    } else if (setIsTilted3D) {
      setIsTilted3D((prev) => !prev);
    } else {
      setInternalTilted((prev) => !prev);
    }
  };

  // Toast notification state
  const [localToast, setLocalToast] = useState<string | null>(null);
  const toastTimer = useRef<any>(null);
  const showToast = useCallback((msg: string) => {
    setLocalToast(msg);
    if (onNotify) onNotify(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setLocalToast(null), 2400);
  }, [onNotify]);

  // Modal for viewing/editing raw HTML code
  const [inspectingHtmlElement, setInspectingHtmlElement] = useState<BoardElement | null>(null);

  // Mouse tracking for pasting right at world coordinates
  const lastMouseWorld = useRef<Point>({ x: 0, y: 0 });
  const lastMouseScreen = useRef<Point>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  // Create sanitized HTML card helper
  const handleCreateHtmlCard = useCallback((rawHtml: string, worldPos: Point, title = "PASTED · HTML") => {
    const sanitized = DOMPurify.sanitize(rawHtml, {
      ADD_ATTR: ["target", "rel", "style", "class"],
      ADD_TAGS: ["style", "iframe"],
    });

    const maxZ = elements.length > 0 ? Math.max(...elements.map((e) => e.zIndex)) : 0;
    const newCard: BoardElement = {
      id: generateId("html"),
      type: "html",
      x: Math.round(worldPos.x - 20),
      y: Math.round(worldPos.y - 20),
      width: 440,
      height: 320,
      zIndex: maxZ + 1,
      content: sanitized,
      rawHtml: rawHtml,
      title: title,
      sourceName: title,
      isRasterized: false,
    };

    onCreateElement(newCard);
    setSelectedIds([newCard.id]);
    showToast("Pasted HTML — sanitized and dropped onto the board.");
  }, [elements, onCreateElement, setSelectedIds, showToast]);

  // Paste listener for clipboard text/html, images, URLs, and files
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "textarea" || activeTag === "input") {
        return;
      }

      const cd = e.clipboardData;
      if (!cd) return;

      const pos = lastMouseWorld.current || { x: 0, y: 0 };

      // 1. Check if clipboard contains image items / screenshot data
      if (cd.items && cd.items.length > 0) {
        for (let i = 0; i < cd.items.length; i++) {
          const item = cd.items[i];
          if (item.type.indexOf("image") !== -1) {
            e.preventDefault();
            const blob = item.getAsFile();
            if (blob) {
              const reader = new FileReader();
              reader.onload = (ev) => {
                const dataUrl = ev.target?.result as string;
                if (dataUrl) {
                  const maxZ = elements.length > 0 ? Math.max(...elements.map((el) => el.zIndex)) : 0;
                  const newImg: BoardElement = {
                    id: generateId("img"),
                    type: "image",
                    x: Math.round(pos.x - 160),
                    y: Math.round(pos.y - 120),
                    width: 320,
                    height: 240,
                    imageUrl: dataUrl,
                    title: "Pasted Image",
                    zIndex: maxZ + 1,
                  };
                  onCreateElement(newImg);
                  setSelectedIds([newImg.id]);
                  showToast("Pasted image screenshot to whiteboard.");
                }
              };
              reader.readAsDataURL(blob);
              return;
            }
          }
        }
      }

      // 2. Check if clipboard files include HTML, images, or documents
      if (cd.files && cd.files.length > 0) {
        for (let i = 0; i < cd.files.length; i++) {
          const file = cd.files[i];
          if (file.type.startsWith("image/")) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = (ev) => {
              const dataUrl = ev.target?.result as string;
              if (dataUrl) {
                const maxZ = elements.length > 0 ? Math.max(...elements.map((el) => el.zIndex)) : 0;
                const newImg: BoardElement = {
                  id: generateId("img"),
                  type: "image",
                  x: Math.round(pos.x - 160),
                  y: Math.round(pos.y - 120),
                  width: 320,
                  height: 240,
                  imageUrl: dataUrl,
                  title: file.name,
                  zIndex: maxZ + 1,
                };
                onCreateElement(newImg);
                setSelectedIds([newImg.id]);
                showToast(`Pasted image: ${file.name}`);
              }
            };
            reader.readAsDataURL(file);
            return;
          } else if (file.name.endsWith(".html") || file.name.endsWith(".htm") || file.type.includes("html")) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = (ev) => {
              const content = ev.target?.result as string;
              if (content) {
                handleCreateHtmlCard(content, pos, file.name);
              }
            };
            reader.readAsText(file);
            return;
          }
        }
      }

      const html = cd.getData("text/html");
      const text = cd.getData("text/plain");

      if (!html && !text) return;

      e.preventDefault();

      // 3. Rich HTML pasted from webpage
      if (html && html.trim().length > 0) {
        handleCreateHtmlCard(html, pos, "PASTED · HTML");
        return;
      }

      // 4. Check if text is a Web URL
      const trimmedText = (text || "").trim();
      if (/^https?:\/\/[^\s]+$/i.test(trimmedText)) {
        let domain = "Web Link";
        try {
          domain = new URL(trimmedText).hostname;
        } catch {}

        const maxZ = elements.length > 0 ? Math.max(...elements.map((el) => el.zIndex)) : 0;
        const newLink: BoardElement = {
          id: generateId("link"),
          type: "link",
          x: Math.round(pos.x - 140),
          y: Math.round(pos.y - 65),
          width: 280,
          height: 130,
          linkUrl: trimmedText,
          linkTitle: domain,
          linkDescription: `Web link to ${domain}`,
          zIndex: maxZ + 1,
        };
        onCreateElement(newLink);
        setSelectedIds([newLink.id]);
        showToast(`Created link card for ${domain}`);
        return;
      }

      // 5. Check if text is raw HTML code snippet
      if (trimmedText.startsWith("<") && (trimmedText.includes("</") || trimmedText.endsWith(">"))) {
        handleCreateHtmlCard(trimmedText, pos, "HTML Snippet");
        return;
      }

      // 6. Plain text -> Sticky note
      if (trimmedText) {
        const maxZ = elements.length > 0 ? Math.max(...elements.map((el) => el.zIndex)) : 0;
        const newSticky: BoardElement = {
          id: generateId("note"),
          type: "sticky",
          x: Math.round(pos.x - 90),
          y: Math.round(pos.y - 90),
          width: 180,
          height: 180,
          content: trimmedText,
          color: selectedStickyColor,
          zIndex: maxZ + 1,
          authorName: currentUser.name,
        };
        onCreateElement(newSticky);
        setSelectedIds([newSticky.id]);
        showToast("Created sticky note from clipboard text.");
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleCreateHtmlCard, elements, onCreateElement, setSelectedIds, selectedStickyColor, currentUser.name, showToast]);

  // Drag and drop files (images, HTML, documents) directly onto canvas
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const rect = containerRef.current?.getBoundingClientRect();
      const screenX = e.clientX - (rect?.left || 0);
      const screenY = e.clientY - (rect?.top || 0);
      const worldPos = screenToWorld(screenX, screenY, viewport);

      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const offset = i * 24;

        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            if (dataUrl) {
              const maxZ = elements.length > 0 ? Math.max(...elements.map((el) => el.zIndex)) : 0;
              const newImg: BoardElement = {
                id: generateId("img"),
                type: "image",
                x: Math.round(worldPos.x - 160 + offset),
                y: Math.round(worldPos.y - 120 + offset),
                width: 320,
                height: 240,
                imageUrl: dataUrl,
                title: file.name,
                zIndex: maxZ + 1,
              };
              onCreateElement(newImg);
              setSelectedIds([newImg.id]);
              showToast(`Uploaded image: ${file.name}`);
            }
          };
          reader.readAsDataURL(file);
        } else if (
          file.name.endsWith(".html") ||
          file.name.endsWith(".htm") ||
          file.type.includes("html")
        ) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const content = ev.target?.result as string;
            if (content) {
              handleCreateHtmlCard(content, { x: worldPos.x + offset, y: worldPos.y + offset }, file.name);
            }
          };
          reader.readAsText(file);
        } else {
          // Document / file card
          const maxZ = elements.length > 0 ? Math.max(...elements.map((el) => el.zIndex)) : 0;
          const newFile: BoardElement = {
            id: generateId("file"),
            type: "file",
            x: Math.round(worldPos.x - 140 + offset),
            y: Math.round(worldPos.y - 60 + offset),
            width: 280,
            height: 120,
            fileName: file.name,
            fileSize: `${(file.size / 1024).toFixed(1)} KB`,
            fileType: file.type || "Document",
            title: file.name,
            zIndex: maxZ + 1,
          };
          onCreateElement(newFile);
          setSelectedIds([newFile.id]);
          showToast(`Attached file: ${file.name}`);
        }
      }
    }
  };

  // Interaction states
  const [dragMode, setDragMode] = useState<DragMode>("none");
  const dragStartScreen = useRef<Point>({ x: 0, y: 0 });
  const dragStartWorld = useRef<Point>({ x: 0, y: 0 });
  const dragStartViewport = useRef<Viewport>(viewport);
  const dragStartElementBounds = useRef<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
  const dragStartSelectionBounds = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const dragStartElementSnapshots = useRef<Map<string, BoardElement>>(new Map());
  const activeResizeHandle = useRef<ResizeHandle | null>(null);

  // Active transient transforms for zero-lag batch operations & connector synchronization
  const [activeTransforms, setActiveTransforms] = useState<Map<string, Partial<BoardElement>>>(new Map());
  const activeTransformsRef = useRef<Map<string, Partial<BoardElement>>>(new Map());

  // Fast index of connectors by bound element ID
  const connectorsByElementId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    elements.forEach((el) => {
      if (el.type === "connector") {
        if (el.startBinding?.elementId) {
          if (!map.has(el.startBinding.elementId)) map.set(el.startBinding.elementId, new Set());
          map.get(el.startBinding.elementId)!.add(el.id);
        }
        if (el.endBinding?.elementId) {
          if (!map.has(el.endBinding.elementId)) map.set(el.endBinding.elementId, new Set());
          map.get(el.endBinding.elementId)!.add(el.id);
        }
      }
    });
    return map;
  }, [elements]);

  // Single current-geometry authority: all objects and connectors read from effectiveElements
  const effectiveElements = useMemo(() => {
    if (activeTransforms.size === 0) return elements;
    return elements.map((el) => {
      const transform = activeTransforms.get(el.id);
      return transform ? { ...el, ...transform } : el;
    });
  }, [elements, activeTransforms]);

  // Helper to resolve an element with its current active preview transform applied
  const getEffectiveElement = useCallback(
    (el: BoardElement): BoardElement => {
      const transform = activeTransformsRef.current.get(el.id);
      return transform ? { ...el, ...transform } : el;
    },
    []
  );

  // Marquee selection box
  const [marqueeBox, setMarqueeBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Freehand drawing in progress
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [drawingStrokePoints, setDrawingStrokePoints] = useState<StrokePoint[]>([]);

  // Vector shape draft (Line, Rect, Ellipse, Star, Polygon)
  const [vectorShapeDraft, setVectorShapeDraft] = useState<{
    start: Point;
    current: Point;
    shape: string;
  } | null>(null);

  // Vector node editing tracking
  const activeNodeDrag = useRef<{
    elementId: string;
    nodeIndex: number;
    handle?: "in" | "out";
  } | null>(null);
  const [internalSelectedNode, setInternalSelectedNode] = useState<number | null>(null);
  const activeNodeIdx = selectedNodeIndex !== undefined ? selectedNodeIndex : internalSelectedNode;
  const setActiveNodeIdx = setSelectedNodeIndex || setInternalSelectedNode;

  // Connector drawing in progress
  const [connectorDraft, setConnectorDraft] = useState<{
    start: Point;
    current: Point;
    startBinding?: { elementId: string; anchor: any };
    endBinding?: { elementId: string; anchor: any };
  } | null>(null);

  // Spacebar pan tracking
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Camera tilt/yaw angle for 3D perspective orbit
  const [cameraAngle, setCameraAngle] = useState({ pitch: 24, yaw: -2 });
  const dragStartAngle = useRef({ pitch: 24, yaw: -2 });

  // Sync default camera angle with viewMode
  useEffect(() => {
    if (viewMode === "deep-3d") {
      setCameraAngle({ pitch: 38, yaw: -5 });
    } else if (viewMode === "soft-3d") {
      setCameraAngle({ pitch: 24, yaw: -2 });
    }
  }, [viewMode]);

  // Temporary tool switching tracking (Hold E for eraser)
  const isHoldingEraser = useRef(false);
  const prevToolBeforeEraser = useRef<ToolType>("select");

  // Internal clipboard for Copy/Paste
  const clipboardRef = useRef<BoardElement[]>([]);

  // Radial Menu (Hold Q) and Context Menu (Right Click) state
  const [radialMenu, setRadialMenu] = useState<{ isOpen: boolean; x: number; y: number }>({
    isOpen: false,
    x: 0,
    y: 0,
  });
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    targetElement: BoardElement | null;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    targetElement: null,
  });

  // Follow user mode
  const [internalFollowingUserId, setInternalFollowingUserId] = useState<string | null>(null);
  const followingUserId = propFollowingUserId !== undefined ? propFollowingUserId : internalFollowingUserId;
  const setFollowingUserId = propSetFollowingUserId || setInternalFollowingUserId;

  useEffect(() => {
    if (!followingUserId || !activeUsers[followingUserId]?.cursor) return;
    const targetCursor = activeUsers[followingUserId].cursor!;
    setViewport((prev) => ({
      ...prev,
      x: window.innerWidth / 2 - targetCursor.x * prev.zoom,
      y: window.innerHeight / 2 - targetCursor.y * prev.zoom,
    }));
  }, [followingUserId, activeUsers, setViewport]);

  // Helper: Zoom to 100% (key: 0)
  const handleZoomReset = useCallback(() => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const centerWorld = screenToWorld(cx, cy, viewport);
    setViewport({
      zoom: 1.0,
      x: cx - centerWorld.x,
      y: cy - centerWorld.y,
    });
    showToast("Zoom reset to 100%");
  }, [viewport, setViewport, showToast]);

  // Helper: Zoom to entire board (key: Shift + 1)
  const handleZoomToFit = useCallback(() => {
    if (elements.length === 0) {
      setViewport({ x: window.innerWidth / 2, y: window.innerHeight / 2, zoom: 1.0 });
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    elements.forEach((el) => {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + (el.width || 100));
      maxY = Math.max(maxY, el.y + (el.height || 100));
    });
    const width = Math.max(100, maxX - minX);
    const height = Math.max(100, maxY - minY);
    const padding = 80;
    const scaleX = (window.innerWidth - padding * 2) / width;
    const scaleY = (window.innerHeight - padding * 2) / height;
    const zoom = Math.max(0.12, Math.min(2.0, Math.min(scaleX, scaleY)));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setViewport({
      zoom,
      x: window.innerWidth / 2 - centerX * zoom,
      y: window.innerHeight / 2 - centerY * zoom,
    });
    showToast("Zoom to entire board (100% content fit)");
  }, [elements, setViewport, showToast]);

  // Helper: Zoom to selection (key: Shift + 2)
  const handleZoomToSelection = useCallback(() => {
    const selected = elements.filter((el) => selectedIds.includes(el.id));
    if (selected.length === 0) {
      handleZoomToFit();
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selected.forEach((el) => {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + (el.width || 100));
      maxY = Math.max(maxY, el.y + (el.height || 100));
    });
    const width = Math.max(80, maxX - minX);
    const height = Math.max(80, maxY - minY);
    const padding = 120;
    const scaleX = (window.innerWidth - padding * 2) / width;
    const scaleY = (window.innerHeight - padding * 2) / height;
    const zoom = Math.max(0.2, Math.min(3.0, Math.min(scaleX, scaleY)));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setViewport({
      zoom,
      x: window.innerWidth / 2 - centerX * zoom,
      y: window.innerHeight / 2 - centerY * zoom,
    });
    showToast(`Zoomed to ${selected.length} selected item${selected.length > 1 ? "s" : ""}`);
  }, [elements, selectedIds, handleZoomToFit, setViewport, showToast]);

  // Layer hierarchy helpers
  const handleBringForward = useCallback((ids: string[]) => {
    const updated = elements.map((el) => {
      if (ids.includes(el.id)) {
        return { ...el, zIndex: (el.zIndex || 1) + 1 };
      }
      return el;
    });
    onBatchUpdateElements(updated.filter((el) => ids.includes(el.id)));
    showToast("Brought forward");
  }, [elements, onBatchUpdateElements, showToast]);

  const handleSendBackward = useCallback((ids: string[]) => {
    const updated = elements.map((el) => {
      if (ids.includes(el.id)) {
        return { ...el, zIndex: Math.max(0, (el.zIndex || 1) - 1) };
      }
      return el;
    });
    onBatchUpdateElements(updated.filter((el) => ids.includes(el.id)));
    showToast("Sent backward");
  }, [elements, onBatchUpdateElements, showToast]);

  const handleBringToFront = useCallback((ids: string[]) => {
    const maxZ = elements.length > 0 ? Math.max(...elements.map((e) => e.zIndex || 1)) : 1;
    const updated = elements.filter((el) => ids.includes(el.id)).map((el) => ({ ...el, zIndex: maxZ + 1 }));
    onBatchUpdateElements(updated);
    showToast("Brought to front");
  }, [elements, onBatchUpdateElements, showToast]);

  const handleSendToBack = useCallback((ids: string[]) => {
    const minZ = elements.length > 0 ? Math.min(...elements.map((e) => e.zIndex || 1)) : 1;
    const updated = elements.filter((el) => ids.includes(el.id)).map((el) => ({ ...el, zIndex: Math.max(0, minZ - 1) }));
    onBatchUpdateElements(updated);
    showToast("Sent to back");
  }, [elements, onBatchUpdateElements, showToast]);

  // Lock / Unlock toggle (Ctrl/Cmd + L)
  const handleToggleLock = useCallback(() => {
    const selected = elements.filter((el) => selectedIds.includes(el.id));
    if (selected.length > 0) {
      const shouldLock = !selected.every((el) => el.locked);
      const updated = selected.map((el) => ({ ...el, locked: shouldLock }));
      onBatchUpdateElements(updated);
      showToast(shouldLock ? "Locked selected items" : "Unlocked selected items");
    }
  }, [elements, selectedIds, onBatchUpdateElements, showToast]);

  // Copy to clipboard (Ctrl/Cmd + C)
  const handleCopyClipboard = useCallback(() => {
    const toCopy = elements.filter((el) => selectedIds.includes(el.id));
    if (toCopy.length > 0) {
      clipboardRef.current = JSON.parse(JSON.stringify(toCopy));
      showToast(`Copied ${toCopy.length} item${toCopy.length > 1 ? "s" : ""} to clipboard`);
    }
  }, [elements, selectedIds, showToast]);

  // Paste from clipboard (Ctrl/Cmd + V)
  const handlePasteClipboard = useCallback(() => {
    if (clipboardRef.current.length === 0) return;
    const pasteOffset = 30;
    const maxZ = elements.length > 0 ? Math.max(...elements.map((e) => e.zIndex || 1)) : 1;
    const pasted = clipboardRef.current.map((el, i) => ({
      ...JSON.parse(JSON.stringify(el)),
      id: generateId(el.type),
      x: el.x + pasteOffset,
      y: el.y + pasteOffset,
      zIndex: maxZ + 1 + i,
    }));
    pasted.forEach((p) => onCreateElement(p));
    setSelectedIds(pasted.map((p) => p.id));
    showToast(`Pasted ${pasted.length} item${pasted.length > 1 ? "s" : ""}`);
  }, [elements, onCreateElement, setSelectedIds, showToast]);

  // Keyboard navigation & spacebar handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in textarea, input, contenteditable, or inside an interactive HTML card
      const activeEl = document.activeElement as HTMLElement | null;
      const activeTag = activeEl?.tagName.toLowerCase();
      const isContentEditable = activeEl?.isContentEditable;
      const isInsideLiveHtmlCard = activeEl?.closest(".interactive-live-dom");

      if (activeTag === "textarea" || activeTag === "input" || isContentEditable || isInsideLiveHtmlCard) {
        if (e.key === "Escape") {
          setEditingId(null);
          activeEl?.blur();
        }
        return;
      }

      // 1. Tool switching & hold shortcuts
      if (e.code === "Space" && !isSpacePressed) {
        e.preventDefault();
        setIsSpacePressed(true);
      } else if (e.key === "v" || e.key === "V") {
        setActiveTool("select");
      } else if (e.key === "h" || e.key === "H") {
        setActiveTool("hand");
      } else if ((e.key === "b" || e.key === "B") && !e.ctrlKey && !e.metaKey) {
        if (e.shiftKey) {
          // Shift + B: cycle brush tools
          e.preventDefault();
          const brushes: BrushType[] = ["pen", "pencil", "marker", "highlighter"];
          const currentIdx = brushes.indexOf(brush as BrushType);
          const nextBrush = brushes[(currentIdx + 1) % brushes.length];
          setBrush?.(nextBrush);
          setActiveTool("draw");
          showToast(`Brush switched to: ${nextBrush.toUpperCase()}`);
        } else {
          setActiveTool("draw");
        }
      } else if ((e.key === "e" || e.key === "E") && !e.ctrlKey && !e.metaKey) {
        // Hold E for temporary eraser
        if (!e.repeat && activeTool !== "eraser") {
          prevToolBeforeEraser.current = activeTool;
          isHoldingEraser.current = true;
          setActiveTool("eraser");
        }
      } else if (e.key === "[" && !e.ctrlKey && !e.metaKey) {
        // Decrease brush size
        e.preventDefault();
        setBrushSize?.((prev: any) => Math.max(1, (typeof prev === "number" ? prev : brushSize) - 2));
      } else if (e.key === "]" && !e.ctrlKey && !e.metaKey) {
        // Increase brush size
        e.preventDefault();
        setBrushSize?.((prev: any) => Math.min(64, (typeof prev === "number" ? prev : brushSize) + 2));
      } else if (e.key === "p" || e.key === "P") {
        setActiveTool("vector-pen");
      } else if (e.key === "a" || e.key === "A") {
        setActiveTool("vector-node");
      } else if (e.key === "t" || e.key === "T") {
        setActiveTool("text");
      } else if (e.key === "n" || e.key === "N" || e.key === "s" || e.key === "S") {
        setActiveTool("sticky");
      } else if (e.key === "r" || e.key === "R") {
        setActiveTool("shape");
      } else if (e.key === "o" || e.key === "O") {
        setActiveTool("shape");
      } else if (e.key === "c" || e.key === "C") {
        if (!e.ctrlKey && !e.metaKey) {
          setActiveTool("comment");
          showToast("Comment tool: Click anywhere to drop a collaborative comment pin");
        }
      } else if (e.key === "l" || e.key === "L") {
        if ((e.ctrlKey || e.metaKey)) {
          // Ctrl/Cmd + L: Lock/Unlock
          e.preventDefault();
          handleToggleLock();
        } else {
          setActiveTool("connector");
        }
      } else if (e.key === "f" || e.key === "F") {
        setActiveTool("frame");
      } else if (e.key === "i" || e.key === "I") {
        setActiveTool("eyedropper");
        showToast("Eyedropper tool active: click on any object to sample color");
      } else if ((e.key === "q" || e.key === "Q") && !e.ctrlKey && !e.metaKey) {
        // Radial quick menu at cursor
        e.preventDefault();
        setRadialMenu({
          isOpen: true,
          x: lastMouseScreen.current.x,
          y: lastMouseScreen.current.y,
        });
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          // Shift + Tab: toggle Presentation Mode
          setViewMode?.(viewMode === "presentation" ? "flat" : "presentation");
        } else {
          // Tab: toggle Clean Board Mode
          onToggleCleanBoard?.();
        }
      } else if (e.key === "0" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // 0: Reset to 100%
        e.preventDefault();
        handleZoomReset();
      } else if ((e.key === "!" || (e.shiftKey && e.key === "1")) && !e.ctrlKey && !e.metaKey) {
        // Shift + 1: Zoom to entire board
        e.preventDefault();
        handleZoomToFit();
      } else if ((e.key === "@" || (e.shiftKey && e.key === "2")) && !e.ctrlKey && !e.metaKey) {
        // Shift + 2: Zoom to selection
        e.preventDefault();
        handleZoomToSelection();
      } else if ((e.key === "?" || (e.shiftKey && e.key === "/")) && !e.ctrlKey && !e.metaKey) {
        // Shortcuts guide
        e.preventDefault();
        onOpenShortcuts?.();
      } else if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        if (selectedIds.length > 0) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          let dx = 0;
          let dy = 0;
          if (e.key === "ArrowLeft") dx = -step;
          if (e.key === "ArrowRight") dx = step;
          if (e.key === "ArrowUp") dy = -step;
          if (e.key === "ArrowDown") dy = step;

          const selected = elements.filter((el) => selectedIds.includes(el.id) && !el.locked);
          if (selected.length > 0) {
            const updated = selected.map((el) => ({
              ...el,
              x: Math.round(el.x + dx),
              y: Math.round(el.y + dy),
            }));
            onBatchUpdateElements(updated);
          }
        }
      } else if (e.key === "Enter") {
        if (activeTool === "vector-pen" || activeTool === "vector-node") {
          e.preventDefault();
          setActiveNodeIdx(null);
          setActiveTool("select");
          showToast("Finished vector path");
        }
      } else if (e.key === "Escape") {
        activeTransformsRef.current.clear();
        setActiveTransforms(new Map());
        setDragMode("none");
        setSelectedIds([]);
        setEditingId(null);
        setActiveNodeIdx(null);
        setVectorShapeDraft(null);
        setConnectorDraft(null);
        setDrawingPoints([]);
        setDrawingStrokePoints([]);
        setRadialMenu((prev) => ({ ...prev, isOpen: false }));
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
        setFollowingUserId(null);
        if (activeTool === "vector-node" || activeTool === "vector-pen" || activeTool === "eyedropper") {
          setActiveTool("select");
        }
      } else if (e.key === "k" || e.key === "K") {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onOpenSearch?.();
        } else {
          setActiveTool("laser");
          showToast("Laser pointer active: drag or move across canvas to highlight");
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "e" || e.key === "E") && e.shiftKey) {
        e.preventDefault();
        onOpenExportModal?.();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A") && !e.shiftKey) {
        e.preventDefault();
        setSelectedIds(elements.map((el) => el.id));
        showToast(`Selected all ${elements.length} elements`);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        handleCopyClipboard();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        handlePasteClipboard();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo?.();
        } else {
          onUndo?.();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        onRedo?.();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "]") {
        e.preventDefault();
        if (e.shiftKey) {
          handleBringToFront(selectedIds);
        } else {
          handleBringForward(selectedIds);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "[") {
        e.preventDefault();
        if (e.shiftKey) {
          handleSendToBack(selectedIds);
        } else {
          handleSendBackward(selectedIds);
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        const toDup = elements.filter((el) => selectedIds.includes(el.id));
        if (toDup.length > 0) {
          onDuplicateElements(toDup);
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        if (e.shiftKey) {
          onUngroupElements?.(selectedIds);
        } else {
          onGroupElements?.(selectedIds);
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (activeTool === "vector-node" && activeNodeIdx !== null && selectedIds.length === 1) {
          const target = elements.find((el) => el.id === selectedIds[0]);
          if (target && target.type === "vectorPath" && target.nodes && target.nodes.length > 2) {
            e.preventDefault();
            const newNodes = target.nodes.filter((_, idx) => idx !== activeNodeIdx);
            const bounds = computeVectorBounds(newNodes);
            onUpdateElement(target.id, {
              nodes: newNodes,
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height,
            });
            setActiveNodeIdx(null);
            showToast("Deleted vector node");
            return;
          }
        }
        if (selectedIds.length > 0) {
          onDeleteElements(selectedIds);
          setSelectedIds([]);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      } else if (e.key === "e" || e.key === "E") {
        // Revert temporary eraser tool
        if (isHoldingEraser.current) {
          isHoldingEraser.current = false;
          setActiveTool(prevToolBeforeEraser.current);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    isSpacePressed,
    selectedIds,
    elements,
    brush,
    brushSize,
    activeTool,
    activeNodeIdx,
    viewMode,
    onDeleteElements,
    onDuplicateElements,
    onGroupElements,
    onUngroupElements,
    setActiveTool,
    setEditingId,
    setSelectedIds,
    setBrush,
    setBrushSize,
    onUndo,
    onRedo,
    onOpenShortcuts,
    onToggleCleanBoard,
    setViewMode,
    handleZoomReset,
    handleZoomToFit,
    handleZoomToSelection,
    handleBringForward,
    handleSendBackward,
    handleBringToFront,
    handleSendToBack,
    handleToggleLock,
    handleCopyClipboard,
    handlePasteClipboard,
    showToast,
    onUpdateElement,
    setActiveNodeIdx,
  ]);

  // Spatial mouse wheel zoom & pan
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift + Wheel: horizontal pan
        const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        setViewport((prev) => ({
          ...prev,
          x: prev.x - delta,
        }));
      } else if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd + Wheel: precision zoom
        const zoomFactor = e.deltaY < 0 ? 1.03 : 0.97;
        setViewport((prev) => {
          const newZoom = Math.max(0.08, Math.min(6.0, prev.zoom * zoomFactor));
          const mouseScreenX = e.clientX;
          const mouseScreenY = e.clientY;
          return {
            zoom: newZoom,
            x: mouseScreenX - (mouseScreenX - prev.x) * (newZoom / prev.zoom),
            y: mouseScreenY - (mouseScreenY - prev.y) * (newZoom / prev.zoom),
          };
        });
      } else {
        // Standard wheel: spatial zoom toward cursor
        const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
        setViewport((prev) => {
          const newZoom = Math.max(0.08, Math.min(6.0, prev.zoom * zoomFactor));
          const mouseScreenX = e.clientX;
          const mouseScreenY = e.clientY;
          return {
            zoom: newZoom,
            x: mouseScreenX - (mouseScreenX - prev.x) * (newZoom / prev.zoom),
            y: mouseScreenY - (mouseScreenY - prev.y) * (newZoom / prev.zoom),
          };
        });
      }
    },
    [setViewport]
  );

  // Mouse Down handler
  const handleMouseDown = (e: React.MouseEvent) => {
    // Dismiss open radial menu or context menu if clicking canvas
    if (radialMenu.isOpen) {
      setRadialMenu((prev) => ({ ...prev, isOpen: false }));
    }
    if (contextMenu.isOpen) {
      setContextMenu((prev) => ({ ...prev, isOpen: false }));
    }

    // Only primary button or middle button
    if (e.button !== 0 && e.button !== 1) return;

    const screenPos = { x: e.clientX, y: e.clientY };
    const worldPos = screenToWorld(screenPos.x, screenPos.y, viewport);

    dragStartScreen.current = screenPos;
    dragStartWorld.current = worldPos;
    dragStartViewport.current = { ...viewport };

    // 0. Eyedropper tool: sample color
    if (activeTool === "eyedropper" && e.button === 0) {
      const hit = [...elements]
        .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
        .find(
          (el) =>
            worldPos.x >= el.x &&
            worldPos.x <= el.x + el.width &&
            worldPos.y >= el.y &&
            worldPos.y <= el.y + el.height
        );
      if (hit) {
        const sampled = hit.strokeColor || hit.color || hit.fillColor || (hit as any).brushColor || "#3b82f6";
        setBrushColor?.(sampled);
        setVectorStrokeColor?.(sampled);
        showToast(`Sampled color: ${sampled}`);
      } else {
        showToast("No element found at cursor");
      }
      setActiveTool("draw");
      return;
    }

    // Pan with middle click, hand tool, spacebar, or 3D orbit
    if (e.button === 1) {
      if (is3D && e.shiftKey) {
        setDragMode("orbit_3d");
        dragStartAngle.current = { ...cameraAngle };
        return;
      }
      setDragMode("pan");
      return;
    }

    if (activeTool === "hand" || isSpacePressed) {
      setDragMode("pan");
      return;
    }

    // Tool: Collaborative Laser Pointer
    if (activeTool === "laser") {
      setDragMode("laser");
      const pt = { x: Math.round(worldPos.x), y: Math.round(worldPos.y), timestamp: Date.now() };
      setLocalLaserPoints([pt]);
      onSendLaserPoint?.(pt);
      return;
    }

    // Tool: Comment Pin Creation
    if (activeTool === "comment") {
      const newComment: BoardElement = {
        id: generateId(),
        type: "comment",
        x: Math.round(worldPos.x - 140),
        y: Math.round(worldPos.y - 75),
        width: 280,
        height: 160,
        content: "",
        commentAuthor: currentUser.name,
        authorName: currentUser.name,
        color: currentUser.color,
        commentResolved: false,
        commentReplies: [],
        reactions: {},
        zIndex: 40,
        metadata: {
          createdAt: Date.now(),
          authorColor: currentUser.color,
          authorId: currentUser.id,
        },
      };
      onCreateElement(newComment);
      setSelectedIds([newComment.id]);
      setEditingId(newComment.id);
      setActiveTool("select");
      showToast("Comment pin placed. Type your message and save.");
      return;
    }

    // 1. Tool: Sticky Note Creation
    if (activeTool === "sticky") {
      const newSticky: BoardElement = {
        id: generateId(),
        type: "sticky",
        x: worldPos.x - 90,
        y: worldPos.y - 90,
        width: 180,
        height: 180,
        content: "",
        color: selectedStickyColor,
        zIndex: 10,
        authorName: currentUser.name,
      };
      onCreateElement(newSticky);
      setSelectedIds([newSticky.id]);
      setEditingId(newSticky.id);
      setActiveTool("select");
      return;
    }

    // 2. Tool: Shape Creation
    if (activeTool === "shape") {
      const newShape: BoardElement = {
        id: generateId(),
        type: "shape",
        shapeType: selectedShapeType,
        x: worldPos.x - 70,
        y: worldPos.y - 50,
        width: 140,
        height: 100,
        content: "New Shape",
        fillColor: "#ffffff",
        strokeColor: "#334155",
        strokeWidth: 2,
        zIndex: 10,
      };
      onCreateElement(newShape);
      setSelectedIds([newShape.id]);
      setEditingId(newShape.id);
      setActiveTool("select");
      return;
    }

    // 3. Tool: Text Box Creation
    if (activeTool === "text") {
      const newText: BoardElement = {
        id: generateId(),
        type: "text",
        x: worldPos.x - 60,
        y: worldPos.y - 25,
        width: 160,
        height: 50,
        content: "",
        fontSize: 16,
        color: "#0f172a",
        zIndex: 20,
      };
      onCreateElement(newText);
      setSelectedIds([newText.id]);
      setEditingId(newText.id);
      setActiveTool("select");
      return;
    }

    // 4. Tool: Frame Creation
    if (activeTool === "frame") {
      const newFrame: BoardElement = {
        id: generateId(),
        type: "frame",
        x: worldPos.x - 200,
        y: worldPos.y - 150,
        width: 400,
        height: 300,
        title: "Frame 1",
        fillColor: "#ffffff",
        strokeColor: "#94a3b8",
        zIndex: 1,
      };
      onCreateElement(newFrame);
      setSelectedIds([newFrame.id]);
      setActiveTool("select");
      return;
    }

    // 5. Tool: Eraser
    if (activeTool === "eraser" || (activeTool === "draw" && brush === "eraser")) {
      setDragMode("eraser");
      const strokeToErase = elements.slice().reverse().find((el) => {
        if (el.type === "freehand" || el.type === "draw") {
          const pts = el.strokePoints || el.points || [];
          return pts.some((p) => Math.hypot(p.x - worldPos.x, p.y - worldPos.y) <= Math.max(18, (el.strokeWidth || 3) * 2));
        }
        return false;
      });
      if (strokeToErase) {
        onDeleteElements([strokeToErase.id]);
      }
      return;
    }

    // 6. Tool: Vector Pen / Bezier
    if (activeTool === "vector-pen") {
      const selectedVec = selectedIds.length === 1 ? elements.find((el) => el.id === selectedIds[0]) : null;
      if (selectedVec && selectedVec.type === "vectorPath" && selectedVec.nodes) {
        const newNodes = [
          ...selectedVec.nodes,
          { x: Math.round(worldPos.x), y: Math.round(worldPos.y), in: { x: 0, y: 0 }, out: { x: 0, y: 0 } },
        ];
        const bounds = computeVectorBounds(newNodes);
        onUpdateElement(selectedVec.id, {
          nodes: newNodes,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        });
        setActiveNodeIdx(newNodes.length - 1);
        activeNodeDrag.current = {
          elementId: selectedVec.id,
          nodeIndex: newNodes.length - 1,
          handle: "out",
        };
        setDragMode("move_vector_handle");
      } else {
        const newVec: BoardElement = {
          id: generateId("vec"),
          type: "vectorPath",
          x: Math.round(worldPos.x),
          y: Math.round(worldPos.y),
          width: 20,
          height: 20,
          closed: false,
          nodes: [
            { x: Math.round(worldPos.x), y: Math.round(worldPos.y), in: { x: 0, y: 0 }, out: { x: 0, y: 0 } },
          ],
          vectorStyle: {
            fill: vectorFillColor || null,
            stroke: vectorStrokeColor || "#0f172a",
            strokeWidth: vectorStrokeWidth || 2,
            strokeCap: (vectorStrokeCap as "round" | "butt" | "square") || "round",
            strokeJoin: (vectorStrokeJoin as "round" | "miter" | "bevel") || "round",
            opacity: 1,
          },
          strokeColor: vectorStrokeColor || "#0f172a",
          strokeWidth: vectorStrokeWidth || 2,
          zIndex: 15,
        };
        onCreateElement(newVec);
        setSelectedIds([newVec.id]);
        setActiveNodeIdx(0);
        activeNodeDrag.current = {
          elementId: newVec.id,
          nodeIndex: 0,
          handle: "out",
        };
        setDragMode("move_vector_handle");
      }
      return;
    }

    // 7. Tool: Vector Shape Tools (Line, Rect, Ellipse, Star, Polygon)
    if (
      activeTool === "vector-line" ||
      activeTool === "vector-rect" ||
      activeTool === "vector-ellipse" ||
      activeTool === "vector-star" ||
      activeTool === "vector-polygon"
    ) {
      const shapeTypeStr = activeTool.replace("vector-", "");
      setDragMode("vector_draw_shape");
      setVectorShapeDraft({
        start: worldPos,
        current: worldPos,
        shape: shapeTypeStr,
      });
      return;
    }

    // 8. Tool: Drawing Mode (Pen, Pencil, Marker, Highlighter)
    if (activeTool === "draw") {
      setDragMode("freehand_draw");
      const pressure = (e as any).pressure > 0 ? (e as any).pressure : 0.5;
      setDrawingPoints([worldPos]);
      setDrawingStrokePoints([{ ...worldPos, pressure }]);
      return;
    }

    // 9. Tool: Connector / Arrow
    if (activeTool === "connector") {
      setDragMode("create_connector");
      // Check if clicking near any existing shape anchor
      const clickedEl = elements
        .slice()
        .reverse()
        .find(
          (el) =>
            el.type !== "connector" &&
            worldPos.x >= el.x &&
            worldPos.x <= el.x + el.width &&
            worldPos.y >= el.y &&
            worldPos.y <= el.y + el.height
        );

      let startBinding: any = undefined;
      let startPoint = worldPos;

      if (clickedEl) {
        const nearest = getNearestAnchor(clickedEl, worldPos);
        startBinding = { elementId: clickedEl.id, anchor: nearest.anchor };
        startPoint = nearest.point;
      }

      setConnectorDraft({
        start: startPoint,
        current: worldPos,
        startBinding,
      });
      return;
    }

    // 7. Select Tool on empty canvas: Marquee Selection
    setDragMode("marquee_select");
    setMarqueeBox({
      x: worldPos.x,
      y: worldPos.y,
      width: 0,
      height: 0,
    });
    if (!e.shiftKey) {
      setSelectedIds([]);
    }
    setEditingId(null);
  };

  // Mouse Move handler
  const handleMouseMove = (e: React.MouseEvent) => {
    const screenPos = { x: e.clientX, y: e.clientY };
    const worldPos = screenToWorld(screenPos.x, screenPos.y, viewport);

    lastMouseWorld.current = worldPos;
    lastMouseScreen.current = screenPos;

    // Send cursor position to peers via WebSocket / BroadcastChannel
    onSendCursor(worldPos, selectedIds);

    if (dragMode === "none") return;

    // Pan canvas
    if (dragMode === "pan") {
      const dx = screenPos.x - dragStartScreen.current.x;
      const dy = screenPos.y - dragStartScreen.current.y;
      setViewport({
        ...dragStartViewport.current,
        x: dragStartViewport.current.x + dx,
        y: dragStartViewport.current.y + dy,
      });
      return;
    }

    // 3D Orbit Dragging
    if (dragMode === "orbit_3d") {
      const dx = screenPos.x - dragStartScreen.current.x;
      const dy = screenPos.y - dragStartScreen.current.y;
      setCameraAngle({
        pitch: Math.max(5, Math.min(85, dragStartAngle.current.pitch - dy * 0.25)),
        yaw: dragStartAngle.current.yaw + dx * 0.25,
      });
      return;
    }

    // Laser pointer dragging
    if (dragMode === "laser") {
      const pt = { x: Math.round(worldPos.x), y: Math.round(worldPos.y), timestamp: Date.now() };
      setLocalLaserPoints((prev) => [...prev.slice(-120), pt]);
      onSendLaserPoint?.(pt);
      return;
    }

    // Eraser dragging
    if (dragMode === "eraser") {
      const hitStrokes = elements.filter((el) => {
        if (el.type === "freehand" || el.type === "draw") {
          const pts = el.strokePoints || el.points || [];
          return pts.some((p) => Math.hypot(p.x - worldPos.x, p.y - worldPos.y) <= Math.max(20, (el.strokeWidth || 3) * 2));
        }
        return false;
      });
      if (hitStrokes.length > 0) {
        onDeleteElements(hitStrokes.map((s) => s.id));
      }
      return;
    }

    // Freehand drawing with stabilizer & pressure
    if (dragMode === "freehand_draw") {
      const pressure = (e as any).pressure > 0 ? (e as any).pressure : 0.5;
      let targetPt = worldPos;
      if (brushStabilize && drawingStrokePoints.length > 0) {
        const last = drawingStrokePoints[drawingStrokePoints.length - 1];
        targetPt = {
          x: Math.round(last.x + (worldPos.x - last.x) * 0.42),
          y: Math.round(last.y + (worldPos.y - last.y) * 0.42),
        };
      }
      setDrawingStrokePoints((prev) => [...prev, { ...targetPt, pressure }]);
      setDrawingPoints((prev) => [...prev, targetPt]);
      return;
    }

    // Vector Shape Dragging
    if (dragMode === "vector_draw_shape" && vectorShapeDraft) {
      setVectorShapeDraft((prev) => (prev ? { ...prev, current: worldPos } : null));
      return;
    }

    // Vector Node Moving
    if (dragMode === "move_vector_node" && activeNodeDrag.current) {
      const { elementId, nodeIndex } = activeNodeDrag.current;
      const target = elements.find((el) => el.id === elementId);
      if (target && target.nodes && target.nodes[nodeIndex]) {
        const newNodes = [...target.nodes];
        newNodes[nodeIndex] = {
          ...newNodes[nodeIndex],
          x: Math.round(worldPos.x),
          y: Math.round(worldPos.y),
        };
        const bounds = computeVectorBounds(newNodes);
        onUpdateElement(
          elementId,
          {
            nodes: newNodes,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
          },
          false
        );
      }
      return;
    }

    // Vector Handle Moving (Bezier out / in)
    if (dragMode === "move_vector_handle" && activeNodeDrag.current) {
      const { elementId, nodeIndex, handle } = activeNodeDrag.current;
      const target = elements.find((el) => el.id === elementId);
      if (target && target.nodes && target.nodes[nodeIndex] && handle) {
        const node = target.nodes[nodeIndex];
        const newNodes = [...target.nodes];
        const offset = {
          x: Math.round(worldPos.x - node.x),
          y: Math.round(worldPos.y - node.y),
        };
        const oppHandle = handle === "out" ? "in" : "out";
        newNodes[nodeIndex] = {
          ...node,
          [handle]: offset,
          [oppHandle]: { x: -offset.x, y: -offset.y },
        };
        const bounds = computeVectorBounds(newNodes);
        onUpdateElement(
          elementId,
          {
            nodes: newNodes,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
          },
          false
        );
      }
      return;
    }

    // Connector live dragging
    if (dragMode === "create_connector" && connectorDraft) {
      // Check if hovering near another shape's anchor
      const hoverEl = elements
        .slice()
        .reverse()
        .find(
          (el) =>
            el.type !== "connector" &&
            el.id !== connectorDraft.startBinding?.elementId &&
            worldPos.x >= el.x - 20 &&
            worldPos.x <= el.x + el.width + 20 &&
            worldPos.y >= el.y - 20 &&
            worldPos.y <= el.y + el.height + 20
        );

      let endBinding: any = undefined;
      let endPoint = worldPos;

      if (hoverEl) {
        const nearest = getNearestAnchor(hoverEl, worldPos);
        endBinding = { elementId: hoverEl.id, anchor: nearest.anchor };
        endPoint = nearest.point;
      }

      setConnectorDraft({
        ...connectorDraft,
        current: endPoint,
        endBinding,
      });
      return;
    }

    // Marquee Selection Box
    if (dragMode === "marquee_select") {
      const x = Math.min(dragStartWorld.current.x, worldPos.x);
      const y = Math.min(dragStartWorld.current.y, worldPos.y);
      const width = Math.abs(worldPos.x - dragStartWorld.current.x);
      const height = Math.abs(worldPos.y - dragStartWorld.current.y);
      const box = { x, y, width, height };
      setMarqueeBox(box);

      // Dynamically select elements intersecting with marquee box
      const hitIds = elements.filter((el) => isElementInBox(el, box)).map((el) => el.id);
      setSelectedIds(hitIds);
      return;
    }

    // Move Elements
    if (dragMode === "move_elements") {
      const dx = worldPos.x - dragStartWorld.current.x;
      const dy = worldPos.y - dragStartWorld.current.y;

      const newTransforms = new Map<string, Partial<BoardElement>>();
      const updated: BoardElement[] = [];

      dragStartElementBounds.current.forEach((initBounds, id) => {
        const target = elements.find((el) => el.id === id);
        if (target && !target.locked) {
          if (target.type === "connector") {
            const isStartBound = Boolean(target.startBinding?.elementId);
            const isEndBound = Boolean(target.endBinding?.elementId);

            // If completely bound on both ends, connector endpoints derive 100% from connected elements.
            // Do NOT apply independent x/y translations (avoids double movement per Phase 3 rules).
            if (isStartBound && isEndBound) {
              return;
            }

            // If it has free endpoints, translate the free endpoints
            const snap = dragStartElementSnapshots.current.get(id);
            const initStart = snap?.startPoint || { x: initBounds.x, y: initBounds.y };
            const initEnd = snap?.endPoint || { x: initBounds.x + initBounds.width, y: initBounds.y + initBounds.height };

            const partial: Partial<BoardElement> = {
              x: Math.round(initBounds.x + dx),
              y: Math.round(initBounds.y + dy),
              startPoint: isStartBound ? target.startPoint : { x: Math.round(initStart.x + dx), y: Math.round(initStart.y + dy) },
              endPoint: isEndBound ? target.endPoint : { x: Math.round(initEnd.x + dx), y: Math.round(initEnd.y + dy) },
            };
            newTransforms.set(id, partial);
            updated.push({ ...target, ...partial });
          } else {
            const partial: Partial<BoardElement> = {
              x: Math.round(initBounds.x + dx),
              y: Math.round(initBounds.y + dy),
            };
            newTransforms.set(id, partial);
            updated.push({ ...target, ...partial });
          }
        }
      });

      activeTransformsRef.current = newTransforms;
      setActiveTransforms(newTransforms);

      if (updated.length > 0) {
        onBatchUpdateElements(updated, false);
      }
      return;
    }

    // Rotate Element
    if (dragMode === "rotate_element" && selectedElements.length === 1) {
      const el = selectedElements[0];
      if (!el.locked) {
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        const rad = Math.atan2(worldPos.y - cy, worldPos.x - cx);
        let deg = Math.round((rad * 180) / Math.PI + 90);
        if (e.shiftKey) {
          deg = Math.round(deg / 15) * 15;
        }
        const finalDeg = ((deg % 360) + 360) % 360;
        const newTransforms = new Map<string, Partial<BoardElement>>();
        newTransforms.set(el.id, { rotation: finalDeg });
        activeTransformsRef.current = newTransforms;
        setActiveTransforms(newTransforms);
        onUpdateElement(el.id, { rotation: finalDeg }, false);
      }
      return;
    }

    // Resize Element or Group of Elements as a single unit
    if (
      dragMode === "resize_element" &&
      activeResizeHandle.current &&
      dragStartSelectionBounds.current
    ) {
      const initBox = dragStartSelectionBounds.current;
      if (initBox.width <= 0 || initBox.height <= 0) return;

      const dx = worldPos.x - dragStartWorld.current.x;
      const dy = worldPos.y - dragStartWorld.current.y;
      const handle = activeResizeHandle.current;

      let newX = initBox.x;
      let newY = initBox.y;
      let newW = initBox.width;
      let newH = initBox.height;
      const minSize = 24;

      if (handle.includes("e")) newW = Math.max(minSize, initBox.width + dx);
      if (handle.includes("s")) newH = Math.max(minSize, initBox.height + dy);
      if (handle.includes("w")) {
        const possibleW = initBox.width - dx;
        if (possibleW >= minSize) {
          newX = initBox.x + dx;
          newW = possibleW;
        } else {
          newX = initBox.x + (initBox.width - minSize);
          newW = minSize;
        }
      }
      if (handle.includes("n")) {
        const possibleH = initBox.height - dy;
        if (possibleH >= minSize) {
          newY = initBox.y + dy;
          newH = possibleH;
        } else {
          newY = initBox.y + (initBox.height - minSize);
          newH = minSize;
        }
      }

      const scaleX = newW / initBox.width;
      const scaleY = newH / initBox.height;

      if (selectedIds.length === 1) {
        const id = selectedIds[0];
        const initial = dragStartElementSnapshots.current.get(id);
        const target = elements.find((el) => el.id === id);
        if (!initial || !target || target.locked) return;

        const partial: Partial<BoardElement> = {
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(newW),
          height: Math.round(newH),
        };

        if (initial.points && initial.points.length > 0) {
          partial.points = initial.points.map((p) => ({
            x: Math.round(newX + ((p.x - initBox.x) / initBox.width) * newW),
            y: Math.round(newY + ((p.y - initBox.y) / initBox.height) * newH),
          }));
        }

        const newTransforms = new Map<string, Partial<BoardElement>>();
        newTransforms.set(id, partial);
        activeTransformsRef.current = newTransforms;
        setActiveTransforms(newTransforms);

        onUpdateElement(id, partial, false);
      } else {
        // Multi-element / Group proportional scaling as a single unit
        const updatedList: BoardElement[] = [];
        const newTransforms = new Map<string, Partial<BoardElement>>();

        dragStartElementSnapshots.current.forEach((initial, id) => {
          const target = elements.find((el) => el.id === id);
          if (!target || target.locked) return;

          const relX = (initial.x - initBox.x) / initBox.width;
          const relY = (initial.y - initBox.y) / initBox.height;

          const scaledEl: BoardElement = {
            ...target,
            x: Math.round(newX + relX * newW),
            y: Math.round(newY + relY * newH),
            width: Math.max(16, Math.round(initial.width * scaleX)),
            height: Math.max(16, Math.round(initial.height * scaleY)),
          };

          if (initial.points && initial.points.length > 0) {
            scaledEl.points = initial.points.map((p) => ({
              x: Math.round(newX + ((p.x - initBox.x) / initBox.width) * newW),
              y: Math.round(newY + ((p.y - initBox.y) / initBox.height) * newH),
            }));
          }

          // Only scale free connector endpoints; bound endpoints derive dynamically
          if (initial.startPoint && !initial.startBinding) {
            scaledEl.startPoint = {
              x: Math.round(newX + ((initial.startPoint.x - initBox.x) / initBox.width) * newW),
              y: Math.round(newY + ((initial.startPoint.y - initBox.y) / initBox.height) * newH),
            };
          }
          if (initial.endPoint && !initial.endBinding) {
            scaledEl.endPoint = {
              x: Math.round(newX + ((initial.endPoint.x - initBox.x) / initBox.width) * newW),
              y: Math.round(newY + ((initial.endPoint.y - initBox.y) / initBox.height) * newH),
            };
          }

          if (initial.fontSize) {
            const fontScale = Math.min(scaleX, scaleY);
            scaledEl.fontSize = Math.max(10, Math.min(96, Math.round(initial.fontSize * fontScale)));
          }

          newTransforms.set(id, scaledEl);
          updatedList.push(scaledEl);
        });

        activeTransformsRef.current = newTransforms;
        setActiveTransforms(newTransforms);

        if (updatedList.length > 0) {
          onBatchUpdateElements(updatedList, false);
        }
      }
      return;
    }
  };

  // Mouse Up handler
  const handleMouseUp = () => {
    // Laser pointer release
    if (dragMode === "laser") {
      setDragMode("none");
      return;
    }

    // 1. Freehand drawing completion
    if (dragMode === "freehand_draw" && drawingPoints.length > 1) {
      const sourcePoints = drawingStrokePoints.length > 1 ? drawingStrokePoints : drawingPoints.map((p) => ({ ...p, pressure: 0.5 }));
      const simplified = simplifyPoints(sourcePoints, brushSmooth || 2.0);

      const bounds = computeSelectionBounds([
        {
          id: "temp",
          type: "freehand",
          x: Math.min(...simplified.map((p) => p.x)),
          y: Math.min(...simplified.map((p) => p.y)),
          width: Math.max(...simplified.map((p) => p.x)) - Math.min(...simplified.map((p) => p.x)),
          height: Math.max(...simplified.map((p) => p.y)) - Math.min(...simplified.map((p) => p.y)),
          zIndex: 10,
        },
      ]);

      const calculatedWidth = brushSize || (brush === "highlighter" ? 24 : brush === "marker" ? 8 : 3);
      const calculatedOpacity = brushOpacity ?? (brush === "highlighter" ? 0.45 : 1);

      const newDraw: BoardElement = {
        id: generateId("stroke"),
        type: "freehand",
        x: bounds?.x || simplified[0].x,
        y: bounds?.y || simplified[0].y,
        width: Math.max(10, bounds?.width || 20),
        height: Math.max(10, bounds?.height || 20),
        strokePoints: simplified,
        points: simplified.map((p) => ({ x: p.x, y: p.y })),
        brush: (brush as BrushType) || "pen",
        color: brushColor || "#0f172a",
        strokeColor: brushColor || "#0f172a",
        strokeWidth: calculatedWidth,
        opacity: calculatedOpacity,
        smooth: brushSmooth || 2.0,
        stabilize: brushStabilize,
        zIndex: 10,
      };
      onCreateElement(newDraw);
      setDrawingPoints([]);
      setDrawingStrokePoints([]);
    }

    // 2. Vector Shape creation completion
    if (dragMode === "vector_draw_shape" && vectorShapeDraft) {
      const x = Math.min(vectorShapeDraft.start.x, vectorShapeDraft.current.x);
      const y = Math.min(vectorShapeDraft.start.y, vectorShapeDraft.current.y);
      const width = Math.max(20, Math.abs(vectorShapeDraft.current.x - vectorShapeDraft.start.x));
      const height = Math.max(20, Math.abs(vectorShapeDraft.current.y - vectorShapeDraft.start.y));

      const { nodes, closed } = shapeToVectorNodes(vectorShapeDraft.shape, x, y, width, height);

      const newVec: BoardElement = {
        id: generateId("vec"),
        type: "vectorPath",
        x,
        y,
        width,
        height,
        closed,
        nodes,
        vectorStyle: {
          fill: vectorFillColor || null,
          stroke: vectorStrokeColor || "#0f172a",
          strokeWidth: vectorStrokeWidth || 2,
          strokeCap: (vectorStrokeCap as "round" | "butt" | "square") || "round",
          strokeJoin: (vectorStrokeJoin as "round" | "miter" | "bevel") || "round",
          opacity: 1,
        },
        fillColor: vectorFillColor || undefined,
        strokeColor: vectorStrokeColor || "#0f172a",
        strokeWidth: vectorStrokeWidth || 2,
        zIndex: 15,
      };
      onCreateElement(newVec);
      setSelectedIds([newVec.id]);
      setVectorShapeDraft(null);
    }

    if (dragMode === "create_connector" && connectorDraft) {
      const newConnector: BoardElement = {
        id: generateId(),
        type: "connector",
        x: Math.min(connectorDraft.start.x, connectorDraft.current.x),
        y: Math.min(connectorDraft.start.y, connectorDraft.current.y),
        width: Math.abs(connectorDraft.current.x - connectorDraft.start.x) || 10,
        height: Math.abs(connectorDraft.current.y - connectorDraft.start.y) || 10,
        startPoint: connectorDraft.start,
        endPoint: connectorDraft.current,
        startBinding: connectorDraft.startBinding,
        endBinding: connectorDraft.endBinding,
        strokeColor: "#64748b",
        strokeWidth: 2,
        arrowEnd: true,
        lineStyle: "curved",
        zIndex: 8,
      };
      onCreateElement(newConnector);
      setConnectorDraft(null);
      setActiveTool("select");
    }

    // Commit completed gesture transactions as single BoardOperation entries
    if (dragMode === "move_elements" && dragStartElementSnapshots.current.size > 0) {
      const updatesList: { id: string; before: BoardElement; after: BoardElement; baseRevision?: number }[] = [];
      dragStartElementSnapshots.current.forEach((before, id) => {
        const canonical = elements.find((e) => e.id === id);
        const after = canonical ? getEffectiveElement(canonical) : null;
        if (after && (after.x !== before.x || after.y !== before.y)) {
          // If completely bound on both ends, connector endpoints derive 100% from connected elements.
          // Do not write redundant independent x/y records to persistence.
          if (before.type === "connector" && before.startBinding?.elementId && before.endBinding?.elementId) {
            return;
          }
          updatesList.push({
            id,
            before,
            after: JSON.parse(JSON.stringify(after)),
            baseRevision: before.revision,
          });
        }
      });
      if (updatesList.length > 0 && onCommitOperation) {
        onCommitOperation({
          type: "batch_update",
          operationId: createOperationId(),
          transactionId: createTransactionId(),
          boardId: "default",
          actorId: currentUser.id,
          actorName: currentUser.name,
          timestamp: Date.now(),
          description: updatesList.length === 1 ? `Move ${updatesList[0].before.type}` : `Move ${updatesList.length} elements`,
          updates: updatesList,
        });
      }
    } else if (dragMode === "resize_element" && dragStartElementSnapshots.current.size > 0) {
      const updatesList: { id: string; before: BoardElement; after: BoardElement; baseRevision?: number }[] = [];
      dragStartElementSnapshots.current.forEach((before, id) => {
        const canonical = elements.find((e) => e.id === id);
        const after = canonical ? getEffectiveElement(canonical) : null;
        if (after && (after.width !== before.width || after.height !== before.height || after.x !== before.x || after.y !== before.y)) {
          updatesList.push({
            id,
            before,
            after: JSON.parse(JSON.stringify(after)),
            baseRevision: before.revision,
          });
        }
      });
      if (updatesList.length > 0 && onCommitOperation) {
        onCommitOperation({
          type: "batch_update",
          operationId: createOperationId(),
          transactionId: createTransactionId(),
          boardId: "default",
          actorId: currentUser.id,
          actorName: currentUser.name,
          timestamp: Date.now(),
          description: updatesList.length === 1 ? `Resize ${updatesList[0].before.type}` : `Resize ${updatesList.length} elements`,
          updates: updatesList,
        });
      }
    } else if (dragMode === "rotate_element" && dragStartElementSnapshots.current.size > 0) {
      dragStartElementSnapshots.current.forEach((before, id) => {
        const canonical = elements.find((e) => e.id === id);
        const after = canonical ? getEffectiveElement(canonical) : null;
        if (after && after.rotation !== before.rotation && onCommitOperation) {
          onCommitOperation({
            type: "update",
            operationId: createOperationId(),
            transactionId: createTransactionId(),
            boardId: "default",
            actorId: currentUser.id,
            actorName: currentUser.name,
            timestamp: Date.now(),
            description: `Rotate ${before.type}`,
            elementId: id,
            before,
            after: JSON.parse(JSON.stringify(after)),
            baseRevision: before.revision,
          });
        }
      });
    } else if ((dragMode === "move_vector_node" || dragMode === "move_vector_handle") && dragStartElementSnapshots.current.size > 0) {
      dragStartElementSnapshots.current.forEach((before, id) => {
        const canonical = elements.find((e) => e.id === id);
        const after = canonical ? getEffectiveElement(canonical) : null;
        if (after && JSON.stringify(after.nodes) !== JSON.stringify(before.nodes) && onCommitOperation) {
          onCommitOperation({
            type: "update",
            operationId: createOperationId(),
            transactionId: createTransactionId(),
            boardId: "default",
            actorId: currentUser.id,
            actorName: currentUser.name,
            timestamp: Date.now(),
            description: "Edit vector path",
            elementId: id,
            before,
            after: JSON.parse(JSON.stringify(after)),
            baseRevision: before.revision,
          });
        }
      });
    }

    activeTransformsRef.current.clear();
    setActiveTransforms(new Map());
    setDragMode("none");
    setMarqueeBox(null);
    activeResizeHandle.current = null;
    activeNodeDrag.current = null;
    dragStartSelectionBounds.current = null;
    dragStartElementSnapshots.current.clear();
  };

  // Element Click & Drag start
  const handleElementMouseDown = (e: React.MouseEvent, element: BoardElement) => {
    e.stopPropagation();

    // Dismiss open radial menu or context menu
    if (radialMenu.isOpen) setRadialMenu((prev) => ({ ...prev, isOpen: false }));
    if (contextMenu.isOpen) setContextMenu((prev) => ({ ...prev, isOpen: false }));

    // Eyedropper tool click on element
    if (activeTool === "eyedropper" && e.button === 0) {
      const sampled = element.strokeColor || element.color || element.fillColor || (element as any).brushColor || "#3b82f6";
      setBrushColor?.(sampled);
      setVectorStrokeColor?.(sampled);
      showToast(`Sampled color: ${sampled}`);
      setActiveTool("draw");
      return;
    }

    // If middle click or spacebar, prioritize pan
    if (e.button === 1 || activeTool === "hand" || isSpacePressed) {
      handleMouseDown(e);
      return;
    }

    // Connector tool click on element
    if (activeTool === "connector") {
      handleMouseDown(e);
      return;
    }

    let newSelected: string[] = [];

    if (element.groupId) {
      // Find all elements in this group
      const groupMembers = elements.filter((el) => el.groupId === element.groupId);
      const groupMemberIds = groupMembers.map((el) => el.id);

      const isEntireGroupAlreadySelected =
        groupMemberIds.length > 1 &&
        groupMemberIds.every((id) => selectedIds.includes(id)) &&
        selectedIds.length === groupMemberIds.length;

      if (e.shiftKey) {
        // Toggle entire group
        const allGroupSelected = groupMemberIds.every((id) => selectedIds.includes(id));
        if (allGroupSelected) {
          newSelected = selectedIds.filter((id) => !groupMemberIds.includes(id));
        } else {
          newSelected = Array.from(new Set([...selectedIds, ...groupMemberIds]));
        }
      } else if (isEntireGroupAlreadySelected) {
        // If the entire group was already selected and user clicks on this child again, allow sub-selection
        newSelected = [element.id];
      } else {
        // Single click: select the entire group as a unified object
        newSelected = groupMemberIds;
      }
    } else {
      // Standalone element without groupId
      if (e.shiftKey) {
        if (selectedIds.includes(element.id)) {
          newSelected = selectedIds.filter((id) => id !== element.id);
        } else {
          newSelected = [...selectedIds, element.id];
        }
      } else {
        if (!selectedIds.includes(element.id)) {
          newSelected = [element.id];
        } else {
          newSelected = [...selectedIds];
        }
      }
    }

    // In 3D perspective view mode, interacting with elements pans the board to inspect them
    if (is3D) {
      setDragMode("pan");
      return;
    }

    setSelectedIds(newSelected);

    // Prepare move elements drag
    const screenPos = { x: e.clientX, y: e.clientY };
    const worldPos = screenToWorld(screenPos.x, screenPos.y, viewport);
    dragStartScreen.current = screenPos;
    dragStartWorld.current = worldPos;

    const boundsMap = new Map();
    const movingIds = new Set(newSelected);

    // Frame moves children: moving a frame moves all objects situated inside its boundary
    newSelected.forEach((selectedId) => {
      const selectedEl = elements.find((el) => el.id === selectedId);
      if (selectedEl && selectedEl.type === "frame") {
        elements.forEach((other) => {
          if (other.id !== selectedEl.id && other.type !== "frame" && !other.locked) {
            const centerX = other.x + other.width / 2;
            const centerY = other.y + other.height / 2;
            if (
              centerX >= selectedEl.x &&
              centerX <= selectedEl.x + selectedEl.width &&
              centerY >= selectedEl.y &&
              centerY <= selectedEl.y + selectedEl.height
            ) {
              movingIds.add(other.id);
            }
          }
        });
      }

      // Group members move together
      if (selectedEl && selectedEl.groupId) {
        elements.forEach((other) => {
          if (other.groupId === selectedEl.groupId && !other.locked) {
            movingIds.add(other.id);
          }
        });
      }
    });

    const snapMap = new Map<string, BoardElement>();
    elements.forEach((el) => {
      if (movingIds.has(el.id)) {
        boundsMap.set(el.id, { x: el.x, y: el.y, width: el.width, height: el.height });
        snapMap.set(el.id, JSON.parse(JSON.stringify(el)));
      }
    });
    dragStartElementBounds.current = boundsMap;
    dragStartElementSnapshots.current = snapMap;
    setDragMode("move_elements");
  };

  // Resize Handle Mouse Down
  const handleResizeMouseDown = (e: React.MouseEvent, handle: ResizeHandle) => {
    e.stopPropagation();
    activeResizeHandle.current = handle;
    const screenPos = { x: e.clientX, y: e.clientY };
    dragStartScreen.current = screenPos;
    dragStartWorld.current = screenToWorld(screenPos.x, screenPos.y, viewport);

    const selectedList = elements.filter((item) => selectedIds.includes(item.id));
    const bounds = computeSelectionBounds(selectedList);
    dragStartSelectionBounds.current = bounds;

    const snapMap = new Map<string, BoardElement>();
    const boundsMap = new Map();
    selectedList.forEach((el) => {
      snapMap.set(el.id, JSON.parse(JSON.stringify(el)));
      boundsMap.set(el.id, { x: el.x, y: el.y, width: el.width, height: el.height });
    });
    dragStartElementSnapshots.current = snapMap;
    dragStartElementBounds.current = boundsMap;

    setDragMode("resize_element");
  };

  // Rotation Handle Mouse Down
  const handleRotateMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const screenPos = { x: e.clientX, y: e.clientY };
    dragStartScreen.current = screenPos;
    dragStartWorld.current = screenToWorld(screenPos.x, screenPos.y, viewport);
    if (selectedElements.length === 1) {
      dragStartElementSnapshots.current = new Map([
        [selectedElements[0].id, JSON.parse(JSON.stringify(selectedElements[0]))],
      ]);
    }
    setDragMode("rotate_element");
  };

  // Cursor style based on current tool & mode
  const getCanvasCursor = () => {
    if (dragMode === "pan" || dragMode === "orbit_3d") return "grabbing";
    if (activeTool === "hand" || isSpacePressed) return "grab";
    if (activeTool === "eyedropper") return "crosshair";
    if (activeTool === "draw" || activeTool === "vector-pen") return "crosshair";
    if (activeTool === "vector-node") return "pointer";
    if (activeTool === "eraser") return "crosshair";
    if (activeTool === "connector") return "crosshair";
    if (activeTool === "comment") return "crosshair";
    if (activeTool === "sticky" || activeTool === "shape" || activeTool === "text" || activeTool === "frame")
      return "cell";
    return "default";
  };

  // Selected element bounding box computation (uses effectiveElements for zero-lag preview alignment)
  const selectedElements = useMemo(
    () => effectiveElements.filter((el) => selectedIds.includes(el.id)),
    [effectiveElements, selectedIds]
  );
  const selectionBounds = useMemo(
    () => computeSelectionBounds(selectedElements),
    [selectedElements]
  );

  // Sort elements by zIndex (uses effectiveElements so dragged elements and their bound connectors render at exact active positions)
  const sortedElements = useMemo(
    () => [...effectiveElements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)),
    [effectiveElements]
  );

  return (
    <div
      ref={containerRef}
      id="infinite-canvas-viewport"
      className={`w-screen h-screen overflow-hidden relative select-none transition-colors duration-200 ${
        isDarkMode ? "bg-[#0B0D0F] text-[#F5F5F5]" : "bg-[#F2EFE7] text-slate-800"
      }`}
      style={{
        cursor: getCanvasCursor(),
        perspective: is3D ? (isDeep3D ? "1000px" : "1400px") : undefined,
        perspectiveOrigin: is3D ? "50% 35%" : undefined,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onContextMenu={(e) => {
        e.preventDefault();
        const screenPos = { x: e.clientX, y: e.clientY };
        const worldPos = screenToWorld(screenPos.x, screenPos.y, viewport);
        // Find if right-click hit an element (highest zIndex first)
        const hit = [...elements]
          .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
          .find(
            (el) =>
              worldPos.x >= el.x &&
              worldPos.x <= el.x + el.width &&
              worldPos.y >= el.y &&
              worldPos.y <= el.y + el.height
          );
        if (hit && !selectedIds.includes(hit.id)) {
          setSelectedIds([hit.id]);
        }
        setContextMenu({
          isOpen: true,
          x: screenPos.x,
          y: screenPos.y,
          targetElement: hit || null,
        });
      }}
    >
      {/* 3D Perspective World Container */}
      <div
        className="w-full h-full absolute inset-0 pointer-events-auto"
        style={{
          transformStyle: is3D ? "preserve-3d" : undefined,
          transform: is3D
            ? `rotateX(${cameraAngle.pitch}deg) rotateZ(${cameraAngle.yaw}deg)`
            : undefined,
          transition: dragMode === "orbit_3d" ? "none" : "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* SVG Canvas Workspace Layer */}
        <svg
        className="w-full h-full absolute inset-0 overflow-visible"
        style={{
          transformOrigin: "0 0",
        }}
      >
        <defs>
          {/* Miro-style infinite dot grid pattern */}
          <pattern
            id="canvas-dot-grid"
            x={viewport.x % (28 * viewport.zoom)}
            y={viewport.y % (28 * viewport.zoom)}
            width={28 * viewport.zoom}
            height={28 * viewport.zoom}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={28 * viewport.zoom / 2}
              cy={28 * viewport.zoom / 2}
              r={Math.max(1, 1.2 * Math.min(1.5, viewport.zoom))}
              fill={isDarkMode ? "#292C30" : "#C7AE82"}
              opacity={isDarkMode ? 0.85 : 0.4}
            />
          </pattern>
        </defs>

        {/* Base Canvas Background Fill */}
        <rect width="100%" height="100%" fill={isDarkMode ? "#0B0D0F" : "#F2EFE7"} />

        {/* Infinite Grid Background */}
        {gridEnabled && <rect width="100%" height="100%" fill="url(#canvas-dot-grid)" />}

        {/* Transformed World Container */}
        <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
          {/* Elements */}
          {sortedElements.map((el) => {
            const isSelected = selectedIds.includes(el.id);
            const isEditing = editingId === el.id;

            return (
              <g
                key={el.id}
                onMouseDown={(e) => handleElementMouseDown(e, el)}
              >
                <ElementView
                  element={el}
                  isSelected={isSelected}
                  isEditing={isEditing}
                  allElements={effectiveElements}
                  currentUser={currentUser}
                  onStartEditing={(id) => setEditingId(id)}
                  onUpdateContent={(id, content) => {
                    const target = elements.find((e) => e.id === id);
                    if (target?.type === "frame") {
                      onUpdateElement(id, { title: content });
                    } else {
                      onUpdateElement(id, { content });
                    }
                    setEditingId(null);
                  }}
                  onAddReaction={onAddReaction}
                  onUpdateElement={onUpdateElement}
                  onDeleteElement={(id) => onDeleteElements([id])}
                  onNotify={showToast}
                  onOpenSourceModal={(targetEl) => setInspectingHtmlElement(targetEl)}
                  zoom={viewport.zoom}
                  isDarkMode={isDarkMode}
                />
              </g>
            );
          })}

          {/* Active Freehand Draw in progress */}
          {dragMode === "freehand_draw" && (drawingStrokePoints.length > 0 || drawingPoints.length > 0) && (
            <path
              d={
                drawingStrokePoints.length > 1
                  ? getSvgPathFromStrokePoints(drawingStrokePoints)
                  : `M ${drawingPoints.map((p) => `${p.x} ${p.y}`).join(" L ")}`
              }
              fill="none"
              stroke={brushColor || "#0f172a"}
              strokeWidth={brushSize || (brush === "highlighter" ? 24 : brush === "marker" ? 8 : 3)}
              strokeLinecap={brush === "highlighter" ? "square" : "round"}
              strokeLinejoin="round"
              opacity={brushOpacity ?? (brush === "highlighter" ? 0.45 : 1)}
              style={{
                mixBlendMode: brush === "highlighter" ? (isDarkMode ? "screen" : "multiply") : "normal",
              }}
            />
          )}

          {/* Active Vector Shape Draft Preview */}
          {dragMode === "vector_draw_shape" && vectorShapeDraft && (() => {
            const x = Math.min(vectorShapeDraft.start.x, vectorShapeDraft.current.x);
            const y = Math.min(vectorShapeDraft.start.y, vectorShapeDraft.current.y);
            const width = Math.max(10, Math.abs(vectorShapeDraft.current.x - vectorShapeDraft.start.x));
            const height = Math.max(10, Math.abs(vectorShapeDraft.current.y - vectorShapeDraft.start.y));
            const { nodes, closed } = shapeToVectorNodes(vectorShapeDraft.shape, x, y, width, height);
            const d = vectorNodesToSvgPath(nodes, closed);

            return (
              <path
                d={d}
                fill={vectorFillColor || "none"}
                stroke={vectorStrokeColor || "#0f172a"}
                strokeWidth={vectorStrokeWidth || 2}
                strokeDasharray="4,4"
                strokeLinecap={vectorStrokeCap || "round"}
                strokeLinejoin={vectorStrokeJoin || "round"}
                className="pointer-events-none"
              />
            );
          })()}

          {/* Active Connector Draft Line */}
          {dragMode === "create_connector" && connectorDraft && (
            <line
              x1={connectorDraft.start.x}
              y1={connectorDraft.start.y}
              x2={connectorDraft.current.x}
              y2={connectorDraft.current.y}
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="4,4"
            />
          )}

          {/* Marquee Selection Rectangle */}
          {marqueeBox && (
            <rect
              x={marqueeBox.x}
              y={marqueeBox.y}
              width={marqueeBox.width}
              height={marqueeBox.height}
              fill="rgba(85, 124, 123, 0.12)"
              stroke="#557C7B"
              strokeWidth={1 / viewport.zoom}
              strokeDasharray="4,4"
              className="pointer-events-none"
            />
          )}

          {/* Bounding Box & 8 Resize Handles for single selection OR Vector Node Handles */}
          {selectedElements.length === 1 && !selectedElements[0].locked && selectedElements[0].type !== "connector" && (
            (() => {
              const el = selectedElements[0];

              // Vector Node Direct Manipulation Mode
              if (activeTool === "vector-node" && el.type === "vectorPath" && el.nodes && el.nodes.length > 0) {
                const nodeRadius = 5.5 / viewport.zoom;
                const handleRadius = 4 / viewport.zoom;

                return (
                  <g className="pointer-events-auto">
                    {/* Path subtle contour outline */}
                    <path
                      d={vectorNodesToSvgPath(el.nodes, el.closed)}
                      fill="none"
                      stroke="#9333ea"
                      strokeWidth={1 / viewport.zoom}
                      strokeDasharray="3,3"
                      className="pointer-events-none"
                    />

                    {/* Bezier control handles for currently selected node */}
                    {activeNodeIdx !== null && el.nodes[activeNodeIdx] && (() => {
                      const n = el.nodes[activeNodeIdx];
                      return (
                        <g key={`handles-${activeNodeIdx}`}>
                          {n.in && (n.in.x !== 0 || n.in.y !== 0) && (
                            <>
                              <line
                                x1={n.x}
                                y1={n.y}
                                x2={n.x + n.in.x}
                                y2={n.y + n.in.y}
                                stroke="#c084fc"
                                strokeWidth={1 / viewport.zoom}
                              />
                              <circle
                                cx={n.x + n.in.x}
                                cy={n.y + n.in.y}
                                r={handleRadius}
                                fill="#a855f7"
                                stroke="#ffffff"
                                strokeWidth={1.5 / viewport.zoom}
                                style={{ cursor: "crosshair" }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  dragStartElementSnapshots.current = new Map([[el.id, JSON.parse(JSON.stringify(el))]]);
                                  activeNodeDrag.current = {
                                    elementId: el.id,
                                    nodeIndex: activeNodeIdx,
                                    handle: "in",
                                  };
                                  setDragMode("move_vector_handle");
                                }}
                              />
                            </>
                          )}
                          {n.out && (n.out.x !== 0 || n.out.y !== 0) && (
                            <>
                              <line
                                x1={n.x}
                                y1={n.y}
                                x2={n.x + n.out.x}
                                y2={n.y + n.out.y}
                                stroke="#c084fc"
                                strokeWidth={1 / viewport.zoom}
                              />
                              <circle
                                cx={n.x + n.out.x}
                                cy={n.y + n.out.y}
                                r={handleRadius}
                                fill="#a855f7"
                                stroke="#ffffff"
                                strokeWidth={1.5 / viewport.zoom}
                                style={{ cursor: "crosshair" }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  dragStartElementSnapshots.current = new Map([[el.id, JSON.parse(JSON.stringify(el))]]);
                                  activeNodeDrag.current = {
                                    elementId: el.id,
                                    nodeIndex: activeNodeIdx,
                                    handle: "out",
                                  };
                                  setDragMode("move_vector_handle");
                                }}
                              />
                            </>
                          )}
                        </g>
                      );
                    })()}

                    {/* Vector Node Points */}
                    {el.nodes.map((node, i) => {
                      const isNodeSelected = activeNodeIdx === i;
                      return (
                        <circle
                          key={i}
                          cx={node.x}
                          cy={node.y}
                          r={nodeRadius}
                          fill={isNodeSelected ? "#9333ea" : "#ffffff"}
                          stroke="#9333ea"
                          strokeWidth={2 / viewport.zoom}
                          style={{ cursor: "move" }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setActiveNodeIdx(i);
                            dragStartElementSnapshots.current = new Map([[el.id, JSON.parse(JSON.stringify(el))]]);
                            activeNodeDrag.current = {
                              elementId: el.id,
                              nodeIndex: i,
                            };
                            setDragMode("move_vector_node");
                          }}
                        />
                      );
                    })}
                  </g>
                );
              }

              const handleSize = 9 / viewport.zoom;
              const halfH = handleSize / 2;

              const handles: { id: ResizeHandle; x: number; y: number; cursor: string }[] = [
                { id: "nw", x: el.x - halfH, y: el.y - halfH, cursor: "nwse-resize" },
                { id: "n", x: el.x + el.width / 2 - halfH, y: el.y - halfH, cursor: "ns-resize" },
                { id: "ne", x: el.x + el.width - halfH, y: el.y - halfH, cursor: "nesw-resize" },
                { id: "e", x: el.x + el.width - halfH, y: el.y + el.height / 2 - halfH, cursor: "ew-resize" },
                { id: "se", x: el.x + el.width - halfH, y: el.y + el.height - halfH, cursor: "nwse-resize" },
                { id: "s", x: el.x + el.width / 2 - halfH, y: el.y + el.height - halfH, cursor: "ns-resize" },
                { id: "sw", x: el.x - halfH, y: el.y + el.height - halfH, cursor: "nesw-resize" },
                { id: "w", x: el.x - halfH, y: el.y + el.height / 2 - halfH, cursor: "ew-resize" },
              ];

              return (
                <g className="pointer-events-auto">
                  {/* Selection boundary ring */}
                  <rect
                    x={el.x}
                    y={el.y}
                    width={el.width}
                    height={el.height}
                    fill="none"
                    stroke="#557C7B"
                    strokeWidth={1.5 / viewport.zoom}
                    className="pointer-events-none"
                  />

                  {/* Corner & Side Handles */}
                  {handles.map((h) => (
                    <rect
                      key={h.id}
                      x={h.x}
                      y={h.y}
                      width={handleSize}
                      height={handleSize}
                      fill="#ffffff"
                      stroke="#557C7B"
                      strokeWidth={1.5 / viewport.zoom}
                      rx={2 / viewport.zoom}
                      style={{ cursor: h.cursor }}
                      onMouseDown={(e) => handleResizeMouseDown(e, h.id)}
                    />
                  ))}

                  {/* Rotation Handle */}
                  {selectedElements.length === 1 && !el.locked && (
                    <g className="pointer-events-auto">
                      <line
                        x1={el.x + el.width / 2}
                        y1={el.y}
                        x2={el.x + el.width / 2}
                        y2={el.y - 20 / viewport.zoom}
                        stroke="#557C7B"
                        strokeWidth={1.5 / viewport.zoom}
                        strokeDasharray={`${3 / viewport.zoom},${3 / viewport.zoom}`}
                      />
                      <circle
                        cx={el.x + el.width / 2}
                        cy={el.y - 20 / viewport.zoom}
                        r={5.5 / viewport.zoom}
                        fill="#ffffff"
                        stroke="#557C7B"
                        strokeWidth={1.5 / viewport.zoom}
                        style={{ cursor: "grab" }}
                        onMouseDown={handleRotateMouseDown}
                      />
                    </g>
                  )}
                </g>
              );
            })()
          )}

          {/* Group & Multi-selection Bounding Box with 8 Resize Handles */}
          {selectedElements.length > 1 && selectionBounds && (
            (() => {
              const anyLocked = selectedElements.some((el) => el.locked);
              const isGroup =
                selectedElements.length > 1 &&
                selectedElements.every(
                  (el) => !!el.groupId && el.groupId === selectedElements[0].groupId
                );

              const boxPadding = 4 / viewport.zoom;
              const bx = selectionBounds.x - boxPadding;
              const by = selectionBounds.y - boxPadding;
              const bw = selectionBounds.width + boxPadding * 2;
              const bh = selectionBounds.height + boxPadding * 2;

              const handleSize = 9 / viewport.zoom;
              const halfH = handleSize / 2;

              const handles: { id: ResizeHandle; x: number; y: number; cursor: string }[] = [
                { id: "nw", x: bx - halfH, y: by - halfH, cursor: "nwse-resize" },
                { id: "n", x: bx + bw / 2 - halfH, y: by - halfH, cursor: "ns-resize" },
                { id: "ne", x: bx + bw - halfH, y: by - halfH, cursor: "nesw-resize" },
                { id: "e", x: bx + bw - halfH, y: by + bh / 2 - halfH, cursor: "ew-resize" },
                { id: "se", x: bx + bw - halfH, y: by + bh - halfH, cursor: "nwse-resize" },
                { id: "s", x: bx + bw / 2 - halfH, y: by + bh - halfH, cursor: "ns-resize" },
                { id: "sw", x: bx - halfH, y: by + bh - halfH, cursor: "nesw-resize" },
                { id: "w", x: bx - halfH, y: by + bh / 2 - halfH, cursor: "ew-resize" },
              ];

              const badgeText = isGroup
                ? `Group (${selectedElements.length})`
                : `${selectedElements.length} items`;
              const badgeWidth = (isGroup ? 78 : 66) / viewport.zoom;

              return (
                <g className="pointer-events-auto">
                  {/* Bounding box outline */}
                  <rect
                    x={bx}
                    y={by}
                    width={bw}
                    height={bh}
                    fill={isGroup ? "rgba(85, 124, 123, 0.05)" : "none"}
                    stroke="#557C7B"
                    strokeWidth={1.5 / viewport.zoom}
                    strokeDasharray={isGroup ? undefined : "4,4"}
                    rx={2 / viewport.zoom}
                    className="pointer-events-none"
                  />

                  {/* Group / Multi-select badge */}
                  <g
                    transform={`translate(${bx}, ${by - 22 / viewport.zoom})`}
                    className="pointer-events-none select-none"
                  >
                    <rect
                      x={0}
                      y={0}
                      width={badgeWidth}
                      height={18 / viewport.zoom}
                      rx={4 / viewport.zoom}
                      fill="#557C7B"
                    />
                    <text
                      x={6 / viewport.zoom}
                      y={12.5 / viewport.zoom}
                      fill="#ffffff"
                      fontSize={10 / viewport.zoom}
                      fontWeight="600"
                      fontFamily="system-ui, -apple-system, sans-serif"
                    >
                      {badgeText}
                    </text>
                  </g>

                  {/* 8 unified resize handles for multi-select / group */}
                  {!anyLocked &&
                    handles.map((h) => (
                      <rect
                        key={h.id}
                        x={h.x}
                        y={h.y}
                        width={handleSize}
                        height={handleSize}
                        fill="#ffffff"
                        stroke="#557C7B"
                        strokeWidth={1.5 / viewport.zoom}
                        rx={2 / viewport.zoom}
                        style={{ cursor: h.cursor }}
                        onMouseDown={(e) => handleResizeMouseDown(e, h.id)}
                      />
                    ))}
                </g>
              );
            })()
          )}

          {/* Multiplayer Live Cursors of other collaborators */}
          {showPeerCursors &&
            (Object.values(activeUsers) as UserPresence[]).map((user) => {
              if (!user.cursor) return null;
              const cx = user.cursor.x;
              const cy = user.cursor.y;

              return (
                <g
                  key={user.id}
                  transform={`translate(${cx}, ${cy})`}
                  className="pointer-events-none select-none transition-all duration-75"
                >
                  {/* Pointer arrow SVG */}
                  <path
                    d="M 0 0 L 0 16 L 4.5 12 L 8.5 20 L 11 19 L 7 11 L 13 11 Z"
                    fill={user.color || "#3b82f6"}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />

                  {/* User Name Tag Badge */}
                  <foreignObject x={12} y={12} width={150} height={28} className="overflow-visible">
                    <div
                      className="px-2 py-0.5 rounded-full text-[11px] font-bold text-white shadow-md inline-flex items-center gap-1"
                      style={{ backgroundColor: user.color || "#3b82f6" }}
                    >
                      <span>{user.name}</span>
                    </div>
                  </foreignObject>
                </g>
              );
            })}

          {/* Local Collaborative Laser Pointer Trails */}
          {localLaserPoints.length > 1 && (
            <g className="pointer-events-none select-none">
              {localLaserPoints.map((pt, i) => {
                if (i === 0) return null;
                const prev = localLaserPoints[i - 1];
                const age = Date.now() - pt.timestamp;
                const opacity = Math.max(0, 1 - age / 1200);
                const width = Math.max(2, 8 * opacity);
                return (
                  <line
                    key={`laser-loc-${i}`}
                    x1={prev.x}
                    y1={prev.y}
                    x2={pt.x}
                    y2={pt.y}
                    stroke="#ef4444"
                    strokeWidth={width}
                    strokeLinecap="round"
                    opacity={opacity}
                    style={{ filter: "drop-shadow(0 0 6px #ef4444)" }}
                  />
                );
              })}
              {localLaserPoints.length > 0 && (
                <circle
                  cx={localLaserPoints[localLaserPoints.length - 1].x}
                  cy={localLaserPoints[localLaserPoints.length - 1].y}
                  r={5}
                  fill="#ffffff"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  style={{ filter: "drop-shadow(0 0 8px #ef4444)" }}
                />
              )}
            </g>
          )}

          {/* Peer Collaborative Laser Pointer Trails */}
          {peerLaserPoints && peerLaserPoints.length > 1 && (
            <g className="pointer-events-none select-none">
              {peerLaserPoints.map((pt, i) => {
                if (i === 0) return null;
                const prev = peerLaserPoints[i - 1];
                if (prev.userId !== pt.userId || pt.timestamp - prev.timestamp > 300) return null;
                const age = Date.now() - pt.timestamp;
                const opacity = Math.max(0, 1 - age / 1200);
                const width = Math.max(2, 7 * opacity);
                const color = pt.color || "#3b82f6";
                return (
                  <line
                    key={`laser-peer-${pt.userId}-${i}`}
                    x1={prev.x}
                    y1={prev.y}
                    x2={pt.x}
                    y2={pt.y}
                    stroke={color}
                    strokeWidth={width}
                    strokeLinecap="round"
                    opacity={opacity}
                    style={{ filter: `drop-shadow(0 0 6px ${color})` }}
                  />
                );
              })}
            </g>
          )}
        </g>
      </svg>
      </div>

      {/* Floating Real-Time Emoji Reactions Burst Layer */}
      {activeReactions && activeReactions.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-[250] overflow-hidden">
          {activeReactions.map((rx) => {
            const age = Date.now() - rx.timestamp;
            const progress = Math.min(1, age / 3200);
            const translateY = -progress * 180;
            const opacity = progress > 0.65 ? Math.max(0, 1 - (progress - 0.65) / 0.35) : 1;
            const scale = 1 + progress * 0.5;

            return (
              <div
                key={rx.id}
                className="absolute transition-transform duration-75 flex flex-col items-center select-none"
                style={{
                  left: rx.x,
                  top: rx.y,
                  transform: `translate(-50%, ${translateY}px) scale(${scale})`,
                  opacity,
                }}
              >
                <span className="text-4xl filter drop-shadow-md animate-bounce">{rx.emoji}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900/85 text-white shadow-sm mt-1 whitespace-nowrap">
                  {rx.userName}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating HUD Controls (3D Tilt, HTML Upload) */}
      <div className="absolute top-18 right-5 z-30 flex items-center gap-2 pointer-events-auto select-none">
        <button
          onClick={toggleTilt}
          className={`px-3 py-1.5 rounded-xl font-mono text-xs font-semibold tracking-wider flex items-center gap-1.5 transition-all shadow-md cursor-pointer border ${
            currentTilted
              ? "bg-[#5eead4] text-[#0a1420] border-[#5eead4] shadow-[0_0_15px_rgba(94,234,212,0.4)]"
              : "bg-[#0e1c2b]/85 backdrop-blur-md text-[#5eead4] border-[#5eead4]/30 hover:bg-[#5eead4]/15"
          }`}
          title="Toggle CSS3D perspective tilt (matches Three.js CSS3DRenderer style)"
        >
          <Box size={14} className={currentTilted ? "animate-spin" : ""} />
          <span>3D TILT: {currentTilted ? "ON" : "OFF"}</span>
        </button>

        {onOpenUploadModal && (
          <button
            onClick={onOpenUploadModal}
            className="px-3 py-1.5 rounded-xl font-mono text-xs font-semibold tracking-wider flex items-center gap-1.5 bg-[#0e1c2b]/85 backdrop-blur-md text-[#ff9d42] border border-[#ff9d42]/30 hover:bg-[#ff9d42]/15 shadow-md cursor-pointer transition-all"
            title="Upload .html file or paste markup"
          >
            <Code2 size={14} />
            <span>UPLOAD HTML</span>
          </button>
        )}
      </div>

      {/* Animated Toast Notification Banner */}
      {localToast && (
        <div
          id="toast"
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[250] bg-[#17191C] text-[#F5F5F5] border border-[#292C30] text-xs font-semibold px-4 py-2 rounded-lg shadow-lg pointer-events-none animate-in fade-in slide-in-from-bottom-2 flex items-center gap-2 font-mono"
        >
          <Sparkles size={14} className="text-[#BCE5F8]" />
          <span>{localToast}</span>
        </div>
      )}

      {/* Raw HTML Code Inspector / Editor Modal */}
      {inspectingHtmlElement && (
        <HtmlSourceModal
          element={inspectingHtmlElement}
          isOpen={true}
          onClose={() => setInspectingHtmlElement(null)}
          onSave={(id, updatedHtml) => {
            onUpdateElement(id, { content: updatedHtml, rawHtml: updatedHtml });
            showToast("HTML card updated.");
          }}
        />
      )}

      {/* 8-Way Quick Tool Radial Menu (Triggered by holding 'Q') */}
      <QuickToolRadialMenu
        isOpen={radialMenu.isOpen}
        position={{ x: radialMenu.x, y: radialMenu.y }}
        activeTool={activeTool}
        onSelectTool={(tool) => {
          setActiveTool(tool);
          showToast(`Selected: ${tool.toUpperCase()}`);
        }}
        onClose={() => setRadialMenu((prev) => ({ ...prev, isOpen: false }))}
        isDarkMode={isDarkMode}
      />

      {/* Right-Click Context Menu for Canvas & Elements */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        position={{ x: contextMenu.x, y: contextMenu.y }}
        targetElement={contextMenu.targetElement}
        selectedIds={selectedIds}
        elements={elements}
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
        onDelete={() => {
          if (selectedIds.length > 0) {
            onDeleteElements(selectedIds);
            setSelectedIds([]);
          } else if (contextMenu.targetElement) {
            onDeleteElements([contextMenu.targetElement.id]);
          }
        }}
        onDuplicate={() => {
          const toDup = selectedIds.length > 0
            ? elements.filter((el) => selectedIds.includes(el.id))
            : contextMenu.targetElement ? [contextMenu.targetElement] : [];
          if (toDup.length > 0) onDuplicateElements(toDup);
        }}
        onBringForward={() => handleBringForward(selectedIds.length > 0 ? selectedIds : contextMenu.targetElement ? [contextMenu.targetElement.id] : [])}
        onSendBackward={() => handleSendBackward(selectedIds.length > 0 ? selectedIds : contextMenu.targetElement ? [contextMenu.targetElement.id] : [])}
        onBringToFront={() => handleBringToFront(selectedIds.length > 0 ? selectedIds : contextMenu.targetElement ? [contextMenu.targetElement.id] : [])}
        onSendToBack={() => handleSendToBack(selectedIds.length > 0 ? selectedIds : contextMenu.targetElement ? [contextMenu.targetElement.id] : [])}
        onGroup={() => onGroupElements?.(selectedIds)}
        onUngroup={() => onUngroupElements?.(selectedIds)}
        onToggleLock={() => handleToggleLock()}
        onCopy={() => handleCopyClipboard()}
        onPaste={() => handlePasteClipboard()}
        onConvertToVector={onConvertToVector}
        onConvertToPath={onConvertToPath}
        onRasterize={onRasterize}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};
