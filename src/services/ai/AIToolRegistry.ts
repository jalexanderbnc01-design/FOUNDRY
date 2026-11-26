/**
 * Foundry Stage 2 — AI Tool Registry (Phase 08)
 * Registers validated schemas for Canvas, Window, Application, and Education tools.
 * Enforces strict argument validation, honest capability availability (never faking
 * unimplemented operations), and Diagnostics reporting.
 */
import { applicationRegistry } from "../ApplicationRegistry";
import { windowManager } from "../WindowManager";
import { sharedContextManager } from "../SharedContextManager";
import { diagnosticsManager } from "../DiagnosticsManager";
import { BoardElement, ShapeType, Viewport } from "../../types";
import { AIToolDefinition } from "./types";
import { sharedDatabaseClient } from "../data/SharedDatabaseClient";
import { knowledgeBaseManager } from "../knowledge/KnowledgeBaseManager";
import { ragEngine } from "../rag/RAGEngine";
import { aiMemoryManager } from "./AIMemoryManager";
import { googleWorkspaceService } from "../google/GoogleWorkspaceService";
import { googleOAuthManager } from "../google/GoogleOAuthManager";

export interface CanvasToolHandler {
  getObjects: (filter?: { type?: string; limit?: number }) => BoardElement[];
  getSelection: () => BoardElement[];
  getViewport: () => Viewport;
  createNote: (args: {
    content: string;
    x?: number;
    y?: number;
    color?: string;
    width?: number;
    height?: number;
  }) => BoardElement;
  createText: (args: {
    content: string;
    x?: number;
    y?: number;
    fontSize?: number;
    color?: string;
  }) => BoardElement;
  createShape: (args: {
    shapeType: ShapeType;
    content?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fillColor?: string;
    strokeColor?: string;
  }) => BoardElement;
  createFrame: (args: {
    title: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    strokeColor?: string;
  }) => BoardElement;
  connectObjects: (args: {
    fromId: string;
    toId: string;
    label?: string;
    lineStyle?: "straight" | "curved" | "orthogonal";
  }) => BoardElement;
  moveObject: (args: { id: string; x: number; y: number }) => BoardElement;
  focusObject: (args: { id: string; zoom?: number }) => { id: string; viewport: Viewport };
}

export interface ToolValidationResult {
  valid: boolean;
  sanitizedArgs: Record<string, any>;
  errors: string[];
}

export class ToolError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

class AIToolRegistryService {
  private tools: Map<string, AIToolDefinition> = new Map();
  private canvasHandler: CanvasToolHandler | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.registerBuiltInTools();
    this.reportDiagnostics();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.reportDiagnostics();
    this.listeners.forEach((l) => {
      try {
        l();
      } catch {}
    });
  }

  setCanvasHandler(handler: CanvasToolHandler | null) {
    this.canvasHandler = handler;
    this.notify();
  }

  hasCanvasHandler(): boolean {
    return this.canvasHandler !== null;
  }

  registerTool(tool: AIToolDefinition) {
    this.tools.set(tool.name, tool);
    this.notify();
  }

  listTools(includeUnavailable = true): AIToolDefinition[] {
    const all = Array.from(this.tools.values());
    return includeUnavailable ? all : all.filter((t) => t.available);
  }

  getTool(name: string): AIToolDefinition | undefined {
    const direct = this.tools.get(name);
    if (direct) return direct;
    // Allow underscore fallback alias in case an LLM emits canvas_create_note instead of canvas.create_note
    for (const tool of this.tools.values()) {
      if (tool.name.replace(/\./g, "_") === name) {
        return tool;
      }
    }
    return undefined;
  }

  /**
   * Build Ollama-compatible tool definitions only for currently available tools.
   */
  getOllamaTools(allowedNames?: Set<string>): Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: AIToolDefinition["inputSchema"];
    };
  }> {
    return this.listTools(false)
      .filter((t) => !allowedNames || allowedNames.has(t.name))
      .map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));
  }

  validateArguments(tool: AIToolDefinition, rawArgs: unknown): ToolValidationResult {
    const errors: string[] = [];
    if (rawArgs === undefined || rawArgs === null) {
      rawArgs = {};
    }
    if (typeof rawArgs !== "object" || Array.isArray(rawArgs)) {
      return {
        valid: false,
        sanitizedArgs: {},
        errors: [`Tool "${tool.name}" arguments must be a JSON object.`],
      };
    }

    const input = rawArgs as Record<string, any>;
    const props = tool.inputSchema.properties || {};
    const required = tool.inputSchema.required || [];
    const sanitized: Record<string, any> = {};

    for (const reqKey of required) {
      if (input[reqKey] === undefined || input[reqKey] === null || input[reqKey] === "") {
        errors.push(`Missing required parameter "${reqKey}".`);
      }
    }

    for (const [key, val] of Object.entries(input)) {
      if (!(key in props)) {
        errors.push(`Unexpected parameter "${key}" for tool "${tool.name}".`);
        continue;
      }
      if (val === undefined || val === null) continue;
      const schema = props[key];
      const expectedType = schema.type;

      if (expectedType === "string") {
        if (typeof val !== "string") {
          errors.push(`Parameter "${key}" must be a string.`);
          continue;
        }
        if (typeof schema.minLength === "number" && val.length < schema.minLength) {
          errors.push(`Parameter "${key}" must be at least ${schema.minLength} characters.`);
          continue;
        }
        if (typeof schema.maxLength === "number" && val.length > schema.maxLength) {
          errors.push(`Parameter "${key}" exceeds maxLength ${schema.maxLength}.`);
          continue;
        }
        if (Array.isArray(schema.enum) && !schema.enum.includes(val)) {
          errors.push(`Parameter "${key}" must be one of: ${schema.enum.join(", ")}.`);
          continue;
        }
        sanitized[key] = val;
      } else if (expectedType === "number" || expectedType === "integer") {
        const num = typeof val === "number" ? val : Number(val);
        if (!Number.isFinite(num)) {
          errors.push(`Parameter "${key}" must be a finite number.`);
          continue;
        }
        if (expectedType === "integer" && !Number.isInteger(num)) {
          errors.push(`Parameter "${key}" must be an integer.`);
          continue;
        }
        if (typeof schema.minimum === "number" && num < schema.minimum) {
          errors.push(`Parameter "${key}" must be >= ${schema.minimum}.`);
          continue;
        }
        if (typeof schema.maximum === "number" && num > schema.maximum) {
          errors.push(`Parameter "${key}" must be <= ${schema.maximum}.`);
          continue;
        }
        sanitized[key] = num;
      } else if (expectedType === "boolean") {
        if (typeof val !== "boolean") {
          errors.push(`Parameter "${key}" must be a boolean.`);
          continue;
        }
        sanitized[key] = val;
      } else if (expectedType === "object") {
        if (typeof val !== "object" || Array.isArray(val)) {
          errors.push(`Parameter "${key}" must be an object.`);
          continue;
        }
        sanitized[key] = val;
      } else if (expectedType === "array") {
        if (!Array.isArray(val)) {
          errors.push(`Parameter "${key}" must be an array.`);
          continue;
        }
        sanitized[key] = val;
      } else {
        sanitized[key] = val;
      }
    }

    return {
      valid: errors.length === 0,
      sanitizedArgs: sanitized,
      errors,
    };
  }

  async executeValidated(name: string, validatedArgs: Record<string, any>): Promise<any> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new ToolError("UNKNOWN_OPERATION", `Unknown AI tool: ${name}`);
    }
    if (!tool.available || !tool.handler) {
      throw new ToolError(
        "UNAVAILABLE_OPERATION",
        tool.unavailableReason || `Tool "${tool.name}" does not have an operational runtime API yet.`
      );
    }
    return await Promise.resolve(tool.handler(validatedArgs));
  }

  private requireCanvas(): CanvasToolHandler {
    if (!this.canvasHandler) {
      throw new ToolError("UNAVAILABLE_OPERATION", "Canvas engine handler is not mounted.");
    }
    return this.canvasHandler;
  }

  private registerBuiltInTools() {
    // ===== CANVAS TOOLS =====
    this.tools.set("canvas.get_objects", {
      name: "canvas.get_objects",
      namespace: "canvas",
      description: "Read objects currently placed on the active Foundry whiteboard canvas.",
      category: "read",
      available: true,
      inputSchema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "Optional element type filter (sticky, shape, text, frame, connector, html, draw).",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 200,
            description: "Maximum objects to return (default 50).",
          },
        },
      },
      handler: (args) => {
        const items = this.requireCanvas().getObjects({
          type: args.type,
          limit: args.limit || 50,
        });
        return {
          count: items.length,
          objects: items.map((el) => ({
            id: el.id,
            type: el.type,
            title: el.title || null,
            shapeType: el.shapeType || null,
            content: el.content ? el.content.slice(0, 300) : null,
            x: Math.round(el.x),
            y: Math.round(el.y),
            width: Math.round(el.width),
            height: Math.round(el.height),
          })),
        };
      },
    });

    this.tools.set("canvas.get_selection", {
      name: "canvas.get_selection",
      namespace: "canvas",
      description: "Read currently selected objects on the canvas.",
      category: "read",
      available: true,
      inputSchema: { type: "object", properties: {} },
      handler: () => {
        const items = this.requireCanvas().getSelection();
        return {
          count: items.length,
          selectedIds: items.map((e) => e.id),
          objects: items.map((el) => ({
            id: el.id,
            type: el.type,
            title: el.title || null,
            content: el.content ? el.content.slice(0, 400) : null,
            x: Math.round(el.x),
            y: Math.round(el.y),
            width: Math.round(el.width),
            height: Math.round(el.height),
          })),
        };
      },
    });

    this.tools.set("canvas.get_viewport", {
      name: "canvas.get_viewport",
      namespace: "canvas",
      description: "Get the current canvas pan offset and zoom level.",
      category: "read",
      available: true,
      inputSchema: { type: "object", properties: {} },
      handler: () => this.requireCanvas().getViewport(),
    });

    this.tools.set("canvas.create_note", {
      name: "canvas.create_note",
      namespace: "canvas",
      description: "Create a sticky note on the canvas.",
      category: "create_modify",
      available: true,
      inputSchema: {
        type: "object",
        required: ["content"],
        properties: {
          content: { type: "string", minLength: 1, maxLength: 2000, description: "Note text content." },
          x: { type: "number", description: "Canvas X coordinate (defaults to viewport center)." },
          y: { type: "number", description: "Canvas Y coordinate (defaults to viewport center)." },
          color: { type: "string", description: "Optional hex background color (e.g. #fef08a)." },
          width: { type: "number", minimum: 100, maximum: 800 },
          height: { type: "number", minimum: 80, maximum: 800 },
        },
      },
      handler: (args) => {
        const created = this.requireCanvas().createNote(args as any);
        return { id: created.id, type: created.type, x: created.x, y: created.y, content: created.content };
      },
    });

    this.tools.set("canvas.create_text", {
      name: "canvas.create_text",
      namespace: "canvas",
      description: "Create a text block on the canvas.",
      category: "create_modify",
      available: true,
      inputSchema: {
        type: "object",
        required: ["content"],
        properties: {
          content: { type: "string", minLength: 1, maxLength: 4000 },
          x: { type: "number" },
          y: { type: "number" },
          fontSize: { type: "number", minimum: 10, maximum: 96 },
          color: { type: "string" },
        },
      },
      handler: (args) => {
        const created = this.requireCanvas().createText(args as any);
        return { id: created.id, type: created.type, x: created.x, y: created.y, content: created.content };
      },
    });

    this.tools.set("canvas.create_shape", {
      name: "canvas.create_shape",
      namespace: "canvas",
      description: "Create a geometric shape on the canvas.",
      category: "create_modify",
      available: true,
      inputSchema: {
        type: "object",
        required: ["shapeType"],
        properties: {
          shapeType: {
            type: "string",
            enum: ["rect", "rounded-rect", "circle", "diamond", "triangle", "star", "cloud", "cylinder"],
          },
          content: { type: "string", maxLength: 1000 },
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number", minimum: 40, maximum: 1200 },
          height: { type: "number", minimum: 40, maximum: 1200 },
          fillColor: { type: "string" },
          strokeColor: { type: "string" },
        },
      },
      handler: (args) => {
        const created = this.requireCanvas().createShape(args as any);
        return {
          id: created.id,
          type: created.type,
          shapeType: created.shapeType,
          x: created.x,
          y: created.y,
          width: created.width,
          height: created.height,
        };
      },
    });

    this.tools.set("canvas.create_frame", {
      name: "canvas.create_frame",
      namespace: "canvas",
      description: "Create a labeled organizational frame on the canvas.",
      category: "create_modify",
      available: true,
      inputSchema: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 200 },
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number", minimum: 180, maximum: 2400 },
          height: { type: "number", minimum: 140, maximum: 2400 },
          strokeColor: { type: "string" },
        },
      },
      handler: (args) => {
        const created = this.requireCanvas().createFrame(args as any);
        return {
          id: created.id,
          type: created.type,
          title: created.title,
          x: created.x,
          y: created.y,
          width: created.width,
          height: created.height,
        };
      },
    });

    this.tools.set("canvas.connect_objects", {
      name: "canvas.connect_objects",
      namespace: "canvas",
      description: "Connect two existing canvas objects with a directional connector line.",
      category: "create_modify",
      available: true,
      inputSchema: {
        type: "object",
        required: ["fromId", "toId"],
        properties: {
          fromId: { type: "string", minLength: 1 },
          toId: { type: "string", minLength: 1 },
          label: { type: "string", maxLength: 120 },
          lineStyle: { type: "string", enum: ["straight", "curved", "orthogonal"] },
        },
      },
      handler: (args) => {
        const created = this.requireCanvas().connectObjects(args as any);
        return { id: created.id, type: created.type, fromId: args.fromId, toId: args.toId };
      },
    });

    this.tools.set("canvas.move_object", {
      name: "canvas.move_object",
      namespace: "canvas",
      description: "Move an existing canvas object to new X/Y coordinates.",
      category: "move_multiple",
      available: true,
      inputSchema: {
        type: "object",
        required: ["id", "x", "y"],
        properties: {
          id: { type: "string", minLength: 1 },
          x: { type: "number" },
          y: { type: "number" },
        },
      },
      handler: (args) => {
        const updated = this.requireCanvas().moveObject(args as any);
        return { id: updated.id, x: updated.x, y: updated.y };
      },
    });

    this.tools.set("canvas.focus_object", {
      name: "canvas.focus_object",
      namespace: "canvas",
      description: "Center the canvas viewport on a specific object ID and select it.",
      category: "open_focus",
      available: true,
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", minLength: 1 },
          zoom: { type: "number", minimum: 0.2, maximum: 2.0 },
        },
      },
      handler: (args) => this.requireCanvas().focusObject(args as any),
    });

    this.tools.set("canvas.delete_object", {
      name: "canvas.delete_object",
      namespace: "canvas",
      description: "Delete a canvas object (guarded by destructive permission policy).",
      category: "delete_data",
      available: true,
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", minLength: 1 },
        },
      },
      handler: () => {
        throw new ToolError("PERMISSION_DENIED", "Destructive canvas deletion is denied by Stage 2 safety policy.");
      },
    });

    // ===== APPLICATION TOOLS =====
    this.tools.set("app.list", {
      name: "app.list",
      namespace: "app",
      description: "List all registered Foundry and Education Controller applications and their status.",
      category: "read",
      available: true,
      inputSchema: { type: "object", properties: {} },
      handler: () =>
        applicationRegistry.list().map((a) => ({
          id: a.id,
          name: a.name,
          category: a.category,
          status: a.status,
          enabled: a.enabled,
          ai: a.ai,
          capabilities: a.capabilities,
        })),
    });

    this.tools.set("app.get", {
      name: "app.get",
      namespace: "app",
      description: "Get detailed manifest and runtime status for an application by appId.",
      category: "read",
      available: true,
      inputSchema: {
        type: "object",
        required: ["appId"],
        properties: { appId: { type: "string", minLength: 1 } },
      },
      handler: (args) => {
        const app = applicationRegistry.get(args.appId);
        if (!app) throw new ToolError("UNKNOWN_OPERATION", `Application "${args.appId}" not found.`);
        return app;
      },
    });

    this.tools.set("app.open", {
      name: "app.open",
      namespace: "app",
      description: "Open an installed Foundry or Education Controller application by appId.",
      category: "open_focus",
      available: true,
      inputSchema: {
        type: "object",
        required: ["appId"],
        properties: { appId: { type: "string", minLength: 1 } },
      },
      handler: (args) => {
        const res = applicationRegistry.launch(args.appId);
        if (!res.success) throw new ToolError("OPERATION_FAILED", res.error || "Failed to open application");
        return res;
      },
    });

    this.tools.set("app.close", {
      name: "app.close",
      namespace: "app",
      description: "Close/hide an open application by appId.",
      category: "open_focus",
      available: true,
      inputSchema: {
        type: "object",
        required: ["appId"],
        properties: { appId: { type: "string", minLength: 1 } },
      },
      handler: (args) => {
        const res = applicationRegistry.close(args.appId);
        if (!res.success) throw new ToolError("OPERATION_FAILED", res.error || "Failed to close application");
        return res;
      },
    });

    this.tools.set("app.focus", {
      name: "app.focus",
      namespace: "app",
      description: "Focus an application window by appId.",
      category: "open_focus",
      available: true,
      inputSchema: {
        type: "object",
        required: ["appId"],
        properties: { appId: { type: "string", minLength: 1 } },
      },
      handler: (args) => {
        const res = applicationRegistry.focus(args.appId);
        if (!res.success) throw new ToolError("OPERATION_FAILED", res.error || "Failed to focus application");
        return res;
      },
    });

    this.tools.set("app.get_status", {
      name: "app.get_status",
      namespace: "app",
      description: "Check runtime status of a registered application.",
      category: "read",
      available: true,
      inputSchema: {
        type: "object",
        required: ["appId"],
        properties: { appId: { type: "string", minLength: 1 } },
      },
      handler: (args) => {
        const status = applicationRegistry.getStatus(args.appId);
        if (!status) throw new ToolError("UNKNOWN_OPERATION", `Unknown application "${args.appId}".`);
        return { appId: args.appId, status };
      },
    });

    this.tools.set("app.get_capabilities", {
      name: "app.get_capabilities",
      namespace: "app",
      description: "List current vs planned capabilities for a registered application.",
      category: "read",
      available: true,
      inputSchema: {
        type: "object",
        required: ["appId"],
        properties: { appId: { type: "string", minLength: 1 } },
      },
      handler: (args) => {
        const caps = applicationRegistry.getCapabilities(args.appId);
        if (!caps) throw new ToolError("UNKNOWN_OPERATION", `Unknown application "${args.appId}".`);
        return { appId: args.appId, ...caps };
      },
    });

    // ===== WINDOW TOOLS =====
    this.tools.set("window.list", {
      name: "window.list",
      namespace: "window",
      description: "List registered floating and companion windows.",
      category: "read",
      available: true,
      inputSchema: { type: "object", properties: {} },
      handler: () => windowManager.getWindows(),
    });

    this.tools.set("window.focus", {
      name: "window.focus",
      namespace: "window",
      description: "Bring a registered window to focus.",
      category: "open_focus",
      available: true,
      inputSchema: {
        type: "object",
        required: ["windowId"],
        properties: { windowId: { type: "string", minLength: 1 } },
      },
      handler: (args) => {
        const win = windowManager.focus(args.windowId);
        if (!win) throw new ToolError("OPERATION_FAILED", `Unknown window "${args.windowId}".`);
        return win;
      },
    });

    this.tools.set("window.show", {
      name: "window.show",
      namespace: "window",
      description: "Show a hidden or minimized window.",
      category: "open_focus",
      available: true,
      inputSchema: {
        type: "object",
        required: ["windowId"],
        properties: { windowId: { type: "string", minLength: 1 } },
      },
      handler: (args) => {
        const win = windowManager.open(args.windowId);
        if (!win) throw new ToolError("OPERATION_FAILED", `Unknown window "${args.windowId}".`);
        return win;
      },
    });

    this.tools.set("window.hide", {
      name: "window.hide",
      namespace: "window",
      description: "Hide an open window.",
      category: "open_focus",
      available: true,
      inputSchema: {
        type: "object",
        required: ["windowId"],
        properties: { windowId: { type: "string", minLength: 1 } },
      },
      handler: (args) => {
        const ok = windowManager.close(args.windowId);
        if (!ok) throw new ToolError("OPERATION_FAILED", `Unknown window "${args.windowId}".`);
        return { windowId: args.windowId, hidden: true };
      },
    });

    this.tools.set("window.move", {
      name: "window.move",
      namespace: "window",
      description: "Move a draggable floating window to viewport coordinates.",
      category: "move_multiple",
      available: true,
      inputSchema: {
        type: "object",
        required: ["windowId", "x", "y"],
        properties: {
          windowId: { type: "string", minLength: 1 },
          x: { type: "number" },
          y: { type: "number" },
        },
      },
      handler: (args) => {
        const win = windowManager.move(args.windowId, { x: args.x, y: args.y });
        if (!win) throw new ToolError("OPERATION_FAILED", `Unable to move window "${args.windowId}".`);
        return win;
      },
    });

    this.tools.set("window.resize", {
      name: "window.resize",
      namespace: "window",
      description: "Resize a resizable floating window.",
      category: "move_multiple",
      available: true,
      inputSchema: {
        type: "object",
        required: ["windowId", "width", "height"],
        properties: {
          windowId: { type: "string", minLength: 1 },
          width: { type: "number", minimum: 220, maximum: 1800 },
          height: { type: "number", minimum: 180, maximum: 1400 },
        },
      },
      handler: (args) => {
        const win = windowManager.resize(args.windowId, { width: args.width, height: args.height });
        if (!win) throw new ToolError("OPERATION_FAILED", `Unable to resize window "${args.windowId}".`);
        return win;
      },
    });

    this.tools.set("window.minimize", {
      name: "window.minimize",
      namespace: "window",
      description: "Minimize a window.",
      category: "open_focus",
      available: true,
      inputSchema: {
        type: "object",
        required: ["windowId"],
        properties: { windowId: { type: "string", minLength: 1 } },
      },
      handler: (args) => {
        const win = windowManager.minimize(args.windowId);
        if (!win) throw new ToolError("OPERATION_FAILED", `Unknown window "${args.windowId}".`);
        return win;
      },
    });

    this.tools.set("window.restore", {
      name: "window.restore",
      namespace: "window",
      description: "Restore a minimized or expanded window.",
      category: "open_focus",
      available: true,
      inputSchema: {
        type: "object",
        required: ["windowId"],
        properties: { windowId: { type: "string", minLength: 1 } },
      },
      handler: (args) => {
        const win = windowManager.restore(args.windowId);
        if (!win) throw new ToolError("OPERATION_FAILED", `Unknown window "${args.windowId}".`);
        return win;
      },
    });

    // ===== ACADEMIC CONTEXT (READ-ONLY LIVE CONTEXT) =====
    this.tools.set("academic.get_active_context", {
      name: "academic.get_active_context",
      namespace: "academic",
      description: "Read the active course and workspace context from SharedContextManager.",
      category: "read",
      available: true,
      inputSchema: { type: "object", properties: {} },
      handler: () => {
        const ctx = sharedContextManager.getContext();
        return {
          activeCourseId: ctx.activeCourseId,
          activeAssignmentId: ctx.activeAssignmentId,
          activeApplicationId: ctx.activeApplicationId,
          openApplicationIds: ctx.openApplicationIds,
        };
      },
    });

    // ===== EDUCATION CAPABILITY SCHEMAS (HONESTLY MARKED UNAVAILABLE WHEN NO API EXISTS) =====
    const unavailableAppTools: Array<{
      name: string;
      namespace: string;
      description: string;
      category: AIToolDefinition["category"];
      required?: string[];
      properties: Record<string, any>;
      reason: string;
    }> = [
      {
        name: "flashcards.create_deck",
        namespace: "flashcards",
        description: "Create a flashcard study deck inside Digital Flashcards Studio.",
        category: "change_app_data",
        required: ["title"],
        properties: { title: { type: "string" }, courseId: { type: "string" } },
        reason: "Digital Flashcards Studio currently provides UI only and does not expose a programmatic deck API.",
      },
      {
        name: "flashcards.add_cards",
        namespace: "flashcards",
        description: "Add flashcards to a deck inside Digital Flashcards Studio.",
        category: "change_app_data",
        required: ["deckId", "cards"],
        properties: { deckId: { type: "string" }, cards: { type: "array" } },
        reason: "Digital Flashcards Studio card mutation API is not implemented yet.",
      },
      {
        name: "choice.create_board",
        namespace: "choice",
        description: "Create a choice board in Choice Board Studio.",
        category: "change_app_data",
        required: ["title"],
        properties: { title: { type: "string" }, items: { type: "array" } },
        reason: "Choice Board Studio programmatic creation API is not implemented yet.",
      },
      {
        name: "slides.create_deck",
        namespace: "slides",
        description: "Create a slide deck in Essay to Slides.",
        category: "change_app_data",
        required: ["title", "sourceText"],
        properties: { title: { type: "string" }, sourceText: { type: "string" } },
        reason: "Essay to Slides programmatic export API is not implemented yet.",
      },
      {
        name: "studyguide.create_guide",
        namespace: "studyguide",
        description: "Create a finals study guide in Finals Study Guide.",
        category: "change_app_data",
        required: ["courseId"],
        properties: { courseId: { type: "string" }, topics: { type: "array" } },
        reason: "Finals Study Guide programmatic API is not implemented yet.",
      },
      {
        name: "countdown.create_timer",
        namespace: "countdown",
        description: "Create an exam or deadline countdown in Countdown app.",
        category: "change_app_data",
        required: ["title", "targetDate"],
        properties: { title: { type: "string" }, targetDate: { type: "string" } },
        reason: "Countdown companion app programmatic timer API is not implemented yet.",
      },
      {
        name: "lesson.create_plan",
        namespace: "lesson",
        description: "Create a lesson plan in Universal Design Lesson Planner.",
        category: "change_app_data",
        required: ["title"],
        properties: { title: { type: "string" }, objectives: { type: "array" } },
        reason: "UDL Lesson Planner programmatic API is not implemented yet.",
      },
    // ===== STAGE 3 — KNOWLEDGE BASE TOOLS =====
    this.tools.set("knowledge.search", {
      name: "knowledge.search",
      namespace: "knowledge",
      description: "Search indexed course documents and notes in Foundry Knowledge Base.",
      category: "read",
      available: true,
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search terms or keywords." },
          courseId: { type: "string", description: "Optional course filter (e.g. CS-304)." },
        },
        required: ["query"],
      },
      handler: async (args) => {
        const docs = await knowledgeBaseManager.search(args.query, args.courseId);
        return {
          count: docs.length,
          query: args.query,
          documents: docs.map((d) => ({
            id: d.id,
            name: d.name,
            sourceType: d.sourceType,
            courseId: d.courseId,
            tags: d.tags,
            summary: d.summary || d.extractedText?.slice(0, 150),
          })),
        };
      },
    });

    this.tools.set("knowledge.get_document", {
      name: "knowledge.get_document",
      namespace: "knowledge",
      description: "Get metadata and full extracted content for a Knowledge Base document.",
      category: "read",
      available: true,
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Document ID." },
        },
        required: ["id"],
      },
      handler: async (args) => {
        const doc = sharedDatabaseClient.getDocument(args.id);
        if (!doc) throw new ToolError("NOT_FOUND", `Document "${args.id}" not found.`);
        return { document: doc };
      },
    });

    this.tools.set("knowledge.import_document", {
      name: "knowledge.import_document",
      namespace: "knowledge",
      description: "Import and extract a text or course document into Knowledge Base.",
      category: "create_modify",
      available: true,
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Document file name." },
          content: { type: "string", description: "Raw document text content." },
          courseId: { type: "string", description: "Course ID." },
          sourceType: { type: "string", enum: ["local", "course_note", "google_docs", "google_drive"] },
        },
        required: ["name", "content"],
      },
      handler: async (args) => {
        const res = await knowledgeBaseManager.importDocument({
          name: args.name,
          content: args.content,
          sourceType: args.sourceType || "local",
          courseId: args.courseId || "CS-304",
        });
        if (!res.success) throw new ToolError("IMPORT_FAILED", res.error || "Failed to import document.");
        return { success: true, documentId: res.document?.id, name: res.document?.name, chunkCount: res.extraction?.chunks.length };
      },
    });

    // ===== STAGE 3 — RAG RETRIEVAL TOOLS =====
    this.tools.set("rag.retrieve", {
      name: "rag.retrieve",
      namespace: "rag",
      description: "Retrieve source-grounded excerpts from course documents with inspectable citations.",
      category: "read",
      available: true,
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Query to match against Knowledge Base chunks." },
          courseId: { type: "string", description: "Course ID filter." },
          limit: { type: "integer", minimum: 1, maximum: 10, description: "Maximum chunks to retrieve." },
        },
        required: ["query"],
      },
      handler: async (args) => {
        const result = await ragEngine.retrieve(args.query, {
          courseId: args.courseId,
          limit: args.limit || 4,
        });
        return {
          count: result.chunks.length,
          retrievalMode: result.retrievalMode,
          citationText: result.citationText,
          chunks: result.chunks.map((c) => ({
            id: c.id,
            documentName: c.metadata.documentName,
            pageNumber: c.metadata.pageNumber,
            slideNumber: c.metadata.slideNumber,
            sectionHeading: c.metadata.sectionHeading,
            content: c.content,
          })),
        };
      },
    });

    this.tools.set("rag.get_context", {
      name: "rag.get_context",
      namespace: "rag",
      description: "Get prompt-injection defended context block and citations for an academic query.",
      category: "read",
      available: true,
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Question or topic." },
          courseId: { type: "string", description: "Course ID." },
        },
        required: ["query"],
      },
      handler: async (args) => {
        const res = await ragEngine.retrieve(args.query, { courseId: args.courseId });
        return {
          contextBlock: res.contextBlock,
          citationText: res.citationText,
          chunkCount: res.chunks.length,
        };
      },
    });

    // ===== STAGE 3 — PERSISTENT AI MEMORY TOOLS =====
    this.tools.set("memory.search", {
      name: "memory.search",
      namespace: "memory",
      description: "Retrieve relevant approved AI memories for user preferences or course context.",
      category: "read",
      available: true,
      inputSchema: {
        type: "object",
        properties: {
          courseId: { type: "string", description: "Optional course filter." },
          type: { type: "string", description: "Memory type (preference, course, project, procedural, etc.)." },
        },
      },
      handler: async (args) => {
        const mems = await aiMemoryManager.getRelevantMemories({ courseId: args.courseId });
        return {
          count: mems.length,
          memories: mems.map((m) => ({ id: m.id, type: m.type, content: m.content, scope: m.scope })),
        };
      },
    });

    this.tools.set("memory.propose", {
      name: "memory.propose",
      namespace: "memory",
      description: "Save an approved persistent AI memory (e.g. user preference or key course decision).",
      category: "create_modify",
      available: true,
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["preference", "course", "project", "procedural", "knowledge"] },
          content: { type: "string", description: "Fact or preference to remember." },
          scope: { type: "string", enum: ["user", "course", "workspace"] },
          courseId: { type: "string" },
        },
        required: ["type", "content"],
      },
      handler: async (args) => {
        const mem = await aiMemoryManager.proposeMemory({
          type: args.type,
          content: args.content,
          scope: args.scope || "user",
          courseId: args.courseId,
          autoApprove: true,
        });
        if (!mem) throw new ToolError("MEMORY_REJECTED", "Memory could not be saved or contained sensitive tokens.");
        return { success: true, memoryId: mem.id, content: mem.content };
      },
    });

    // ===== STAGE 3 — SHARED ACADEMIC CONTEXT TOOLS =====
    this.tools.set("academic.get_courses", {
      name: "academic.get_courses",
      namespace: "academic",
      description: "List all academic courses and active enrollment in Foundry.",
      category: "read",
      available: true,
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const courses = await sharedDatabaseClient.fetchCourses();
        return { count: courses.length, courses };
      },
    });

    this.tools.set("academic.get_assignments", {
      name: "academic.get_assignments",
      namespace: "academic",
      description: "List academic assignments and milestones for a course.",
      category: "read",
      available: true,
      inputSchema: {
        type: "object",
        properties: { courseId: { type: "string", description: "Course ID (e.g. CS-304)." } },
      },
      handler: async (args) => {
        const assignments = await sharedDatabaseClient.fetchAssignments(args.courseId);
        return { count: assignments.length, assignments };
      },
    });

    this.tools.set("academic.get_tasks", {
      name: "academic.get_tasks",
      namespace: "academic",
      description: "List academic study tasks and deadlines.",
      category: "read",
      available: true,
      inputSchema: {
        type: "object",
        properties: { courseId: { type: "string" } },
      },
      handler: async (args) => {
        const tasks = await sharedDatabaseClient.fetchTasks(args.courseId);
        return { count: tasks.length, tasks };
      },
    });

    this.tools.set("academic.create_task", {
      name: "academic.create_task",
      namespace: "academic",
      description: "Create an academic task or milestone in the shared academic database.",
      category: "create_modify",
      available: true,
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title." },
          courseId: { type: "string", description: "Course ID." },
          dueDate: { type: "string", description: "Due date or time remaining." },
          priority: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["title"],
      },
      handler: async (args) => {
        const task = await sharedDatabaseClient.upsertTask({
          title: args.title,
          courseId: args.courseId || "CS-304",
          dueDate: args.dueDate || "Due Soon",
          priority: args.priority || "medium",
          status: "pending",
        });
        if (!task) throw new ToolError("TASK_FAILED", "Failed to create academic task.");
        return { success: true, taskId: task.id, title: task.title };
      },
    });

    // ===== STAGE 3 — GOOGLE WORKSPACE TOOLS =====
    this.tools.set("google.drive.search", {
      name: "google.drive.search",
      namespace: "google",
      description: "Search authorized files in Google Drive.",
      category: "read",
      available: true,
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", description: "File name query." } },
      },
      handler: async (args) => {
        const res = await googleWorkspaceService.searchDriveFiles(args.query || "");
        if (!res.ok) throw new ToolError("GOOGLE_ERROR", res.error || "Drive search failed.");
        return { count: res.files.length, files: res.files };
      },
    });

    this.tools.set("google.docs.read", {
      name: "google.docs.read",
      namespace: "google",
      description: "Read structured content from an authorized Google Doc.",
      category: "read",
      available: true,
      inputSchema: {
        type: "object",
        properties: { documentId: { type: "string", description: "Google Doc ID." } },
        required: ["documentId"],
      },
      handler: async (args) => {
        const res = await googleWorkspaceService.getDocContent(args.documentId);
        if (!res.ok) throw new ToolError("GOOGLE_ERROR", res.error || "Failed to read Google Doc.");
        return { title: res.title, text: res.text };
      },
    });

    this.tools.set("google.docs.create", {
      name: "google.docs.create",
      namespace: "google",
      description: "Create an approved Google Doc with study materials or notes.",
      category: "create_modify",
      available: true,
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Document title." },
          content: { type: "string", description: "Body text content." },
        },
        required: ["title"],
      },
      handler: async (args) => {
        const res = await googleWorkspaceService.createDoc(args.title, args.content);
        if (!res.ok) throw new ToolError("GOOGLE_ERROR", res.error || "Failed to create Google Doc.");
        return { success: true, documentId: res.documentId, title: res.title };
      },
    });

    this.tools.set("google.slides.read", {
      name: "google.slides.read",
      namespace: "google",
      description: "Read slide contents and speaker notes from Google Slides.",
      category: "read",
      available: true,
      inputSchema: {
        type: "object",
        properties: { presentationId: { type: "string", description: "Presentation ID." } },
        required: ["presentationId"],
      },
      handler: async (args) => {
        const res = await googleWorkspaceService.getPresentation(args.presentationId);
        if (!res.ok) throw new ToolError("GOOGLE_ERROR", res.error || "Failed to read presentation.");
        return { title: res.title, slideCount: res.slideCount, slidesText: res.slidesText };
      },
    });

    this.tools.set("google.slides.create", {
      name: "google.slides.create",
      namespace: "google",
      description: "Create an approved Google Slides presentation.",
      category: "create_modify",
      available: true,
      inputSchema: {
        type: "object",
        properties: { title: { type: "string", description: "Presentation title." } },
        required: ["title"],
      },
      handler: async (args) => {
        const res = await googleWorkspaceService.createPresentation(args.title);
        if (!res.ok) throw new ToolError("GOOGLE_ERROR", res.error || "Failed to create presentation.");
        return { success: true, presentationId: res.presentationId, title: res.title };
      },
    });

    this.tools.set("google.sheets.read", {
      name: "google.sheets.read",
      namespace: "google",
      description: "Read tabular values and cells from an authorized Google Sheet.",
      category: "read",
      available: true,
      inputSchema: {
        type: "object",
        properties: {
          spreadsheetId: { type: "string", description: "Spreadsheet ID." },
          range: { type: "string", description: "Cell range (e.g. Sheet1!A1:D20)." },
        },
        required: ["spreadsheetId"],
      },
      handler: async (args) => {
        const res = await googleWorkspaceService.getSheetValues(args.spreadsheetId, args.range || "A1:Z50");
        if (!res.ok) throw new ToolError("GOOGLE_ERROR", res.error || "Failed to read Google Sheet.");
        return { values: res.values };
      },
    });

    this.tools.set("google.sheets.create", {
      name: "google.sheets.create",
      namespace: "google",
      description: "Create an approved Google Sheet for study tracking or survey responses.",
      category: "create_modify",
      available: true,
      inputSchema: {
        type: "object",
        properties: { title: { type: "string", description: "Spreadsheet title." } },
        required: ["title"],
      },
      handler: async (args) => {
        const res = await googleWorkspaceService.createSpreadsheet(args.title);
        if (!res.ok) throw new ToolError("GOOGLE_ERROR", res.error || "Failed to create Google Sheet.");
        return { success: true, spreadsheetId: res.spreadsheetId };
      },
    });

    this.tools.set("google.calendar.list_events", {
      name: "google.calendar.list_events",
      namespace: "google",
      description: "List upcoming events and deadlines from Google Calendar.",
      category: "read",
      available: true,
      inputSchema: {
        type: "object",
        properties: { maxResults: { type: "integer", minimum: 1, maximum: 50 } },
      },
      handler: async (args) => {
        const res = await googleWorkspaceService.listCalendarEvents(args.maxResults || 10);
        if (!res.ok) throw new ToolError("GOOGLE_ERROR", res.error || "Failed to list calendar events.");
        return { count: res.events.length, events: res.events };
      },
    });

    this.tools.set("google.calendar.create_event", {
      name: "google.calendar.create_event",
      namespace: "google",
      description: "Create an approved study block or milestone event in Google Calendar.",
      category: "create_modify",
      available: true,
      inputSchema: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Event title." },
          description: { type: "string" },
          startTime: { type: "string", description: "ISO 8601 start date-time." },
          endTime: { type: "string", description: "ISO 8601 end date-time." },
        },
        required: ["summary", "startTime", "endTime"],
      },
      handler: async (args) => {
        const res = await googleWorkspaceService.createCalendarEvent(args);
        if (!res.ok) throw new ToolError("GOOGLE_ERROR", res.error || "Failed to create calendar event.");
        return { success: true, eventId: res.eventId };
      },
    });

    this.tools.set("google.tasks.list", {
      name: "google.tasks.list",
      namespace: "google",
      description: "List active tasks from Google Tasks.",
      category: "read",
      available: true,
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const res = await googleWorkspaceService.listTasks();
        if (!res.ok) throw new ToolError("GOOGLE_ERROR", res.error || "Failed to list tasks.");
        return { count: res.tasks.length, tasks: res.tasks };
      },
    });

    this.tools.set("google.tasks.create", {
      name: "google.tasks.create",
      namespace: "google",
      description: "Create an approved task in Google Tasks.",
      category: "create_modify",
      available: true,
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title." },
          notes: { type: "string" },
          due: { type: "string", description: "RFC 3339 due timestamp." },
        },
        required: ["title"],
      },
      handler: async (args) => {
        const res = await googleWorkspaceService.createTask(args.title, args.notes, args.due);
        if (!res.ok) throw new ToolError("GOOGLE_ERROR", res.error || "Failed to create Google task.");
        return { success: true, taskId: res.taskId };
      },
    });

    this.tools.set("google.forms.create", {
      name: "google.forms.create",
      namespace: "google",
      description: "Create an approved Choice Board survey or assessment form in Google Forms.",
      category: "create_modify",
      available: true,
      inputSchema: {
        type: "object",
        properties: { title: { type: "string", description: "Form title." } },
        required: ["title"],
      },
      handler: async (args) => {
        const res = await googleWorkspaceService.createForm(args.title);
        if (!res.ok) throw new ToolError("GOOGLE_ERROR", res.error || "Failed to create form.");
        return { success: true, formId: res.formId, responderUri: res.responderUri };
      },
    });

    this.tools.set("google.classroom.list_courses", {
      name: "google.classroom.list_courses",
      namespace: "google",
      description: "List authorized active Google Classroom courses.",
      category: "read",
      available: true,
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const res = await googleWorkspaceService.listClassroomCourses();
        if (!res.ok) throw new ToolError("GOOGLE_ERROR", res.error || "Failed to list Classroom courses.");
        return { count: res.courses.length, courses: res.courses };
      },
    });

    for (const def of unavailableAppTools) {
      this.tools.set(def.name, {
        name: def.name,
        namespace: def.namespace,
        description: def.description,
        category: def.category,
        available: false,
        unavailableReason: def.reason,
        inputSchema: {
          type: "object",
          properties: def.properties,
          required: def.required,
        },
      });
    }
  }

  private reportDiagnostics() {
    const all = Array.from(this.tools.values());
    const availableCount = all.filter((t) => t.available).length;
    const plannedCount = all.length - availableCount;
    diagnosticsManager.reportMetric({
      id: "ai_tool_registry",
      name: "AI Tool Registry",
      status: this.canvasHandler ? "healthy" : "warning",
      verified: Boolean(this.canvasHandler),
      value: `${availableCount} operational · ${plannedCount} planned (unavailable)`,
      message: this.canvasHandler ? "Canvas, App & Window tools bound" : "Waiting for canvas handler binding",
      timestamp: Date.now(),
    });
  }
}

export const aiToolRegistry = new AIToolRegistryService();
