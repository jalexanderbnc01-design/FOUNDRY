/**
 * Foundry Communication Bridge (Phase 05)
 * Implements validated `foundry.bridge` v1 envelopes, source & iframe handshake
 * verification, permission enforcement, duplicate-request protection, timeouts,
 * Event Bus correlation, Diagnostics logging, and all Phase 5.4 host operations.
 */
import { eventBus, FOUNDRY_EVENTS } from "./EventBus";
import { permissionManager } from "./PermissionManager";
import { diagnosticsManager } from "./DiagnosticsManager";
import { applicationRegistry } from "./ApplicationRegistry";
import { windowManager } from "./WindowManager";
import { sharedContextManager } from "./SharedContextManager";
import { educationControllerAdapter } from "./educationControllerAdapter";
import { BoardElement, Viewport } from "../types";

export const BRIDGE_PROTOCOL = "foundry.bridge" as const;
export const BRIDGE_VERSION = 1 as const;

export type BridgeErrorCode =
  | "VALIDATION_ERROR"
  | "UNSUPPORTED_VERSION"
  | "UNAUTHORIZED_SOURCE"
  | "PERMISSION_DENIED"
  | "UNKNOWN_TARGET"
  | "UNKNOWN_OPERATION"
  | "UNAVAILABLE_OPERATION"
  | "DUPLICATE_REQUEST"
  | "TIMEOUT"
  | "OPERATION_FAILED";

export interface BridgeErrorDetail {
  code: BridgeErrorCode;
  message: string;
  details?: any;
}

export interface BridgeRequest {
  protocol: typeof BRIDGE_PROTOCOL;
  version: number;
  type: "request";
  requestId: string;
  source: string;
  target: string;
  operation: string;
  timestamp: number;
  payload: Record<string, any>;
  timeoutMs?: number;
  handshakeToken?: string;
}

export interface BridgeResponse {
  protocol: typeof BRIDGE_PROTOCOL;
  version: typeof BRIDGE_VERSION;
  type: "response";
  requestId: string;
  source: string;
  target: string;
  operation?: string;
  timestamp: number;
  success: boolean;
  data: any;
  error: BridgeErrorDetail | null;
}

export type BridgeOperationHandler = (
  payload: Record<string, any>,
  request: BridgeRequest
) => Promise<any> | any;

interface RegisteredFrameSource {
  moduleId: string;
  frame: HTMLIFrameElement;
  contentWindow: Window | null;
  allowedOrigin: string | null; // null allows opaque "null" origin via exact Window ref + handshakeToken
  handshakeToken: string;
}

export interface HostCanvasProvider {
  getWorkspaceInfo: () => {
    workspaceId: string;
    workspaceName: string;
    connectionStatus: string;
    elementCount: number;
  };
  getViewport: () => Viewport;
  getSelectedElements: () => BoardElement[];
}

class CommunicationBridgeService {
  private handlers: Map<string, Map<string, BridgeOperationHandler>> = new Map();
  private unavailableOps: Map<string, string> = new Map();
  private trustedSources: Set<string> = new Set([
    "foundry-host",
    "foundry-settings",
    "application-registry",
    "window-manager",
    "education-controller",
    "diagnostics-manager",
  ]);
  private registeredFrames: Map<string, RegisteredFrameSource> = new Map();
  private requestHistory: BridgeResponse[] = [];
  private recentRequestIds: Set<string> = new Set();
  private messageTransportAttached = false;
  private initialized = false;
  private hostCanvasProvider: HostCanvasProvider | null = null;
  private aiStatusChecker: (() => boolean) | null = null;
  private internalHostToken = `fnd_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;

  constructor() {
    this.registerFoundationalOperations();
    this.initialized = true;
    this.syncDiagnosticsProbe();
  }

  setAIStatusChecker(checker: (() => boolean) | null): void {
    this.aiStatusChecker = checker;
  }

  private syncDiagnosticsProbe() {
    diagnosticsManager.setRuntimeProbes({
      bridge: {
        initialized: this.initialized,
        protocolVersion: BRIDGE_VERSION,
        operationCount: this.getRegisteredOperations().length,
        transportAttached: this.messageTransportAttached,
        verifiedSourceCount: this.trustedSources.size + this.registeredFrames.size,
        errorCount: this.requestHistory.filter((r) => !r.success).length,
      },
    });
  }

  setHostCanvasProvider(provider: HostCanvasProvider | null): void {
    this.hostCanvasProvider = provider;
  }

  getInternalHostToken(): string {
    return this.internalHostToken;
  }

  registerTrustedSource(moduleId: string): void {
    if (moduleId && typeof moduleId === "string") {
      this.trustedSources.add(moduleId);
      this.syncDiagnosticsProbe();
    }
  }

  unregisterTrustedSource(moduleId: string): void {
    this.trustedSources.delete(moduleId);
    this.syncDiagnosticsProbe();
  }

  /**
   * Explicitly binds a sandboxed or same-origin iframe reference with a scoped
   * handshake token so postMessage traffic cannot spoof another module ID.
   */
  registerFrameSource(
    moduleId: string,
    frame: HTMLIFrameElement,
    allowedOrigin: string | null = null
  ): string {
    const handshakeToken = `hs_${moduleId}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    this.registeredFrames.set(moduleId, {
      moduleId,
      frame,
      contentWindow: frame.contentWindow,
      allowedOrigin,
      handshakeToken,
    });
    this.trustedSources.add(moduleId);
    this.syncDiagnosticsProbe();
    return handshakeToken;
  }

  unregisterFrameSource(moduleId: string): void {
    this.registeredFrames.delete(moduleId);
    this.syncDiagnosticsProbe();
  }

  pushEventToFrame(moduleId: string, eventName: string, data: any): boolean {
    const registered = this.registeredFrames.get(moduleId);
    if (!registered) return false;
    const targetWin = registered.frame.contentWindow || registered.contentWindow;
    if (!targetWin || typeof targetWin.postMessage !== "function") return false;
    try {
      targetWin.postMessage(
        {
          protocol: BRIDGE_PROTOCOL,
          version: BRIDGE_VERSION,
          type: "event",
          source: "foundry-host",
          target: moduleId,
          event: eventName,
          timestamp: Date.now(),
          data,
        },
        registered.allowedOrigin === null ? "*" : registered.allowedOrigin
      );
      return true;
    } catch {
      return false;
    }
  }

  attachMessageTransport(): () => void {
    if (typeof window === "undefined") return () => {};
    if (!this.messageTransportAttached) {
      window.addEventListener("message", this.handleWindowMessage);
      this.messageTransportAttached = true;
      this.syncDiagnosticsProbe();
    }
    return () => this.detachMessageTransport();
  }

  detachMessageTransport(): void {
    if (typeof window !== "undefined" && this.messageTransportAttached) {
      window.removeEventListener("message", this.handleWindowMessage);
    }
    this.messageTransportAttached = false;
    this.syncDiagnosticsProbe();
  }

  private handleWindowMessage = async (event: MessageEvent) => {
    const raw = event.data;
    if (!raw || typeof raw !== "object" || raw.protocol !== BRIDGE_PROTOCOL) {
      return;
    }
    if (raw.type !== "request") {
      return;
    }

    // Verify source frame / origin / handshake before routing
    const sourceId = typeof raw.source === "string" ? raw.source : "";
    const registered = this.registeredFrames.get(sourceId);

    let verified = false;
    if (registered) {
      const liveWin = registered.frame.contentWindow || registered.contentWindow;
      const winMatches = Boolean(liveWin && event.source === liveWin);
      const tokenMatches = raw.handshakeToken === registered.handshakeToken;
      const originMatches =
        registered.allowedOrigin === null
          ? event.origin === "null" || event.origin === window.location.origin
          : event.origin === registered.allowedOrigin;

      verified = winMatches && tokenMatches && originMatches;
    } else if (
      event.source === window &&
      event.origin === window.location.origin &&
      raw.handshakeToken === this.internalHostToken &&
      this.trustedSources.has(sourceId)
    ) {
      verified = true;
    }

    if (!verified) {
      const rejected = this.buildErrorResponse(
        typeof raw.requestId === "string" ? raw.requestId : `rejected_${Date.now()}`,
        sourceId || "unknown-source",
        typeof raw.target === "string" ? raw.target : "foundry-host",
        typeof raw.operation === "string" ? raw.operation : "unknown",
        "UNAUTHORIZED_SOURCE",
        `Message from "${sourceId || "unknown"}" failed iframe reference, origin, or handshake verification`,
        0
      );
      this.recordResponse(rejected, 0, raw.operation || "unknown");
      return;
    }

    const response = await this.send(raw as BridgeRequest);
    try {
      const targetWin = event.source as Window | null;
      if (targetWin && typeof targetWin.postMessage === "function") {
        targetWin.postMessage(response, event.origin === "null" ? "*" : event.origin);
      }
    } catch {
      // Ignore closed iframe channel
    }
  };

  registerModule(moduleId: string, operations: Record<string, BridgeOperationHandler>): void {
    const existing = this.handlers.get(moduleId) || new Map<string, BridgeOperationHandler>();
    Object.entries(operations).forEach(([op, handler]) => {
      existing.set(op, handler);
    });
    this.handlers.set(moduleId, existing);
    this.syncDiagnosticsProbe();
  }

  registerOperation(targetModuleId: string, operation: string, handler: BridgeOperationHandler): void {
    const existing = this.handlers.get(targetModuleId) || new Map<string, BridgeOperationHandler>();
    existing.set(operation, handler);
    this.handlers.set(targetModuleId, existing);
    this.syncDiagnosticsProbe();
  }

  registerUnavailableOperation(operation: string, reason: string): void {
    this.unavailableOps.set(operation, reason);
  }

  unregisterModule(moduleId: string): void {
    this.handlers.delete(moduleId);
    this.syncDiagnosticsProbe();
  }

  getRegisteredOperations(targetModuleId?: string): string[] {
    if (targetModuleId) {
      return Array.from(this.handlers.get(targetModuleId)?.keys() || []);
    }
    const all: string[] = [];
    this.handlers.forEach((ops, mod) => {
      ops.forEach((_, opName) => {
        all.push(mod === "foundry-host" ? opName : `${mod}:${opName}`);
      });
    });
    return all;
  }

  getUnavailableOperations(): Array<{ operation: string; reason: string }> {
    return Array.from(this.unavailableOps.entries()).map(([operation, reason]) => ({
      operation,
      reason,
    }));
  }

  getConnectedModules(): string[] {
    return Array.from(new Set([...this.handlers.keys(), ...this.trustedSources]));
  }

  createRequest(params: {
    source: string;
    operation: string;
    target?: string;
    payload?: Record<string, any>;
    requestId?: string;
    timeoutMs?: number;
    handshakeToken?: string;
  }): BridgeRequest {
    return {
      protocol: BRIDGE_PROTOCOL,
      version: BRIDGE_VERSION,
      type: "request",
      requestId:
        params.requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      source: params.source,
      target: params.target || "foundry-host",
      operation: params.operation,
      timestamp: Date.now(),
      payload: params.payload || {},
      timeoutMs: params.timeoutMs,
      handshakeToken: params.handshakeToken,
    };
  }

  private buildErrorResponse(
    requestId: string,
    source: string,
    target: string,
    operation: string,
    code: BridgeErrorCode,
    message: string,
    _durationMs: number,
    details?: any
  ): BridgeResponse {
    return {
      protocol: BRIDGE_PROTOCOL,
      version: BRIDGE_VERSION,
      type: "response",
      requestId,
      source: target || "foundry-host",
      target: source || "unknown",
      operation,
      timestamp: Date.now(),
      success: false,
      data: null,
      error: {
        code,
        message,
        details,
      },
    };
  }

  private recordResponse(response: BridgeResponse, durationMs: number, operation: string) {
    this.requestHistory.unshift(response);
    if (this.requestHistory.length > 100) {
      this.requestHistory.length = 100;
    }

    if (response.success) {
      eventBus.emit(
        FOUNDRY_EVENTS.BRIDGE_RESPONSE,
        {
          requestId: response.requestId,
          source: response.target,
          target: response.source,
          operation,
          durationMs,
        },
        "communication-bridge"
      );
      diagnosticsManager.logExecution({
        source: response.target,
        operation,
        target: response.source,
        status: "success",
        durationMs,
        message: `Bridge operation "${operation}" succeeded`,
        error: null,
      });
    } else {
      eventBus.emit(
        FOUNDRY_EVENTS.BRIDGE_ERROR,
        {
          requestId: response.requestId,
          source: response.target,
          target: response.source,
          operation,
          code: response.error?.code,
          error: response.error?.message,
        },
        "communication-bridge"
      );
      diagnosticsManager.logExecution({
        source: response.target,
        operation,
        target: response.source,
        status: response.error?.code === "PERMISSION_DENIED" ? "warning" : "error",
        durationMs,
        message: `Bridge operation "${operation}" failed (${response.error?.code || "ERROR"})`,
        error: response.error?.message || "Unknown bridge error",
      });
    }
    this.syncDiagnosticsProbe();
  }

  async send(rawRequest: unknown): Promise<BridgeResponse> {
    const startMs = Date.now();

    // 1. Structural request validation
    if (!rawRequest || typeof rawRequest !== "object" || Array.isArray(rawRequest)) {
      const res = this.buildErrorResponse(
        `invalid_${startMs}`,
        "unknown",
        "foundry-host",
        "unknown",
        "VALIDATION_ERROR",
        "Bridge request must be a JSON object",
        0
      );
      this.recordResponse(res, 0, "unknown");
      return res;
    }

    const req = rawRequest as Partial<BridgeRequest>;
    const reqId = typeof req.requestId === "string" && req.requestId.trim() ? req.requestId.trim() : "";
    const source = typeof req.source === "string" && req.source.trim() ? req.source.trim() : "";
    const target = typeof req.target === "string" && req.target.trim() ? req.target.trim() : "";
    const operation = typeof req.operation === "string" && req.operation.trim() ? req.operation.trim() : "";

    if (req.protocol !== BRIDGE_PROTOCOL) {
      const res = this.buildErrorResponse(
        reqId || `invalid_${startMs}`,
        source || "unknown",
        target || "foundry-host",
        operation || "unknown",
        "VALIDATION_ERROR",
        `Invalid bridge protocol: expected "${BRIDGE_PROTOCOL}"`,
        0
      );
      this.recordResponse(res, Date.now() - startMs, operation || "unknown");
      return res;
    }

    if (req.version !== BRIDGE_VERSION) {
      const res = this.buildErrorResponse(
        reqId || `invalid_${startMs}`,
        source || "unknown",
        target || "foundry-host",
        operation || "unknown",
        "UNSUPPORTED_VERSION",
        `Unsupported bridge protocol version: ${String(req.version)} (expected ${BRIDGE_VERSION})`,
        0
      );
      this.recordResponse(res, Date.now() - startMs, operation || "unknown");
      return res;
    }

    if (req.type !== "request" || !reqId || !source || !target || !operation) {
      const res = this.buildErrorResponse(
        reqId || `invalid_${startMs}`,
        source || "unknown",
        target || "foundry-host",
        operation || "unknown",
        "VALIDATION_ERROR",
        "Bridge request missing required fields (type='request', requestId, source, target, operation)",
        0
      );
      this.recordResponse(res, Date.now() - startMs, operation || "unknown");
      return res;
    }

    if (
      req.payload !== undefined &&
      (typeof req.payload !== "object" || req.payload === null || Array.isArray(req.payload))
    ) {
      const res = this.buildErrorResponse(
        reqId,
        source,
        target,
        operation,
        "VALIDATION_ERROR",
        "Bridge request payload must be a plain object",
        0
      );
      this.recordResponse(res, Date.now() - startMs, operation);
      return res;
    }

    const validatedReq: BridgeRequest = {
      protocol: BRIDGE_PROTOCOL,
      version: BRIDGE_VERSION,
      type: "request",
      requestId: reqId,
      source,
      target,
      operation,
      timestamp: typeof req.timestamp === "number" ? req.timestamp : startMs,
      payload: (req.payload as Record<string, any>) || {},
      timeoutMs: typeof req.timeoutMs === "number" ? req.timeoutMs : 5000,
      handshakeToken: req.handshakeToken,
    };

    eventBus.emit(
      FOUNDRY_EVENTS.BRIDGE_REQUEST,
      { requestId: reqId, source, target, operation },
      "communication-bridge"
    );

    // 2. Source verification
    if (!this.trustedSources.has(source)) {
      const res = this.buildErrorResponse(
        reqId,
        source,
        target,
        operation,
        "UNAUTHORIZED_SOURCE",
        `Untrusted or unregistered source module: "${source}"`,
        Date.now() - startMs
      );
      this.recordResponse(res, Date.now() - startMs, operation);
      return res;
    }

    // 3. Duplicate-request protection
    if (this.recentRequestIds.has(reqId)) {
      const res = this.buildErrorResponse(
        reqId,
        source,
        target,
        operation,
        "DUPLICATE_REQUEST",
        `Duplicate requestId rejected: "${reqId}"`,
        Date.now() - startMs
      );
      this.recordResponse(res, Date.now() - startMs, operation);
      return res;
    }
    this.recentRequestIds.add(reqId);
    if (this.recentRequestIds.size > 500) {
      const oldest = this.recentRequestIds.values().next().value;
      if (oldest) this.recentRequestIds.delete(oldest);
    }

    // 4. Planned / unavailable operation check
    if (this.unavailableOps.has(operation)) {
      const res = this.buildErrorResponse(
        reqId,
        source,
        target,
        operation,
        "UNAVAILABLE_OPERATION",
        this.unavailableOps.get(operation) || `Operation "${operation}" is unavailable in Stage 1`,
        Date.now() - startMs
      );
      this.recordResponse(res, Date.now() - startMs, operation);
      return res;
    }

    // 5. Permission evaluation
    const perm = await permissionManager.evaluate(source, operation);
    if (!perm.allowed) {
      const res = this.buildErrorResponse(
        reqId,
        source,
        target,
        operation,
        perm.state === "unavailable" ? "UNAVAILABLE_OPERATION" : "PERMISSION_DENIED",
        perm.reason || `Permission denied for "${operation}"`,
        Date.now() - startMs,
        { scope: perm.scope, permissionState: perm.state }
      );
      this.recordResponse(res, Date.now() - startMs, operation);
      return res;
    }

    // 6. Target & operation lookup
    const targetOps = this.handlers.get(target);
    if (!targetOps) {
      const res = this.buildErrorResponse(
        reqId,
        source,
        target,
        operation,
        "UNKNOWN_TARGET",
        `Target module not registered: "${target}"`,
        Date.now() - startMs
      );
      this.recordResponse(res, Date.now() - startMs, operation);
      return res;
    }

    const handler = targetOps.get(operation);
    if (!handler) {
      const res = this.buildErrorResponse(
        reqId,
        source,
        target,
        operation,
        "UNKNOWN_OPERATION",
        `Operation "${operation}" is not supported by target "${target}"`,
        Date.now() - startMs
      );
      this.recordResponse(res, Date.now() - startMs, operation);
      return res;
    }

    // 7. Execute with timeout guard
    const timeoutMs = Math.max(25, Math.min(30000, validatedReq.timeoutMs ?? 5000));
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    try {
      const executionPromise = Promise.resolve(handler(validatedReq.payload, validatedReq));
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(Object.assign(new Error(`Operation "${operation}" timed out after ${timeoutMs}ms`), { isTimeout: true }));
        }, timeoutMs);
      });

      const data = await Promise.race([executionPromise, timeoutPromise]);
      const durationMs = Date.now() - startMs;
      const response: BridgeResponse = {
        protocol: BRIDGE_PROTOCOL,
        version: BRIDGE_VERSION,
        type: "response",
        requestId: reqId,
        source: target,
        target: source,
        operation,
        timestamp: Date.now(),
        success: true,
        data: data ?? null,
        error: null,
      };
      this.recordResponse(response, durationMs, operation);
      return response;
    } catch (err: any) {
      const durationMs = Date.now() - startMs;
      const code: BridgeErrorCode = err?.isTimeout ? "TIMEOUT" : "OPERATION_FAILED";
      const response = this.buildErrorResponse(
        reqId,
        source,
        target,
        operation,
        code,
        err?.message || String(err),
        durationMs
      );
      this.recordResponse(response, durationMs, operation);
      return response;
    } finally {
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private registerFoundationalOperations() {
    this.registerModule("foundry-host", {
      // System operations
      "system.ping": () => ({
        pong: true,
        protocol: BRIDGE_PROTOCOL,
        version: BRIDGE_VERSION,
        timestamp: Date.now(),
      }),
      "system.get_status": () => ({
        healthy: diagnosticsManager.checkHealth(),
        subsystems: diagnosticsManager.getMetrics(),
        timestamp: Date.now(),
      }),
      "system.get_version": () => ({
        name: "Foundry",
        stage: 2,
        version: "2.0.0",
        bridgeProtocol: BRIDGE_PROTOCOL,
        bridgeVersion: BRIDGE_VERSION,
      }),
      "system.get_capabilities": () => ({
        operations: this.getRegisteredOperations("foundry-host"),
        unavailableOperations: this.getUnavailableOperations(),
        aiConnected: this.aiStatusChecker ? this.aiStatusChecker() : false,
      }),

      // Application operations
      "app.list": () => applicationRegistry.list(),
      "app.get": (payload) => {
        if (!payload?.appId || typeof payload.appId !== "string") {
          throw new Error("app.get requires string payload.appId");
        }
        const app = applicationRegistry.get(payload.appId);
        if (!app) {
          throw new Error(`Unknown application: ${payload.appId}`);
        }
        return app;
      },
      "app.open": (payload) => {
        if (!payload?.appId || typeof payload.appId !== "string") {
          throw new Error("app.open requires string payload.appId");
        }
        const res = applicationRegistry.launch(payload.appId, payload.options);
        if (!res.success) {
          throw new Error(res.error || `Failed to open application: ${payload.appId}`);
        }
        return res;
      },
      "app.close": (payload) => {
        if (!payload?.appId || typeof payload.appId !== "string") {
          throw new Error("app.close requires string payload.appId");
        }
        const res = applicationRegistry.close(payload.appId);
        if (!res.success) {
          throw new Error(res.error || `Failed to close application: ${payload.appId}`);
        }
        return res;
      },
      "app.focus": (payload) => {
        if (!payload?.appId || typeof payload.appId !== "string") {
          throw new Error("app.focus requires string payload.appId");
        }
        const res = applicationRegistry.focus(payload.appId);
        if (!res.success) {
          throw new Error(res.error || `Failed to focus application: ${payload.appId}`);
        }
        return res;
      },
      "app.get_status": (payload) => {
        if (!payload?.appId || typeof payload.appId !== "string") {
          throw new Error("app.get_status requires string payload.appId");
        }
        const status = applicationRegistry.getStatus(payload.appId);
        if (!status) {
          throw new Error(`Unknown application: ${payload.appId}`);
        }
        return { appId: payload.appId, status };
      },
      "app.get_capabilities": (payload) => {
        if (!payload?.appId || typeof payload.appId !== "string") {
          throw new Error("app.get_capabilities requires string payload.appId");
        }
        const caps = applicationRegistry.getCapabilities(payload.appId);
        if (!caps) {
          throw new Error(`Unknown application: ${payload.appId}`);
        }
        return { appId: payload.appId, ...caps };
      },

      // Window operations
      "window.list": (payload) => windowManager.getWindows(payload?.parentWindowId),
      "window.get": (payload) => {
        if (!payload?.windowId || typeof payload.windowId !== "string") {
          throw new Error("window.get requires string payload.windowId");
        }
        const win = windowManager.getWindow(payload.windowId);
        if (!win) {
          throw new Error(`Unknown window: ${payload.windowId}`);
        }
        return win;
      },
      "window.show": (payload) => {
        if (!payload?.windowId) throw new Error("window.show requires payload.windowId");
        const win = windowManager.open(payload.windowId);
        if (!win) throw new Error(`Unknown window: ${payload.windowId}`);
        return win;
      },
      "window.hide": (payload) => {
        if (!payload?.windowId) throw new Error("window.hide requires payload.windowId");
        const ok = windowManager.close(payload.windowId);
        if (!ok) throw new Error(`Unknown window: ${payload.windowId}`);
        return { windowId: payload.windowId, hidden: true };
      },
      "window.focus": (payload) => {
        if (!payload?.windowId) throw new Error("window.focus requires payload.windowId");
        const win = windowManager.focus(payload.windowId);
        if (!win) throw new Error(`Unknown window: ${payload.windowId}`);
        return win;
      },
      "window.move": (payload) => {
        if (!payload?.windowId || !payload?.position) {
          throw new Error("window.move requires payload.windowId and payload.position");
        }
        const win = windowManager.move(payload.windowId, payload.position);
        if (!win) throw new Error(`Unable to move window: ${payload.windowId}`);
        return win;
      },
      "window.resize": (payload) => {
        if (!payload?.windowId || !payload?.size) {
          throw new Error("window.resize requires payload.windowId and payload.size");
        }
        const win = windowManager.resize(payload.windowId, payload.size);
        if (!win) throw new Error(`Unable to resize window: ${payload.windowId}`);
        return win;
      },
      "window.minimize": (payload) => {
        if (!payload?.windowId) throw new Error("window.minimize requires payload.windowId");
        const win = windowManager.minimize(payload.windowId);
        if (!win) throw new Error(`Unknown window: ${payload.windowId}`);
        return win;
      },
      "window.restore": (payload) => {
        if (!payload?.windowId) throw new Error("window.restore requires payload.windowId");
        const win = windowManager.restore(payload.windowId);
        if (!win) throw new Error(`Unknown window: ${payload.windowId}`);
        return win;
      },
      "window.expand": (payload) => {
        if (!payload?.windowId) throw new Error("window.expand requires payload.windowId");
        const win = windowManager.expand(payload.windowId);
        if (!win) throw new Error(`Unknown window: ${payload.windowId}`);
        return win;
      },

      // Workspace operations
      "workspace.get_active": () => {
        if (this.hostCanvasProvider) {
          return this.hostCanvasProvider.getWorkspaceInfo();
        }
        const ctx = sharedContextManager.getContext();
        return {
          workspaceId: ctx.workspaceId,
          workspaceName: ctx.workspaceName,
          connectionStatus: "unknown",
          elementCount: 0,
        };
      },
      "workspace.get_context": () => sharedContextManager.getContext(),
      "workspace.get_viewport": () => {
        if (this.hostCanvasProvider) {
          return this.hostCanvasProvider.getViewport();
        }
        return sharedContextManager.getContext().viewport;
      },

      // Selection operations
      "selection.get": () => {
        if (this.hostCanvasProvider) {
          const items = this.hostCanvasProvider.getSelectedElements();
          return {
            selectedIds: items.map((i) => i.id),
            elements: items.map((i) => ({
              id: i.id,
              type: i.type,
              title: i.title || null,
              x: i.x,
              y: i.y,
              width: i.width,
              height: i.height,
            })),
          };
        }
        const ctx = sharedContextManager.getContext();
        return { selectedIds: ctx.selectedCanvasObjectIds, elements: [] };
      },
      "selection.count": () => {
        if (this.hostCanvasProvider) {
          return { count: this.hostCanvasProvider.getSelectedElements().length };
        }
        return { count: sharedContextManager.getContext().selectedCanvasObjectIds.length };
      },

      // Controller operations
      "controller.show": () => {
        if (!educationControllerAdapter.show()) {
          throw new Error("Education Controller is not mounted");
        }
        return educationControllerAdapter.getState();
      },
      "controller.hide": () => {
        if (!educationControllerAdapter.hide()) {
          throw new Error("Education Controller is not mounted");
        }
        return educationControllerAdapter.getState();
      },
      "controller.open_section": (payload) => {
        if (!payload?.section || typeof payload.section !== "string") {
          throw new Error("controller.open_section requires string payload.section");
        }
        const ok = educationControllerAdapter.openSection(payload.section);
        if (!ok) {
          throw new Error(`Unable to open controller section "${payload.section}"`);
        }
        return educationControllerAdapter.getState();
      },
      "controller.open_ai": () => {
        if (!educationControllerAdapter.openAI()) {
          throw new Error("Education Controller is not mounted");
        }
        return educationControllerAdapter.getState();
      },
      "controller.get_state": () => {
        const state = educationControllerAdapter.getState();
        if (!state) {
          throw new Error("Education Controller is not mounted");
        }
        return state;
      },
    });

    // Stage 3 / Planned operations explicitly registered as unavailable
    this.registerUnavailableOperation(
      "ai.execute_workflow",
      "Autonomous multi-step AI workflows are deferred to Stage 3"
    );
  }

  getHistory(): BridgeResponse[] {
    return [...this.requestHistory];
  }

  getRecentErrors(): BridgeResponse[] {
    return this.requestHistory.filter((r) => !r.success);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isTransportAttached(): boolean {
    return this.messageTransportAttached;
  }

  destroy(): void {
    this.detachMessageTransport();
    this.registeredFrames.clear();
    this.recentRequestIds.clear();
    this.hostCanvasProvider = null;
    this.initialized = false;
    this.syncDiagnosticsProbe();
  }
}

export const communicationBridge = new CommunicationBridgeService();
