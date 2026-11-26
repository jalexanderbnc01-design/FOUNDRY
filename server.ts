import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { SqliteBoardStore } from "./src/server/persistence/SqliteBoardStore";
import { BoardRecord, BoardStore } from "./src/server/persistence/BoardStore";
import { reconcileUpdateWithConflict } from "./src/utils/undoManager";
import { ollamaAdapter, validateOllamaBaseUrl } from "./src/server/ai/OllamaAdapter";
import { aiStore } from "./src/server/ai/AIConversationStore";
import { sharedDatabase } from "./src/server/database/SharedDatabase";

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json({ limit: "20mb" }));

// Lazy GoogleGenAI client initialization
let genAiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAiClient) {
    genAiClient = new GoogleGenAI({ apiKey });
  }
  return genAiClient;
}

// Types for backend state
export interface BoardElement {
  id: string;
  type:
    | "sticky"
    | "shape"
    | "text"
    | "connector"
    | "draw"
    | "freehand"
    | "vectorPath"
    | "frame"
    | "html"
    | "image"
    | "file"
    | "link"
    | "comment"
    | string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex: number;
  content?: string;
  shapeType?:
    | "rect"
    | "rounded-rect"
    | "circle"
    | "diamond"
    | "triangle"
    | "star"
    | "cloud"
    | "cylinder";
  color?: string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: "solid" | "dashed";
  fontSize?: number;
  textAlign?: "left" | "center" | "right";
  points?: { x: number; y: number }[];
  startBinding?: {
    elementId: string;
    anchor: "top" | "bottom" | "left" | "right" | "center";
  };
  endBinding?: {
    elementId: string;
    anchor: "top" | "bottom" | "left" | "right" | "center";
  };
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  arrowStart?: boolean;
  arrowEnd?: boolean;
  lineStyle?: "straight" | "curved" | "orthogonal";
  title?: string;
  locked?: boolean;
  groupId?: string;
  createdBy?: string;
  depth?: number;
  metadata?: Record<string, any>;

  // HTML Card fields
  rawHtml?: string;
  rasterUrl?: string;
  isRasterized?: boolean;
  htmlState?: "live" | "snapshot" | "image" | "code";
  sourceName?: string;

  // Media / File / Link / Comment
  imageUrl?: string;
  fileName?: string;
  fileSize?: string;
  fileType?: string;
  fileData?: string;
  linkUrl?: string;
  linkTitle?: string;
  linkDescription?: string;
  linkFavicon?: string;
  commentAuthor?: string;
  commentResolved?: boolean;
  commentReplies?: { id: string; author: string; text: string; timestamp: number }[];

  authorId?: string;
  authorName?: string;
  reactions?: { [emoji: string]: number };
}

export interface UserPresence {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selectedIds?: string[];
  activeAction?: string;
  viewport?: { x: number; y: number; zoom: number };
  lastActive: number;
}

export interface ActivityLogItem {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  action: string;
  timestamp: number;
  elementId?: string;
  elementTitle?: string;
}

// Initial board starter elements
function getInitialElements(): BoardElement[] {
  return [
    {
      id: "frame-1",
      type: "frame",
      x: -350,
      y: -280,
      width: 820,
      height: 520,
      title: "Sprint Brainstorm & Roadmap",
      zIndex: 1,
      fillColor: "#ffffff",
      strokeColor: "#cbd5e1",
    },
    {
      id: "sticky-1",
      type: "sticky",
      x: -300,
      y: -200,
      width: 180,
      height: 180,
      content: "🚀 User Research & Feedback Analysis",
      color: "#fef08a", // pastel yellow
      zIndex: 10,
      reactions: { "👍": 3, "💡": 2 },
    },
    {
      id: "sticky-2",
      type: "sticky",
      x: -80,
      y: -200,
      width: 180,
      height: 180,
      content: "🎨 Redesign Infinite Canvas interaction & smooth zoom",
      color: "#bae6fd", // pastel sky
      zIndex: 11,
      reactions: { "❤️": 4 },
    },
    {
      id: "sticky-3",
      type: "sticky",
      x: 140,
      y: -200,
      width: 180,
      height: 180,
      content: "⚡ Real-time WebSocket sync & multiplayer cursors",
      color: "#bbf7d0", // pastel mint
      zIndex: 12,
      reactions: { "🔥": 5 },
    },
    {
      id: "shape-1",
      type: "shape",
      shapeType: "diamond",
      x: -80,
      y: 60,
      width: 180,
      height: 120,
      content: "Review Milestone?",
      fillColor: "#fbcfe8",
      strokeColor: "#f472b6",
      zIndex: 15,
    },
    {
      id: "connector-1",
      type: "connector",
      x: -80,
      y: -20,
      width: 180,
      height: 80,
      startPoint: { x: 10, y: -20 },
      endPoint: { x: 10, y: 60 },
      startBinding: { elementId: "sticky-2", anchor: "bottom" },
      endBinding: { elementId: "shape-1", anchor: "top" },
      strokeColor: "#64748b",
      strokeWidth: 2,
      arrowEnd: true,
      lineStyle: "curved",
      zIndex: 8,
    },
    {
      id: "text-1",
      type: "text",
      x: -300,
      y: 100,
      width: 240,
      height: 60,
      content: "💡 Tip: Spacebar + Drag to pan canvas\nScroll wheel or pinch to zoom",
      fontSize: 14,
      fillColor: "transparent",
      strokeColor: "#475569",
      zIndex: 20,
    },
    {
      id: "html-starter-card",
      type: "html",
      x: 520,
      y: -280,
      width: 440,
      height: 380,
      title: "PASTED · HTML",
      sourceName: "WEB COMPONENT DEMO",
      content: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 4px;">
  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
    <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #0284c7; background: #e0f2fe; padding: 3px 8px; border-radius: 9999px;">
      🌐 HTML Capture & View
    </span>
    <span style="font-size: 11px; color: #64748b; font-family: monospace;">Approach A · Live DOM</span>
  </div>
  <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #0f172a;">
    Interactive HTML on Canvas
  </h4>
  <p style="margin: 0 0 12px 0; font-size: 13px; color: #475569; line-height: 1.5;">
    Copy formatted text, tables, or cards from any webpage and press <b>Ctrl+V</b> anywhere on the board.
  </p>
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-bottom: 12px;">
    <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Key Capabilities:</div>
    <ul style="margin: 0; padding-left: 16px; font-size: 12px; color: #334155; line-height: 1.6;">
      <li><b>Live DOM Overlay:</b> Sanitized with DOMPurify, links stay clickable.</li>
      <li><b>Rasterize:</b> Click RASTERIZE to freeze to a static &lt;img&gt; with html2canvas.</li>
      <li><b>3D Tilt:</b> Toggle 3D TILT to view with CSS perspective and depth!</li>
    </ul>
  </div>
  <div style="display: flex; gap: 8px;">
    <a href="https://developer.mozilla.org" target="_blank" rel="noopener noreferrer" style="font-size: 12px; color: #2563eb; text-decoration: underline;">MDN Web Docs &rarr;</a>
  </div>
</div>`,
      rawHtml: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 4px;">...</div>`,
      isRasterized: false,
      zIndex: 15,
    }
  ];
}

// Durable SQLite persistence authority & in-memory runtime caches partitioned by boardId
const boardStore: BoardStore = new SqliteBoardStore();
const DEFAULT_BOARD_ID = "default";
const boardsCache: Map<string, Map<string, BoardElement>> = new Map();
const revisionsCache: Map<string, Map<string, number>> = new Map();
const clientBoardMap: Map<WebSocket, string> = new Map();
const boardUsers: Map<string, Map<string, UserPresence>> = new Map();
const boardActivity: Map<string, ActivityLogItem[]> = new Map();

async function getBoardElementsMap(boardId: string): Promise<Map<string, BoardElement>> {
  let map = boardsCache.get(boardId);
  if (!map) {
    map = new Map();
    const stored = await boardStore.getElements(boardId);
    stored.forEach((el) => {
      map!.set(el.id, el as any);
    });
    boardsCache.set(boardId, map);
  }
  return map;
}

function getRevisionsMap(boardId: string): Map<string, number> {
  let map = revisionsCache.get(boardId);
  if (!map) {
    map = new Map();
    revisionsCache.set(boardId, map);
  }
  return map;
}

function getBoardUsersMap(boardId: string): Map<string, UserPresence> {
  let map = boardUsers.get(boardId);
  if (!map) {
    map = new Map();
    boardUsers.set(boardId, map);
  }
  return map;
}

function getBoardActivityList(boardId: string): ActivityLogItem[] {
  let list = boardActivity.get(boardId);
  if (!list) {
    list = [
      {
        id: `act-init-${boardId}`,
        userId: "system",
        userName: "Slate System",
        userColor: "#3b82f6",
        action: "Initialized collaborative whiteboard workspace",
        timestamp: Date.now() - 120000,
      },
    ];
    boardActivity.set(boardId, list);
  }
  return list;
}

async function initializePersistence() {
  try {
    await boardStore.initialize();
    let defaultBoard = await boardStore.getBoard(DEFAULT_BOARD_ID);
    if (!defaultBoard) {
      console.log("[Persistence] No existing board found in SQLite. Initializing default board...");
      defaultBoard = {
        id: DEFAULT_BOARD_ID,
        title: "Sprint Brainstorm & Roadmap",
        created_at: Date.now(),
        updated_at: Date.now(),
        schema_version: 1,
      };
      await boardStore.createBoard(defaultBoard);
      const initial = getInitialElements() as any;
      await boardStore.replaceBoardElements(DEFAULT_BOARD_ID, initial);
      console.log(`[Persistence] Seeded default board with ${initial.length} elements.`);
    } else {
      console.log(`[Persistence] Loaded existing board "${defaultBoard.title}" (${defaultBoard.id}) from SQLite.`);
    }

    // Hydrate in-memory runtime cache for default board from durable SQLite authority
    const defaultElementsMap = await getBoardElementsMap(DEFAULT_BOARD_ID);
    const defaultRevs = getRevisionsMap(DEFAULT_BOARD_ID);
    defaultElementsMap.forEach((el) => {
      defaultRevs.set(el.id, (el as any).revision || 1);
    });
    console.log(`[Persistence] Hydrated runtime memory cache with ${defaultElementsMap.size} elements from SQLite.`);
  } catch (err) {
    console.error("[Persistence] Error initializing SQLite store:", err);
  }
  try {
    aiStore.initialize();
    console.log("[Persistence] Initialized AI SQLite store.");
  } catch (err) {
    console.error("[Persistence] Error initializing AI SQLite store:", err);
  }
  try {
    sharedDatabase.initialize();
    console.log("[Persistence] Initialized Shared SQLite Database (24 collections).");
  } catch (err) {
    console.error("[Persistence] Error initializing Shared SQLite Database:", err);
  }
}

const activeUsers: Map<string, UserPresence> = new Map();
const clients: Map<WebSocket, string> = new Map();

function recordActivity(
  userId: string,
  userName: string,
  userColor: string,
  action: string,
  elementId?: string,
  elementTitle?: string,
  boardId: string = DEFAULT_BOARD_ID
) {
  const item: ActivityLogItem = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId,
    userName,
    userColor,
    action,
    timestamp: Date.now(),
    elementId,
    elementTitle,
  };
  const list = getBoardActivityList(boardId);
  list.push(item);
  if (list.length > 80) {
    list.shift();
  }
  broadcast({ type: "activity:new", item, boardId }, undefined, boardId);
  return item;
}

// REST endpoints
app.get("/api/boards", async (req, res) => {
  try {
    const allBoards = await boardStore.getAllBoards();
    const boardsWithCounts = await Promise.all(
      allBoards.map(async (b) => {
        const els = await boardStore.getElements(b.id);
        return {
          ...b,
          elementCount: els.length,
        };
      })
    );
    res.json({ boards: boardsWithCounts });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to list boards" });
  }
});

app.post("/api/boards", async (req, res) => {
  try {
    const { title = "Untitled Board", template } = req.body;
    const newId = `board_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newBoard: BoardRecord = {
      id: newId,
      title: title.trim() || "Untitled Board",
      created_at: Date.now(),
      updated_at: Date.now(),
      schema_version: 1,
    };
    await boardStore.createBoard(newBoard);
    const starterElements = template === "blank" ? [] : (getInitialElements() as any);
    if (starterElements.length > 0) {
      await boardStore.replaceBoardElements(newId, starterElements);
      const map = await getBoardElementsMap(newId);
      starterElements.forEach((el: any) => map.set(el.id, el));
    }
    res.json({ success: true, board: newBoard });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to create board" });
  }
});

app.patch("/api/boards/:id", async (req, res) => {
  try {
    const { title } = req.body;
    const boardId = req.params.id;
    if (title) {
      await boardStore.updateBoard(boardId, { title: title.trim() });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to update board" });
  }
});

app.delete("/api/boards/:id", async (req, res) => {
  try {
    const boardId = req.params.id;
    if (boardId === DEFAULT_BOARD_ID) {
      return res.status(400).json({ error: "Cannot delete primary default board" });
    }
    await boardStore.deleteBoard(boardId);
    boardsCache.delete(boardId);
    revisionsCache.delete(boardId);
    boardUsers.delete(boardId);
    boardActivity.delete(boardId);

    // Notify any clients currently connected to the deleted board to switch to DEFAULT_BOARD_ID
    broadcast(
      {
        type: "board:deleted",
        boardId,
        fallbackBoardId: DEFAULT_BOARD_ID,
      },
      undefined,
      boardId
    );

    // Reassign all active sockets mapped to the deleted board to DEFAULT_BOARD_ID
    for (const [socket, assignedBoard] of clientBoardMap.entries()) {
      if (assignedBoard === boardId) {
        clientBoardMap.set(socket, DEFAULT_BOARD_ID);
      }
    }

    res.json({ success: true, fallbackBoardId: DEFAULT_BOARD_ID });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to delete board" });
  }
});

app.get("/api/board", async (req, res) => {
  const boardId = (req.query.boardId as string) || DEFAULT_BOARD_ID;
  let board = await boardStore.getBoard(boardId);
  if (!board) {
    board = {
      id: boardId,
      title: "Sprint Brainstorm & Roadmap",
      created_at: Date.now(),
      updated_at: Date.now(),
      schema_version: 1,
    };
  }
  const elementsMap = await getBoardElementsMap(boardId);
  const usersMap = getBoardUsersMap(boardId);
  res.json({
    board,
    elements: Array.from(elementsMap.values()),
    userCount: usersMap.size,
  });
});

app.get("/api/board/history", (req, res) => {
  const boardId = (req.query.boardId as string) || DEFAULT_BOARD_ID;
  const history = getBoardActivityList(boardId);
  res.json({
    history: history.slice(-50),
  });
});

app.post("/api/board/reset", async (req, res) => {
  const boardId = (req.query.boardId as string) || DEFAULT_BOARD_ID;
  const initial = getInitialElements() as any;
  await boardStore.replaceBoardElements(boardId, initial);
  const elementsMap = await getBoardElementsMap(boardId);
  elementsMap.clear();
  initial.forEach((el: any) => elementsMap.set(el.id, el));
  broadcast(
    {
      type: "board:sync",
      boardId,
      elements: Array.from(elementsMap.values()),
    },
    undefined,
    boardId
  );
  recordActivity(
    "system",
    "Slate System",
    "#3b82f6",
    "Reset whiteboard to starter sprint roadmap",
    undefined,
    undefined,
    boardId
  );
  res.json({ success: true, count: elementsMap.size });
});

// AI Whiteboard Assistant Endpoint (Gemini 2.5 Flash server-side integration)
app.post("/api/ai/whiteboard", async (req, res) => {
  try {
    const { action, selectedElements = [], userPrompt = "", boardTitle = "Whiteboard" } = req.body;
    const ai = getGenAI();

    // Extract text content from provided elements
    const elementTexts = selectedElements
      .map((el: BoardElement) => {
        const text = el.content || el.title || el.rawHtml || "";
        return `[${el.type.toUpperCase()}] ${text.slice(0, 400)}`;
      })
      .filter(Boolean);

    const contextStr = elementTexts.length > 0
      ? `Selected objects:\n${elementTexts.join("\n")}`
      : `No objects pre-selected. General request.`;

    if (!ai) {
      // Fallback deterministic generator if API key is not yet configured in secrets
      if (action === "summarize") {
        return res.json({
          success: true,
          action: "summarize",
          result: {
            title: "Executive Synthesis",
            summary: "Key themes indicate strong consensus on improving canvas performance, establishing intuitive spatial clustering, and streamlining live HTML sandbox rendering.",
            bullets: [
              "Streamline canvas rendering & LOD optimization",
              "Consolidate user research and feedback analysis",
              "Implement intelligent clipboard paste detection",
            ],
          },
        });
      }

      if (action === "cluster") {
        return res.json({
          success: true,
          action: "cluster",
          result: {
            clusters: [
              {
                name: "Architecture & Performance",
                color: "#bae6fd",
                items: [
                  "Cached raster preview for HTML cards",
                  "LOD zoom thresholds for large boards",
                  "Smooth 3D perspective camera matrix",
                ],
              },
              {
                name: "User Experience & Features",
                color: "#fef08a",
                items: [
                  "Smart clipboard detection for URLs & SVGs",
                  "Presentation mode using ordered frames",
                  "Multiplayer follow mode with live viewport",
                ],
              },
              {
                name: "Sprint Delivery & Quality",
                color: "#bbf7d0",
                items: [
                  "Verify DOMPurify sanitization rules",
                  "Conduct peer reviews on multiplayer sync",
                  "Automated regression suite for canvas math",
                ],
              },
            ],
          },
        });
      }

      if (action === "flowchart") {
        return res.json({
          success: true,
          action: "flowchart",
          result: {
            steps: [
              { id: "step-1", label: "User Input / Paste", shape: "rounded-rect" },
              { id: "step-2", label: "Inspect Clipboard Type", shape: "diamond" },
              { id: "step-3", label: "Sanitize & Render Live DOM", shape: "rect" },
              { id: "step-4", label: "Auto-Rasterize on Idle", shape: "rect" },
              { id: "step-5", label: "Sync via WebSocket", shape: "circle" },
            ],
          },
        });
      }

      if (action === "action_items") {
        return res.json({
          success: true,
          action: "action_items",
          result: {
            tasks: [
              { title: "Define zoom thresholds for HTML LOD", priority: "High" },
              { title: "Wire clipboard image pasting to base64 card", priority: "High" },
              { title: "Enable frame slide sequencing for presentation", priority: "Medium" },
              { title: "Add activity log timeline UI", priority: "Medium" },
            ],
          },
        });
      }

      if (action === "find_duplicates") {
        return res.json({
          success: true,
          action: "find_duplicates",
          result: {
            analysis: "Found 2 related conceptual overlaps: Canvas navigation shortcuts vs. zoom panning controls. Recommend grouping under a single 'Navigation UX' section.",
          },
        });
      }

      // Default generate_notes
      return res.json({
        success: true,
        action: "generate_notes",
        result: {
          notes: [
            { text: "Interactive DOM inspector toggle", color: "#fef08a" },
            { text: "Spatial audio cues for cursor presence", color: "#fed7aa" },
            { text: "Export board as interactive SVG package", color: "#bbf7d0" },
            { text: "Smart link unfurler for Figma & GitHub URLs", color: "#bae6fd" },
          ],
        },
      });
    }

    // Call Gemini API using gemini-3.8-flash
    let promptInstruction = "";
    if (action === "summarize") {
      promptInstruction = `Summarize these whiteboard notes in JSON format: {"title": string, "summary": string, "bullets": string[]}. Keep it concise and actionable.`;
    } else if (action === "cluster") {
      promptInstruction = `Group these whiteboard ideas into 2 to 4 thematic clusters. Return JSON: {"clusters": [{"name": string, "color": "#fef08a" | "#bae6fd" | "#bbf7d0" | "#fbcfe8", "items": string[]}]}`;
    } else if (action === "flowchart") {
      promptInstruction = `Turn these ideas into a clear step-by-step flowchart process. Return JSON: {"steps": [{"id": string, "label": string, "shape": "rect" | "diamond" | "rounded-rect" | "circle"}]}. Max 6 steps.`;
    } else if (action === "action_items") {
      promptInstruction = `Extract actionable tasks from these notes. Return JSON: {"tasks": [{"title": string, "priority": "High" | "Medium" | "Low"}]}. Max 6 tasks.`;
    } else if (action === "find_duplicates") {
      promptInstruction = `Analyze these whiteboard notes and find overlapping or duplicate ideas. Return JSON: {"analysis": string, "duplicates": [{"topic": string, "notes": string[], "recommendation": string}]}`;
    } else {
      promptInstruction = `Generate 4 to 6 creative, high-value sticky note ideas for: "${userPrompt || boardTitle}". Return JSON: {"notes": [{"text": string, "color": "#fef08a" | "#bae6fd" | "#bbf7d0" | "#fed7aa" | "#fbcfe8"}]}`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are an expert whiteboard AI assistant helping a product team organize ideas on an infinite canvas.\n${promptInstruction}\n\nContext:\n${contextStr}\n\nUser request: ${userPrompt}\n\nIMPORTANT: Return ONLY valid, parseable JSON matching the requested structure without markdown fences or additional commentary.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { error: "Failed to parse AI response" };
    }

    res.json({
      success: true,
      action,
      result: parsed,
    });
  } catch (error: any) {
    console.error("AI Assistant Error:", error);
    res.status(500).json({
      success: false,
      error: error?.message || "AI execution failed",
      fallback: true,
    });
  }
});

// =============================================================================
// FOUNDRY STAGE 2 — OLLAMA AI ENGINE, CONVERSATIONS, USAGE & DIAGNOSTICS API
// =============================================================================

const activeChatStreams = new Map<string, AbortController>();

app.get("/api/ai/providers", async (_req, res) => {
  try {
    const settings = aiStore.getOllamaSettings();
    const probe = settings.enabled
      ? await ollamaAdapter.testConnection(settings.baseUrl, 2500)
      : { ok: false, connected: false, baseUrl: settings.baseUrl, version: null, latencyMs: 0 };

    res.json({
      providers: [
        {
          id: "ollama",
          name: "Ollama",
          enabled: settings.enabled,
          connectionMode: settings.connectionMode,
          baseUrl: settings.baseUrl,
          selectedModel: settings.selectedModel,
          connected: probe.connected,
          version: probe.version,
          latencyMs: probe.latencyMs,
          errorCode: (probe as any).errorCode || null,
          error: (probe as any).error || null,
        },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to list AI providers" });
  }
});

app.get("/api/ai/providers/ollama/status", async (req, res) => {
  try {
    const settings = aiStore.getOllamaSettings();
    const targetUrl = typeof req.query.baseUrl === "string" && req.query.baseUrl.trim()
      ? req.query.baseUrl.trim()
      : settings.baseUrl;

    if (!settings.enabled) {
      return res.json({
        enabled: false,
        connected: false,
        baseUrl: targetUrl,
        connectionMode: settings.connectionMode,
        selectedModel: settings.selectedModel,
        version: null,
        latencyMs: 0,
        error: "Ollama provider is disabled in settings.",
      });
    }

    const probe = await ollamaAdapter.testConnection(targetUrl, Math.min(settings.timeoutMs, 5000));
    res.json({
      enabled: settings.enabled,
      connectionMode: settings.connectionMode,
      selectedModel: settings.selectedModel,
      ...probe,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, connected: false, error: err?.message || "Status check failed" });
  }
});

app.patch("/api/ai/providers/ollama/settings", (req, res) => {
  try {
    const body = req.body || {};
    if (body.baseUrl !== undefined) {
      const check = validateOllamaBaseUrl(body.baseUrl);
      if (check.ok === false) {
        return res.status(400).json({ success: false, errorCode: "INVALID_URL", error: check.error });
      }
      body.baseUrl = check.origin;
    }
    const updated = aiStore.updateOllamaSettings(body);
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to save Ollama settings" });
  }
});

app.post("/api/ai/providers/ollama/test", async (req, res) => {
  try {
    const settings = aiStore.getOllamaSettings();
    const targetUrl = typeof req.body?.baseUrl === "string" && req.body.baseUrl.trim()
      ? req.body.baseUrl.trim()
      : settings.baseUrl;
    const probe = await ollamaAdapter.testConnection(targetUrl, Math.min(settings.timeoutMs, 8000));
    let models: any[] = [];
    if (probe.connected) {
      models = await ollamaAdapter.discoverModels(targetUrl, 8000).catch(() => []);
    }
    res.json({ ...probe, models });
  } catch (err: any) {
    res.status(500).json({ ok: false, connected: false, error: err?.message || "Connection test failed" });
  }
});

app.get("/api/ai/providers/ollama/models", async (req, res) => {
  try {
    const settings = aiStore.getOllamaSettings();
    const targetUrl = typeof req.query.baseUrl === "string" && req.query.baseUrl.trim()
      ? req.query.baseUrl.trim()
      : settings.baseUrl;
    const models = await ollamaAdapter.discoverModels(targetUrl, 8000);
    res.json({ ok: true, baseUrl: targetUrl, models });
  } catch (err: any) {
    res.status(err?.code === "INVALID_URL" ? 400 : 502).json({
      ok: false,
      errorCode: err?.code || "OLLAMA_UNREACHABLE",
      error: err?.message || "Failed to discover Ollama models",
      guidance: err?.guidance || "",
      models: [],
    });
  }
});

app.get("/api/ai/providers/ollama/running-models", async (req, res) => {
  try {
    const settings = aiStore.getOllamaSettings();
    const targetUrl = typeof req.query.baseUrl === "string" && req.query.baseUrl.trim()
      ? req.query.baseUrl.trim()
      : settings.baseUrl;
    const models = await ollamaAdapter.getRunningModels(targetUrl, 5000);
    res.json({ ok: true, models });
  } catch (err: any) {
    res.status(502).json({
      ok: false,
      errorCode: err?.code || "OLLAMA_UNREACHABLE",
      error: err?.message || "Failed to query running models",
      models: [],
    });
  }
});

app.post("/api/ai/providers/ollama/model-info", async (req, res) => {
  try {
    const settings = aiStore.getOllamaSettings();
    const targetUrl = typeof req.body?.baseUrl === "string" && req.body.baseUrl.trim()
      ? req.body.baseUrl.trim()
      : settings.baseUrl;
    const model = typeof req.body?.model === "string" ? req.body.model.trim() : settings.selectedModel || "";
    if (!model) {
      return res.status(400).json({ ok: false, errorCode: "MODEL_NOT_SELECTED", error: "Model name is required" });
    }
    const info = await ollamaAdapter.getModelInfo(targetUrl, model, 8000);
    res.json({ ok: true, info });
  } catch (err: any) {
    const status = err?.code === "MODEL_NOT_FOUND" ? 404 : err?.code === "INVALID_URL" ? 400 : 502;
    res.status(status).json({
      ok: false,
      errorCode: err?.code || "HTTP_ERROR",
      error: err?.message || "Failed to inspect model",
    });
  }
});

app.post("/api/ai/providers/ollama/generate", async (req, res) => {
  try {
    const settings = aiStore.getOllamaSettings();
    const targetUrl = typeof req.body?.baseUrl === "string" && req.body.baseUrl.trim()
      ? req.body.baseUrl.trim()
      : settings.baseUrl;
    const model = typeof req.body?.model === "string" && req.body.model.trim()
      ? req.body.model.trim()
      : settings.selectedModel;
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "Reply with OK if you are ready.";

    if (!model) {
      return res.status(400).json({ ok: false, errorCode: "MODEL_NOT_SELECTED", error: "No Ollama model selected." });
    }

    const t0 = Date.now();
    const result = await ollamaAdapter.generate(
      targetUrl,
      {
        model,
        prompt,
        options: {
          temperature: settings.temperature,
          num_ctx: settings.numCtx,
          num_predict: Math.min(256, settings.numPredict),
        },
        keep_alive: settings.keepAlive,
      },
      settings.timeoutMs
    );
    res.json({ ok: true, model, latencyMs: Date.now() - t0, ...result });
  } catch (err: any) {
    res.status(502).json({
      ok: false,
      errorCode: err?.code || "OLLAMA_UNREACHABLE",
      error: err?.message || "Test generation failed",
      guidance: err?.guidance || "",
    });
  }
});

app.post("/api/ai/chat", async (req, res) => {
  const settings = aiStore.getOllamaSettings();
  const body = req.body || {};
  const requestId =
    typeof body.requestId === "string" && body.requestId.trim()
      ? body.requestId.trim()
      : `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  const targetUrl = typeof body.baseUrl === "string" && body.baseUrl.trim()
    ? body.baseUrl.trim()
    : settings.baseUrl;
  const model = typeof body.model === "string" && body.model.trim()
    ? body.model.trim()
    : settings.selectedModel;
  const messages = Array.isArray(body.messages) ? body.messages : null;
  const tools = Array.isArray(body.tools) ? body.tools : undefined;
  const wantStream = body.stream !== undefined ? Boolean(body.stream) : settings.streaming;

  if (!settings.enabled) {
    return res.status(400).json({ ok: false, errorCode: "OLLAMA_UNREACHABLE", error: "Ollama AI provider is disabled." });
  }
  if (!model) {
    return res.status(400).json({ ok: false, errorCode: "MODEL_NOT_SELECTED", error: "No Ollama model is selected." });
  }
  if (!messages || messages.length === 0) {
    return res.status(400).json({ ok: false, errorCode: "VALIDATION_ERROR", error: "Chat messages array is required." });
  }

  const urlCheck = validateOllamaBaseUrl(targetUrl);
  if (urlCheck.ok === false) {
    return res.status(400).json({ ok: false, errorCode: "INVALID_URL", error: urlCheck.error });
  }

  const abortController = new AbortController();
  activeChatStreams.set(requestId, abortController);
  let clientClosed = false;
  res.on("close", () => {
    if (!res.writableEnded) {
      clientClosed = true;
      abortController.abort();
    }
  });

  const startTime = Date.now();
  let firstTokenLatencyMs: number | null = null;
  let outputChars = 0;
  let finalMetrics: any = null;
  let finalError: { code?: string; message?: string } | null = null;
  let toolCallsCount = 0;

  const options = {
    temperature: typeof body.options?.temperature === "number" ? body.options.temperature : settings.temperature,
    num_ctx: typeof body.options?.num_ctx === "number" ? body.options.num_ctx : settings.numCtx,
    num_predict: typeof body.options?.num_predict === "number" ? body.options.num_predict : settings.numPredict,
    top_p: typeof body.options?.top_p === "number" ? body.options.top_p : settings.topP,
    top_k: typeof body.options?.top_k === "number" ? body.options.top_k : settings.topK,
    repeat_penalty: typeof body.options?.repeat_penalty === "number" ? body.options.repeat_penalty : settings.repeatPenalty,
  };
  const timeoutMs = typeof body.timeoutMs === "number" ? body.timeoutMs : settings.timeoutMs;
  const keepAlive = typeof body.keep_alive === "string" ? body.keep_alive : settings.keepAlive;

  if (wantStream) {
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const writeLine = (obj: any) => {
      if (!clientClosed && !res.writableEnded) {
        res.write(JSON.stringify(obj) + "\n");
      }
    };

    writeLine({ type: "meta", requestId, model, baseUrl: urlCheck.origin, startTime });

    await ollamaAdapter.streamChat(
      urlCheck.origin,
      { model, messages, tools, stream: true, options, keep_alive: keepAlive },
      (ev) => {
        if (ev.type === "chunk") {
          if (firstTokenLatencyMs === null && (ev.content || ev.thinking)) {
            firstTokenLatencyMs = Date.now() - startTime;
          }
          outputChars += (ev.content || "").length;
        }
        if (ev.type === "tool_calls" && ev.toolCalls) {
          toolCallsCount += ev.toolCalls.length;
        }
        if (ev.type === "done") {
          finalMetrics = ev.metrics || null;
        }
        if (ev.type === "error") {
          finalError = { code: ev.errorCode, message: ev.error };
        }
        writeLine(ev);
      },
      abortController.signal,
      timeoutMs
    );

    activeChatStreams.delete(requestId);
    if (!res.writableEnded) {
      res.end();
    }
  } else {
    let content = "";
    let toolCalls: any[] = [];
    await ollamaAdapter.streamChat(
      urlCheck.origin,
      { model, messages, tools, stream: false, options, keep_alive: keepAlive },
      (ev) => {
        if (ev.type === "chunk" && ev.content) {
          if (firstTokenLatencyMs === null) firstTokenLatencyMs = Date.now() - startTime;
          content += ev.content;
        } else if (ev.type === "tool_calls" && ev.toolCalls) {
          toolCalls = ev.toolCalls;
          toolCallsCount += ev.toolCalls.length;
        } else if (ev.type === "done") {
          finalMetrics = ev.metrics || null;
        } else if (ev.type === "error") {
          finalError = { code: ev.errorCode, message: ev.error };
        }
      },
      abortController.signal,
      timeoutMs
    );
    outputChars = content.length;
    activeChatStreams.delete(requestId);

    if (finalError) {
      res.status(finalError.code === "MODEL_NOT_FOUND" ? 404 : 502).json({
        ok: false,
        requestId,
        errorCode: finalError.code,
        error: finalError.message,
      });
    } else {
      res.json({
        ok: true,
        requestId,
        model,
        content,
        toolCalls,
        metrics: finalMetrics,
      });
    }
  }

  // Record truthful usage log on completion
  try {
    const durationMs = Date.now() - startTime;
    const estInput = Math.ceil(JSON.stringify(messages).length / 4);
    const estOutput = Math.ceil(outputChars / 4);
    const hasActual = typeof finalMetrics?.evalCount === "number" || typeof finalMetrics?.promptEvalCount === "number";
    aiStore.recordUsage({
      requestId,
      conversationId,
      provider: "ollama",
      model,
      startTime,
      firstTokenLatencyMs,
      durationMs,
      inputTokens: finalMetrics?.promptEvalCount ?? estInput,
      outputTokens: finalMetrics?.evalCount ?? estOutput,
      tokensPerSec: finalMetrics?.tokensPerSec ?? null,
      estimatedMetrics: !hasActual,
      toolCallsCount,
      cancelled: finalError?.code === "CANCELLED" || clientClosed,
      errorCode: finalError?.code || null,
      errorMessage: finalError?.message || null,
      createdAt: Date.now(),
    });
  } catch (err) {
    console.error("[AI Usage] Failed to record usage:", err);
  }
});

app.post("/api/ai/chat/cancel", (req, res) => {
  const requestId = typeof req.body?.requestId === "string" ? req.body.requestId.trim() : "";
  if (!requestId) {
    return res.status(400).json({ ok: false, error: "requestId is required" });
  }
  const ctrl = activeChatStreams.get(requestId);
  if (ctrl) {
    ctrl.abort();
    activeChatStreams.delete(requestId);
    return res.json({ ok: true, cancelled: true, requestId });
  }
  return res.json({ ok: true, cancelled: false, requestId, message: "No active stream with this requestId" });
});

app.get("/api/ai/conversations", (_req, res) => {
  try {
    res.json({ ok: true, conversations: aiStore.listConversations() });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to list conversations" });
  }
});

app.post("/api/ai/conversations", (req, res) => {
  try {
    const body = req.body || {};
    const now = Date.now();
    const id = typeof body.id === "string" && body.id.trim()
      ? body.id.trim()
      : `conv_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const saved = aiStore.saveConversation({
      id,
      title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : "New Conversation",
      createdAt: typeof body.createdAt === "number" ? body.createdAt : now,
      updatedAt: now,
      model: typeof body.model === "string" ? body.model : null,
      systemPrompt: typeof body.systemPrompt === "string" ? body.systemPrompt : "",
      mode: typeof body.mode === "string" ? body.mode : "assist",
      activeCourseId: typeof body.activeCourseId === "string" ? body.activeCourseId : null,
      activeApplicationId: typeof body.activeApplicationId === "string" ? body.activeApplicationId : null,
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      selectedCanvasObjectIds: Array.isArray(body.selectedCanvasObjectIds) ? body.selectedCanvasObjectIds : [],
      toolHistory: Array.isArray(body.toolHistory) ? body.toolHistory : [],
      messages: Array.isArray(body.messages) ? body.messages : [],
    });
    res.json({ ok: true, conversation: saved });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to save conversation" });
  }
});

app.get("/api/ai/conversations/:id", (req, res) => {
  try {
    const conv = aiStore.getConversation(req.params.id);
    if (!conv) return res.status(404).json({ ok: false, error: "Conversation not found" });
    res.json({ ok: true, conversation: conv });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to load conversation" });
  }
});

app.patch("/api/ai/conversations/:id", (req, res) => {
  try {
    const existing = aiStore.getConversation(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: "Conversation not found" });
    const body = req.body || {};
    const saved = aiStore.saveConversation({
      ...existing,
      ...body,
      id: req.params.id,
      updatedAt: Date.now(),
    });
    res.json({ ok: true, conversation: saved });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to update conversation" });
  }
});

app.delete("/api/ai/conversations/:id", (req, res) => {
  try {
    const deleted = aiStore.deleteConversation(req.params.id);
    res.json({ ok: true, deleted });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to delete conversation" });
  }
});

app.get("/api/ai/usage", (req, res) => {
  try {
    const limit = Number(req.query.limit) || 100;
    res.json({ ok: true, ...aiStore.getUsage(limit) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to load AI usage" });
  }
});

app.post("/api/ai/usage", (req, res) => {
  try {
    const body = req.body || {};
    if (!body.requestId) {
      return res.status(400).json({ ok: false, error: "requestId is required" });
    }
    aiStore.recordUsage({
      requestId: String(body.requestId),
      conversationId: String(body.conversationId || ""),
      provider: String(body.provider || "ollama"),
      model: String(body.model || ""),
      startTime: Number(body.startTime) || Date.now(),
      firstTokenLatencyMs: body.firstTokenLatencyMs ?? null,
      durationMs: Number(body.durationMs) || 0,
      inputTokens: Number(body.inputTokens) || 0,
      outputTokens: Number(body.outputTokens) || 0,
      tokensPerSec: body.tokensPerSec ?? null,
      estimatedMetrics: Boolean(body.estimatedMetrics),
      toolCallsCount: Number(body.toolCallsCount) || 0,
      cancelled: Boolean(body.cancelled),
      errorCode: body.errorCode ?? null,
      errorMessage: body.errorMessage ?? null,
      createdAt: Date.now(),
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to record AI usage" });
  }
});

app.get("/api/ai/diagnostics", async (_req, res) => {
  try {
    const settings = aiStore.getOllamaSettings();
    const probe = settings.enabled
      ? await ollamaAdapter.testConnection(settings.baseUrl, 2500)
      : { ok: false, connected: false, baseUrl: settings.baseUrl, version: null, latencyMs: 0 };
    const usage = aiStore.getUsage(25);
    res.json({
      ok: true,
      settings,
      providerProbe: probe,
      activeStreams: activeChatStreams.size,
      usageSummary: usage.summary,
      recentLogs: usage.logs,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to collect AI diagnostics" });
  }
});

// =============================================================================
// FOUNDRY STAGE 3 — SHARED DATABASE, KNOWLEDGE, RAG, MEMORY & SYNC API
// =============================================================================

// Academic Context (Courses, Assignments, Tasks, Notes)
app.get("/api/academic/courses", (_req, res) => {
  try {
    res.json({ ok: true, courses: sharedDatabase.getCourses() });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to get courses" });
  }
});

app.get("/api/academic/courses/:id", (req, res) => {
  try {
    const course = sharedDatabase.getCourse(req.params.id);
    if (!course) return res.status(404).json({ ok: false, error: "Course not found" });
    res.json({ ok: true, course });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to get course" });
  }
});

app.post("/api/academic/courses", (req, res) => {
  try {
    const body = req.body || {};
    const now = Date.now();
    const course = {
      id: body.id || `course_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      code: body.code || "COURSE",
      name: body.name || "Untitled Course",
      term: body.term || "Current Term",
      instructor: body.instructor,
      description: body.description,
      color: body.color,
      active: body.active !== undefined ? Boolean(body.active) : true,
      createdAt: body.createdAt || now,
      updatedAt: now,
    };
    sharedDatabase.upsertCourse(course);
    res.json({ ok: true, course });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to save course" });
  }
});

app.get("/api/academic/assignments", (req, res) => {
  try {
    const courseId = typeof req.query.courseId === "string" ? req.query.courseId : undefined;
    res.json({ ok: true, assignments: sharedDatabase.getAssignments(courseId) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to get assignments" });
  }
});

app.post("/api/academic/assignments", (req, res) => {
  try {
    const body = req.body || {};
    const now = Date.now();
    const assignment = {
      id: body.id || `assign_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      courseId: body.courseId || "CS-304",
      title: body.title || "Untitled Assignment",
      description: body.description,
      dueDate: body.dueDate || "Due Soon",
      status: body.status || "not_started",
      weight: typeof body.weight === "number" ? body.weight : undefined,
      points: typeof body.points === "number" ? body.points : undefined,
      createdAt: body.createdAt || now,
      updatedAt: now,
    };
    sharedDatabase.upsertAssignment(assignment);
    res.json({ ok: true, assignment });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to save assignment" });
  }
});

app.get("/api/academic/tasks", (req, res) => {
  try {
    const courseId = typeof req.query.courseId === "string" ? req.query.courseId : undefined;
    res.json({ ok: true, tasks: sharedDatabase.getTasks(courseId) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to get tasks" });
  }
});

app.post("/api/academic/tasks", (req, res) => {
  try {
    const body = req.body || {};
    const now = Date.now();
    const task = {
      id: body.id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      courseId: body.courseId,
      assignmentId: body.assignmentId,
      title: body.title || "Untitled Task",
      status: body.status || "pending",
      priority: body.priority || "medium",
      dueDate: body.dueDate,
      createdAt: body.createdAt || now,
      updatedAt: now,
    };
    sharedDatabase.upsertTask(task);
    res.json({ ok: true, task });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to save task" });
  }
});

app.get("/api/academic/notes", (req, res) => {
  try {
    const courseId = typeof req.query.courseId === "string" ? req.query.courseId : undefined;
    res.json({ ok: true, notes: sharedDatabase.getNotes(courseId) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to get notes" });
  }
});

app.post("/api/academic/notes", (req, res) => {
  try {
    const body = req.body || {};
    const now = Date.now();
    const note = {
      id: body.id || `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceId: body.workspaceId,
      courseId: body.courseId,
      assignmentId: body.assignmentId,
      title: body.title || "Untitled Note",
      content: body.content || "",
      format: body.format || "markdown",
      tags: Array.isArray(body.tags) ? body.tags : [],
      createdAt: body.createdAt || now,
      updatedAt: now,
    };
    sharedDatabase.upsertNote(note);
    res.json({ ok: true, note });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to save note" });
  }
});

// Knowledge Base Documents
app.get("/api/knowledge/documents", (req, res) => {
  try {
    const courseId = typeof req.query.courseId === "string" ? req.query.courseId : undefined;
    const query = typeof req.query.query === "string" ? req.query.query : undefined;
    res.json({ ok: true, documents: sharedDatabase.getDocuments({ courseId, query }) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to get documents" });
  }
});

app.get("/api/knowledge/documents/:id", (req, res) => {
  try {
    const doc = sharedDatabase.getDocument(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, error: "Document not found" });
    res.json({ ok: true, document: doc });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to get document" });
  }
});

app.post("/api/knowledge/documents", (req, res) => {
  try {
    const body = req.body || {};
    const now = Date.now();
    const docId = body.id || `doc_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const doc = {
      id: docId,
      name: body.name || "Untitled Document",
      sourceType: body.sourceType || "local",
      mimeType: body.mimeType || "text/plain",
      workspaceId: body.workspaceId ?? null,
      courseId: body.courseId ?? null,
      assignmentId: body.assignmentId ?? null,
      filePath: body.filePath ?? null,
      fileSize: Number(body.fileSize) || 0,
      tags: Array.isArray(body.tags) ? body.tags : [],
      extractionStatus: body.extractionStatus || "extracted",
      indexingStatus: body.indexingStatus || "indexed",
      revision: Number(body.revision) || 1,
      sourceUrl: body.sourceUrl ?? null,
      googleFileId: body.googleFileId ?? null,
      extractedText: body.extractedText ?? null,
      summary: body.summary ?? null,
      createdAt: body.createdAt || now,
      updatedAt: now,
    };
    sharedDatabase.upsertDocument(doc);

    // If chunks are provided, store them
    if (Array.isArray(body.chunks) && body.chunks.length > 0) {
      sharedDatabase.setDocumentChunks(docId, body.chunks);
    }

    res.json({ ok: true, document: doc });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to save document" });
  }
});

app.delete("/api/knowledge/documents/:id", (req, res) => {
  try {
    const success = sharedDatabase.deleteDocument(req.params.id);
    res.json({ ok: true, deleted: success });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to delete document" });
  }
});

app.get("/api/knowledge/documents/:id/chunks", (req, res) => {
  try {
    res.json({ ok: true, chunks: sharedDatabase.getDocumentChunks(req.params.id) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to get chunks" });
  }
});

// RAG Retrieval & Embedding Proxy
app.post("/api/rag/search", (req, res) => {
  try {
    const body = req.body || {};
    const query = typeof body.query === "string" ? body.query : "";
    const courseId = typeof body.courseId === "string" ? body.courseId : undefined;
    const limit = typeof body.limit === "number" ? body.limit : 5;

    const results = sharedDatabase.searchChunks(query, { courseId, limit });
    res.json({ ok: true, query, courseId, count: results.length, chunks: results });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "RAG search failed" });
  }
});

app.post("/api/rag/embed", async (req, res) => {
  try {
    const settings = aiStore.getOllamaSettings();
    const targetUrl = typeof req.body?.baseUrl === "string" ? req.body.baseUrl : settings.baseUrl;
    const model = typeof req.body?.model === "string" ? req.body.model : "nomic-embed-text";
    const text = typeof req.body?.text === "string" ? req.body.text : "";

    if (!text) {
      return res.status(400).json({ ok: false, error: "Text is required for embedding" });
    }

    // Attempt local Ollama /api/embed
    try {
      const url = `${targetUrl.replace(/\/+$/, "")}/api/embed`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: text }),
        signal: AbortSignal.timeout(5000),
      });

      if (resp.ok) {
        const data = await resp.json();
        return res.json({
          ok: true,
          provider: "ollama",
          model,
          embedding: Array.isArray(data.embeddings) ? data.embeddings[0] : [],
        });
      }
    } catch {}

    // Truthful fallback when no local embedding model is installed in Ollama
    res.json({
      ok: false,
      errorCode: "NO_EMBEDDING_MODEL",
      error: `Local embedding model "${model}" is not installed or unreachable in Ollama. Falling back to keyword search.`,
      fallback: "keyword",
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Embedding failed" });
  }
});

// AI Memories
app.get("/api/memory", (req, res) => {
  try {
    const courseId = typeof req.query.courseId === "string" ? req.query.courseId : undefined;
    const scope = typeof req.query.scope === "string" ? req.query.scope : undefined;
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    res.json({ ok: true, memories: sharedDatabase.getMemories({ courseId, scope, type }) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to get memories" });
  }
});

app.post("/api/memory", (req, res) => {
  try {
    const body = req.body || {};
    const now = Date.now();
    const mem = {
      id: body.id || `mem_${now}_${Math.random().toString(36).slice(2, 6)}`,
      type: body.type || "preference",
      content: body.content || "",
      scope: body.scope || "user",
      workspaceId: body.workspaceId ?? null,
      courseId: body.courseId ?? null,
      sourceConversationId: body.sourceConversationId ?? null,
      status: body.status || "approved",
      createdAt: body.createdAt || now,
      updatedAt: now,
    };
    sharedDatabase.upsertMemory(mem);
    res.json({ ok: true, memory: mem });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to save memory" });
  }
});

app.delete("/api/memory/:id", (req, res) => {
  try {
    const success = sharedDatabase.deleteMemory(req.params.id);
    res.json({ ok: true, deleted: success });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to delete memory" });
  }
});

// Flashcards & Study Guides
app.get("/api/academic/flashcards/decks", (req, res) => {
  try {
    const courseId = typeof req.query.courseId === "string" ? req.query.courseId : undefined;
    res.json({ ok: true, decks: sharedDatabase.getFlashcardDecks(courseId) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to get decks" });
  }
});

app.post("/api/academic/flashcards/decks", (req, res) => {
  try {
    const body = req.body || {};
    const now = Date.now();
    const deck = {
      id: body.id || `deck_${now}_${Math.random().toString(36).slice(2, 6)}`,
      courseId: body.courseId || "CS-304",
      title: body.title || "Untitled Deck",
      description: body.description,
      sourceDocumentId: body.sourceDocumentId ?? null,
      tags: Array.isArray(body.tags) ? body.tags : [],
      createdAt: body.createdAt || now,
      updatedAt: now,
    };
    sharedDatabase.upsertFlashcardDeck(deck);
    res.json({ ok: true, deck });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to save deck" });
  }
});

app.get("/api/academic/flashcards", (req, res) => {
  try {
    const deckId = typeof req.query.deckId === "string" ? req.query.deckId : "";
    if (!deckId) return res.status(400).json({ ok: false, error: "deckId is required" });
    res.json({ ok: true, cards: sharedDatabase.getFlashcards(deckId) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to get flashcards" });
  }
});

app.post("/api/academic/flashcards", (req, res) => {
  try {
    const body = req.body || {};
    const now = Date.now();
    const card = {
      id: body.id || `card_${now}_${Math.random().toString(36).slice(2, 6)}`,
      deckId: body.deckId,
      front: body.front || "",
      back: body.back || "",
      hint: body.hint,
      sourceRef: body.sourceRef,
      reviewCount: Number(body.reviewCount) || 0,
      easeFactor: Number(body.easeFactor) || 2.5,
      createdAt: body.createdAt || now,
      updatedAt: now,
    };
    sharedDatabase.upsertFlashcard(card);
    res.json({ ok: true, card });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to save flashcard" });
  }
});

// Synchronization & System Stats
app.get("/api/sync/jobs", (req, res) => {
  try {
    const limit = Number(req.query.limit) || 20;
    res.json({ ok: true, jobs: sharedDatabase.getSyncJobs(limit) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to get sync jobs" });
  }
});

app.post("/api/sync/jobs", (req, res) => {
  try {
    const body = req.body || {};
    const now = Date.now();
    const job = {
      id: body.id || `sync_${now}_${Math.random().toString(36).slice(2, 6)}`,
      targetType: body.targetType || "document",
      targetId: body.targetId || "",
      provider: body.provider || "google",
      action: body.action || "sync",
      status: body.status || "synchronized",
      details: body.details || {},
      createdAt: now,
      completedAt: now,
    };
    sharedDatabase.recordSyncJob(job);
    res.json({ ok: true, job });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to record sync job" });
  }
});

app.get("/api/data/stats", (_req, res) => {
  try {
    res.json({ ok: true, stats: sharedDatabase.getStats() });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to get stats" });
  }
});

app.get("/api/data/export", (_req, res) => {
  try {
    res.json({
      ok: true,
      exportedAt: Date.now(),
      courses: sharedDatabase.getCourses(),
      assignments: sharedDatabase.getAssignments(),
      tasks: sharedDatabase.getTasks(),
      notes: sharedDatabase.getNotes(),
      documents: sharedDatabase.getDocuments(),
      memories: sharedDatabase.getMemories(),
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to export data" });
  }
});

// WebSocket Server initialization
const wss = new WebSocketServer({ server, path: "/ws" });

function broadcast(msg: any, senderWs?: WebSocket, targetBoardId?: string) {
  const payload = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client !== senderWs) {
      if (!targetBoardId || (clientBoardMap.get(client) || DEFAULT_BOARD_ID) === targetBoardId) {
        client.send(payload);
      }
    }
  }
}

wss.on("connection", (ws: WebSocket) => {
  let currentUserId: string | null = null;

  ws.on("message", async (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      switch (data.type) {
        case "user:init": {
          const targetBoardId = data.boardId || data.user.boardId || DEFAULT_BOARD_ID;
          clientBoardMap.set(ws, targetBoardId);
          currentUserId = data.user.id;
          clients.set(ws, currentUserId);

          const usersMap = getBoardUsersMap(targetBoardId);
          const userObj: UserPresence = {
            id: data.user.id,
            name: data.user.name,
            color: data.user.color,
            lastActive: Date.now(),
          };
          usersMap.set(currentUserId, userObj);
          activeUsers.set(currentUserId, userObj);

          // Send current state to newly joined user
          const elementsMap = await getBoardElementsMap(targetBoardId);
          ws.send(
            JSON.stringify({
              type: "board:init",
              boardId: targetBoardId,
              elements: Array.from(elementsMap.values()),
              users: Array.from(usersMap.values()),
              history: getBoardActivityList(targetBoardId).slice(-50),
            })
          );

          // Broadcast user joined to others on the same board
          broadcast(
            {
              type: "user:join",
              boardId: targetBoardId,
              user: userObj,
            },
            ws,
            targetBoardId
          );
          break;
        }

        case "board:switch": {
          const oldBoardId = clientBoardMap.get(ws) || DEFAULT_BOARD_ID;
          const newBoardId = data.boardId || DEFAULT_BOARD_ID;
          if (oldBoardId !== newBoardId) {
            if (currentUserId) {
              const oldUsers = getBoardUsersMap(oldBoardId);
              oldUsers.delete(currentUserId);
              broadcast({ type: "user:leave", userId: currentUserId, boardId: oldBoardId }, ws, oldBoardId);
            }
            clientBoardMap.set(ws, newBoardId);
            if (currentUserId) {
              const newUsers = getBoardUsersMap(newBoardId);
              const userObj = activeUsers.get(currentUserId);
              if (userObj) {
                newUsers.set(currentUserId, userObj);
                broadcast({ type: "user:join", user: userObj, boardId: newBoardId }, ws, newBoardId);
              }
            }
          }
          const elementsMap = await getBoardElementsMap(newBoardId);
          const usersMap = getBoardUsersMap(newBoardId);
          ws.send(
            JSON.stringify({
              type: "board:init",
              boardId: newBoardId,
              elements: Array.from(elementsMap.values()),
              users: Array.from(usersMap.values()),
              history: getBoardActivityList(newBoardId).slice(-50),
            })
          );
          break;
        }

        case "cursor:move": {
          if (!currentUserId) return;
          const boardId = clientBoardMap.get(ws) || DEFAULT_BOARD_ID;
          const usersMap = getBoardUsersMap(boardId);
          const user = usersMap.get(currentUserId) || activeUsers.get(currentUserId);
          if (user) {
            user.cursor = data.cursor;
            user.selectedIds = data.selectedIds;
            if (data.activeAction !== undefined) user.activeAction = data.activeAction;
            if (data.viewport !== undefined) user.viewport = data.viewport;
            user.lastActive = Date.now();
            broadcast(
              {
                type: "cursor:update",
                boardId,
                userId: currentUserId,
                cursor: data.cursor,
                selectedIds: data.selectedIds,
                activeAction: user.activeAction,
                viewport: user.viewport,
              },
              ws,
              boardId
            );
          }
          break;
        }

        case "laser:point": {
          if (!currentUserId) return;
          const boardId = data.boardId || clientBoardMap.get(ws) || DEFAULT_BOARD_ID;
          const usersMap = getBoardUsersMap(boardId);
          const user = usersMap.get(currentUserId) || activeUsers.get(currentUserId);
          broadcast(
            {
              type: "laser:point",
              boardId,
              userId: currentUserId,
              userName: user?.name || "Collaborator",
              color: data.color || user?.color || "#ef4444",
              point: data.point,
              timestamp: Date.now(),
            },
            ws,
            boardId
          );
          break;
        }

        case "reaction:burst": {
          if (!currentUserId) return;
          const boardId = data.boardId || clientBoardMap.get(ws) || DEFAULT_BOARD_ID;
          const usersMap = getBoardUsersMap(boardId);
          const user = usersMap.get(currentUserId) || activeUsers.get(currentUserId);
          broadcast(
            {
              type: "reaction:burst",
              boardId,
              id: data.id || "rx_" + Math.random().toString(36).substring(2, 9),
              userId: currentUserId,
              userName: user?.name || "Collaborator",
              emoji: data.emoji || "🎉",
              point: data.point,
              timestamp: Date.now(),
            },
            ws,
            boardId
          );
          break;
        }

        case "presentation:slide": {
          const boardId = data.boardId || clientBoardMap.get(ws) || DEFAULT_BOARD_ID;
          broadcast(
            {
              type: "presentation:slide",
              boardId,
              userId: currentUserId,
              slideIndex: data.slideIndex,
            },
            ws,
            boardId
          );
          break;
        }

        case "activity:add": {
          if (data.item) {
            const boardId = data.boardId || clientBoardMap.get(ws) || DEFAULT_BOARD_ID;
            recordActivity(
              data.item.userId || currentUserId || "user",
              data.item.userName || "User",
              data.item.userColor || "#3b82f6",
              data.item.action,
              data.item.elementId,
              data.item.elementTitle,
              boardId
            );
          }
          break;
        }

        case "element:create": {
          if (data.element && data.element.id) {
            const boardId = data.boardId || clientBoardMap.get(ws) || DEFAULT_BOARD_ID;
            const elementsMap = await getBoardElementsMap(boardId);
            const revsMap = getRevisionsMap(boardId);

            const rev = (revsMap.get(data.element.id) || 0) + 1;
            revsMap.set(data.element.id, rev);
            const elWithRev = { ...data.element, revision: rev };
            elementsMap.set(data.element.id, elWithRev);
            boardStore.createElement(boardId, elWithRev as any).catch((err) => {
              console.error("[Persistence] Error persisting created element:", err);
            });
            broadcast({ type: "element:created", boardId, element: elWithRev }, ws, boardId);

            const user = currentUserId ? activeUsers.get(currentUserId) : null;
            recordActivity(
              user?.id || "user",
              user?.name || "Someone",
              user?.color || "#3b82f6",
              `Created ${data.element.type} "${data.element.title || data.element.content?.slice(0, 24) || data.element.type}"`,
              data.element.id,
              data.element.title,
              boardId
            );
          }
          break;
        }

        case "element:update": {
          if (data.element && data.element.id) {
            const boardId = data.boardId || clientBoardMap.get(ws) || DEFAULT_BOARD_ID;
            const elementsMap = await getBoardElementsMap(boardId);
            const revsMap = getRevisionsMap(boardId);

            const existing = elementsMap.get(data.element.id) || ({} as any);
            const rev = (revsMap.get(data.element.id) || 1) + 1;
            revsMap.set(data.element.id, rev);
            const merged = { ...existing, ...data.element, revision: rev };
            elementsMap.set(data.element.id, merged);
            boardStore.updateElement(boardId, merged as any).catch((err) => {
              console.error("[Persistence] Error persisting updated element:", err);
            });
            broadcast({ type: "element:updated", boardId, element: merged }, ws, boardId);
          }
          break;
        }

        case "elements:batch_update": {
          if (Array.isArray(data.elements)) {
            const boardId = data.boardId || clientBoardMap.get(ws) || DEFAULT_BOARD_ID;
            const elementsMap = await getBoardElementsMap(boardId);
            const revsMap = getRevisionsMap(boardId);

            const mergedList: any[] = [];
            data.elements.forEach((el: BoardElement) => {
              const existing = elementsMap.get(el.id) || ({} as any);
              const rev = (revsMap.get(el.id) || 1) + 1;
              revsMap.set(el.id, rev);
              const merged = { ...existing, ...el, revision: rev };
              elementsMap.set(el.id, merged);
              mergedList.push(merged);
            });
            boardStore.batchUpdateElements(boardId, mergedList).catch((err) => {
              console.error("[Persistence] Error persisting batch update:", err);
            });
            broadcast({ type: "elements:batch_updated", boardId, elements: mergedList }, ws, boardId);
          }
          break;
        }

        case "element:delete": {
          if (data.id) {
            const boardId = data.boardId || clientBoardMap.get(ws) || DEFAULT_BOARD_ID;
            const elementsMap = await getBoardElementsMap(boardId);
            const revsMap = getRevisionsMap(boardId);

            const el = elementsMap.get(data.id);
            elementsMap.delete(data.id);
            revsMap.delete(data.id);
            boardStore.deleteElement(boardId, data.id).catch((err) => {
              console.error("[Persistence] Error persisting deleted element:", err);
            });
            broadcast({ type: "element:deleted", boardId, id: data.id }, ws, boardId);

            const user = currentUserId ? activeUsers.get(currentUserId) : null;
            recordActivity(
              user?.id || "user",
              user?.name || "Someone",
              user?.color || "#3b82f6",
              `Deleted ${el?.type || "object"} "${el?.title || el?.content?.slice(0, 20) || data.id}"`,
              data.id,
              el?.title,
              boardId
            );
          }
          break;
        }

        case "elements:batch_delete": {
          if (Array.isArray(data.ids)) {
            const boardId = data.boardId || clientBoardMap.get(ws) || DEFAULT_BOARD_ID;
            const elementsMap = await getBoardElementsMap(boardId);
            const revsMap = getRevisionsMap(boardId);

            data.ids.forEach((id: string) => {
              elementsMap.delete(id);
              revsMap.delete(id);
            });
            boardStore.batchDeleteElements(boardId, data.ids).catch((err) => {
              console.error("[Persistence] Error persisting batch delete:", err);
            });
            broadcast({ type: "elements:batch_deleted", boardId, ids: data.ids }, ws, boardId);

            const user = currentUserId ? activeUsers.get(currentUserId) : null;
            recordActivity(
              user?.id || "user",
              user?.name || "Someone",
              user?.color || "#3b82f6",
              `Deleted ${data.ids.length} objects`,
              undefined,
              undefined,
              boardId
            );
          }
          break;
        }

        case "operation:apply": {
          const op = data.operation;
          if (!op || !op.type) break;
          const boardId = op.boardId || data.boardId || clientBoardMap.get(ws) || DEFAULT_BOARD_ID;
          const elementsMap = await getBoardElementsMap(boardId);
          const revsMap = getRevisionsMap(boardId);

          const isUndo = Boolean(data.isUndo);
          const isRedo = Boolean(data.isRedo);
          const user = currentUserId ? activeUsers.get(currentUserId) : null;
          const actorName = user?.name || op.actorName || "Collaborator";
          const actorId = user?.id || op.actorId || "user";
          const actorColor = user?.color || "#3b82f6";

          if (op.type === "delete") {
            const el = elementsMap.get(op.elementId);
            if (!el) {
              ws.send(
                JSON.stringify({
                  type: "operation:conflict",
                  boardId,
                  operationId: op.operationId,
                  reason: "Element no longer exists on board",
                })
              );
              break;
            }

            // If undoing a create: check if someone else edited it
            const currentRev = revsMap.get(op.elementId) || 1;
            if (isUndo && op.baseRevision && currentRev > op.baseRevision) {
              ws.send(
                JSON.stringify({
                  type: "operation:conflict",
                  boardId,
                  operationId: op.operationId,
                  elementId: op.elementId,
                  reason: "Cannot undo create: element was modified by another collaborator",
                })
              );
              break;
            }

            elementsMap.delete(op.elementId);
            revsMap.delete(op.elementId);
            boardStore.deleteElement(boardId, op.elementId).catch((err) => {
              console.error("[Persistence] Error persisting operation delete:", err);
            });
            broadcast({ type: "element:deleted", boardId, id: op.elementId }, undefined, boardId);
            ws.send(JSON.stringify({ type: "element:deleted", boardId, id: op.elementId }));

            recordActivity(
              actorId,
              actorName,
              actorColor,
              `${isUndo ? "Undid" : "Redid"} ${op.description || "delete"}`,
              op.elementId,
              el.title,
              boardId
            );
          } else if (op.type === "create") {
            const el = op.element;
            const rev = (revsMap.get(el.id) || 0) + 1;
            el.revision = rev;
            revsMap.set(el.id, rev);
            elementsMap.set(el.id, el);
            boardStore.createElement(boardId, el as any).catch((err) => {
              console.error("[Persistence] Error persisting operation create:", err);
            });
            broadcast({ type: "element:created", boardId, element: el }, undefined, boardId);
            ws.send(JSON.stringify({ type: "element:created", boardId, element: el }));

            recordActivity(
              actorId,
              actorName,
              actorColor,
              `${isUndo ? "Undid" : "Redid"} ${op.description || "create"}`,
              el.id,
              el.title,
              boardId
            );
          } else if (op.type === "update") {
            const current = elementsMap.get(op.elementId);
            if (!current) {
              ws.send(
                JSON.stringify({
                  type: "operation:conflict",
                  boardId,
                  operationId: op.operationId,
                  elementId: op.elementId,
                  reason: "Cannot undo: element was deleted by another collaborator",
                })
              );
              break;
            }

            // Reconcile with 3-way field-aware diffing
            const result = reconcileUpdateWithConflict(current as any, op.before, op.after);
            if (!result.canApplyPartial || !result.reconciledElement) {
              ws.send(
                JSON.stringify({
                  type: "operation:conflict",
                  boardId,
                  operationId: op.operationId,
                  elementId: op.elementId,
                  conflictingFields: result.conflictingFields,
                  reason: result.reason || "Undo conflict: property was modified by another collaborator",
                })
              );
              break;
            }

            const rev = (revsMap.get(op.elementId) || 1) + 1;
            revsMap.set(op.elementId, rev);
            const updated = { ...result.reconciledElement, revision: rev };
            elementsMap.set(op.elementId, updated);
            boardStore.updateElement(boardId, updated as any).catch((err) => {
              console.error("[Persistence] Error persisting operation update:", err);
            });

            broadcast({ type: "element:updated", boardId, element: updated }, undefined, boardId);
            ws.send(JSON.stringify({ type: "element:updated", boardId, element: updated }));

            if (result.hasConflict) {
              ws.send(
                JSON.stringify({
                  type: "operation:conflict_resolved",
                  boardId,
                  operationId: op.operationId,
                  elementId: op.elementId,
                  reason: result.reason,
                })
              );
            }

            recordActivity(
              actorId,
              actorName,
              actorColor,
              `${isUndo ? "Undid" : "Redid"} "${op.description}"`,
              op.elementId,
              updated.title,
              boardId
            );
          } else if (op.type === "batch_update") {
            const mergedList: any[] = [];
            let anyConflict = false;

            op.updates.forEach((u: any) => {
              const current = elementsMap.get(u.id);
              if (!current) return;
              const res = reconcileUpdateWithConflict(current as any, u.before, u.after);
              if (res.canApplyPartial && res.reconciledElement) {
                if (res.hasConflict) anyConflict = true;
                const rev = (revsMap.get(u.id) || 1) + 1;
                revsMap.set(u.id, rev);
                const item = { ...res.reconciledElement, revision: rev };
                elementsMap.set(u.id, item);
                mergedList.push(item);
              }
            });

            if (mergedList.length > 0) {
              boardStore.batchUpdateElements(boardId, mergedList).catch((err) => {
                console.error("[Persistence] Error persisting operation batch update:", err);
              });
              broadcast({ type: "elements:batch_updated", boardId, elements: mergedList }, undefined, boardId);
              ws.send(JSON.stringify({ type: "elements:batch_updated", boardId, elements: mergedList }));

              if (anyConflict) {
                ws.send(
                  JSON.stringify({
                    type: "operation:conflict_resolved",
                    boardId,
                    operationId: op.operationId,
                    reason: "Partially restored batch: preserved newer edits on conflicting properties",
                  })
                );
              }

              recordActivity(
                actorId,
                actorName,
                actorColor,
                `${isUndo ? "Undid" : "Redid"} "${op.description}"`,
                undefined,
                undefined,
                boardId
              );
            }
          } else if (op.type === "batch_delete") {
            const ids = op.elements.map((e: any) => e.id);
            ids.forEach((id: string) => {
              elementsMap.delete(id);
              revsMap.delete(id);
            });
            boardStore.batchDeleteElements(boardId, ids).catch((err) => {
              console.error("[Persistence] Error persisting operation batch delete:", err);
            });
            broadcast({ type: "elements:batch_deleted", boardId, ids }, undefined, boardId);
            ws.send(JSON.stringify({ type: "elements:batch_deleted", boardId, ids }));

            recordActivity(
              actorId,
              actorName,
              actorColor,
              `${isUndo ? "Undid" : "Redid"} "${op.description}"`,
              undefined,
              undefined,
              boardId
            );
          } else if (op.type === "batch_create") {
            const list: any[] = [];
            op.elements.forEach((el: any) => {
              const rev = (revsMap.get(el.id) || 0) + 1;
              el.revision = rev;
              revsMap.set(el.id, rev);
              elementsMap.set(el.id, el);
              list.push(el);
              boardStore.createElement(boardId, el as any).catch((err) => {
                console.error("[Persistence] Error persisting operation batch create:", err);
              });
            });
            broadcast({ type: "elements:batch_updated", boardId, elements: list }, undefined, boardId);
            ws.send(JSON.stringify({ type: "elements:batch_updated", boardId, elements: list }));

            recordActivity(
              actorId,
              actorName,
              actorColor,
              `${isUndo ? "Undid" : "Redid"} "${op.description}"`,
              undefined,
              undefined,
              boardId
            );
          }
          break;
        }

        case "board:replace": {
          if (Array.isArray(data.elements)) {
            const boardId = data.boardId || clientBoardMap.get(ws) || DEFAULT_BOARD_ID;
            const elementsMap = await getBoardElementsMap(boardId);
            elementsMap.clear();
            data.elements.forEach((el: BoardElement) => elementsMap.set(el.id, el));
            boardStore.replaceBoardElements(boardId, data.elements as any).catch((err) => {
              console.error("[Persistence] Error persisting board replace:", err);
            });
            broadcast({ type: "board:synced", boardId, elements: data.elements }, ws, boardId);
          }
          break;
        }
      }
    } catch (e) {
      console.error("WS error parsing message:", e);
    }
  });

  ws.on("close", () => {
    if (currentUserId) {
      const boardId = clientBoardMap.get(ws) || DEFAULT_BOARD_ID;
      const usersMap = getBoardUsersMap(boardId);
      usersMap.delete(currentUserId);
      activeUsers.delete(currentUserId);
      clients.delete(ws);
      clientBoardMap.delete(ws);
      broadcast({ type: "user:leave", userId: currentUserId, boardId }, undefined, boardId);
    }
  });
});

// Periodic cleanup of stale users (30s)
setInterval(() => {
  const now = Date.now();
  for (const [id, user] of activeUsers.entries()) {
    if (now - user.lastActive > 30000) {
      activeUsers.delete(id);
      broadcast({ type: "user:leave", userId: id });
    }
  }
}, 10000);

async function startServer() {
  await initializePersistence();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server with WebSockets running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
