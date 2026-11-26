/**
 * Foundry Central Application Registry (Phase 04)
 * Discovers, registers, launches, focuses, closes, and inspects Foundry applications
 * and Education Controller companion applications using standardized manifests.
 */
import { eventBus, FOUNDRY_EVENTS } from "./EventBus";
import { windowManager, WindowDisplayMode } from "./WindowManager";
import {
  educationControllerAdapter,
  MAIN_CONTROLLER_WINDOW_ID,
} from "./educationControllerAdapter";
import { sharedContextManager } from "./SharedContextManager";

export type ApplicationStatus =
  | "not_installed"
  | "installed"
  | "available"
  | "running"
  | "hidden"
  | "disabled"
  | "error"
  | "requires_configuration";

export type ApplicationCategory =
  | "education"
  | "ai"
  | "utility"
  | "creative"
  | "analysis"
  | "management"
  | "settings";

export type AllDisplayModes = WindowDisplayMode;

export interface ApplicationManifest {
  id: string;
  name: string;
  description: string;
  category: ApplicationCategory;
  version: string;
  host: "education-controller" | "foundry-host";
  status: ApplicationStatus;
  enabled: boolean;
  displayModes: AllDisplayModes[];
  defaultWindow: {
    width: number;
    height: number;
    resizable: boolean;
    draggable: boolean;
  };
  capabilities: string[];
  plannedCapabilities: string[];
  ai: {
    enabled: boolean;
    connected: boolean;
  };
  dependencies: string[];
  recentErrors?: string[];
  iconName?: string;
  entryPoint?: string;
}

export interface ApplicationLaunchResult {
  success: boolean;
  appId: string;
  status: ApplicationStatus;
  windowId?: string | null;
  error?: string;
}

// Legacy alias kept for compatibility
export type RegisteredApp = ApplicationManifest;

const DEFAULT_STAGE1_MANIFESTS: ApplicationManifest[] = [
  {
    id: "education-controller",
    name: "Education Controller",
    description: "Floating Slate Education Studio workspace controller and navigation hub.",
    category: "education",
    version: "1.0.0",
    host: "foundry-host",
    status: "installed",
    enabled: true,
    displayModes: ["controller", "floating"],
    defaultWindow: { width: 600, height: 330, resizable: true, draggable: true },
    capabilities: ["open", "close", "focus", "minimize", "restore", "expand", "open_section", "open_ai"],
    plannedCapabilities: ["multi_instance", "cloud_profile_sync"],
    ai: { enabled: true, connected: false },
    dependencies: [],
  },
  {
    id: "education-ai",
    name: "Education AI Chat",
    description: "Primary Foundry AI interface hosted inside Education Controller.",
    category: "ai",
    version: "1.0.0",
    host: "education-controller",
    status: "installed",
    enabled: true,
    displayModes: ["embedded"],
    defaultWindow: { width: 520, height: 540, resizable: true, draggable: false },
    capabilities: ["open", "close", "focus", "chat", "streaming", "ollama_inference", "tool_calling"],
    plannedCapabilities: ["rag_grounding", "autonomous_workflows"],
    ai: { enabled: true, connected: false },
    dependencies: ["education-controller"],
  },
  {
    id: "knowledge-base",
    name: "Knowledge Base",
    description: "Course notes, reference library, and structured study files viewer.",
    category: "education",
    version: "1.0.0",
    host: "education-controller",
    status: "installed",
    enabled: true,
    displayModes: ["embedded"],
    defaultWindow: { width: 560, height: 540, resizable: true, draggable: false },
    capabilities: ["open", "close", "focus"],
    plannedCapabilities: ["semantic_search", "canvas_citation_insert", "rag_indexing"],
    ai: { enabled: false, connected: false },
    dependencies: ["education-controller"],
  },
  {
    id: "choice-board",
    name: "Choice Board Studio",
    description: "Interactive learning choice grid and assignment option builder.",
    category: "education",
    version: "1.0.0",
    host: "education-controller",
    status: "installed",
    enabled: true,
    displayModes: ["companion"],
    defaultWindow: { width: 300, height: 620, resizable: true, draggable: false },
    capabilities: ["open", "close", "focus"],
    plannedCapabilities: ["export_to_canvas", "assign_to_course"],
    ai: { enabled: false, connected: false },
    dependencies: ["education-controller"],
  },
  {
    id: "essay-to-slides",
    name: "Essay to Slides",
    description: "Structured outline and slide companion from academic essays.",
    category: "education",
    version: "1.0.0",
    host: "education-controller",
    status: "installed",
    enabled: true,
    displayModes: ["companion"],
    defaultWindow: { width: 300, height: 620, resizable: true, draggable: false },
    capabilities: ["open", "close", "focus"],
    plannedCapabilities: ["generate_presentation_frames", "ai_slide_outline"],
    ai: { enabled: false, connected: false },
    dependencies: ["education-controller"],
  },
  {
    id: "countdown",
    name: "Countdown",
    description: "Compact floating exam and assignment countdown timer.",
    category: "education",
    version: "1.0.0",
    host: "education-controller",
    status: "installed",
    enabled: true,
    displayModes: ["companion"],
    defaultWindow: { width: 300, height: 215, resizable: true, draggable: false },
    capabilities: ["open", "close", "focus"],
    plannedCapabilities: ["sync_calendar_deadlines"],
    ai: { enabled: false, connected: false },
    dependencies: ["education-controller"],
  },
  {
    id: "finals-study-guide",
    name: "Finals Study Guide",
    description: "Exam readiness checklist, topic weighting, and review synthesizer.",
    category: "education",
    version: "1.0.0",
    host: "education-controller",
    status: "installed",
    enabled: true,
    displayModes: ["companion"],
    defaultWindow: { width: 300, height: 620, resizable: true, draggable: false },
    capabilities: ["open", "close", "focus"],
    plannedCapabilities: ["generate_study_plan", "export_study_sheet"],
    ai: { enabled: false, connected: false },
    dependencies: ["education-controller"],
  },
  {
    id: "digital-flashcards",
    name: "Digital Flashcards Studio",
    description: "Course flashcards, quizzes and study analytics.",
    category: "education",
    version: "1.0.0",
    host: "education-controller",
    status: "installed",
    enabled: true,
    displayModes: ["companion"],
    defaultWindow: { width: 300, height: 620, resizable: true, draggable: false },
    capabilities: ["open", "close", "focus"],
    plannedCapabilities: ["create_deck", "import_material", "start_study", "start_quiz"],
    ai: { enabled: false, connected: false },
    dependencies: ["education-controller"],
  },
  {
    id: "student-command-center",
    name: "Student Command Center",
    description: "Course overview, task queue, and academic schedule companion panel.",
    category: "education",
    version: "1.0.0",
    host: "education-controller",
    status: "installed",
    enabled: true,
    displayModes: ["companion"],
    defaultWindow: { width: 560, height: 620, resizable: true, draggable: false },
    capabilities: ["open", "close", "focus"],
    plannedCapabilities: ["lms_grade_sync", "ai_daily_briefing"],
    ai: { enabled: false, connected: false },
    dependencies: ["education-controller"],
  },
  {
    id: "udl-lesson-planner",
    name: "Universal Design Lesson Planner",
    description: "UDL lesson planning calendar and instructional accessibility companion.",
    category: "education",
    version: "1.0.0",
    host: "education-controller",
    status: "installed",
    enabled: true,
    displayModes: ["companion"],
    defaultWindow: { width: 300, height: 620, resizable: true, draggable: false },
    capabilities: ["open", "close", "focus"],
    plannedCapabilities: ["curriculum_alignment", "export_lesson_frame"],
    ai: { enabled: false, connected: false },
    dependencies: ["education-controller"],
  },
  {
    id: "session-timer",
    name: "Session Timer and Projects",
    description: "External profile timer, active focus tracker, and student project drawer.",
    category: "education",
    version: "1.0.0",
    host: "education-controller",
    status: "installed",
    enabled: true,
    displayModes: ["companion"],
    defaultWindow: { width: 410, height: 340, resizable: false, draggable: false },
    capabilities: ["open", "close", "focus"],
    plannedCapabilities: ["pomodoro_telemetry_export"],
    ai: { enabled: false, connected: false },
    dependencies: ["education-controller"],
  },
  {
    id: "education-settings",
    name: "Education Settings",
    description: "Embedded account settings, preferences, and studio configuration panel.",
    category: "settings",
    version: "1.0.0",
    host: "education-controller",
    status: "installed",
    enabled: true,
    displayModes: ["embedded"],
    defaultWindow: { width: 640, height: 520, resizable: false, draggable: false },
    capabilities: ["open", "close", "focus"],
    plannedCapabilities: ["provider_key_vault"],
    ai: { enabled: false, connected: false },
    dependencies: ["education-controller"],
  },
  {
    id: "teaching-deck-assistant",
    name: "Teaching Deck Assistant",
    description: "Planned instructional slide-deck co-pilot (not installed in Stage 1).",
    category: "education",
    version: "0.0.0",
    host: "foundry-host",
    status: "not_installed",
    enabled: false,
    displayModes: [],
    defaultWindow: { width: 420, height: 540, resizable: true, draggable: true },
    capabilities: [],
    plannedCapabilities: ["create_teaching_deck", "rubric_alignment", "speaker_notes"],
    ai: { enabled: false, connected: false },
    dependencies: ["education-controller"],
  },
  {
    id: "html-engine",
    name: "HTML Sandbox Engine",
    description: "Live sanitized DOM rendering, iframe isolation, and snapshot rasterization.",
    category: "creative",
    version: "1.0.0",
    host: "foundry-host",
    status: "running",
    enabled: true,
    displayModes: ["canvas_object"],
    defaultWindow: { width: 440, height: 320, resizable: true, draggable: true },
    capabilities: ["render_sanitized_html", "rasterize_snapshot"],
    plannedCapabilities: ["bridge_sandbox_channel"],
    ai: { enabled: false, connected: false },
    dependencies: [],
  },
  {
    id: "vector-engine",
    name: "Vector Path & Boolean Engine",
    description: "Bezier path editing, boolean path operations, and geometric snapping.",
    category: "creative",
    version: "1.0.0",
    host: "foundry-host",
    status: "running",
    enabled: true,
    displayModes: ["canvas_object"],
    defaultWindow: { width: 320, height: 400, resizable: false, draggable: false },
    capabilities: ["edit_nodes", "boolean_union", "boolean_subtract", "boolean_intersect", "boolean_exclude"],
    plannedCapabilities: [],
    ai: { enabled: false, connected: false },
    dependencies: [],
  },
  {
    id: "realtime-sync",
    name: "Multiplayer Sync Bridge",
    description: "Operation-based conflict resolution, WebSocket sync, cursors, and laser pointers.",
    category: "utility",
    version: "1.0.0",
    host: "foundry-host",
    status: "running",
    enabled: true,
    displayModes: ["embedded"],
    defaultWindow: { width: 0, height: 0, resizable: false, draggable: false },
    capabilities: ["sync_elements", "presence_broadcast", "operation_undo_redo"],
    plannedCapabilities: [],
    ai: { enabled: false, connected: false },
    dependencies: [],
  },
  {
    id: "ai-tool-registry",
    name: "AI Tool Registry",
    description: "Stage 2 validated tool registry for canvas, window, and application operations with permission enforcement.",
    category: "ai",
    version: "2.0.0",
    host: "foundry-host",
    status: "requires_configuration",
    enabled: true,
    displayModes: ["embedded"],
    defaultWindow: { width: 0, height: 0, resizable: false, draggable: false },
    capabilities: ["list_tools", "validate_schema", "execute_tool", "canvas_tools", "app_tools", "window_tools"],
    plannedCapabilities: ["autonomous_workflows", "semantic_rag_tools"],
    ai: { enabled: true, connected: false },
    dependencies: [],
  },
];

class ApplicationRegistryService {
  private apps: Map<string, ApplicationManifest> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    DEFAULT_STAGE1_MANIFESTS.forEach((manifest) => {
      this.apps.set(manifest.id, { ...manifest, recentErrors: [] });
    });
  }

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error("ApplicationRegistry listener error:", err);
      }
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  register(manifest: ApplicationManifest): ApplicationManifest {
    const normalized: ApplicationManifest = {
      ...manifest,
      capabilities: [...(manifest.capabilities || [])],
      plannedCapabilities: [...(manifest.plannedCapabilities || [])],
      displayModes: [...(manifest.displayModes || [])],
      dependencies: [...(manifest.dependencies || [])],
      recentErrors: [...(manifest.recentErrors || [])],
    };
    this.apps.set(normalized.id, normalized);
    eventBus.emit(
      FOUNDRY_EVENTS.APP_REGISTERED,
      { appId: normalized.id, name: normalized.name, status: normalized.status },
      "application-registry"
    );
    this.notify();
    return { ...normalized };
  }

  unregister(appId: string): boolean {
    const existed = this.apps.delete(appId);
    if (existed) {
      this.notify();
    }
    return existed;
  }

  get(appId: string): ApplicationManifest | undefined {
    const app = this.apps.get(appId);
    if (!app) return undefined;
    return {
      ...app,
      status: this.computeLiveStatus(app),
      capabilities: [...app.capabilities],
      plannedCapabilities: [...app.plannedCapabilities],
      displayModes: [...app.displayModes],
      dependencies: [...app.dependencies],
      recentErrors: [...(app.recentErrors || [])],
    };
  }

  list(): ApplicationManifest[] {
    return Array.from(this.apps.values()).map((app) => ({
      ...app,
      status: this.computeLiveStatus(app),
      capabilities: [...app.capabilities],
      plannedCapabilities: [...app.plannedCapabilities],
      displayModes: [...app.displayModes],
      dependencies: [...app.dependencies],
      recentErrors: [...(app.recentErrors || [])],
    }));
  }

  search(query: string): ApplicationManifest[] {
    const q = (query || "").trim().toLowerCase();
    if (!q) return this.list();
    return this.list().filter(
      (app) =>
        app.id.toLowerCase().includes(q) ||
        app.name.toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q) ||
        app.category.toLowerCase().includes(q)
    );
  }

  private computeLiveStatus(app: ApplicationManifest): ApplicationStatus {
    if (app.status === "not_installed") return "not_installed";
    if (!app.enabled) return "disabled";
    if (app.recentErrors && app.recentErrors.length > 0 && app.status === "error") return "error";

    if (app.host === "education-controller" || app.id === "education-controller") {
      if (!educationControllerAdapter.isMounted()) {
        return app.status === "disabled" ? "disabled" : "installed";
      }
      return educationControllerAdapter.getAppRuntimeStatus(app.id);
    }

    return app.status;
  }

  isInstalled(appId: string): boolean {
    const app = this.apps.get(appId);
    if (!app) return false;
    return app.status !== "not_installed";
  }

  getStatus(appId: string): ApplicationStatus | null {
    const app = this.apps.get(appId);
    if (!app) return null;
    return this.computeLiveStatus(app);
  }

  getCapabilities(appId: string): { capabilities: string[]; plannedCapabilities: string[] } | null {
    const app = this.apps.get(appId);
    if (!app) return null;
    return {
      capabilities: [...app.capabilities],
      plannedCapabilities: [...app.plannedCapabilities],
    };
  }

  private recordError(appId: string, msg: string) {
    const app = this.apps.get(appId);
    if (app) {
      app.recentErrors = [msg, ...(app.recentErrors || [])].slice(0, 10);
      this.notify();
    }
    eventBus.emit(FOUNDRY_EVENTS.APP_ERROR, { appId, error: msg }, "application-registry");
  }

  launch(appId: string, _options?: Record<string, any>): ApplicationLaunchResult {
    const app = this.apps.get(appId);
    if (!app) {
      const err = `Application "${appId}" is not registered`;
      eventBus.emit(FOUNDRY_EVENTS.APP_ERROR, { appId, error: err }, "application-registry");
      return { success: false, appId, status: "not_installed", error: err };
    }

    if (app.status === "not_installed") {
      const err = `Application "${app.name}" (${appId}) is not installed`;
      this.recordError(appId, err);
      return { success: false, appId, status: "not_installed", error: err };
    }

    if (!app.enabled) {
      const err = `Application "${app.name}" (${appId}) is disabled`;
      this.recordError(appId, err);
      return { success: false, appId, status: "disabled", error: err };
    }

    // Check dependencies
    for (const depId of app.dependencies) {
      if (!this.isInstalled(depId)) {
        const err = `Missing dependency "${depId}" for "${appId}"`;
        this.recordError(appId, err);
        return { success: false, appId, status: "error", error: err };
      }
    }

    if (app.host === "education-controller" || app.id === "education-controller") {
      if (!educationControllerAdapter.isMounted()) {
        const err = "Education Controller is not currently mounted";
        this.recordError(appId, err);
        return { success: false, appId, status: "error", error: err };
      }

      const res = educationControllerAdapter.openApp(appId);
      if (!res.ok) {
        this.recordError(appId, res.error || "Failed to open controller application");
        return {
          success: false,
          appId,
          status: "error",
          error: res.error || "Failed to launch application",
        };
      }

      const windowMatch = windowManager
        .getWindows()
        .find((w) => w.appId === appId);
      const targetWindowId = windowMatch?.windowId || MAIN_CONTROLLER_WINDOW_ID;

      sharedContextManager.updateContext({
        activeApplicationId: appId,
        focusedWindowId: MAIN_CONTROLLER_WINDOW_ID,
      });

      this.notify();
      return {
        success: true,
        appId,
        status: "running",
        windowId: targetWindowId,
      };
    }

    // Native host engine apps (e.g. html-engine, vector-engine, realtime-sync)
    return {
      success: true,
      appId,
      status: this.computeLiveStatus(app),
      windowId: null,
    };
  }

  close(appId: string): ApplicationLaunchResult {
    const app = this.apps.get(appId);
    if (!app) {
      return {
        success: false,
        appId,
        status: "not_installed",
        error: `Application "${appId}" is not registered`,
      };
    }

    if (app.host === "education-controller" || app.id === "education-controller") {
      const res = educationControllerAdapter.closeApp(appId);
      if (!res.ok) {
        this.recordError(appId, res.error || "Failed to close application");
        return { success: false, appId, status: "error", error: res.error };
      }
      this.notify();
      return {
        success: true,
        appId,
        status: this.computeLiveStatus(app),
      };
    }

    return {
      success: false,
      appId,
      status: this.computeLiveStatus(app),
      error: `Core service "${appId}" cannot be closed via Application Registry`,
    };
  }

  focus(appId: string): ApplicationLaunchResult {
    const app = this.apps.get(appId);
    if (!app) {
      return {
        success: false,
        appId,
        status: "not_installed",
        error: `Application "${appId}" is not registered`,
      };
    }
    if (app.status === "not_installed") {
      return {
        success: false,
        appId,
        status: "not_installed",
        error: `Application "${appId}" is not installed`,
      };
    }

    if (app.host === "education-controller" || app.id === "education-controller") {
      const res = educationControllerAdapter.focusApp(appId);
      if (!res.ok) {
        return { success: false, appId, status: "error", error: res.error };
      }
      this.notify();
      return {
        success: true,
        appId,
        status: this.computeLiveStatus(app),
        windowId: MAIN_CONTROLLER_WINDOW_ID,
      };
    }

    return {
      success: true,
      appId,
      status: this.computeLiveStatus(app),
    };
  }

  // ---- Backward-compatible aliases ----
  registerApp(app: ApplicationManifest) {
    this.register(app);
  }

  unregisterApp(id: string) {
    this.unregister(id);
  }

  getApps(): ApplicationManifest[] {
    return this.list();
  }

  setAppEnabled(id: string, enabled: boolean) {
    const app = this.apps.get(id);
    if (app && app.status !== "not_installed") {
      app.enabled = enabled;
      if (!enabled && app.host === "education-controller") {
        educationControllerAdapter.closeApp(id);
      }
      this.notify();
    }
  }

  setAIState(
    appId: string,
    enabled: boolean,
    connected: boolean,
    statusOverride?: ApplicationStatus
  ) {
    const app = this.apps.get(appId);
    if (!app) return;
    app.ai = { enabled: Boolean(enabled), connected: Boolean(connected) };
    if (statusOverride && app.status !== "not_installed") {
      app.status = statusOverride;
    }
    this.notify();
  }
}

export const applicationRegistry = new ApplicationRegistryService();
