import React, { useState, useCallback, useEffect, useMemo } from "react";
import DOMPurify from "dompurify";
import { X, AlertTriangle } from "lucide-react";
import {
  ToolType,
  ShapeType,
  Viewport,
  BoardElement,
  ViewMode,
  BrushType,
  BooleanOperation,
  EditorRailMode,
  ExportOptions,
} from "./types";
import { useRealtimeBoard } from "./hooks/useRealtimeBoard";
import { Canvas } from "./components/Canvas";
import { Toolbar } from "./components/Toolbar";
import { Header } from "./components/Header";
import { PropertyBar } from "./components/PropertyBar";
import { Minimap } from "./components/Minimap";
import { TemplatesModal } from "./components/TemplatesModal";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { HtmlUploadModal } from "./components/HtmlUploadModal";
import { HistoryDrawer } from "./components/HistoryDrawer";
import { CommentsDrawer } from "./components/CommentsDrawer";
import { AiAssistantModal } from "./components/AiAssistantModal";
import { PresentationBar } from "./components/PresentationBar";
import { DrawingToolbar } from "./components/DrawingToolbar";
import { VectorToolbar } from "./components/VectorToolbar";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { StatusBar } from "./components/StatusBar";
import { BoardSearchModal } from "./components/BoardSearchModal";
import { ExportModal } from "./components/ExportModal";
import { SettingsModal, SettingsTab } from "./components/SettingsModal";
import { mountEducationController } from "./services/educationController";
import { educationControllerAdapter } from "./services/educationControllerAdapter";
import { windowManager } from "./services/WindowManager";
import { communicationBridge } from "./services/CommunicationBridge";
import { sharedContextManager } from "./services/SharedContextManager";
import { diagnosticsManager } from "./services/DiagnosticsManager";
import { settingsManager } from "./services/SettingsManager";
import { eventBus, FOUNDRY_EVENTS } from "./services/EventBus";
import { foundryAIService } from "./services/ai/FoundryAIService";
import { aiContextManager } from "./services/ai/AIContextManager";
import { aiToolRegistry } from "./services/ai/AIToolRegistry";
import { FOUNDRY_Z_LAYERS, THEME } from "./theme";
import { computeSelectionBounds, generateId } from "./utils/canvasMath";
import {
  convertFreehandToVectorPath,
  shapeToVectorNodes,
  performBooleanPathOperation,
  rasterizeElementsToDataUrl,
} from "./utils/vectorMath";

export default function App() {
  const {
    boardId,
    boardTitle,
    setBoardTitle,
    boardsList,
    switchBoard,
    createBoard,
    deleteBoard,
    elements,
    activeUsers,
    currentUser,
    connectionStatus,
    createElement,
    updateElement,
    batchUpdateElements,
    deleteElements,
    replaceBoard,
    sendCursor,
    undo,
    redo,
    canUndo,
    canRedo,
    activityHistory,
    conflictNotice,
    clearConflictNotice,
    recordCustomOperation,
    peerLaserPoints,
    activeReactions,
    syncedSlideIndex,
    sendLaserPoint,
    sendReactionBurst,
    sendPresentationSlide,
  } = useRealtimeBoard();

  // Navigation & Viewport camera
  const [viewport, setViewport] = useState<Viewport>({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    zoom: 1.0,
  });

  // Tools & Selection
  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [railMode, setRailMode] = useState<EditorRailMode>("select");
  const [selectedShapeType, setSelectedShapeType] = useState<ShapeType>("rounded-rect");
  const [selectedStickyColor, setSelectedStickyColor] = useState<string>("#fef08a");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedElements = elements.filter((el) => selectedIds.includes(el.id));
  const [editingId, setEditingId] = useState<string | null>(null);

  // Dual-mode Toolbar Visibility
  const [showDrawingToolbar, setShowDrawingToolbar] = useState(false);
  const [showVectorToolbar, setShowVectorToolbar] = useState(false);

  // Drawing Mode Settings
  const [brush, setBrush] = useState<BrushType>("pen");
  const [brushSize, setBrushSize] = useState<number>(4);
  const [brushOpacity, setBrushOpacity] = useState<number>(1);
  const [brushSmooth, setBrushSmooth] = useState<number>(2.0);
  const [brushColor, setBrushColor] = useState<string>("#0f172a");
  const [brushPressure, setBrushPressure] = useState<boolean>(true);
  const [brushStabilize, setBrushStabilize] = useState<boolean>(true);

  // Vector Mode Settings
  const [vectorFillColor, setVectorFillColor] = useState<string | null>(null);
  const [vectorStrokeColor, setVectorStrokeColor] = useState<string>("#0f172a");
  const [vectorStrokeWidth, setVectorStrokeWidth] = useState<number>(2);
  const [vectorStrokeCap, setVectorStrokeCap] = useState<"round" | "butt" | "square">("round");
  const [vectorStrokeJoin, setVectorStrokeJoin] = useState<"round" | "miter" | "bevel">("round");

  // Clean Board Mode (Zen canvas triggered by Tab)
  const [isCleanBoardMode, setIsCleanBoardMode] = useState<boolean>(false);

  // View Mode: "flat" | "soft-3d" | "deep-3d" | "presentation"
  const [viewMode, setViewMode] = useState<ViewMode>("flat");

  // Presentation slide state
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Modals & Drawers
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showHtmlUploadModal, setShowHtmlUploadModal] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showCommentsDrawer, setShowCommentsDrawer] = useState(false);
  const [showAiAssistantModal, setShowAiAssistantModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>("general");
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);
  const [showPeerCursors, setShowPeerCursors] = useState(true);

  // Canvas View & Interaction Settings
  const [gridEnabled, setGridEnabled] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [guidesEnabled, setGuidesEnabled] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);

  // 3D Perspective Tilt mode (synced with viewMode)
  const isTilted3D = viewMode === "soft-3d" || viewMode === "deep-3d";
  const handleToggleTilt3D = useCallback(() => {
    setViewMode((prev) => (prev === "flat" ? "soft-3d" : "flat"));
  }, []);

  // Dark mode state with localStorage persistence (Foundry Dark is default)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("whiteboard_dark_mode");
      if (saved !== null) {
        return saved === "true";
      }
      return true;
    } catch {
      return true;
    }
  });

  const handleToggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("whiteboard_dark_mode", String(next));
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Mount Foundry Education Controller, WindowManager Adapter, Communication Bridge, and Stage 2 AI Engine
  const [eduController, setEduController] = useState<any>(null);
  const liveHostStateRef = React.useRef({
    boardId,
    boardTitle,
    connectionStatus,
    elements,
    selectedIds,
    viewport,
    isDarkMode,
    createElement,
    updateElement,
    setViewport,
    setSelectedIds,
  });
  liveHostStateRef.current = {
    boardId,
    boardTitle,
    connectionStatus,
    elements,
    selectedIds,
    viewport,
    isDarkMode,
    createElement,
    updateElement,
    setViewport,
    setSelectedIds,
  };

  useEffect(() => {
    const settings = settingsManager.getSettings();
    const ctrl = mountEducationController({
      zIndex: FOUNDRY_Z_LAYERS.floatingWorkspaceMin,
      topInset: 48,
      companionGap: settings.windowManagement.companionGap,
    });
    setEduController(ctrl);

    const unbindAdapter = educationControllerAdapter.bind(ctrl);

    let eduToken: string | null = null;
    let eduWindow: Window | null = null;
    let aiToken: string | null = null;
    let aiWindow: Window | null = null;

    const syncControllerFrame = () => {
      const frame = ctrl.getFrame?.();
      if (!frame || !frame.contentWindow) return;
      if (eduWindow !== frame.contentWindow || !eduToken) {
        eduWindow = frame.contentWindow;
        eduToken = communicationBridge.registerFrameSource("education-controller", frame, null);
      }
      try {
        frame.contentWindow.postMessage(
          {
            type: "foundry:controller-init",
            handshakeToken: eduToken,
            aiSnapshot: foundryAIService.getStateSnapshot(),
          },
          window.location.origin
        );
      } catch {}
    };

    const syncAIFrame = () => {
      const aiFrame = ctrl.getAIFrame?.();
      if (!aiFrame || !aiFrame.contentWindow) return;
      if (aiWindow !== aiFrame.contentWindow || !aiToken) {
        aiWindow = aiFrame.contentWindow;
        aiToken = communicationBridge.registerFrameSource("education-ai", aiFrame, null);
      }
      try {
        aiFrame.contentWindow.postMessage(
          {
            type: "foundry:ai-init",
            handshakeToken: aiToken,
            snapshot: foundryAIService.getStateSnapshot(),
          },
          "*"
        );
      } catch {}
    };

    syncControllerFrame();
    syncAIFrame();

    const onFrameHandshakeReady = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "foundry:ai-ready") {
        const aiFrame = ctrl.getAIFrame?.();
        if (aiFrame?.contentWindow && event.source === aiFrame.contentWindow) {
          syncAIFrame();
        }
      } else if (data.type === "foundry:edu-ready") {
        const frame = ctrl.getFrame?.();
        if (frame?.contentWindow && event.source === frame.contentWindow) {
          syncControllerFrame();
        }
      }
    };
    window.addEventListener("message", onFrameHandshakeReady);

    communicationBridge.setHostCanvasProvider({
      getWorkspaceInfo: () => ({
        workspaceId: liveHostStateRef.current.boardId,
        workspaceName: liveHostStateRef.current.boardTitle,
        connectionStatus: liveHostStateRef.current.connectionStatus,
        elementCount: liveHostStateRef.current.elements.length,
      }),
      getViewport: () => ({ ...liveHostStateRef.current.viewport }),
      getSelectedElements: () => {
        const selectedSet = new Set(liveHostStateRef.current.selectedIds);
        return liveHostStateRef.current.elements.filter((el) => selectedSet.has(el.id));
      },
    });

    aiContextManager.setHostProvider({
      getWorkspaceInfo: () => ({
        workspaceId: liveHostStateRef.current.boardId,
        workspaceName: liveHostStateRef.current.boardTitle,
        connectionStatus: liveHostStateRef.current.connectionStatus,
        elementCount: liveHostStateRef.current.elements.length,
      }),
      getElements: () => liveHostStateRef.current.elements,
      getSelectedElements: () => {
        const selectedSet = new Set(liveHostStateRef.current.selectedIds);
        return liveHostStateRef.current.elements.filter((el) => selectedSet.has(el.id));
      },
    });

    const getViewportCenter = () => {
      const vp = liveHostStateRef.current.viewport;
      return {
        x: Math.round((window.innerWidth / 2 - vp.x) / vp.zoom),
        y: Math.round((window.innerHeight / 2 - vp.y) / vp.zoom),
      };
    };

    const getNextZ = () => {
      const els = liveHostStateRef.current.elements;
      return (els.length > 0 ? Math.max(...els.map((e) => e.zIndex || 0)) : 0) + 1;
    };

    aiToolRegistry.setCanvasHandler({
      getObjects: (filter) => {
        let list = liveHostStateRef.current.elements;
        if (filter?.type) {
          list = list.filter((e) => e.type === filter.type);
        }
        const limit = typeof filter?.limit === "number" ? filter.limit : 50;
        return list.slice(0, limit);
      },
      getSelection: () => {
        const selectedSet = new Set(liveHostStateRef.current.selectedIds);
        return liveHostStateRef.current.elements.filter((e) => selectedSet.has(e.id));
      },
      getViewport: () => ({ ...liveHostStateRef.current.viewport }),
      createNote: (args) => {
        const center = getViewportCenter();
        const width = args.width ?? 210;
        const height = args.height ?? 160;
        const el: BoardElement = {
          id: generateId("note"),
          type: "sticky",
          x: args.x ?? center.x - Math.round(width / 2),
          y: args.y ?? center.y - Math.round(height / 2),
          width,
          height,
          content: args.content,
          color: args.color || "#fef08a",
          zIndex: getNextZ(),
          authorName: "Foundry AI",
        };
        liveHostStateRef.current.createElement(el);
        liveHostStateRef.current.setSelectedIds([el.id]);
        return el;
      },
      createText: (args) => {
        const center = getViewportCenter();
        const el: BoardElement = {
          id: generateId("text"),
          type: "text",
          x: args.x ?? center.x - 120,
          y: args.y ?? center.y - 24,
          width: 240,
          height: 48,
          content: args.content,
          fontSize: args.fontSize ?? 18,
          color: args.color || (liveHostStateRef.current.isDarkMode ? "#f5f5f5" : "#0f172a"),
          zIndex: getNextZ(),
          authorName: "Foundry AI",
        };
        liveHostStateRef.current.createElement(el);
        liveHostStateRef.current.setSelectedIds([el.id]);
        return el;
      },
      createShape: (args) => {
        const center = getViewportCenter();
        const width = args.width ?? 180;
        const height = args.height ?? 100;
        const el: BoardElement = {
          id: generateId("shape"),
          type: "shape",
          shapeType: args.shapeType,
          x: args.x ?? center.x - Math.round(width / 2),
          y: args.y ?? center.y - Math.round(height / 2),
          width,
          height,
          content: args.content || "",
          fillColor: args.fillColor || (liveHostStateRef.current.isDarkMode ? "#1e293b" : "#ffffff"),
          strokeColor: args.strokeColor || "#3b82f6",
          strokeWidth: 2,
          zIndex: getNextZ(),
          authorName: "Foundry AI",
        };
        liveHostStateRef.current.createElement(el);
        liveHostStateRef.current.setSelectedIds([el.id]);
        return el;
      },
      createFrame: (args) => {
        const center = getViewportCenter();
        const width = args.width ?? 480;
        const height = args.height ?? 320;
        const el: BoardElement = {
          id: generateId("frame"),
          type: "frame",
          title: args.title,
          x: args.x ?? center.x - Math.round(width / 2),
          y: args.y ?? center.y - Math.round(height / 2),
          width,
          height,
          strokeColor: args.strokeColor || "#3b82f6",
          fillColor: "rgba(59, 130, 246, 0.04)",
          zIndex: 0,
          authorName: "Foundry AI",
        };
        liveHostStateRef.current.createElement(el);
        liveHostStateRef.current.setSelectedIds([el.id]);
        return el;
      },
      connectObjects: (args) => {
        const els = liveHostStateRef.current.elements;
        const fromEl = els.find((e) => e.id === args.fromId);
        const toEl = els.find((e) => e.id === args.toId);
        if (!fromEl || !toEl) {
          throw new Error(`Cannot connect objects: ${!fromEl ? args.fromId : args.toId} not found.`);
        }
        const startPoint = {
          x: Math.round(fromEl.x + (fromEl.width || 120) / 2),
          y: Math.round(fromEl.y + (fromEl.height || 80) / 2),
        };
        const endPoint = {
          x: Math.round(toEl.x + (toEl.width || 120) / 2),
          y: Math.round(toEl.y + (toEl.height || 80) / 2),
        };
        const el: BoardElement = {
          id: generateId("conn"),
          type: "connector",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          content: args.label || "",
          strokeColor: liveHostStateRef.current.isDarkMode ? "#94a3b8" : "#64748b",
          strokeWidth: 2,
          arrowEnd: true,
          lineStyle: args.lineStyle || "orthogonal",
          startPoint,
          endPoint,
          startBinding: { elementId: fromEl.id, anchor: "center" },
          endBinding: { elementId: toEl.id, anchor: "center" },
          zIndex: getNextZ(),
          authorName: "Foundry AI",
        };
        liveHostStateRef.current.createElement(el);
        return el;
      },
      moveObject: (args) => {
        const target = liveHostStateRef.current.elements.find((e) => e.id === args.id);
        if (!target) {
          throw new Error(`Canvas object "${args.id}" not found.`);
        }
        liveHostStateRef.current.updateElement(target.id, { x: args.x, y: args.y });
        return { ...target, x: args.x, y: args.y };
      },
      focusObject: (args) => {
        const target = liveHostStateRef.current.elements.find((e) => e.id === args.id);
        if (!target) {
          throw new Error(`Canvas object "${args.id}" not found.`);
        }
        const current = liveHostStateRef.current.viewport;
        const nextZoom = args.zoom ?? Math.max(0.5, Math.min(2, current.zoom));
        const cx = target.x + (target.width || 120) / 2;
        const cy = target.y + (target.height || 80) / 2;
        const nextViewport: Viewport = {
          zoom: nextZoom,
          x: Math.round(window.innerWidth / 2 - cx * nextZoom),
          y: Math.round(window.innerHeight / 2 - cy * nextZoom),
        };
        liveHostStateRef.current.setViewport(nextViewport);
        liveHostStateRef.current.setSelectedIds([target.id]);
        return { id: target.id, viewport: nextViewport };
      },
    });

    foundryAIService.setOpenSettingsCallback((tab) => {
      setSettingsInitialTab((tab as SettingsTab) || "ollama");
      setShowSettingsModal(true);
    });

    const detachTransport = communicationBridge.attachMessageTransport();
    void foundryAIService.initialize();

    const offControllerReady = eventBus.on(FOUNDRY_EVENTS.CONTROLLER_READY, () => {
      syncControllerFrame();
      syncAIFrame();
      diagnosticsManager.verifyAll({
        canvas: {
          mounted: true,
          elementCount: liveHostStateRef.current.elements.length,
          connectionStatus: liveHostStateRef.current.connectionStatus,
          viewportZoom: liveHostStateRef.current.viewport.zoom,
        },
      });
    });

    eventBus.emit(
      FOUNDRY_EVENTS.READY,
      { stage: 2, version: "2.0.0", workspaceId: liveHostStateRef.current.boardId },
      "foundry-host"
    );

    diagnosticsManager.verifyAll({
      canvas: {
        mounted: true,
        elementCount: liveHostStateRef.current.elements.length,
        connectionStatus: liveHostStateRef.current.connectionStatus,
        viewportZoom: liveHostStateRef.current.viewport.zoom,
      },
    });

    return () => {
      window.removeEventListener("message", onFrameHandshakeReady);
      offControllerReady();
      foundryAIService.setOpenSettingsCallback(null);
      aiToolRegistry.setCanvasHandler(null);
      aiContextManager.setHostProvider(null);
      communicationBridge.unregisterFrameSource("education-ai");
      communicationBridge.unregisterFrameSource("education-controller");
      detachTransport();
      communicationBridge.destroy();
      unbindAdapter();
      windowManager.destroy();
      try {
        ctrl.destroy();
      } catch {}
    };
  }, []);

  // Synchronize live workspace metadata, selection, viewport, and diagnostics probes
  useEffect(() => {
    sharedContextManager.updateContext({
      workspaceId: boardId,
      workspaceName: boardTitle,
    });
    eventBus.emit(
      FOUNDRY_EVENTS.WORKSPACE_CHANGED,
      { workspaceId: boardId, workspaceName: boardTitle },
      "workspace-manager"
    );
  }, [boardId, boardTitle]);

  useEffect(() => {
    sharedContextManager.updateContext({
      selectedCanvasObjectIds: selectedIds,
    });
    eventBus.emit(
      FOUNDRY_EVENTS.CANVAS_SELECTION_CHANGED,
      { selectedIds, count: selectedIds.length },
      "selection-manager"
    );
  }, [selectedIds]);

  useEffect(() => {
    sharedContextManager.updateContext({ viewport });
    eventBus.emitThrottled(
      FOUNDRY_EVENTS.CANVAS_VIEWPORT_CHANGED,
      { viewport },
      "canvas-engine",
      150
    );
  }, [viewport]);

  useEffect(() => {
    diagnosticsManager.setRuntimeProbes({
      canvas: {
        mounted: true,
        elementCount: elements.length,
        connectionStatus,
        viewportZoom: viewport.zoom,
      },
    });
  }, [elements.length, connectionStatus, viewport.zoom]);

  // Central AI Entry Point (Phase 2.6): route all Foundry AI buttons to Education Controller AI Chat
  const handleOpenPrimaryAI = useCallback(() => {
    if (educationControllerAdapter.openAI()) {
      return;
    }
    if (eduController && typeof eduController.openAI === "function") {
      eduController.openAI();
    }
  }, [eduController]);

  // Insert HTML card handler
  const handleInsertHtmlCard = useCallback(
    (rawHtml: string, title?: string) => {
      const sanitized = DOMPurify.sanitize(rawHtml, {
        ADD_ATTR: ["target", "rel", "style", "class"],
        ADD_TAGS: ["style", "iframe"],
      });

      const maxZ = elements.length > 0 ? Math.max(...elements.map((e) => e.zIndex)) : 0;
      const centerX = Math.round((window.innerWidth / 2 - viewport.x) / viewport.zoom);
      const centerY = Math.round((window.innerHeight / 2 - viewport.y) / viewport.zoom);

      const newCard: BoardElement = {
        id: generateId("html"),
        type: "html",
        x: centerX - 220,
        y: centerY - 160,
        width: 440,
        height: 320,
        zIndex: maxZ + 1,
        content: sanitized,
        rawHtml: rawHtml,
        title: title || "HTML Card",
        sourceName: title || "UPLOADED",
        isRasterized: false,
      };

      createElement(newCard);
      setSelectedIds([newCard.id]);
    },
    [elements, viewport, createElement, setSelectedIds]
  );

  // Fit to screen calculation
  const handleFitToScreen = useCallback(() => {
    if (elements.length === 0) {
      setViewport({ x: window.innerWidth / 2, y: window.innerHeight / 2, zoom: 1.0 });
      return;
    }
    const bounds = computeSelectionBounds(elements);
    if (!bounds) return;

    const padding = 100;
    const availableW = window.innerWidth - padding * 2;
    const availableH = window.innerHeight - padding * 2;
    const zoom = Math.max(0.2, Math.min(1.8, Math.min(availableW / bounds.width, availableH / bounds.height)));

    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    setViewport({
      zoom,
      x: window.innerWidth / 2 - centerX * zoom,
      y: window.innerHeight / 2 - centerY * zoom,
    });
  }, [elements]);

  const handleResetZoom = useCallback(() => {
    setViewport((prev) => ({
      ...prev,
      zoom: 1.0,
    }));
  }, []);

  // Jump camera to collaborator's cursor
  const handleJumpToUser = useCallback((userId: string) => {
    const user = activeUsers[userId];
    if (user && user.cursor) {
      setViewport((prev) => ({
        ...prev,
        x: window.innerWidth / 2 - user.cursor!.x * prev.zoom,
        y: window.innerHeight / 2 - user.cursor!.y * prev.zoom,
      }));
    }
  }, [activeUsers]);

  // Count of unresolved comments across the canvas
  const unresolvedCommentsCount = useMemo(
    () => elements.filter((el) => el.type === "comment" && !el.commentResolved).length,
    [elements]
  );

  // Jump canvas camera to a comment and focus it
  const handleSelectComment = useCallback(
    (comment: BoardElement) => {
      const targetZoom = Math.max(0.75, Math.min(1.5, viewport.zoom));
      setViewport({
        zoom: targetZoom,
        x: window.innerWidth / 2 - (comment.x + (comment.width || 280) / 2) * targetZoom,
        y: window.innerHeight / 2 - (comment.y + (comment.height || 160) / 2) * targetZoom,
      });
      setSelectedIds([comment.id]);
      setShowCommentsDrawer(false);
    },
    [viewport.zoom, setViewport, setSelectedIds]
  );

  // Duplicate elements
  const handleDuplicate = useCallback(
    (toDuplicate: BoardElement[]) => {
      const idMap = new Map<string, string>();
      const offset = 30;

      // Ensure duplicated groups get their own fresh cohesive groupId
      const groupMap = new Map<string, string>();
      toDuplicate.forEach((el) => {
        if (el.groupId && !groupMap.has(el.groupId)) {
          groupMap.set(el.groupId, `group_${generateId()}`);
        }
      });

      const newElements: BoardElement[] = toDuplicate.map((el) => {
        const newId = generateId();
        idMap.set(el.id, newId);
        return {
          ...el,
          id: newId,
          groupId: el.groupId ? groupMap.get(el.groupId) : undefined,
          x: el.x + offset,
          y: el.y + offset,
          zIndex: (el.zIndex || 10) + 1,
        };
      });

      newElements.forEach((el) => createElement(el));
      setSelectedIds(newElements.map((el) => el.id));
    },
    [createElement]
  );

  // Group elements together
  const handleGroup = useCallback(
    (idsToGroup?: string[]) => {
      const targetIds = idsToGroup || selectedIds;
      if (targetIds.length < 2) return;
      const newGroupId = `group_${generateId()}`;
      const toGroup = elements.filter((el) => targetIds.includes(el.id));
      const updated = toGroup.map((el) => ({ ...el, groupId: newGroupId }));
      batchUpdateElements(updated);
      setSelectedIds(targetIds);
    },
    [selectedIds, elements, batchUpdateElements]
  );

  // Ungroup elements
  const handleUngroup = useCallback(
    (idsToUngroup?: string[]) => {
      const targetIds = idsToUngroup || selectedIds;
      if (targetIds.length === 0) return;
      const selectedGrouped = elements.filter(
        (el) => targetIds.includes(el.id) && el.groupId
      );
      if (selectedGrouped.length === 0) return;
      const targetGroupIds = new Set(selectedGrouped.map((el) => el.groupId!));
      const allMembers = elements.filter(
        (el) => el.groupId && targetGroupIds.has(el.groupId)
      );
      const updated = allMembers.map((el) => ({ ...el, groupId: undefined }));
      batchUpdateElements(updated);
    },
    [selectedIds, elements, batchUpdateElements]
  );

  // Add emoji reaction
  const handleAddReaction = useCallback(
    (elementId: string, emoji: string) => {
      const target = elements.find((el) => el.id === elementId);
      if (!target) return;
      const currentReactions = { ...(target.reactions || {}) };
      currentReactions[emoji] = (currentReactions[emoji] || 0) + 1;
      updateElement(elementId, { reactions: currentReactions });
    },
    [elements, updateElement]
  );

  // Convert Freehand Stroke to Vector Path
  const handleConvertToVector = useCallback(
    (elementId: string) => {
      const el = elements.find((e) => e.id === elementId);
      if (!el || (el.type !== "freehand" && el.type !== "draw")) return;
      const converted = convertFreehandToVectorPath(el);
      deleteElements([elementId]);
      createElement(converted);
      setSelectedIds([converted.id]);
      setActiveTool("vector-node");
      setShowVectorToolbar(true);
    },
    [elements, deleteElements, createElement]
  );

  // Convert Primitive Shape to Vector Path
  const handleConvertToPath = useCallback(
    (elementId: string) => {
      const el = elements.find((e) => e.id === elementId);
      if (!el || el.type !== "shape") return;
      const { nodes, closed } = shapeToVectorNodes(
        el.shapeType || "rect",
        el.x,
        el.y,
        el.width,
        el.height
      );
      const converted: BoardElement = {
        id: generateId("vec"),
        type: "vectorPath",
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        nodes,
        closed,
        vectorStyle: {
          fill: el.fillColor || null,
          stroke: el.strokeColor || "#0f172a",
          strokeWidth: el.strokeWidth || 2,
          strokeCap: "round",
          strokeJoin: "round",
          opacity: 1,
        },
        fillColor: el.fillColor || undefined,
        strokeColor: el.strokeColor || "#0f172a",
        strokeWidth: el.strokeWidth || 2,
        zIndex: el.zIndex || 15,
      };
      deleteElements([elementId]);
      createElement(converted);
      setSelectedIds([converted.id]);
      setActiveTool("vector-node");
      setShowVectorToolbar(true);
    },
    [elements, deleteElements, createElement]
  );

  // Perform Boolean Path Operation (Union, Subtract, Intersect, Exclude)
  const handleBooleanOperation = useCallback(
    (op: BooleanOperation) => {
      const selected = elements.filter((el) => selectedIds.includes(el.id) && el.type === "vectorPath");
      if (selected.length < 2) return;
      const result = performBooleanPathOperation(op, selected);
      if (result) {
        deleteElements(selected.map((s) => s.id));
        createElement(result);
        setSelectedIds([result.id]);
      }
    },
    [elements, selectedIds, deleteElements, createElement]
  );

  // Flatten / Rasterize Vector or Freehand Elements to Image
  const handleRasterize = useCallback(
    async (targetElements: BoardElement[]) => {
      if (targetElements.length === 0) return;
      const res = await rasterizeElementsToDataUrl(targetElements);
      if (!res) return;

      const imageEl: BoardElement = {
        id: generateId("img"),
        type: "image",
        x: res.x,
        y: res.y,
        width: res.width,
        height: res.height,
        imageUrl: res.dataUrl,
        title: "Flattened Vector/Drawing",
        zIndex: Math.max(...targetElements.map((e) => e.zIndex || 10), 10) + 1,
      };

      deleteElements(targetElements.map((e) => e.id));
      createElement(imageEl);
      setSelectedIds([imageEl.id]);
      setActiveTool("select");
    },
    [deleteElements, createElement]
  );

  // Apply template
  const handleApplyTemplate = useCallback(
    (templateElements: BoardElement[], mode: "replace" | "add") => {
      if (mode === "replace") {
        replaceBoard(templateElements);
      } else {
        templateElements.forEach((el) => createElement(el));
      }
      setTimeout(handleFitToScreen, 100);
    },
    [createElement, replaceBoard, handleFitToScreen]
  );

  // Export board as JSON
  const handleExportJson = useCallback(() => {
    const data = {
      title: boardTitle,
      version: 1,
      createdAt: new Date().toISOString(),
      elements,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${boardTitle.toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [boardTitle, elements]);

  // Import board from JSON
  const handleImportJson = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && Array.isArray(parsed.elements)) {
            replaceBoard(parsed.elements);
            if (parsed.title) setBoardTitle(parsed.title);
            setTimeout(handleFitToScreen, 150);
          }
        } catch (err) {
          console.error("Invalid JSON board file", err);
        }
      };
      reader.readAsText(file);
    },
    [replaceBoard, handleFitToScreen]
  );

  // Advanced Multi-Format Whiteboard Exporter
  const handleExportWithOptions = useCallback(
    (options: ExportOptions) => {
      let targetElements = elements;
      if (options.scope === "selected" && selectedElements.length > 0) {
        targetElements = selectedElements;
      } else if (options.scope === "viewport") {
        const vpBounds = {
          x: -viewport.x / viewport.zoom,
          y: -viewport.y / viewport.zoom,
          width: window.innerWidth / viewport.zoom,
          height: window.innerHeight / viewport.zoom,
        };
        targetElements = elements.filter(
          (el) =>
            !(
              el.x + el.width < vpBounds.x ||
              el.x > vpBounds.x + vpBounds.width ||
              el.y + el.height < vpBounds.y ||
              el.y > vpBounds.y + vpBounds.height
            )
        );
        if (targetElements.length === 0) targetElements = elements;
      }

      if (targetElements.length === 0) return;

      const filename = `${boardTitle.toLowerCase().replace(/\s+/g, "-") || "whiteboard"}-${Date.now()}`;

      // 1. JSON Board Archive
      if (options.format === "json") {
        const dataStr =
          "data:text/json;charset=utf-8," +
          encodeURIComponent(
            JSON.stringify(
              {
                version: 2,
                title: boardTitle,
                exportedAt: new Date().toISOString(),
                scope: options.scope,
                elements: targetElements,
              },
              null,
              2
            )
          );
        const a = document.createElement("a");
        a.href = dataStr;
        a.download = `${filename}.json`;
        a.click();
        return;
      }

      const bounds = computeSelectionBounds(targetElements);
      if (!bounds) return;

      const pad = 60;
      const baseW = Math.round(bounds.width + pad * 2);
      const baseH = Math.round(bounds.height + pad * 2);

      // 2. SVG Vector Export
      if (options.format === "svg") {
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${baseW} ${baseH}" width="${baseW}" height="${baseH}">\n`;
        if (!options.transparentBg) {
          svg += `  <rect width="100%" height="100%" fill="${isDarkMode ? "#0F172A" : "#F8FAFC"}"/>\n`;
        }
        targetElements.forEach((el) => {
          const rx = Math.round(el.x - bounds.x + pad);
          const ry = Math.round(el.y - bounds.y + pad);
          if (el.type === "sticky") {
            svg += `  <rect x="${rx}" y="${ry}" width="${el.width}" height="${el.height}" rx="8" fill="${el.color || "#fef08a"}" stroke="#cbd5e1" stroke-width="1"/>\n`;
            if (el.content) {
              svg += `  <text x="${rx + 12}" y="${ry + 24}" font-family="sans-serif" font-size="14" fill="#1e293b">${el.content.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>\n`;
            }
          } else if (el.type === "shape") {
            if (el.shapeType === "circle") {
              svg += `  <circle cx="${rx + el.width / 2}" cy="${ry + el.height / 2}" r="${Math.min(el.width, el.height) / 2}" fill="${el.fillColor || "#ffffff"}" stroke="${el.strokeColor || "#334155"}" stroke-width="${el.strokeWidth || 2}"/>\n`;
            } else {
              svg += `  <rect x="${rx}" y="${ry}" width="${el.width}" height="${el.height}" rx="6" fill="${el.fillColor || "#ffffff"}" stroke="${el.strokeColor || "#334155"}" stroke-width="${el.strokeWidth || 2}"/>\n`;
            }
            if (el.content) {
              svg += `  <text x="${rx + el.width / 2}" y="${ry + el.height / 2 + 5}" font-family="sans-serif" font-size="13" font-weight="bold" fill="${el.color || "#1e293b"}" text-anchor="middle">${el.content.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>\n`;
            }
          } else if (el.type === "text" && el.content) {
            svg += `  <text x="${rx}" y="${ry + 18}" font-family="sans-serif" font-size="${el.fontSize || 16}" fill="${el.color || "#1e293b"}">${el.content.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>\n`;
          } else if (el.type === "frame") {
            svg += `  <rect x="${rx}" y="${ry}" width="${el.width}" height="${el.height}" fill="${el.fillColor || "none"}" stroke="${el.strokeColor || "#94a3b8"}" stroke-width="2" stroke-dasharray="6,6"/>\n`;
            svg += `  <text x="${rx + 10}" y="${ry - 8}" font-family="sans-serif" font-size="12" font-weight="bold" fill="#64748b">${(el.title || "Frame").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>\n`;
          } else if ((el.type === "freehand" || el.type === "draw") && (el.strokePoints || el.points)) {
            const pts = el.strokePoints || el.points || [];
            if (pts.length > 1) {
              const d = pts.reduce((acc, p, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${rx + (p.x - el.x)} ${ry + (p.y - el.y)}`, "");
              svg += `  <path d="${d}" fill="none" stroke="${el.strokeColor || el.color || "#3b82f6"}" stroke-width="${el.strokeWidth || 3}" stroke-linecap="round" stroke-linejoin="round"/>\n`;
            }
          }
        });
        svg += `</svg>`;
        const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.svg`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      // 3. High-Resolution PNG Export
      const scale = options.scale || 2;
      const canvas = document.createElement("canvas");
      canvas.width = baseW * scale;
      canvas.height = baseH * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.scale(scale, scale);

      if (!options.transparentBg) {
        ctx.fillStyle = isDarkMode ? "#0f172a" : "#f8fafc";
        ctx.fillRect(0, 0, baseW, baseH);

        // Dot grid
        ctx.fillStyle = isDarkMode ? "#334155" : "#e2e8f0";
        for (let x = 0; x < baseW; x += 24) {
          for (let y = 0; y < baseH; y += 24) {
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      targetElements.forEach((el) => {
        const rx = el.x - bounds.x + pad;
        const ry = el.y - bounds.y + pad;

        if (el.type === "frame") {
          ctx.strokeStyle = el.strokeColor || "#94a3b8";
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.fillStyle = el.fillColor || "#ffffff";
          ctx.fillRect(rx, ry, el.width, el.height);
          ctx.strokeRect(rx, ry, el.width, el.height);
          ctx.setLineDash([]);
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(rx, ry - 24, 160, 24);
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 11px sans-serif";
          ctx.fillText(el.title || "Frame", rx + 8, ry - 8);
        } else if (el.type === "sticky") {
          ctx.fillStyle = el.color || "#fef08a";
          ctx.shadowColor = "rgba(0,0,0,0.1)";
          ctx.shadowBlur = 8;
          ctx.shadowOffsetY = 4;
          ctx.beginPath();
          ctx.roundRect(rx, ry, el.width, el.height, 8);
          ctx.fill();
          ctx.shadowColor = "transparent";

          ctx.fillStyle = "#1e293b";
          ctx.font = "500 13px sans-serif";
          const lines = (el.content || "").split("\n");
          let lineY = ry + 24;
          lines.forEach((line) => {
            ctx.fillText(line, rx + 12, lineY);
            lineY += 18;
          });
        } else if (el.type === "shape") {
          ctx.fillStyle = el.fillColor || "#ffffff";
          ctx.strokeStyle = el.strokeColor || "#334155";
          ctx.lineWidth = el.strokeWidth || 2;
          ctx.beginPath();
          if (el.shapeType === "circle") {
            ctx.ellipse(rx + el.width / 2, ry + el.height / 2, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
          } else {
            ctx.roundRect(rx, ry, el.width, el.height, 8);
          }
          ctx.fill();
          ctx.stroke();

          if (el.content) {
            ctx.fillStyle = el.color || "#1e293b";
            ctx.font = "bold 13px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(el.content, rx + el.width / 2, ry + el.height / 2 + 5);
            ctx.textAlign = "left";
          }
        } else if (el.type === "text" && el.content) {
          ctx.fillStyle = el.color || (isDarkMode ? "#f8fafc" : "#1e293b");
          ctx.font = `${el.fontSize || 16}px sans-serif`;
          ctx.fillText(el.content, rx, ry + (el.fontSize || 16));
        } else if ((el.type === "freehand" || el.type === "draw") && (el.strokePoints || el.points)) {
          const pts = el.strokePoints || el.points || [];
          if (pts.length > 1) {
            ctx.strokeStyle = el.strokeColor || el.color || "#3b82f6";
            ctx.lineWidth = el.strokeWidth || 3;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            pts.forEach((p, idx) => {
              const px = rx + (p.x - el.x);
              const py = ry + (p.y - el.y);
              if (idx === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            });
            ctx.stroke();
          }
        }
      });

      const a = document.createElement("a");
      a.download = `${filename}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    },
    [elements, selectedElements, viewport, boardTitle, isDarkMode]
  );

  // Export board as PNG image
  const handleExportPng = useCallback(() => {
    handleExportWithOptions({
      format: "png",
      scale: 2,
      scope: "all",
      transparentBg: false,
    });
  }, [handleExportWithOptions]);

  // Export board as SVG vector
  const handleExportSvg = useCallback(() => {
    handleExportWithOptions({
      format: "svg",
      scale: 1,
      scope: "all",
      transparentBg: false,
    });
  }, [handleExportWithOptions]);

  // Object Alignment
  const handleAlign = useCallback((dir: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
    if (selectedElements.length < 2) return;
    const bounds = computeSelectionBounds(selectedElements);
    if (!bounds) return;

    const updated = selectedElements.map((el) => {
      let newX = el.x;
      let newY = el.y;
      if (dir === "left") newX = bounds.x;
      else if (dir === "center") newX = bounds.x + (bounds.width - el.width) / 2;
      else if (dir === "right") newX = bounds.x + bounds.width - el.width;
      else if (dir === "top") newY = bounds.y;
      else if (dir === "middle") newY = bounds.y + (bounds.height - el.height) / 2;
      else if (dir === "bottom") newY = bounds.y + bounds.height - el.height;
      return { ...el, x: newX, y: newY };
    });
    batchUpdateElements(updated);
  }, [selectedElements, batchUpdateElements]);

  // Object Distribution
  const handleDistribute = useCallback((axis: "horizontal" | "vertical") => {
    if (selectedElements.length < 3) return;
    const sorted = [...selectedElements].sort((a, b) => axis === "horizontal" ? a.x - b.x : a.y - b.y);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    if (axis === "horizontal") {
      const totalSpan = (last.x + last.width) - first.x;
      const totalElementsWidth = sorted.reduce((sum, el) => sum + el.width, 0);
      const gap = (totalSpan - totalElementsWidth) / (sorted.length - 1);
      let curX = first.x;
      const updated = sorted.map((el) => {
        const res = { ...el, x: curX };
        curX += el.width + gap;
        return res;
      });
      batchUpdateElements(updated);
    } else {
      const totalSpan = (last.y + last.height) - first.y;
      const totalElementsHeight = sorted.reduce((sum, el) => sum + el.height, 0);
      const gap = (totalSpan - totalElementsHeight) / (sorted.length - 1);
      let curY = first.y;
      const updated = sorted.map((el) => {
        const res = { ...el, y: curY };
        curY += el.height + gap;
        return res;
      });
      batchUpdateElements(updated);
    }
  }, [selectedElements, batchUpdateElements]);

  // Layer ordering
  const handleBringToFront = useCallback(() => {
    if (selectedElements.length === 0) return;
    const maxZ = Math.max(...elements.map((e) => e.zIndex || 1), 1);
    const updated = selectedElements.map((el, i) => ({ ...el, zIndex: maxZ + 1 + i }));
    batchUpdateElements(updated);
  }, [selectedElements, elements, batchUpdateElements]);

  const handleSendToBack = useCallback(() => {
    if (selectedElements.length === 0) return;
    const minZ = Math.min(...elements.map((e) => e.zIndex || 1), 1);
    const updated = selectedElements.map((el, i) => ({ ...el, zIndex: Math.max(1, minZ - selectedElements.length + i) }));
    batchUpdateElements(updated);
  }, [selectedElements, elements, batchUpdateElements]);

  const handleBringForward = useCallback(() => {
    if (selectedElements.length === 0) return;
    const updated = selectedElements.map((el) => ({ ...el, zIndex: (el.zIndex || 1) + 1 }));
    batchUpdateElements(updated);
  }, [selectedElements, batchUpdateElements]);

  const handleSendBackward = useCallback(() => {
    if (selectedElements.length === 0) return;
    const updated = selectedElements.map((el) => ({ ...el, zIndex: Math.max(1, (el.zIndex || 1) - 1) }));
    batchUpdateElements(updated);
  }, [selectedElements, batchUpdateElements]);

  const handleLockSelected = useCallback(() => {
    if (selectedElements.length === 0) return;
    const anyUnlocked = selectedElements.some((e) => !e.locked);
    const updated = selectedElements.map((el) => ({ ...el, locked: anyUnlocked }));
    batchUpdateElements(updated);
  }, [selectedElements, batchUpdateElements]);

  const handleInsertTool = useCallback((tool: ToolType, shapeType?: ShapeType) => {
    setActiveTool(tool);
    if (shapeType) setSelectedShapeType(shapeType);
    if (tool === "draw" || tool === "eraser") {
      setRailMode("draw");
    } else if (tool.startsWith("vector")) {
      setRailMode("vector");
    } else {
      setRailMode("select");
    }
  }, []);

  // Reset board
  const handleResetBoard = useCallback(() => {
    if (window.confirm("Are you sure you want to reset the whiteboard to default state?")) {
      fetch("/api/board/reset", { method: "POST" })
        .then((res) => res.json())
        .then(() => {
          window.location.reload();
        })
        .catch(() => {});
    }
  }, []);

  // Frame slides for presentation mode
  const frames = elements.filter((el) => el.type === "frame");

  const handleSelectSlide = useCallback(
    (index: number) => {
      setCurrentSlideIndex(index);
      const frame = frames[index];
      if (frame) {
        const padding = 100;
        const availW = window.innerWidth - padding * 2;
        const availH = window.innerHeight - padding * 2;
        const zoom = Math.max(0.2, Math.min(1.4, Math.min(availW / frame.width, availH / frame.height)));
        const centerX = frame.x + frame.width / 2;
        const centerY = frame.y + frame.height / 2;
        setViewport({
          zoom,
          x: window.innerWidth / 2 - centerX * zoom,
          y: window.innerHeight / 2 - centerY * zoom,
        });
        setSelectedIds([frame.id]);
      }
    },
    [frames]
  );

  // Sync presentation slide navigation when broadcast by remote presenter
  useEffect(() => {
    if (syncedSlideIndex !== null && syncedSlideIndex !== currentSlideIndex) {
      handleSelectSlide(syncedSlideIndex);
    }
  }, [syncedSlideIndex, currentSlideIndex, handleSelectSlide]);

  // AI Assistant action applicator
  const handleApplyAiResult = useCallback(
    (action: string, result: any) => {
      if (!result) return;
      const originX = Math.round(viewport.x > 0 ? (window.innerWidth / 2 - viewport.x) / viewport.zoom : 200);
      const originY = Math.round(viewport.y > 0 ? (window.innerHeight / 2 - viewport.y) / viewport.zoom : 200);
      const maxZ = elements.length > 0 ? Math.max(...elements.map((el) => el.zIndex)) : 0;
      let nextZ = maxZ + 1;

      if (action === "summarize") {
        const title = result.title || "AI Board Summary";
        const summaryText = result.summary || "";
        const bullets: string[] = Array.isArray(result.bullets) ? result.bullets : [];
        const rawHtml = `
          <div style="font-family: inherit; padding: 6px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #6366f1; letter-spacing: 0.05em; margin-bottom: 4px;">Executive Summary</div>
            <h3 style="font-size: 15px; font-weight: 700; color: #1e293b; margin: 0 0 8px 0;">${title}</h3>
            <p style="font-size: 12px; color: #475569; line-height: 1.5; margin: 0 0 10px 0;">${summaryText}</p>
            <div style="font-size: 11px; font-weight: 600; color: #334155; margin-bottom: 4px;">Key Insights:</div>
            <ul style="padding-left: 18px; margin: 0; font-size: 12px; color: #475569; line-height: 1.6;">
              ${bullets.map((b) => `<li>${b}</li>`).join("")}
            </ul>
          </div>
        `;
        const summaryCard: BoardElement = {
          id: generateId("card"),
          type: "html",
          x: originX,
          y: originY,
          width: 440,
          height: 320,
          title,
          zIndex: nextZ++,
          content: DOMPurify.sanitize(rawHtml, { ADD_ATTR: ["style"], ADD_TAGS: ["style"] }),
          rawHtml,
          htmlState: "live",
        };
        createElement(summaryCard);
        setSelectedIds([summaryCard.id]);
      } else if (action === "cluster" && Array.isArray(result.clusters)) {
        const createdIds: string[] = [];
        result.clusters.forEach((cluster: any, cIdx: number) => {
          const frameX = originX + cIdx * 320;
          const frameY = originY;
          const frameWidth = 290;
          const items: string[] = Array.isArray(cluster.items) ? cluster.items : [];
          const frameHeight = Math.max(260, 80 + items.length * 90);

          const frameEl: BoardElement = {
            id: generateId("frame"),
            type: "frame",
            title: cluster.name || `Cluster ${cIdx + 1}`,
            x: frameX,
            y: frameY,
            width: frameWidth,
            height: frameHeight,
            fillColor: isDarkMode ? "#1e293b" : "#f8fafc",
            strokeColor: cluster.color || "#3b82f6",
            strokeWidth: 2,
            zIndex: nextZ++,
          };
          createElement(frameEl);
          createdIds.push(frameEl.id);

          items.forEach((itemText: string, iIdx: number) => {
            const stickyEl: BoardElement = {
              id: generateId("note"),
              type: "sticky",
              content: itemText,
              x: frameX + 20,
              y: frameY + 50 + iIdx * 85,
              width: 250,
              height: 75,
              color: cluster.color || "#fef08a",
              zIndex: nextZ++,
              authorName: "AI Clustered",
            };
            createElement(stickyEl);
            createdIds.push(stickyEl.id);
          });
        });
        setSelectedIds(createdIds);
      } else if (action === "flowchart" && Array.isArray(result.steps)) {
        const stepIds: string[] = [];
        result.steps.forEach((step: any, idx: number) => {
          const sId = generateId("shape");
          stepIds.push(sId);
          const x = originX + idx * 210;
          const y = originY + (idx % 2 === 0 ? 0 : 30);

          const shapeEl: BoardElement = {
            id: sId,
            type: "shape",
            shapeType: step.shape || "rounded-rect",
            x,
            y,
            width: 160,
            height: 80,
            content: step.label || `Step ${idx + 1}`,
            fillColor: isDarkMode ? "#1e293b" : "#ffffff",
            strokeColor: "#3b82f6",
            strokeWidth: 2,
            zIndex: nextZ++,
          };
          createElement(shapeEl);

          if (idx > 0) {
            const prevId = stepIds[idx - 1];
            const connEl: BoardElement = {
              id: generateId("conn"),
              type: "connector",
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              strokeColor: isDarkMode ? "#94a3b8" : "#64748b",
              strokeWidth: 2,
              arrowEnd: true,
              lineStyle: "orthogonal",
              startBinding: { elementId: prevId, anchor: "right" },
              endBinding: { elementId: sId, anchor: "left" },
              zIndex: nextZ++,
            };
            createElement(connEl);
          }
        });
        setSelectedIds(stepIds);
      } else if (action === "action_items" && Array.isArray(result.tasks)) {
        const createdIds: string[] = [];
        result.tasks.forEach((task: any, idx: number) => {
          const stickyEl: BoardElement = {
            id: generateId("note"),
            type: "sticky",
            content: `[ ] ${task.title || "Action Item"}\nPriority: ${task.priority || "Normal"}`,
            x: originX + (idx % 3) * 200,
            y: originY + Math.floor(idx / 3) * 150,
            width: 180,
            height: 130,
            color: task.priority === "High" ? "#fed7aa" : "#bbf7d0",
            zIndex: nextZ++,
            authorName: "AI Action Items",
          };
          createElement(stickyEl);
          createdIds.push(stickyEl.id);
        });
        setSelectedIds(createdIds);
      } else if (action === "generate_notes" && Array.isArray(result.notes)) {
        const createdIds: string[] = [];
        const colors = ["#fef08a", "#bae6fd", "#bbf7d0", "#fbcfe8", "#fed7aa"];
        result.notes.forEach((noteText: string, idx: number) => {
          const stickyEl: BoardElement = {
            id: generateId("note"),
            type: "sticky",
            content: noteText,
            x: originX + (idx % 3) * 210,
            y: originY + Math.floor(idx / 3) * 190,
            width: 190,
            height: 170,
            color: colors[idx % colors.length],
            zIndex: nextZ++,
            authorName: "AI Brainstorm",
          };
          createElement(stickyEl);
          createdIds.push(stickyEl.id);
        });
        setSelectedIds(createdIds);
      }
    },
    [viewport, elements, createElement, setSelectedIds, isDarkMode]
  );

  return (
    <div
      className="w-screen h-screen overflow-hidden relative transition-colors duration-200"
      style={{
        backgroundColor: isDarkMode ? THEME.canvas : "#F2EFE7",
        color: isDarkMode ? THEME.primaryText : "#121A1F",
      }}
    >
      {/* Clean Board Mode Floating Indicator */}
      {isCleanBoardMode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[250] flex items-center gap-2.5 px-4 py-1.5 rounded-full backdrop-blur-md border shadow-xl bg-[#17191C]/95 text-[#F5F5F5] border-[#292C30] text-xs select-none pointer-events-auto animate-in fade-in slide-in-from-top-2">
          <span className="w-2 h-2 rounded-full bg-[#39E58C]" />
          <span className="font-semibold tracking-wide">Clean Board Mode</span>
          <span className="opacity-40">•</span>
          <span className="text-[#8B929C]">
            Press <kbd className="font-mono bg-[#202327] px-1.5 py-0.5 rounded text-[11px] border border-[#292C30] text-[#F5F5F5]">Tab</kbd> to restore UI
          </span>
          <button
            onClick={() => setIsCleanBoardMode(false)}
            className="ml-1 p-1 rounded-full hover:bg-[#202327] text-[#8B929C] hover:text-[#F5F5F5] transition-colors cursor-pointer"
            title="Exit Clean Board Mode"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Top Main Navigation Header */}
      {!isCleanBoardMode && (
        <Header
          boardId={boardId}
          boardTitle={boardTitle}
          setBoardTitle={setBoardTitle}
          boardsList={boardsList}
          onSelectBoard={(targetId) => switchBoard(targetId)}
          onNewBoard={() => createBoard()}
          onDeleteBoard={(targetId) => deleteBoard(targetId)}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          activeUsers={activeUsers}
          currentUser={currentUser}
          onJumpToUser={handleJumpToUser}
          connectionStatus={connectionStatus}
          onExportPng={handleExportPng}
          onExportJson={handleExportJson}
          onImportJson={handleImportJson}
          onResetBoard={handleResetBoard}
          onOpenShortcuts={() => setShowShortcutsModal(true)}
          onOpenTemplates={() => setShowTemplatesModal(true)}
          isTilted3D={isTilted3D}
          onToggleTilt3D={handleToggleTilt3D}
          viewMode={viewMode}
          onSelectViewMode={(mode) => setViewMode(mode)}
          onOpenHistory={() => setShowHistoryDrawer(true)}
          onOpenComments={() => setShowCommentsDrawer((prev) => !prev)}
          unresolvedCommentsCount={unresolvedCommentsCount}
          onOpenAiAssistant={handleOpenPrimaryAI}
          onOpenHtmlUpload={() => setShowHtmlUploadModal(true)}
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
          onOpenSearch={() => setShowSearchModal(true)}
          onTogglePropertiesPanel={() => setIsPropertiesPanelOpen((prev) => !prev)}
          isPropertiesPanelOpen={isPropertiesPanelOpen}
          followingUserId={followingUserId}
          onFollowUser={(id) => setFollowingUserId(id)}
          showPeerCursors={showPeerCursors}
          onToggleShowPeerCursors={() => setShowPeerCursors((prev) => !prev)}
          onOpenSettings={() => {
            setSettingsInitialTab("general");
            setShowSettingsModal(true);
          }}
          selectedElements={selectedElements}
          onSelectAll={() => setSelectedIds(elements.map((e) => e.id))}
          onDeleteSelected={() => deleteElements(selectedIds)}
          onDuplicateSelected={() => handleDuplicate(selectedElements)}
          onGroupSelected={handleGroup}
          onUngroupSelected={handleUngroup}
          onLockSelected={handleLockSelected}
          onBringToFront={handleBringToFront}
          onSendToBack={handleSendToBack}
          onBringForward={handleBringForward}
          onSendBackward={handleSendBackward}
          onAlign={handleAlign}
          onDistribute={handleDistribute}
          onInsertTool={handleInsertTool}
          gridEnabled={gridEnabled}
          onToggleGrid={() => setGridEnabled((prev) => !prev)}
          snapEnabled={snapEnabled}
          onToggleSnap={() => setSnapEnabled((prev) => !prev)}
          guidesEnabled={guidesEnabled}
          onToggleGuides={() => setGuidesEnabled((prev) => !prev)}
          showMinimap={showMinimap}
          onToggleMinimap={() => setShowMinimap((prev) => !prev)}
          onZoomIn={() => setViewport((prev) => ({ ...prev, zoom: Math.min(5, prev.zoom * 1.2) }))}
          onZoomOut={() => setViewport((prev) => ({ ...prev, zoom: Math.max(0.1, prev.zoom / 1.2) }))}
          onResetZoom={handleResetZoom}
          onFitBoard={handleFitToScreen}
          isCleanBoardMode={isCleanBoardMode}
          onToggleCleanBoard={() => setIsCleanBoardMode((prev) => !prev)}
          onExportSvg={handleExportSvg}
          onOpenExportModal={() => setShowExportModal(true)}
          onConvertToVector={() => {
            if (selectedElements.length > 0) handleConvertToVector(selectedElements[0].id);
          }}
          onRasterize={() => handleRasterize(selectedElements)}
          onApplyAiResult={handleApplyAiResult}
        />
      )}

      {/* Undo Conflict Notification Banner */}
      {conflictNotice && (
        <div
          id="undo-conflict-notice"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-[250] flex items-center gap-3 px-4 py-3 rounded-lg border shadow-xl backdrop-blur-md bg-[#17191C]/95 text-[#F5F5F5] border-amber-500/50 max-w-xl transition-all"
        >
          <div className="p-1.5 rounded-full bg-amber-500/20 text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Undo Conflict Detected
            </div>
            <div className="text-sm text-stone-300 truncate mt-0.5">
              {conflictNotice.message}
            </div>
          </div>
          {conflictNotice.conflictingElements && conflictNotice.conflictingElements.length > 0 && (
            <button
              id="jump-to-conflicting-element-btn"
              onClick={() => {
                const ids = conflictNotice.conflictingElements.map((e) => e.id);
                setSelectedIds(ids);
                const target = elements.find((e) => ids.includes(e.id));
                if (target) {
                  setViewport((prev) => ({
                    ...prev,
                    x: window.innerWidth / 2 - (target.x + target.width / 2) * prev.zoom,
                    y: window.innerHeight / 2 - (target.y + target.height / 2) * prev.zoom,
                  }));
                }
              }}
              className="text-xs font-medium px-2.5 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors shrink-0"
            >
              Focus Object
            </button>
          )}
          <button
            id="dismiss-conflict-notice-btn"
            onClick={clearConflictNotice}
            className="p-1 rounded text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Left Floating Tool Palette */}
      {!isCleanBoardMode && (
        <Toolbar
          railMode={railMode}
          setRailMode={setRailMode}
          activeTool={activeTool}
          setActiveTool={(tool) => {
            setActiveTool(tool);
            if (tool === "draw" || tool === "eraser") {
              setRailMode("draw");
            } else if (tool.startsWith("vector")) {
              setRailMode("vector");
            } else {
              setRailMode("select");
            }
          }}
          selectedShapeType={selectedShapeType}
          setSelectedShapeType={setSelectedShapeType}
          selectedStickyColor={selectedStickyColor}
          setSelectedStickyColor={setSelectedStickyColor}
          onOpenTemplates={() => setShowTemplatesModal(true)}
          onOpenHtmlUpload={() => setShowHtmlUploadModal(true)}
          onOpenAiAssistant={handleOpenPrimaryAI}
          onOpenHistory={() => setShowHistoryDrawer(true)}
          onOpenComments={() => setShowCommentsDrawer((prev) => !prev)}
          unresolvedCommentsCount={unresolvedCommentsCount}
          onSendReactionBurst={sendReactionBurst}
          brush={brush}
          setBrush={setBrush}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          brushOpacity={brushOpacity}
          setBrushOpacity={setBrushOpacity}
          brushSmooth={brushSmooth}
          setBrushSmooth={setBrushSmooth}
          brushColor={brushColor}
          setBrushColor={setBrushColor}
          brushPressure={brushPressure}
          setBrushPressure={setBrushPressure}
          brushStabilize={brushStabilize}
          setBrushStabilize={setBrushStabilize}
          vectorFillColor={vectorFillColor}
          setVectorFillColor={setVectorFillColor}
          vectorStrokeColor={vectorStrokeColor}
          setVectorStrokeColor={setVectorStrokeColor}
          vectorStrokeWidth={vectorStrokeWidth}
          setVectorStrokeWidth={setVectorStrokeWidth}
          vectorStrokeCap={vectorStrokeCap}
          setVectorStrokeCap={setVectorStrokeCap}
          vectorStrokeJoin={vectorStrokeJoin}
          setVectorStrokeJoin={setVectorStrokeJoin}
          onBooleanOp={handleBooleanOperation}
          onConvertToPath={() => {
            if (selectedElements.length === 1 && selectedElements[0].type === "shape") {
              handleConvertToPath(selectedElements[0].id);
            }
          }}
          canConvertToPath={selectedElements.length === 1 && selectedElements[0].type === "shape"}
          canPerformBoolean={selectedElements.filter((el) => el.type === "vectorPath").length >= 2}
          onToggleDrawingToolbar={() => setShowDrawingToolbar((prev) => !prev)}
          onToggleVectorToolbar={() => setShowVectorToolbar((prev) => !prev)}
          showDrawingToolbar={showDrawingToolbar}
          showVectorToolbar={showVectorToolbar}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Floating Property Bar above selected element(s) */}
      {!isCleanBoardMode && (
        <PropertyBar
          selectedElements={selectedElements}
          viewport={viewport}
          onUpdate={updateElement}
          onBatchUpdate={batchUpdateElements}
          onDelete={deleteElements}
          onDuplicate={handleDuplicate}
          onAddReaction={handleAddReaction}
          onGroup={handleGroup}
          onUngroup={handleUngroup}
          onConvertToVector={handleConvertToVector}
          onConvertToPath={handleConvertToPath}
          onEditNodes={(id) => {
            setSelectedIds([id]);
            setActiveTool("vector-node");
            setRailMode("vector");
          }}
          onRasterize={handleRasterize}
          onEditHtml={(id) => {
            setEditingId(id);
            setShowHtmlUploadModal(true);
          }}
          onTogglePropertiesPanel={() => setIsPropertiesPanelOpen((prev) => !prev)}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Drawing Mode Floating Toolbar */}
      {!isCleanBoardMode && showDrawingToolbar && (
        <DrawingToolbar
          brush={brush}
          setBrush={setBrush}
          size={brushSize}
          setSize={setBrushSize}
          opacity={brushOpacity}
          setOpacity={setBrushOpacity}
          smooth={brushSmooth}
          setSmooth={setBrushSmooth}
          color={brushColor}
          setColor={setBrushColor}
          pressure={brushPressure}
          setPressure={setBrushPressure}
          stabilize={brushStabilize}
          setStabilize={setBrushStabilize}
          onClose={() => setShowDrawingToolbar(false)}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Vector Mode Floating Toolbar */}
      {!isCleanBoardMode && showVectorToolbar && (
        <VectorToolbar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          fillColor={vectorFillColor}
          setFillColor={setVectorFillColor}
          strokeColor={vectorStrokeColor}
          setStrokeColor={setVectorStrokeColor}
          strokeWidth={vectorStrokeWidth}
          setStrokeWidth={setVectorStrokeWidth}
          strokeCap={vectorStrokeCap}
          setStrokeCap={setVectorStrokeCap}
          strokeJoin={vectorStrokeJoin}
          setStrokeJoin={setVectorStrokeJoin}
          onBooleanOp={handleBooleanOperation}
          onConvertToPath={() => {
            if (selectedElements.length === 1 && selectedElements[0].type === "shape") {
              handleConvertToPath(selectedElements[0].id);
            }
          }}
          canConvertToPath={selectedElements.length === 1 && selectedElements[0].type === "shape"}
          canPerformBoolean={selectedElements.filter((el) => el.type === "vectorPath").length >= 2}
          onClose={() => setShowVectorToolbar(false)}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Infinite Canvas Engine */}
      <Canvas
        elements={elements}
        viewport={viewport}
        setViewport={setViewport}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        selectedShapeType={selectedShapeType}
        selectedStickyColor={selectedStickyColor}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        editingId={editingId}
        setEditingId={setEditingId}
        onCreateElement={createElement}
        onUpdateElement={updateElement}
        onBatchUpdateElements={batchUpdateElements}
        onCommitOperation={recordCustomOperation}
        onDeleteElements={deleteElements}
        onDuplicateElements={handleDuplicate}
        onGroupElements={handleGroup}
        onUngroupElements={handleUngroup}
        onSendCursor={sendCursor}
        activeUsers={activeUsers}
        currentUser={currentUser}
        onAddReaction={handleAddReaction}
        isTilted3D={isTilted3D}
        setIsTilted3D={handleToggleTilt3D}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenUploadModal={() => setShowHtmlUploadModal(true)}
        isDarkMode={isDarkMode}
        gridEnabled={gridEnabled}
        snapEnabled={snapEnabled}
        guidesEnabled={guidesEnabled}
        brush={brush}
        setBrush={setBrush}
        brushSize={brushSize}
        setBrushSize={setBrushSize}
        brushOpacity={brushOpacity}
        brushSmooth={brushSmooth}
        brushColor={brushColor}
        setBrushColor={setBrushColor}
        brushPressure={brushPressure}
        brushStabilize={brushStabilize}
        vectorFillColor={vectorFillColor}
        vectorStrokeColor={vectorStrokeColor}
        setVectorStrokeColor={setVectorStrokeColor}
        vectorStrokeWidth={vectorStrokeWidth}
        vectorStrokeCap={vectorStrokeCap}
        vectorStrokeJoin={vectorStrokeJoin}
        onUndo={undo}
        onRedo={redo}
        onOpenShortcuts={() => setShowShortcutsModal(true)}
        onToggleCleanBoard={() => setIsCleanBoardMode((prev) => !prev)}
        isCleanBoardMode={isCleanBoardMode}
        onConvertToVector={handleConvertToVector}
        onConvertToPath={handleConvertToPath}
        onRasterize={handleRasterize}
        followingUserId={followingUserId}
        setFollowingUserId={setFollowingUserId}
        showPeerCursors={showPeerCursors}
        onOpenSearch={() => setShowSearchModal(true)}
        onOpenExportModal={() => setShowExportModal(true)}
        peerLaserPoints={peerLaserPoints}
        onSendLaserPoint={sendLaserPoint}
        activeReactions={activeReactions}
        onSendReactionBurst={sendReactionBurst}
      />

      {/* Presentation Mode Slide Navigation Bar */}
      {viewMode === "presentation" && (
        <PresentationBar
          frames={frames}
          currentSlideIndex={currentSlideIndex}
          onSelectSlide={handleSelectSlide}
          onExitPresentation={() => setViewMode("flat")}
          isDarkMode={isDarkMode}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          onBroadcastSlide={sendPresentationSlide}
        />
      )}

      {/* Bottom Right Minimap & Zoom Controls */}
      {!isCleanBoardMode && showMinimap && (
        <Minimap
          elements={elements}
          viewport={viewport}
          setViewport={setViewport}
          onFitToScreen={handleFitToScreen}
          onResetZoom={handleResetZoom}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Bottom Status Bar */}
      {!isCleanBoardMode && (
        <StatusBar
          viewport={viewport}
          setViewport={setViewport}
          elements={elements}
          selectedElements={selectedElements}
          activeTool={activeTool}
          gridEnabled={gridEnabled}
          setGridEnabled={setGridEnabled}
          snapEnabled={snapEnabled}
          setSnapEnabled={setSnapEnabled}
          guidesEnabled={guidesEnabled}
          setGuidesEnabled={setGuidesEnabled}
          showMinimap={showMinimap}
          setShowMinimap={setShowMinimap}
          viewMode={viewMode}
          setViewMode={setViewMode}
          connectionStatus={connectionStatus}
          activeUsersCount={Object.keys(activeUsers).length + 1}
          onFitToScreen={handleFitToScreen}
          onResetZoom={handleResetZoom}
          onToggleShortcuts={() => setShowShortcutsModal(true)}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Precision Properties Inspector Panel (Right Sidebar) */}
      {!isCleanBoardMode && isPropertiesPanelOpen && (
        <PropertiesPanel
          selectedElements={selectedElements}
          elements={elements}
          viewport={viewport}
          setViewport={setViewport}
          onUpdateElement={updateElement}
          onBatchUpdateElements={batchUpdateElements}
          onDeleteElements={deleteElements}
          onDuplicateElements={handleDuplicate}
          onGroupElements={handleGroup}
          onUngroupElements={handleUngroup}
          onConvertToVector={handleConvertToVector}
          onConvertToPath={handleConvertToPath}
          onEditNodes={(id) => {
            setSelectedIds([id]);
            setActiveTool("vector-node");
            setShowVectorToolbar(true);
          }}
          onRasterize={handleRasterize}
          setSelectedIds={setSelectedIds}
          isOpen={isPropertiesPanelOpen}
          onClose={() => setIsPropertiesPanelOpen(false)}
          isDarkMode={isDarkMode}
          isPerspectiveActive={isTilted3D}
        />
      )}

      {/* Board Object Search Modal (Ctrl/Cmd + K) */}
      <BoardSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        elements={elements}
        setViewport={setViewport}
        setSelectedIds={setSelectedIds}
        isDarkMode={isDarkMode}
      />

      {/* Templates Hub Modal */}
      <TemplatesModal
        isOpen={showTemplatesModal}
        onClose={() => setShowTemplatesModal(false)}
        onApplyTemplate={handleApplyTemplate}
        isDarkMode={isDarkMode}
      />

      {/* Keyboard Shortcuts Reference */}
      <ShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
        isDarkMode={isDarkMode}
      />

      {/* History & Activity Log Drawer */}
      <HistoryDrawer
        isOpen={showHistoryDrawer}
        onClose={() => setShowHistoryDrawer(false)}
        history={activityHistory}
        onUndoMyAction={undo}
        onUndoBoardAction={undo}
        isDarkMode={isDarkMode}
      />

      {/* Collaborative Comments & Discussion Threads Drawer */}
      <CommentsDrawer
        isOpen={showCommentsDrawer}
        onClose={() => setShowCommentsDrawer(false)}
        elements={elements}
        onSelectComment={handleSelectComment}
        onUpdateElement={updateElement}
        onDeleteElement={(id) => deleteElements([id])}
        onActivateCommentTool={() => {
          setActiveTool("comment");
          setShowCommentsDrawer(false);
        }}
        isDarkMode={isDarkMode}
      />

      {/* AI Assistant Modal */}
      <AiAssistantModal
        isOpen={showAiAssistantModal}
        onClose={() => setShowAiAssistantModal(false)}
        selectedElements={selectedElements}
        onApplyAiResult={handleApplyAiResult}
        isDarkMode={isDarkMode}
      />

      {/* HTML Upload and Markup Modal */}
      <HtmlUploadModal
        isOpen={showHtmlUploadModal}
        onClose={() => setShowHtmlUploadModal(false)}
        onInsertHtml={handleInsertHtmlCard}
        isDarkMode={isDarkMode}
      />

      {/* Advanced Board Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        elements={elements}
        selectedIds={selectedIds}
        viewport={viewport}
        onExport={handleExportWithOptions}
        boardTitle={boardTitle}
        isDarkMode={isDarkMode}
      />

      {/* Foundry Settings & System Center Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        initialTab={settingsInitialTab}
      />
    </div>
  );

}
