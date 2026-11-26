/**
 * Foundry Shared Workspace Context Manager (Phase 5.6).
 * Tracks actual live workspace, course, selection, window, app, and viewport state.
 * Never fabricates values that are not present in runtime state.
 */

export interface SharedWorkspaceContext {
  workspaceId: string | null;
  workspaceName: string | null;
  activeCourseId: string | null;
  activeAssignmentId: string | null;
  activeApplicationId: string | null;
  focusedWindowId: string | null;
  selectedCanvasObjectIds: string[];
  openApplicationIds: string[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
}

type ContextListener = (context: SharedWorkspaceContext) => void;

class SharedContextManagerService {
  private context: SharedWorkspaceContext = {
    workspaceId: null,
    workspaceName: null,
    activeCourseId: null,
    activeAssignmentId: null,
    activeApplicationId: null,
    focusedWindowId: null,
    selectedCanvasObjectIds: [],
    openApplicationIds: [],
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
    },
  };

  private listeners: Set<ContextListener> = new Set();

  getContext(): SharedWorkspaceContext {
    return {
      ...this.context,
      selectedCanvasObjectIds: [...this.context.selectedCanvasObjectIds],
      openApplicationIds: [...this.context.openApplicationIds],
      viewport: { ...this.context.viewport },
    };
  }

  updateContext(partial: Partial<SharedWorkspaceContext>): SharedWorkspaceContext {
    const next: SharedWorkspaceContext = {
      ...this.context,
      ...partial,
      selectedCanvasObjectIds: partial.selectedCanvasObjectIds
        ? [...partial.selectedCanvasObjectIds]
        : [...this.context.selectedCanvasObjectIds],
      openApplicationIds: partial.openApplicationIds
        ? [...partial.openApplicationIds]
        : [...this.context.openApplicationIds],
      viewport: partial.viewport
        ? {
            x: Number.isFinite(partial.viewport.x) ? partial.viewport.x : this.context.viewport.x,
            y: Number.isFinite(partial.viewport.y) ? partial.viewport.y : this.context.viewport.y,
            zoom: Number.isFinite(partial.viewport.zoom) ? partial.viewport.zoom : this.context.viewport.zoom,
          }
        : { ...this.context.viewport },
    };

    this.context = next;
    const snapshot = this.getContext();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error("SharedContextManager listener error:", err);
      }
    });
    return snapshot;
  }

  subscribe(listener: ContextListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  reset(): void {
    this.updateContext({
      workspaceId: null,
      workspaceName: null,
      activeCourseId: null,
      activeAssignmentId: null,
      activeApplicationId: null,
      focusedWindowId: null,
      selectedCanvasObjectIds: [],
      openApplicationIds: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });
  }
}

export const sharedContextManager = new SharedContextManagerService();
