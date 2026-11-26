/**
 * Foundry Unified Window Manager (Phase 03)
 * Coordinates viewport-level floating windows, parent-child companion relationships,
 * z-index layering, viewport clamping, and layout persistence without duplicating controller handlers.
 */
import { eventBus, FOUNDRY_EVENTS } from "./EventBus";
import { persistenceManager, STORAGE_KEYS } from "./PersistenceManager";
import { sharedContextManager } from "./SharedContextManager";
import { settingsManager } from "./SettingsManager";
import { FOUNDRY_Z_LAYERS } from "../theme";

export type WindowDisplayMode =
  | "controller"
  | "floating"
  | "companion"
  | "canvas_object"
  | "docked"
  | "embedded";

export type WindowRuntimeState =
  | "normal"
  | "minimized"
  | "expanded"
  | "docked"
  | "hidden";

export type DockPosition = "left" | "right" | "top" | "bottom" | null;

export interface FoundryWindow {
  windowId: string;
  appId: string;
  title: string;
  parentWindowId: string | null;
  displayMode: WindowDisplayMode;
  position: { x: number; y: number };
  size: { width: number; height: number };
  state: WindowRuntimeState;
  visible: boolean;
  focused: boolean;
  zIndex: number;
  resizable: boolean;
  draggable: boolean;
  dockPosition?: DockPosition;
  normalBounds?: { x: number; y: number; width: number; height: number } | null;
  wasVisibleBeforeParentMinimize?: boolean;
  metadata?: Record<string, any>;
}

export interface WindowRegistrationConfig {
  windowId: string;
  appId: string;
  title?: string;
  parentWindowId?: string | null;
  displayMode?: WindowDisplayMode;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  state?: WindowRuntimeState;
  visible?: boolean;
  focused?: boolean;
  zIndex?: number;
  resizable?: boolean;
  draggable?: boolean;
  dockPosition?: DockPosition;
  metadata?: Record<string, any>;
}

export interface WindowAdapterHooks {
  onShow?: () => void;
  onHide?: () => void;
  onFocus?: (zIndex: number) => void;
  onMove?: (position: { x: number; y: number }) => void;
  onResize?: (size: { width: number; height: number }) => void;
  onMinimize?: () => void;
  onRestore?: () => void;
  onExpand?: () => void;
  onResetLayout?: () => void;
  onClose?: () => void;
}

interface PersistedLayoutSnapshot {
  version: 1;
  savedAt: number;
  openApplicationIds: string[];
  windows: Record<
    string,
    {
      position: { x: number; y: number };
      size: { width: number; height: number };
      state: WindowRuntimeState;
      visible: boolean;
      dockPosition?: DockPosition;
      normalBounds?: { x: number; y: number; width: number; height: number } | null;
    }
  >;
}

// Legacy alias kept for compatibility
export interface FloatingWindow {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  componentKey: string;
  state?: Record<string, any>;
}

class WindowManagerService {
  private windows: Map<string, FoundryWindow> = new Map();
  private adapters: Map<string, WindowAdapterHooks> = new Map();
  private listeners: Set<() => void> = new Set();
  private topZIndex: number = FOUNDRY_Z_LAYERS.floatingWorkspaceMin;
  private resizeListenerAttached = false;
  private saveTimer: number | null = null;
  private initialized = false;

  constructor() {
    this.attachViewportResizeListener();
  }

  private attachViewportResizeListener() {
    if (this.resizeListenerAttached || typeof window === "undefined") return;
    this.resizeListenerAttached = true;
    window.addEventListener("resize", this.handleViewportResize);
  }

  private handleViewportResize = () => {
    let changed = false;
    this.windows.forEach((win) => {
      if (win.displayMode === "companion" || !win.visible) return;
      const clamped = this.clampToViewport(win.position, win.size, win.state === "minimized");
      if (
        clamped.position.x !== win.position.x ||
        clamped.position.y !== win.position.y ||
        clamped.size.width !== win.size.width ||
        clamped.size.height !== win.size.height
      ) {
        win.position = clamped.position;
        win.size = clamped.size;
        changed = true;
      }
    });
    if (changed) {
      this.notify();
      this.scheduleSave();
    }
  };

  private clampToViewport(
    pos: { x: number; y: number },
    size: { width: number; height: number },
    minimized: boolean = false
  ): { position: { x: number; y: number }; size: { width: number; height: number } } {
    const vw = typeof window !== "undefined" ? Math.max(320, window.innerWidth) : 1440;
    const vh = typeof window !== "undefined" ? Math.max(320, window.innerHeight) : 900;
    const topInset = 48;
    const width = Math.max(220, Math.min(size.width, vw - 12));
    const height = Math.max(180, Math.min(size.height, vh - topInset - 11));
    const activeW = minimized ? 52 : width;
    const x = Math.max(0, Math.min(pos.x, Math.max(0, vw - activeW)));
    const y = Math.max(topInset, Math.min(pos.y, Math.max(topInset, vh - Math.min(height, 120))));
    return {
      position: { x: Math.round(x), y: Math.round(y) },
      size: { width: Math.round(width), height: Math.round(height) },
    };
  }

  private allocateZIndex(): number {
    this.topZIndex += 1;
    if (this.topZIndex > FOUNDRY_Z_LAYERS.floatingWorkspaceMax) {
      // Renormalize floating windows cleanly inside [floatingWorkspaceMin .. floatingWorkspaceMax]
      const ordered = Array.from(this.windows.values()).sort((a, b) => a.zIndex - b.zIndex);
      let cursor: number = FOUNDRY_Z_LAYERS.floatingWorkspaceMin;
      ordered.forEach((w) => {
        w.zIndex = cursor;
        const hooks = this.adapters.get(w.windowId);
        hooks?.onFocus?.(w.zIndex);
        cursor = Math.min(FOUNDRY_Z_LAYERS.floatingWorkspaceMax - 5, cursor + 1);
      });
      this.topZIndex = cursor + 1;
    }
    return this.topZIndex;
  }

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error("WindowManager listener error:", err);
      }
    });
  }

  private scheduleSave() {
    const remember = settingsManager.getSettings().windowManagement.rememberPositions;
    if (!remember || typeof window === "undefined") return;
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      this.persistLayout();
    }, 150);
  }

  persistLayout(): boolean {
    const snapshot: PersistedLayoutSnapshot = {
      version: 1,
      savedAt: Date.now(),
      openApplicationIds: Array.from(
        new Set(
          Array.from(this.windows.values())
            .filter((w) => w.visible)
            .map((w) => w.appId)
        )
      ),
      windows: {},
    };
    this.windows.forEach((win) => {
      snapshot.windows[win.windowId] = {
        position: { ...win.position },
        size: { ...win.size },
        state: win.state,
        visible: win.visible,
        dockPosition: win.dockPosition ?? null,
        normalBounds: win.normalBounds ? { ...win.normalBounds } : null,
      };
    });
    return persistenceManager.setJson(STORAGE_KEYS.WINDOW_LAYOUT, snapshot);
  }

  getSavedLayout(): PersistedLayoutSnapshot | null {
    const saved = persistenceManager.getJson<PersistedLayoutSnapshot>(STORAGE_KEYS.WINDOW_LAYOUT);
    if (!saved || saved.version !== 1 || typeof saved.windows !== "object") return null;
    return saved;
  }

  registerListener(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribe(listener: () => void): () => void {
    return this.registerListener(listener);
  }

  mount(windowId: string, hooks: WindowAdapterHooks): void {
    this.adapters.set(windowId, hooks);
    this.initialized = true;
  }

  register(config: WindowRegistrationConfig): FoundryWindow {
    this.initialized = true;
    const existing = this.windows.get(config.windowId);
    const savedLayout = settingsManager.getSettings().windowManagement.rememberPositions
      ? this.getSavedLayout()?.windows?.[config.windowId]
      : undefined;

    const basePos = config.position ?? savedLayout?.position ?? { x: 12, y: 58 };
    const baseSize = config.size ?? savedLayout?.size ?? { width: 600, height: 330 };
    const clamped =
      config.displayMode === "companion"
        ? { position: basePos, size: baseSize }
        : this.clampToViewport(basePos, baseSize, (config.state ?? savedLayout?.state) === "minimized");

    const win: FoundryWindow = existing
      ? {
          ...existing,
          ...config,
          position: clamped.position,
          size: clamped.size,
        }
      : {
          windowId: config.windowId,
          appId: config.appId,
          title: config.title || config.appId,
          parentWindowId: config.parentWindowId ?? null,
          displayMode: config.displayMode ?? "floating",
          position: clamped.position,
          size: clamped.size,
          state: config.state ?? savedLayout?.state ?? "normal",
          visible: config.visible ?? savedLayout?.visible ?? true,
          focused: config.focused ?? false,
          zIndex: config.zIndex ?? FOUNDRY_Z_LAYERS.floatingWorkspaceMin,
          resizable: config.resizable ?? true,
          draggable: config.draggable ?? true,
          dockPosition: config.dockPosition ?? savedLayout?.dockPosition ?? null,
          normalBounds: savedLayout?.normalBounds ?? null,
          metadata: config.metadata,
        };

    if (win.zIndex > this.topZIndex) {
      this.topZIndex = Math.min(win.zIndex, FOUNDRY_Z_LAYERS.floatingWorkspaceMax);
    }
    this.windows.set(win.windowId, win);
    this.notify();
    return { ...win };
  }

  /**
   * Synchronizes WindowManager metadata from an external native/shadow DOM controller
   * (such as mountEducationController) without invoking adapter callbacks back into it.
   */
  syncFromHost(windowId: string, patch: Partial<FoundryWindow>): FoundryWindow | null {
    const win = this.windows.get(windowId);
    if (!win) return null;

    const prevState = win.state;
    const prevPos = { ...win.position };
    const prevSize = { ...win.size };
    const prevVisible = win.visible;

    Object.assign(win, patch);

    if (patch.position && (patch.position.x !== prevPos.x || patch.position.y !== prevPos.y)) {
      eventBus.emitThrottled(
        FOUNDRY_EVENTS.WINDOW_MOVED,
        { windowId: win.windowId, appId: win.appId, position: { ...win.position } },
        "window-manager",
        150
      );
    }

    if (
      patch.size &&
      (patch.size.width !== prevSize.width || patch.size.height !== prevSize.height)
    ) {
      eventBus.emitThrottled(
        FOUNDRY_EVENTS.WINDOW_RESIZED,
        { windowId: win.windowId, appId: win.appId, size: { ...win.size } },
        "window-manager",
        150
      );
    }

    if (prevState !== "minimized" && win.state === "minimized") {
      this.hideChildrenForMinimize(windowId);
      eventBus.emit(
        FOUNDRY_EVENTS.WINDOW_MINIMIZED,
        { windowId: win.windowId, appId: win.appId },
        "window-manager"
      );
    } else if (prevState === "minimized" && win.state !== "minimized") {
      this.restoreChildrenAfterParentRestore(windowId);
      eventBus.emit(
        FOUNDRY_EVENTS.WINDOW_RESTORED,
        { windowId: win.windowId, appId: win.appId },
        "window-manager"
      );
    }

    if (prevVisible !== win.visible && win.windowId === "education-controller-main") {
      eventBus.emit(
        FOUNDRY_EVENTS.CONTROLLER_VISIBILITY_CHANGED,
        { windowId: win.windowId, visible: win.visible, state: win.state },
        "window-manager"
      );
    }

    this.notify();
    this.scheduleSave();
    return { ...win };
  }

  private hideChildrenForMinimize(parentWindowId: string) {
    this.windows.forEach((child) => {
      if (child.parentWindowId === parentWindowId) {
        if (child.visible) {
          child.wasVisibleBeforeParentMinimize = true;
          child.visible = false;
          child.state = "hidden";
        }
      }
    });
  }

  private restoreChildrenAfterParentRestore(parentWindowId: string) {
    this.windows.forEach((child) => {
      if (child.parentWindowId === parentWindowId && child.wasVisibleBeforeParentMinimize) {
        child.visible = true;
        child.state = "normal";
        child.wasVisibleBeforeParentMinimize = false;
      }
    });
  }

  open(windowId: string): FoundryWindow | null {
    const win = this.windows.get(windowId);
    if (!win) return null;

    if (win.state === "minimized") {
      return this.restore(windowId);
    }

    win.visible = true;
    if (win.state === "hidden") win.state = "normal";
    this.adapters.get(windowId)?.onShow?.();
    this.focus(windowId);
    this.scheduleSave();
    return { ...win };
  }

  close(windowId: string): boolean {
    const win = this.windows.get(windowId);
    if (!win) return false;
    win.visible = false;
    win.focused = false;
    win.state = "hidden";
    this.adapters.get(windowId)?.onClose?.();
    this.adapters.get(windowId)?.onHide?.();

    if (sharedContextManager.getContext().focusedWindowId === windowId) {
      sharedContextManager.updateContext({ focusedWindowId: null });
    }

    if (windowId === "education-controller-main") {
      this.hideChildrenForMinimize(windowId);
      eventBus.emit(
        FOUNDRY_EVENTS.CONTROLLER_VISIBILITY_CHANGED,
        { windowId, visible: false, state: win.state },
        "window-manager"
      );
    }

    this.notify();
    this.scheduleSave();
    return true;
  }

  focus(windowId: string): FoundryWindow | null {
    const win = this.windows.get(windowId);
    if (!win) return null;

    this.windows.forEach((w) => {
      w.focused = w.windowId === windowId;
    });

    if (!win.visible) {
      win.visible = true;
      if (win.state === "hidden") win.state = "normal";
      this.adapters.get(windowId)?.onShow?.();
    }

    const z = this.allocateZIndex();
    win.zIndex = z;
    this.adapters.get(windowId)?.onFocus?.(z);

    sharedContextManager.updateContext({
      focusedWindowId: win.windowId,
      activeApplicationId: win.appId,
    });

    eventBus.emit(
      FOUNDRY_EVENTS.WINDOW_FOCUSED,
      { windowId: win.windowId, appId: win.appId, zIndex: z },
      "window-manager"
    );

    this.notify();
    return { ...win };
  }

  blur(windowId: string): boolean {
    const win = this.windows.get(windowId);
    if (!win) return false;
    win.focused = false;
    if (sharedContextManager.getContext().focusedWindowId === windowId) {
      sharedContextManager.updateContext({ focusedWindowId: null });
    }
    this.notify();
    return true;
  }

  move(windowId: string, position: { x: number; y: number }): FoundryWindow | null {
    const win = this.windows.get(windowId);
    if (!win || !win.draggable) return null;
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return null;

    const clamped = this.clampToViewport(position, win.size, win.state === "minimized");
    win.position = clamped.position;
    if (win.state === "expanded" || win.state === "docked") {
      win.state = "normal";
      win.dockPosition = null;
    }
    this.adapters.get(windowId)?.onMove?.(win.position);
    eventBus.emitThrottled(
      FOUNDRY_EVENTS.WINDOW_MOVED,
      { windowId: win.windowId, appId: win.appId, position: { ...win.position } },
      "window-manager",
      120
    );
    this.notify();
    this.scheduleSave();
    return { ...win };
  }

  resize(windowId: string, size: { width: number; height: number }): FoundryWindow | null {
    const win = this.windows.get(windowId);
    if (!win || !win.resizable) return null;
    if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) return null;

    const clamped = this.clampToViewport(win.position, size, win.state === "minimized");
    win.size = clamped.size;
    if (win.state === "expanded") {
      win.state = "normal";
    }
    this.adapters.get(windowId)?.onResize?.(win.size);
    eventBus.emitThrottled(
      FOUNDRY_EVENTS.WINDOW_RESIZED,
      { windowId: win.windowId, appId: win.appId, size: { ...win.size } },
      "window-manager",
      120
    );
    this.notify();
    this.scheduleSave();
    return { ...win };
  }

  minimize(windowId: string): FoundryWindow | null {
    const win = this.windows.get(windowId);
    if (!win) return null;
    win.state = "minimized";
    win.focused = false;
    this.hideChildrenForMinimize(windowId);
    this.adapters.get(windowId)?.onMinimize?.();
    eventBus.emit(
      FOUNDRY_EVENTS.WINDOW_MINIMIZED,
      { windowId: win.windowId, appId: win.appId },
      "window-manager"
    );
    this.notify();
    this.scheduleSave();
    return { ...win };
  }

  restore(windowId: string): FoundryWindow | null {
    const win = this.windows.get(windowId);
    if (!win) return null;
    const prevState = win.state;
    win.visible = true;
    win.state = "normal";
    if (prevState === "expanded" && win.normalBounds) {
      win.position = { x: win.normalBounds.x, y: win.normalBounds.y };
      win.size = { width: win.normalBounds.width, height: win.normalBounds.height };
      win.normalBounds = null;
    }
    win.dockPosition = null;
    this.restoreChildrenAfterParentRestore(windowId);
    this.adapters.get(windowId)?.onRestore?.();
    this.focus(windowId);
    eventBus.emit(
      FOUNDRY_EVENTS.WINDOW_RESTORED,
      { windowId: win.windowId, appId: win.appId },
      "window-manager"
    );
    this.scheduleSave();
    return { ...win };
  }

  expand(windowId: string): FoundryWindow | null {
    const win = this.windows.get(windowId);
    if (!win) return null;
    if (win.state !== "expanded") {
      win.normalBounds = {
        x: win.position.x,
        y: win.position.y,
        width: win.size.width,
        height: win.size.height,
      };
    }
    win.visible = true;
    win.state = "expanded";
    this.restoreChildrenAfterParentRestore(windowId);
    this.adapters.get(windowId)?.onExpand?.();
    this.focus(windowId);
    this.scheduleSave();
    return { ...win };
  }

  dock(windowId: string, dockPosition: Exclude<DockPosition, null>): FoundryWindow | null {
    const win = this.windows.get(windowId);
    if (!win) return null;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
    const vh = typeof window !== "undefined" ? window.innerHeight : 900;
    const topInset = 48;

    win.normalBounds = {
      x: win.position.x,
      y: win.position.y,
      width: win.size.width,
      height: win.size.height,
    };
    win.dockPosition = dockPosition;
    win.state = "docked";
    win.visible = true;

    let targetPos = { ...win.position };
    let targetSize = { ...win.size };
    if (dockPosition === "left") {
      targetPos = { x: 12, y: topInset + 10 };
      targetSize = { width: Math.min(620, Math.round(vw * 0.42)), height: vh - topInset - 26 };
    } else if (dockPosition === "right") {
      const w = Math.min(620, Math.round(vw * 0.42));
      targetPos = { x: vw - w - 12, y: topInset + 10 };
      targetSize = { width: w, height: vh - topInset - 26 };
    } else if (dockPosition === "top") {
      targetPos = { x: 12, y: topInset + 10 };
      targetSize = { width: vw - 24, height: Math.round((vh - topInset) * 0.45) };
    } else if (dockPosition === "bottom") {
      const h = Math.round((vh - topInset) * 0.45);
      targetPos = { x: 12, y: vh - h - 12 };
      targetSize = { width: vw - 24, height: h };
    }

    win.position = targetPos;
    win.size = targetSize;
    this.adapters.get(windowId)?.onMove?.(targetPos);
    this.adapters.get(windowId)?.onResize?.(targetSize);
    this.focus(windowId);
    this.scheduleSave();
    return { ...win };
  }

  undock(windowId: string): FoundryWindow | null {
    const win = this.windows.get(windowId);
    if (!win) return null;
    win.dockPosition = null;
    win.state = "normal";
    if (win.normalBounds) {
      win.position = { x: win.normalBounds.x, y: win.normalBounds.y };
      win.size = { width: win.normalBounds.width, height: win.normalBounds.height };
      win.normalBounds = null;
      this.adapters.get(windowId)?.onMove?.(win.position);
      this.adapters.get(windowId)?.onResize?.(win.size);
    }
    this.notify();
    this.scheduleSave();
    return { ...win };
  }

  getWindow(windowId: string): FoundryWindow | undefined {
    const win = this.windows.get(windowId);
    return win ? { ...win, position: { ...win.position }, size: { ...win.size } } : undefined;
  }

  getWindows(parentWindowId?: string | null): FoundryWindow[] {
    const all = Array.from(this.windows.values()).sort((a, b) => a.zIndex - b.zIndex);
    if (parentWindowId !== undefined) {
      return all.filter((w) => w.parentWindowId === parentWindowId).map((w) => ({ ...w }));
    }
    return all.map((w) => ({ ...w }));
  }

  getChildWindows(parentWindowId: string): FoundryWindow[] {
    return this.getWindows(parentWindowId);
  }

  resetLayout(windowId?: string): void {
    if (windowId) {
      const win = this.windows.get(windowId);
      if (win) {
        this.adapters.get(windowId)?.onResetLayout?.();
        win.state = "normal";
        win.dockPosition = null;
        win.normalBounds = null;
        win.visible = true;
        this.notify();
        this.scheduleSave();
      }
      return;
    }
    persistenceManager.remove(STORAGE_KEYS.WINDOW_LAYOUT);
    this.windows.forEach((win) => {
      this.adapters.get(win.windowId)?.onResetLayout?.();
      if (!win.parentWindowId) {
        win.state = "normal";
        win.dockPosition = null;
        win.normalBounds = null;
        win.visible = true;
      }
    });
    this.notify();
    this.scheduleSave();
  }

  destroy(windowId?: string): void {
    if (windowId) {
      this.windows.delete(windowId);
      this.adapters.delete(windowId);
      this.notify();
      return;
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.handleViewportResize);
      this.resizeListenerAttached = false;
    }
    if (this.saveTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.windows.clear();
    this.adapters.clear();
    this.initialized = false;
    this.notify();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // ---- Backward-compatible helpers ----
  openWindow(config: Omit<FloatingWindow, "zIndex" | "isMinimized" | "isMaximized">): string {
    this.register({
      windowId: config.id,
      appId: config.componentKey,
      title: config.title,
      position: { x: config.x, y: config.y },
      size: { width: config.width, height: config.height },
      visible: true,
    });
    this.focus(config.id);
    return config.id;
  }

  closeWindow(id: string) {
    this.close(id);
  }

  focusWindow(id: string) {
    this.focus(id);
  }

  updateWindow(id: string, updates: Partial<FloatingWindow>) {
    const win = this.windows.get(id);
    if (!win) return;
    if (typeof updates.x === "number" || typeof updates.y === "number") {
      this.move(id, {
        x: typeof updates.x === "number" ? updates.x : win.position.x,
        y: typeof updates.y === "number" ? updates.y : win.position.y,
      });
    }
    if (typeof updates.width === "number" || typeof updates.height === "number") {
      this.resize(id, {
        width: typeof updates.width === "number" ? updates.width : win.size.width,
        height: typeof updates.height === "number" ? updates.height : win.size.height,
      });
    }
    if (typeof updates.isMinimized === "boolean") {
      if (updates.isMinimized) this.minimize(id);
      else this.restore(id);
    }
  }

  toggleMinimize(id: string) {
    const win = this.windows.get(id);
    if (!win) return;
    if (win.state === "minimized") this.restore(id);
    else this.minimize(id);
  }

  toggleMaximize(id: string) {
    const win = this.windows.get(id);
    if (!win) return;
    if (win.state === "expanded") this.restore(id);
    else this.expand(id);
  }
}

export const windowManager = new WindowManagerService();
