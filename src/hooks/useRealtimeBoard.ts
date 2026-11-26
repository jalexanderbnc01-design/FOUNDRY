import { useState, useEffect, useRef, useCallback } from "react";
import {
  BoardElement,
  Point,
  UserPresence,
  ActivityLogItem,
  BoardOperation,
  BoardMetadata,
  LaserPoint,
  ReactionBurst,
  CreateElementOp,
  UpdateElementOp,
  DeleteElementOp,
  BatchCreateOp,
  BatchUpdateOp,
  BatchDeleteOp,
} from "../types";
import {
  createOperationId,
  createTransactionId,
  generateInverseOperation,
} from "../utils/undoManager";

const DEFAULT_BOARD_ID = "default";

const USER_COLORS = [
  "#3b82f6", // blue
  "#ec4899", // pink
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#f43f5e", // rose
  "#14b8a6", // teal
];

function getRandomUser() {
  const names = ["Alex Rivera", "Jordan Chen", "Taylor Morgan", "Morgan Blake", "Casey Kim", "Sam Patel"];
  const name = names[Math.floor(Math.random() * names.length)];
  const color = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
  const id = "usr_" + Math.random().toString(36).substring(2, 8);
  return { id, name, color };
}

function getInitialBoardId(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("boardId") || DEFAULT_BOARD_ID;
  } catch {
    return DEFAULT_BOARD_ID;
  }
}

export function useRealtimeBoard() {
  const [boardId, setBoardId] = useState<string>(getInitialBoardId);
  const currentBoardIdRef = useRef<string>(boardId);
  currentBoardIdRef.current = boardId;

  const [boardTitle, setBoardTitleState] = useState<string>("Collaborative Workspace");
  const [boardsList, setBoardsList] = useState<BoardMetadata[]>([]);
  const [isLoadingBoards, setIsLoadingBoards] = useState<boolean>(false);

  const [currentUser, setCurrentUser] = useState(() => {
    const saved = sessionStorage.getItem("miro_current_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    const created = getRandomUser();
    sessionStorage.setItem("miro_current_user", JSON.stringify(created));
    return created;
  });

  const [elements, setElements] = useState<BoardElement[]>([]);
  const [activeUsers, setActiveUsers] = useState<Record<string, UserPresence>>({});
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "offline">("connecting");
  const [activityHistory, setActivityHistory] = useState<ActivityLogItem[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const cursorThrottleTimer = useRef<number | null>(null);
  const lastCursorSent = useRef<Point | null>(null);

  // Operation-Based Multiplayer Undo / Redo history
  const undoStackRef = useRef<BoardOperation[]>([]);
  const redoStackRef = useRef<BoardOperation[]>([]);
  const [, setHistoryVersion] = useState(0);
  const [conflictNotice, setConflictNotice] = useState<{ message: string; timestamp: number } | null>(null);

  // Real-time collaborative laser trails and reaction bursts
  const [peerLaserPoints, setPeerLaserPoints] = useState<LaserPoint[]>([]);
  const [activeReactions, setActiveReactions] = useState<ReactionBurst[]>([]);
  const [syncedSlideIndex, setSyncedSlideIndex] = useState<number | null>(null);

  // Stable reference to switchBoard function for early lifecycle/event callbacks
  const switchBoardRef = useRef<(id: string) => Promise<void>>(() => Promise.resolve());

  // Fetch boards list from server
  const refreshBoards = useCallback(async () => {
    try {
      setIsLoadingBoards(true);
      const res = await fetch("/api/boards");
      const data = await res.json();
      if (Array.isArray(data.boards)) {
        setBoardsList(data.boards);
        const currentMeta = data.boards.find((b: BoardMetadata) => b.id === currentBoardIdRef.current);
        if (currentMeta && currentMeta.title) {
          setBoardTitleState(currentMeta.title);
        }
      }
    } catch (err) {
      console.error("Failed to load boards list:", err);
    } finally {
      setIsLoadingBoards(false);
    }
  }, []);

  // Update board title and persist via PATCH /api/boards/:id
  const setBoardTitle = useCallback(async (newTitle: string) => {
    const targetBoardId = currentBoardIdRef.current;
    setBoardTitleState(newTitle);
    setBoardsList((prev) =>
      prev.map((b) => (b.id === targetBoardId ? { ...b, title: newTitle, updatedAt: Date.now() } : b))
    );
    try {
      await fetch(`/api/boards/${targetBoardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
    } catch (err) {
      console.error("Failed to persist board title:", err);
    }
  }, []);

  // Record an operation into the actor-scoped undo stack and clear redo stack
  const recordOperation = useCallback((op: BoardOperation) => {
    undoStackRef.current.push(op);
    if (undoStackRef.current.length > 50) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = []; // User performing a new action invalidates redo stack
    setHistoryVersion((v) => v + 1);
  }, []);

  // Update elements state safely
  const updateElementsLocally = useCallback((newElementsOrUpdater: BoardElement[] | ((prev: BoardElement[]) => BoardElement[])) => {
    setElements((prev) => {
      return typeof newElementsOrUpdater === "function" ? newElementsOrUpdater(prev) : newElementsOrUpdater;
    });
  }, []);

  // Broadcast helper
  const sendNetworkEvent = useCallback((msg: any) => {
    const payload = { boardId: currentBoardIdRef.current, ...msg };
    // 1. Via WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
    // 2. Via BroadcastChannel for local tabs
    if (bcRef.current) {
      try {
        bcRef.current.postMessage({ ...payload, senderId: currentUser.id });
      } catch (e) {}
    }
  }, [currentUser.id]);

  // Handle incoming messages from WS or BroadcastChannel
  const handleIncomingMessage = useCallback((data: any) => {
    // If message is tagged with another boardId, discard it
    if (data.boardId && data.boardId !== currentBoardIdRef.current) {
      return;
    }

    switch (data.type) {
      case "board:init":
      case "board:synced":
      case "board:sync": {
        if (Array.isArray(data.elements)) {
          setElements(data.elements);
        }
        if (Array.isArray(data.users)) {
          const userMap: Record<string, UserPresence> = {};
          data.users.forEach((u: UserPresence) => {
            if (u.id !== currentUser.id) userMap[u.id] = u;
          });
          setActiveUsers(userMap);
        }
        if (Array.isArray(data.history)) {
          setActivityHistory(data.history);
        }
        break;
      }

      case "cursor:update": {
        if (data.userId && data.userId !== currentUser.id) {
          setActiveUsers((prev) => {
            const existing = prev[data.userId] || {
              id: data.userId,
              name: "Collaborator",
              color: "#3b82f6",
              lastActive: Date.now(),
            };
            return {
              ...prev,
              [data.userId]: {
                ...existing,
                cursor: data.cursor,
                selectedIds: data.selectedIds,
                lastActive: Date.now(),
              },
            };
          });
        }
        break;
      }

      case "user:join": {
        if (data.user && data.user.id !== currentUser.id) {
          setActiveUsers((prev) => ({
            ...prev,
            [data.user.id]: data.user,
          }));
        }
        break;
      }

      case "user:leave": {
        if (data.userId) {
          setActiveUsers((prev) => {
            const copy = { ...prev };
            delete copy[data.userId];
            return copy;
          });
        }
        break;
      }

      case "element:created": {
        if (data.element) {
          setElements((prev) => {
            if (prev.some((e) => e.id === data.element.id)) return prev;
            return [...prev, data.element];
          });
        }
        break;
      }

      case "element:updated": {
        if (data.element) {
          setElements((prev) =>
            prev.map((el) => (el.id === data.element.id ? { ...el, ...data.element } : el))
          );
        }
        break;
      }

      case "elements:batch_updated": {
        if (Array.isArray(data.elements)) {
          const updateMap = new Map<string, BoardElement>(data.elements.map((e: BoardElement) => [e.id, e]));
          setElements((prev) =>
            prev.map((el) => {
              const updatedItem = updateMap.get(el.id);
              return updatedItem ? { ...el, ...updatedItem } : el;
            })
          );
        }
        break;
      }

      case "element:deleted": {
        if (data.id) {
          setElements((prev) => prev.filter((el) => el.id !== data.id));
        }
        break;
      }

      case "elements:batch_deleted": {
        if (Array.isArray(data.ids)) {
          const idSet = new Set(data.ids);
          setElements((prev) => prev.filter((el) => !idSet.has(el.id)));
        }
        break;
      }

      case "activity:new": {
        if (data.item) {
          setActivityHistory((prev) => [...prev.slice(-99), data.item]);
        }
        break;
      }

      case "operation:conflict": {
        if (data.reason) {
          setConflictNotice({
            message: data.reason,
            timestamp: Date.now(),
          });
        }
        break;
      }

      case "operation:conflict_resolved": {
        if (data.reason) {
          setConflictNotice({
            message: data.reason,
            timestamp: Date.now(),
          });
        }
        break;
      }

      case "laser:point": {
        if (data.point && data.userId !== currentUser.id) {
          const pt: LaserPoint = {
            x: data.point.x,
            y: data.point.y,
            color: data.color || "#ef4444",
            userId: data.userId,
            userName: data.userName,
            timestamp: Date.now(),
          };
          setPeerLaserPoints((prev) => [...prev.slice(-150), pt]);
        }
        break;
      }

      case "reaction:burst": {
        if (data.emoji) {
          const rx: ReactionBurst = {
            id: data.id || "rx_" + Math.random().toString(36).substring(2, 9),
            emoji: data.emoji,
            x: data.point?.x ?? (window.innerWidth / 2 + (Math.random() * 200 - 100)),
            y: data.point?.y ?? (window.innerHeight - 100),
            userId: data.userId || "peer",
            userName: data.userName || "Team",
            timestamp: Date.now(),
          };
          setActiveReactions((prev) => [...prev.slice(-30), rx]);
        }
        break;
      }

      case "presentation:slide": {
        if (typeof data.slideIndex === "number" && data.userId !== currentUser.id) {
          setSyncedSlideIndex(data.slideIndex);
        }
        break;
      }

      case "board:deleted": {
        const fallback = data.fallbackBoardId || DEFAULT_BOARD_ID;
        setConflictNotice({
          message: "The current board was deleted by a teammate. Migrated to primary workspace.",
          timestamp: Date.now(),
        });
        refreshBoards();
        switchBoardRef.current(fallback);
        break;
      }
    }
  }, [currentUser.id, refreshBoards]);

  // Periodic cleanup for fading laser points and reaction bursts
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setPeerLaserPoints((prev) => (prev.length === 0 ? prev : prev.filter((p) => now - p.timestamp < 1500)));
      setActiveReactions((prev) => (prev.length === 0 ? prev : prev.filter((r) => now - r.timestamp < 4000)));
    }, 300);
    return () => clearInterval(timer);
  }, []);

  // Connect WebSocket and BroadcastChannel
  useEffect(() => {
    refreshBoards();

    // 1. BroadcastChannel for fast multi-tab sync
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("miro_whiteboard_sync");
      bcRef.current = bc;
      bc.onmessage = (event) => {
        const msg = event.data;
        if (!msg || msg.senderId === currentUser.id) return;
        handleIncomingMessage(msg);
      };
    } catch (e) {
      console.log("BroadcastChannel unavailable");
    }

    // 2. WebSocket connection
    let ws: WebSocket | null = null;
    let reconnectTimeout: number | null = null;

    function connectWs() {
      setConnectionStatus("connecting");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnectionStatus("connected");
          // Announce presence with current boardId
          ws?.send(
            JSON.stringify({
              type: "user:init",
              boardId: currentBoardIdRef.current,
              user: currentUser,
            })
          );
        };

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            handleIncomingMessage(data);
          } catch (err) {
            console.error("Error parsing WS message:", err);
          }
        };

        ws.onclose = () => {
          setConnectionStatus("offline");
          reconnectTimeout = window.setTimeout(connectWs, 3000);
        };

        ws.onerror = () => {
          setConnectionStatus("offline");
        };
      } catch (err) {
        setConnectionStatus("offline");
        reconnectTimeout = window.setTimeout(connectWs, 3000);
      }
    }

    connectWs();

    // Fetch initial board state
    fetch(`/api/board?boardId=${currentBoardIdRef.current}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.elements) {
          setElements(data.elements);
        }
      })
      .catch(() => {});

    fetch(`/api/board/history?boardId=${currentBoardIdRef.current}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.history)) {
          setActivityHistory(data.history);
        }
      })
      .catch(() => {});

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
      if (bc) bc.close();
    };
  }, [currentUser, handleIncomingMessage, refreshBoards]);

  // Switch board logic
  const switchBoard = useCallback(async (targetBoardId: string) => {
    if (!targetBoardId) targetBoardId = DEFAULT_BOARD_ID;
    setBoardId(targetBoardId);
    currentBoardIdRef.current = targetBoardId;

    // Clear local undo and redo stacks when switching boards
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryVersion((v) => v + 1);

    // Update browser URL query params
    try {
      const url = new URL(window.location.href);
      if (targetBoardId === DEFAULT_BOARD_ID) {
        url.searchParams.delete("boardId");
      } else {
        url.searchParams.set("boardId", targetBoardId);
      }
      window.history.pushState({}, "", url.toString());
    } catch {}

    // Find and set board title from boards list
    const foundMeta = boardsList.find((b) => b.id === targetBoardId);
    if (foundMeta) {
      setBoardTitleState(foundMeta.title);
    }

    // Send board:switch WS message
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "board:switch",
          boardId: targetBoardId,
        })
      );
    }

    // Fetch board elements & history immediately
    try {
      const [boardRes, historyRes] = await Promise.all([
        fetch(`/api/board?boardId=${targetBoardId}`),
        fetch(`/api/board/history?boardId=${targetBoardId}`),
      ]);
      const boardData = await boardRes.json();
      if (boardData.elements) {
        setElements(boardData.elements);
      }
      const histData = await historyRes.json();
      if (Array.isArray(histData.history)) {
        setActivityHistory(histData.history);
      }
    } catch (e) {
      console.error("Failed fetching board data after switch:", e);
    }
  }, [boardsList]);

  switchBoardRef.current = switchBoard;

  // Create new board
  const createBoard = useCallback(async (title?: string, template: "blank" | "starter" = "blank") => {
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Untitled Board",
          template,
        }),
      });
      const data = await res.json();
      if (data.board) {
        await refreshBoards();
        await switchBoard(data.board.id);
        return data.board;
      }
    } catch (err) {
      console.error("Failed to create new board:", err);
    }
    return null;
  }, [refreshBoards, switchBoard]);

  // Delete board
  const deleteBoard = useCallback(async (targetBoardId: string) => {
    if (targetBoardId === DEFAULT_BOARD_ID) {
      console.warn("Cannot delete default workspace board");
      return false;
    }
    try {
      const res = await fetch(`/api/boards/${targetBoardId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        await refreshBoards();
        if (currentBoardIdRef.current === targetBoardId) {
          await switchBoard(DEFAULT_BOARD_ID);
        }
        return true;
      }
    } catch (err) {
      console.error("Failed to delete board:", err);
    }
    return false;
  }, [refreshBoards, switchBoard]);

  // Apply an operation locally to state
  const applyOperationLocally = useCallback((op: BoardOperation) => {
    setElements((prev) => {
      switch (op.type) {
        case "create": {
          if (prev.some((e) => e.id === op.element.id)) {
            return prev.map((e) => (e.id === op.element.id ? op.element : e));
          }
          return [...prev, op.element];
        }
        case "delete": {
          return prev.filter((e) => e.id !== op.elementId);
        }
        case "update": {
          return prev.map((e) => (e.id === op.elementId ? { ...e, ...op.after } : e));
        }
        case "batch_create": {
          const newMap = new Map(op.elements.map((e) => [e.id, e]));
          const unchanged = prev.filter((e) => !newMap.has(e.id));
          return [...unchanged, ...op.elements];
        }
        case "batch_delete": {
          const delIds = new Set(op.elements.map((e) => e.id));
          return prev.filter((e) => !delIds.has(e.id));
        }
        case "batch_update": {
          const updateMap = new Map(op.updates.map((u) => [u.id, u.after]));
          return prev.map((e) => {
            const after = updateMap.get(e.id);
            return after ? { ...e, ...after } : e;
          });
        }
      }
    });
  }, []);

  // Mutations
  const createElement = useCallback((element: BoardElement, description?: string) => {
    const currentId = currentBoardIdRef.current;
    const op: CreateElementOp = {
      type: "create",
      operationId: createOperationId(),
      transactionId: createTransactionId(),
      boardId: currentId,
      actorId: currentUser.id,
      actorName: currentUser.name,
      timestamp: Date.now(),
      description: description || `Create ${element.type}`,
      element: JSON.parse(JSON.stringify(element)),
    };
    recordOperation(op);
    updateElementsLocally((prev) => [...prev, element]);
    sendNetworkEvent({ type: "element:create", boardId: currentId, element });
  }, [currentUser, recordOperation, updateElementsLocally, sendNetworkEvent]);

  const updateElement = useCallback((id: string, partial: Partial<BoardElement>, recordHistory = true, description?: string) => {
    const currentId = currentBoardIdRef.current;
    if (recordHistory) {
      setElements((prev) => {
        const before = prev.find((el) => el.id === id);
        if (before) {
          const after: BoardElement = { ...before, ...partial };
          const op: UpdateElementOp = {
            type: "update",
            operationId: createOperationId(),
            transactionId: createTransactionId(),
            boardId: currentId,
            actorId: currentUser.id,
            actorName: currentUser.name,
            timestamp: Date.now(),
            description: description || `Update ${before.type}`,
            elementId: id,
            before: JSON.parse(JSON.stringify(before)),
            after: JSON.parse(JSON.stringify(after)),
            baseRevision: before.revision,
          };
          recordOperation(op);
        }
        return prev.map((el) => (el.id === id ? { ...el, ...partial } : el));
      });
    } else {
      updateElementsLocally((prev) =>
        prev.map((el) => (el.id === id ? { ...el, ...partial } : el))
      );
    }
    sendNetworkEvent({ type: "element:update", boardId: currentId, element: { id, ...partial } });
  }, [currentUser, recordOperation, updateElementsLocally, sendNetworkEvent]);

  const batchUpdateElements = useCallback((updated: BoardElement[], recordHistory = true, description?: string) => {
    const currentId = currentBoardIdRef.current;
    const updateMap = new Map<string, BoardElement>(updated.map((e) => [e.id, e]));
    if (recordHistory) {
      setElements((prev) => {
        const updatesList: { id: string; before: BoardElement; after: BoardElement; baseRevision?: number }[] = [];
        updated.forEach((after) => {
          const before = prev.find((el) => el.id === after.id) || after;
          updatesList.push({
            id: after.id,
            before: JSON.parse(JSON.stringify(before)),
            after: JSON.parse(JSON.stringify(after)),
            baseRevision: before.revision,
          });
        });

        if (updatesList.length > 0) {
          const op: BatchUpdateOp = {
            type: "batch_update",
            operationId: createOperationId(),
            transactionId: createTransactionId(),
            boardId: currentId,
            actorId: currentUser.id,
            actorName: currentUser.name,
            timestamp: Date.now(),
            description: description || `Update ${updated.length} elements`,
            updates: updatesList,
          };
          recordOperation(op);
        }

        return prev.map((el) => {
          const item = updateMap.get(el.id);
          return item ? { ...el, ...item } : el;
        });
      });
    } else {
      updateElementsLocally((prev) =>
        prev.map((el) => {
          const item = updateMap.get(el.id);
          return item ? { ...el, ...item } : el;
        })
      );
    }
    sendNetworkEvent({ type: "elements:batch_update", boardId: currentId, elements: updated });
  }, [currentUser, recordOperation, updateElementsLocally, sendNetworkEvent]);

  const deleteElement = useCallback((id: string, description?: string) => {
    const currentId = currentBoardIdRef.current;
    setElements((prev) => {
      const before = prev.find((el) => el.id === id);
      if (before) {
        const op: DeleteElementOp = {
          type: "delete",
          operationId: createOperationId(),
          transactionId: createTransactionId(),
          boardId: currentId,
          actorId: currentUser.id,
          actorName: currentUser.name,
          timestamp: Date.now(),
          description: description || `Delete ${before.type}`,
          elementId: id,
          before: JSON.parse(JSON.stringify(before)),
          baseRevision: before.revision,
        };
        recordOperation(op);
      }
      return prev.filter((el) => el.id !== id);
    });
    sendNetworkEvent({ type: "element:delete", boardId: currentId, id });
  }, [currentUser, recordOperation, sendNetworkEvent]);

  const deleteElements = useCallback((ids: string[], description?: string) => {
    const currentId = currentBoardIdRef.current;
    const idSet = new Set(ids);
    setElements((prev) => {
      const beforeElements = prev.filter((el) => idSet.has(el.id));
      if (beforeElements.length > 0) {
        const op: BatchDeleteOp = {
          type: "batch_delete",
          operationId: createOperationId(),
          transactionId: createTransactionId(),
          boardId: currentId,
          actorId: currentUser.id,
          actorName: currentUser.name,
          timestamp: Date.now(),
          description: description || `Delete ${beforeElements.length} elements`,
          elements: JSON.parse(JSON.stringify(beforeElements)),
        };
        recordOperation(op);
      }
      return prev.filter((el) => !idSet.has(el.id));
    });
    sendNetworkEvent({ type: "elements:batch_delete", boardId: currentId, ids });
  }, [currentUser, recordOperation, sendNetworkEvent]);

  const replaceBoard = useCallback((newElements: BoardElement[]) => {
    const currentId = currentBoardIdRef.current;
    updateElementsLocally(newElements);
    sendNetworkEvent({ type: "board:replace", boardId: currentId, elements: newElements });
  }, [updateElementsLocally, sendNetworkEvent]);

  // Commit an explicit completed gesture transaction
  const commitOperation = useCallback((op: BoardOperation) => {
    recordOperation(op);
  }, [recordOperation]);

  // Throttled cursor broadcasting
  const sendCursor = useCallback((point: Point | null, selectedIds: string[] = []) => {
    lastCursorSent.current = point;
    if (cursorThrottleTimer.current) return;

    cursorThrottleTimer.current = window.setTimeout(() => {
      cursorThrottleTimer.current = null;
      if (lastCursorSent.current) {
        sendNetworkEvent({
          type: "cursor:move",
          boardId: currentBoardIdRef.current,
          cursor: lastCursorSent.current,
          selectedIds,
        });
      }
    }, 40);
  }, [sendNetworkEvent]);

  // Operation-based multiplayer Undo
  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const op = undoStackRef.current.pop()!;
    const inverseOp = generateInverseOperation(op, currentUser.id, currentUser.name);
    redoStackRef.current.push(op);
    setHistoryVersion((v) => v + 1);

    // Optimistically apply inverse operation
    applyOperationLocally(inverseOp);

    // Broadcast operation:apply with isUndo: true
    sendNetworkEvent({
      type: "operation:apply",
      boardId: currentBoardIdRef.current,
      operation: inverseOp,
      isUndo: true,
      description: inverseOp.description,
    });
  }, [currentUser, applyOperationLocally, sendNetworkEvent]);

  // Operation-based multiplayer Redo
  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const op = redoStackRef.current.pop()!;
    undoStackRef.current.push(op);
    setHistoryVersion((v) => v + 1);

    // Optimistically apply redo operation
    applyOperationLocally(op);

    // Broadcast operation:apply with isRedo: true
    sendNetworkEvent({
      type: "operation:apply",
      boardId: currentBoardIdRef.current,
      operation: op,
      isRedo: true,
      description: op.description,
    });
  }, [applyOperationLocally, sendNetworkEvent]);

  const setUserName = useCallback((name: string) => {
    setCurrentUser((prev: any) => {
      const updated = { ...prev, name };
      sessionStorage.setItem("miro_current_user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const sendLaserPoint = useCallback(
    (point: Point, color?: string) => {
      sendNetworkEvent({
        type: "laser:point",
        boardId: currentBoardIdRef.current,
        point,
        color: color || currentUser.color,
      });
    },
    [currentUser.color, sendNetworkEvent]
  );

  const sendReactionBurst = useCallback(
    (emoji: string, point?: Point) => {
      const rx: ReactionBurst = {
        id: "rx_" + Math.random().toString(36).substring(2, 9),
        emoji,
        x: point?.x ?? (window.innerWidth / 2 + (Math.random() * 200 - 100)),
        y: point?.y ?? (window.innerHeight - 120),
        userId: currentUser.id,
        userName: currentUser.name,
        timestamp: Date.now(),
      };
      // Local immediate addition
      setActiveReactions((prev) => [...prev.slice(-30), rx]);
      // Network event
      sendNetworkEvent({
        type: "reaction:burst",
        boardId: currentBoardIdRef.current,
        id: rx.id,
        emoji,
        point: point ?? { x: rx.x, y: rx.y },
      });
    },
    [currentUser.id, currentUser.name, sendNetworkEvent]
  );

  const sendPresentationSlide = useCallback(
    (slideIndex: number) => {
      sendNetworkEvent({
        type: "presentation:slide",
        boardId: currentBoardIdRef.current,
        slideIndex,
      });
    },
    [sendNetworkEvent]
  );

  return {
    boardId,
    boardTitle,
    setBoardTitle,
    boardsList,
    isLoadingBoards,
    refreshBoards,
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
    deleteElement,
    deleteElements,
    replaceBoard,
    commitOperation,
    recordCustomOperation: commitOperation,
    sendCursor,
    undo,
    redo,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    setUserName,
    activityHistory,
    conflictNotice,
    clearConflictNotice: () => setConflictNotice(null),
    peerLaserPoints,
    activeReactions,
    syncedSlideIndex,
    sendLaserPoint,
    sendReactionBurst,
    sendPresentationSlide,
  };
}
