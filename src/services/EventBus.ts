/**
 * Foundry Event Bus for structured internal system communication (Phase 5.5).
 */

export const FOUNDRY_EVENTS = {
  READY: "foundry:ready",
  WORKSPACE_CHANGED: "workspace:changed",
  WORKSPACE_SAVED: "workspace:saved",
  CANVAS_SELECTION_CHANGED: "canvas:selection-changed",
  CANVAS_VIEWPORT_CHANGED: "canvas:viewport-changed",
  APP_REGISTERED: "app:registered",
  APP_OPENED: "app:opened",
  APP_CLOSED: "app:closed",
  APP_ERROR: "app:error",
  WINDOW_FOCUSED: "window:focused",
  WINDOW_MOVED: "window:moved",
  WINDOW_RESIZED: "window:resized",
  WINDOW_MINIMIZED: "window:minimized",
  WINDOW_RESTORED: "window:restored",
  CONTROLLER_READY: "controller:ready",
  CONTROLLER_VISIBILITY_CHANGED: "controller:visibility-changed",
  COURSE_CHANGED: "course:changed",
  BRIDGE_REQUEST: "bridge:request",
  BRIDGE_RESPONSE: "bridge:response",
  BRIDGE_ERROR: "bridge:error",
} as const;

export type FoundryEventName =
  | (typeof FOUNDRY_EVENTS)[keyof typeof FOUNDRY_EVENTS]
  | (string & {});

export interface FoundryEventEnvelope<T = any> {
  event: FoundryEventName;
  timestamp: number;
  source: string;
  data: T;
}

type Listener = (envelope: FoundryEventEnvelope) => void;

class EventBusService {
  private listeners: Map<string, Set<Listener>> = new Map();
  private wildcardListeners: Set<Listener> = new Set();
  private recentEvents: FoundryEventEnvelope[] = [];
  private throttleTimers: Map<string, { timer: number; latest: { data: any; source: string } }> = new Map();
  private readonly maxHistory = 150;

  on(event: FoundryEventName, listener: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => {
      const set = this.listeners.get(event);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  once(event: FoundryEventName, listener: Listener): () => void {
    const off = this.on(event, (env) => {
      off();
      listener(env);
    });
    return off;
  }

  onAny(listener: Listener): () => void {
    this.wildcardListeners.add(listener);
    return () => {
      this.wildcardListeners.delete(listener);
    };
  }

  emit<T = any>(event: FoundryEventName, data?: T, source: string = "foundry-host"): FoundryEventEnvelope<T> {
    const envelope: FoundryEventEnvelope<T> = {
      event,
      timestamp: Date.now(),
      source,
      data: (data === undefined ? {} : data) as T,
    };

    this.recentEvents.unshift(envelope);
    if (this.recentEvents.length > this.maxHistory) {
      this.recentEvents.length = this.maxHistory;
    }

    const set = this.listeners.get(event);
    if (set) {
      set.forEach((listener) => {
        try {
          listener(envelope);
        } catch (err) {
          console.error(`Error in event listener for ${event}:`, err);
        }
      });
    }

    this.wildcardListeners.forEach((listener) => {
      try {
        listener(envelope);
      } catch (err) {
        console.error(`Error in wildcard event listener for ${event}:`, err);
      }
    });

    return envelope;
  }

  emitThrottled<T = any>(
    event: FoundryEventName,
    data: T,
    source: string = "foundry-host",
    delayMs: number = 120
  ): void {
    const key = `${event}::${source}`;
    const existing = this.throttleTimers.get(key);
    if (existing) {
      existing.latest = { data, source };
      return;
    }

    this.emit(event, data, source);
    const timer = window.setTimeout(() => {
      const entry = this.throttleTimers.get(key);
      this.throttleTimers.delete(key);
      if (entry && entry.latest.data !== data) {
        this.emit(event, entry.latest.data, entry.latest.source);
      }
    }, delayMs);

    this.throttleTimers.set(key, { timer, latest: { data, source } });
  }

  getRegisteredEventNames(): string[] {
    return Object.values(FOUNDRY_EVENTS);
  }

  getRecentEvents(limit: number = 50): FoundryEventEnvelope[] {
    return this.recentEvents.slice(0, limit);
  }

  getSubscriberCount(): number {
    let count = this.wildcardListeners.size;
    for (const set of this.listeners.values()) {
      count += set.size;
    }
    return count;
  }

  clear(): void {
    this.recentEvents = [];
    for (const entry of this.throttleTimers.values()) {
      window.clearTimeout(entry.timer);
    }
    this.throttleTimers.clear();
  }
}

export const eventBus = new EventBusService();
