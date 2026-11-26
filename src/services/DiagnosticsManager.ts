/**
 * Foundry Diagnostics Manager & Bounded Execution Log (Phase 05 & Stage 1 Diagnostics)
 * Tracks real verified subsystem statuses (never pre-seeded as healthy) and
 * maintains a bounded activity log with secret redaction and status filtering.
 */
import { eventBus } from "./EventBus";
import { persistenceManager } from "./PersistenceManager";
import { windowManager } from "./WindowManager";
import { applicationRegistry } from "./ApplicationRegistry";
import { educationControllerAdapter } from "./educationControllerAdapter";

export type SubsystemStatus = "unverified" | "healthy" | "warning" | "error";

export interface SystemMetric {
  id: string;
  name: string;
  status: SubsystemStatus;
  verified: boolean;
  value: string | number;
  message?: string;
  timestamp: number;
}

export type ExecutionLogStatus = "info" | "success" | "warning" | "error";

export interface ExecutionLogRecord {
  id: string;
  timestamp: number;
  source: string;
  operation: string;
  target: string;
  status: ExecutionLogStatus;
  durationMs: number;
  message: string;
  error: string | null;
}

export interface DiagnosticRuntimeProbes {
  canvas?: {
    mounted: boolean;
    elementCount: number;
    connectionStatus?: string;
    viewportZoom?: number;
  };
  bridge?: {
    initialized: boolean;
    protocolVersion: number;
    operationCount: number;
    transportAttached: boolean;
    verifiedSourceCount: number;
    errorCount: number;
  };
}

const SENSITIVE_PATTERN =
  /(token|api[_-]?key|secret|password|credential|authorization|bearer)\s*[:=]\s*["']?([^\s"',;}{]+)/gi;

export function redactSensitiveText(input: string): string {
  if (!input) return input;
  return input.replace(SENSITIVE_PATTERN, "$1=[REDACTED]");
}

class DiagnosticsManagerService {
  private metrics: Map<string, SystemMetric> = new Map([
    [
      "canvas_engine",
      {
        id: "canvas_engine",
        name: "Canvas Engine",
        status: "unverified",
        verified: false,
        value: "Awaiting runtime check",
        timestamp: 0,
      },
    ],
    [
      "window_manager",
      {
        id: "window_manager",
        name: "Window Manager",
        status: "unverified",
        verified: false,
        value: "Awaiting runtime check",
        timestamp: 0,
      },
    ],
    [
      "application_registry",
      {
        id: "application_registry",
        name: "Application Registry",
        status: "unverified",
        verified: false,
        value: "Awaiting runtime check",
        timestamp: 0,
      },
    ],
    [
      "communication_bridge",
      {
        id: "communication_bridge",
        name: "Communication Bridge",
        status: "unverified",
        verified: false,
        value: "Awaiting runtime check",
        timestamp: 0,
      },
    ],
    [
      "education_controller",
      {
        id: "education_controller",
        name: "Education Controller",
        status: "unverified",
        verified: false,
        value: "Awaiting runtime check",
        timestamp: 0,
      },
    ],
    [
      "persistence_store",
      {
        id: "persistence_store",
        name: "Persistence Manager",
        status: "unverified",
        verified: false,
        value: "Awaiting runtime check",
        timestamp: 0,
      },
    ],
    [
      "event_bus",
      {
        id: "event_bus",
        name: "Event Bus",
        status: "unverified",
        verified: false,
        value: "Awaiting runtime check",
        timestamp: 0,
      },
    ],
  ]);

  private executionLog: ExecutionLogRecord[] = [];
  private readonly maxLogEntries = 250;
  private latestProbes: DiagnosticRuntimeProbes = {};
  private listeners: Set<() => void> = new Set();
  private seq = 0;

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error("DiagnosticsManager listener error:", err);
      }
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setRuntimeProbes(probes: Partial<DiagnosticRuntimeProbes>): void {
    this.latestProbes = {
      ...this.latestProbes,
      ...probes,
    };
  }

  reportMetric(metric: SystemMetric) {
    this.metrics.set(metric.id || metric.name, {
      ...metric,
      timestamp: metric.timestamp || Date.now(),
    });
    this.notify();
  }

  logExecution(entry: Omit<ExecutionLogRecord, "id" | "timestamp"> & { id?: string; timestamp?: number }): ExecutionLogRecord {
    this.seq += 1;
    const record: ExecutionLogRecord = {
      id: entry.id || `exec_${Date.now()}_${this.seq}`,
      timestamp: entry.timestamp || Date.now(),
      source: redactSensitiveText(entry.source || "foundry-host"),
      operation: redactSensitiveText(entry.operation || "system.event"),
      target: redactSensitiveText(entry.target || "foundry-host"),
      status: entry.status,
      durationMs: Number.isFinite(entry.durationMs) ? Math.max(0, Math.round(entry.durationMs)) : 0,
      message: redactSensitiveText(entry.message || ""),
      error: entry.error ? redactSensitiveText(entry.error) : null,
    };

    this.executionLog.unshift(record);
    if (this.executionLog.length > this.maxLogEntries) {
      this.executionLog.length = this.maxLogEntries;
    }
    this.notify();
    return record;
  }

  getExecutionLog(filter: "all" | ExecutionLogStatus = "all", limit = 150): ExecutionLogRecord[] {
    const filtered =
      filter === "all"
        ? this.executionLog
        : this.executionLog.filter((item) => item.status === filter);
    return filtered.slice(0, limit);
  }

  clearExecutionLog(): void {
    this.executionLog = [];
    this.notify();
  }

  verifyAll(overrides?: Partial<DiagnosticRuntimeProbes>): SystemMetric[] {
    const t0 = Date.now();
    const probes: DiagnosticRuntimeProbes = {
      ...this.latestProbes,
      ...overrides,
    };
    this.latestProbes = probes;

    // 1. Canvas Engine verification
    const hasDomCanvas =
      typeof document !== "undefined" && Boolean(document.getElementById("infinite-canvas-viewport"));
    const canvasMounted = Boolean(probes.canvas?.mounted ?? hasDomCanvas);
    const elCount = probes.canvas?.elementCount ?? 0;
    const zoomPct = Math.round((probes.canvas?.viewportZoom ?? 1) * 100);
    this.metrics.set("canvas_engine", {
      id: "canvas_engine",
      name: "Canvas Engine",
      status: canvasMounted ? "healthy" : "warning",
      verified: canvasMounted,
      value: canvasMounted ? `${elCount} objects · ${zoomPct}% zoom` : "Canvas viewport not mounted",
      message: probes.canvas?.connectionStatus
        ? `Sync state: ${probes.canvas.connectionStatus}`
        : undefined,
      timestamp: Date.now(),
    });

    // 2. Window Manager verification
    const wmInit = windowManager.isInitialized();
    const allWindows = windowManager.getWindows();
    const visibleCount = allWindows.filter((w) => w.visible).length;
    this.metrics.set("window_manager", {
      id: "window_manager",
      name: "Window Manager",
      status: wmInit ? "healthy" : "warning",
      verified: wmInit,
      value: wmInit
        ? `${allWindows.length} registered (${visibleCount} visible)`
        : "Not initialized",
      timestamp: Date.now(),
    });

    // 3. Application Registry verification
    const apps = applicationRegistry.list();
    const installedCount = apps.filter((a) => a.status !== "not_installed").length;
    const runningCount = apps.filter((a) => a.status === "running").length;
    const notInstalledCount = apps.filter((a) => a.status === "not_installed").length;
    this.metrics.set("application_registry", {
      id: "application_registry",
      name: "Application Registry",
      status: apps.length > 0 ? "healthy" : "error",
      verified: apps.length > 0,
      value: `${installedCount} installed · ${runningCount} running · ${notInstalledCount} not installed`,
      timestamp: Date.now(),
    });

    // 4. Communication Bridge verification
    const bridgeInfo = probes.bridge;
    const bridgeOk = Boolean(bridgeInfo?.initialized && bridgeInfo.operationCount > 0);
    this.metrics.set("communication_bridge", {
      id: "communication_bridge",
      name: "Communication Bridge",
      status: bridgeOk ? "healthy" : bridgeInfo?.initialized ? "warning" : "unverified",
      verified: bridgeOk,
      value: bridgeInfo
        ? `v${bridgeInfo.protocolVersion} · ${bridgeInfo.operationCount} ops · ${bridgeInfo.verifiedSourceCount} verified sources`
        : "Bridge status probe unavailable",
      message: bridgeInfo?.transportAttached ? "postMessage handshake listener active" : "Internal dispatch only",
      timestamp: Date.now(),
    });

    // 5. Education Controller verification
    const ctrlMounted = educationControllerAdapter.isMounted();
    const ctrlReady = educationControllerAdapter.isFrameReady();
    const ctrlState = educationControllerAdapter.getState() as any;
    let ctrlStatus: SubsystemStatus = "unverified";
    let ctrlValue = "Controller unmounted";
    if (ctrlMounted && ctrlReady) {
      ctrlStatus = "healthy";
      ctrlValue = `${ctrlState?.visible ? "Visible" : "Hidden"} · ${ctrlState?.minimized ? "Minimized" : ctrlState?.expanded ? "Expanded" : `${Math.round(ctrlState?.w || 0)}×${Math.round(ctrlState?.h || 0)}`}`;
    } else if (ctrlMounted) {
      ctrlStatus = "warning";
      ctrlValue = "Mounted · waiting for iframe ready";
    }
    this.metrics.set("education_controller", {
      id: "education_controller",
      name: "Education Controller",
      status: ctrlStatus,
      verified: ctrlMounted && ctrlReady,
      value: ctrlValue,
      message: ctrlState?.activeCourse ? `Course: ${ctrlState.activeCourse}` : undefined,
      timestamp: Date.now(),
    });

    // 6. Persistence Manager verification (real storage read/write probe)
    const storageRes = persistenceManager.verifyStorage();
    this.metrics.set("persistence_store", {
      id: "persistence_store",
      name: "Persistence Manager",
      status: storageRes.available && storageRes.writable ? "healthy" : "error",
      verified: storageRes.available && storageRes.writable,
      value:
        storageRes.available && storageRes.writable
          ? `localStorage R/W verified (${storageRes.keyCount} keys)`
          : storageRes.error || "Storage unavailable",
      timestamp: Date.now(),
    });

    // 7. Event Bus verification (live synchronous pub/sub probe)
    let eventBusPassed = false;
    const probeChannel = "__foundry:diagnostics:probe__";
    const off = eventBus.on(probeChannel, (env) => {
      if (env?.data?.nonce === t0) eventBusPassed = true;
    });
    eventBus.emit(probeChannel, { nonce: t0 }, "diagnostics-manager");
    off();

    this.metrics.set("event_bus", {
      id: "event_bus",
      name: "Event Bus",
      status: eventBusPassed ? "healthy" : "error",
      verified: eventBusPassed,
      value: eventBusPassed
        ? `${eventBus.getSubscriberCount()} active listeners · ${eventBus.getRegisteredEventNames().length} canonical events`
        : "Event dispatch probe failed",
      timestamp: Date.now(),
    });

    const durationMs = Date.now() - t0;
    const allHealthy = this.checkHealth();
    this.logExecution({
      source: "diagnostics-manager",
      operation: "diagnostics.verify_all",
      target: "foundry-host",
      status: allHealthy ? "success" : "warning",
      durationMs,
      message: allHealthy
        ? "All 7 Foundry subsystems verified"
        : "Diagnostics verification completed with unverified/warning subsystems",
      error: null,
    });

    this.notify();
    return this.getMetrics();
  }

  getMetrics(): SystemMetric[] {
    return Array.from(this.metrics.values()).map((m) => ({ ...m }));
  }

  getMetric(id: string): SystemMetric | undefined {
    const m = this.metrics.get(id);
    return m ? { ...m } : undefined;
  }

  checkHealth(): boolean {
    for (const m of this.metrics.values()) {
      if (!m.verified || m.status === "error" || m.status === "unverified") {
        return false;
      }
    }
    return true;
  }
}

export const diagnosticsManager = new DiagnosticsManagerService();
