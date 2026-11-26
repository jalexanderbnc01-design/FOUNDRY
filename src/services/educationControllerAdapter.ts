/**
 * Foundry Education Controller Adapter (Phase 02 & Phase 04)
 * Connects the mounted Education Controller instance to WindowManager,
 * EventBus, SharedContextManager, SettingsManager, and ApplicationRegistry
 * without duplicating the controller's drag, resize, or internal UI logic.
 */
import { eventBus, FOUNDRY_EVENTS } from "./EventBus";
import { windowManager } from "./WindowManager";
import { sharedContextManager } from "./SharedContextManager";
import { settingsManager } from "./SettingsManager";
import { FOUNDRY_Z_LAYERS } from "../theme";

export interface EducationControllerInstance {
  show: () => void;
  hide: () => void;
  reset: () => void;
  minimize: () => void;
  toggleMinimize: () => void;
  toggleExpand: () => void;
  openAI: () => void;
  openSection: (section: string) => boolean;
  getState: () => {
    x: number;
    y: number;
    w: number;
    h: number;
    minimized: boolean;
    expanded: boolean;
    visible: boolean;
  };
  getInternalWorkspaceState?: () => {
    x: number;
    y: number;
    w: number;
    h: number;
    minimized: boolean;
    expanded: boolean;
    visible: boolean;
    zIndex: number;
    activeSection: string;
    activeCourse: string | null;
    aiOpen: boolean;
    activeCompanionSidecar: string | null;
    profileTrayOpen: boolean;
    openCompanionIds: string[];
    companionGap: number;
    frameReady: boolean;
  };
  setZIndex?: (z: number) => void;
  setBounds?: (next: Partial<{ x: number; y: number; w: number; h: number }>) => void;
  setCompanionGap?: (px: number) => void;
  getHost?: () => HTMLElement;
  getFrame?: () => HTMLIFrameElement;
  destroy: () => void;
}

export interface CompanionMapping {
  appId: string;
  windowId: string;
  title: string;
  sidecarId?: string;
  closeButtonIds?: string[];
  studyIndex?: number;
  navSection?: string;
  isProfileTray?: boolean;
}

export const COMPANION_APP_MAPPINGS: CompanionMapping[] = [
  {
    appId: "choice-board",
    windowId: "companion-choice-board",
    title: "Choice Board Studio",
    sidecarId: "choiceSidecar",
    closeButtonIds: ["closeChoiceBtn"],
    studyIndex: 0,
  },
  {
    appId: "essay-to-slides",
    windowId: "companion-essay-to-slides",
    title: "Essay to Slides",
    sidecarId: "essaySidecar",
    closeButtonIds: ["closeEssayBtn"],
    studyIndex: 1,
  },
  {
    appId: "countdown",
    windowId: "companion-countdown",
    title: "Countdown",
    sidecarId: "countdownSidecar",
    closeButtonIds: ["closeCountdownBtn"],
    studyIndex: 2,
  },
  {
    appId: "finals-study-guide",
    windowId: "companion-finals-study-guide",
    title: "Finals Study Guide",
    sidecarId: "finalsSidecar",
    closeButtonIds: ["closefinalsBtn", "closeFinalsBtn"],
    studyIndex: 3,
  },
  {
    appId: "digital-flashcards",
    windowId: "companion-digital-flashcards",
    title: "Digital Flashcards Studio",
    sidecarId: "flashSidecar",
    closeButtonIds: ["closeflashBtn", "closeFlashBtn"],
    studyIndex: 4,
  },
  {
    appId: "student-command-center",
    windowId: "companion-student-command-center",
    title: "Student Command Center",
    sidecarId: "commandSidecar",
    closeButtonIds: ["closeCommandBtn"],
    studyIndex: 5,
  },
  {
    appId: "udl-lesson-planner",
    windowId: "companion-udl-lesson-planner",
    title: "Universal Design Lesson Planner",
    sidecarId: "plannerSidecar",
    closeButtonIds: ["closePlannerBtn"],
    navSection: "calendar",
  },
  {
    appId: "session-timer",
    windowId: "companion-session-timer",
    title: "Session Timer and Projects",
    sidecarId: "bottomProfileTray",
    closeButtonIds: ["closeBottomTrayBtn"],
    isProfileTray: true,
  },
];

export const MAIN_CONTROLLER_WINDOW_ID = "education-controller-main";

class EducationControllerAdapterService {
  private controller: EducationControllerInstance | null = null;
  private cleanupFns: Array<() => void> = [];
  private activeInternalApps: Set<string> = new Set();
  private frameReady = false;
  private lastKnownCourse: string | null = null;

  bind(instance: EducationControllerInstance): () => void {
    this.unbind();
    this.controller = instance;

    const initialState = instance.getState();
    const internalState = instance.getInternalWorkspaceState?.();
    this.frameReady = Boolean(internalState?.frameReady);

    // Apply user's configured companion spacing
    const settings = settingsManager.getSettings();
    instance.setCompanionGap?.(settings.windowManagement.companionGap);

    // Register main controller window in WindowManager
    windowManager.register({
      windowId: MAIN_CONTROLLER_WINDOW_ID,
      appId: "education-controller",
      title: "Education Studio Controller",
      parentWindowId: null,
      displayMode: "controller",
      position: { x: initialState.x, y: initialState.y },
      size: { width: initialState.w, height: initialState.h },
      state: initialState.minimized ? "minimized" : initialState.expanded ? "expanded" : initialState.visible ? "normal" : "hidden",
      visible: initialState.visible,
      focused: false,
      zIndex: FOUNDRY_Z_LAYERS.floatingWorkspaceMin,
      resizable: true,
      draggable: true,
    });

    windowManager.mount(MAIN_CONTROLLER_WINDOW_ID, {
      onShow: () => this.controller?.show(),
      onHide: () => this.controller?.hide(),
      onFocus: (zIndex) => this.controller?.setZIndex?.(zIndex),
      onMove: (position) => this.controller?.setBounds?.({ x: position.x, y: position.y }),
      onResize: (size) => this.controller?.setBounds?.({ w: size.width, h: size.height }),
      onMinimize: () => this.controller?.minimize(),
      onRestore: () => this.controller?.show(),
      onExpand: () => {
        const s = this.controller?.getState();
        if (s && !s.expanded) this.controller?.toggleExpand();
      },
      onResetLayout: () => this.controller?.reset(),
      onClose: () => this.controller?.hide(),
    });

    // Register companion child windows under parent controller
    COMPANION_APP_MAPPINGS.forEach((mapping) => {
      windowManager.register({
        windowId: mapping.windowId,
        appId: mapping.appId,
        title: mapping.title,
        parentWindowId: MAIN_CONTROLLER_WINDOW_ID,
        displayMode: "companion",
        position: { x: initialState.x + initialState.w + settings.windowManagement.companionGap, y: initialState.y },
        size: {
          width: mapping.appId === "student-command-center" ? 560 : mapping.appId === "session-timer" ? 410 : 300,
          height: mapping.appId === "countdown" ? 215 : initialState.h,
        },
        state: "hidden",
        visible: false,
        focused: false,
        zIndex: FOUNDRY_Z_LAYERS.floatingWorkspaceMin,
        resizable: true,
        draggable: false,
      });

      windowManager.mount(mapping.windowId, {
        onShow: () => this.openApp(mapping.appId),
        onHide: () => this.closeApp(mapping.appId),
        onFocus: () => this.focusApp(mapping.appId),
        onClose: () => this.closeApp(mapping.appId),
      });
    });

    const host = instance.getHost?.();
    if (host) {
      const onReady = (ev: Event) => {
        this.frameReady = true;
        const detail = (ev as CustomEvent).detail;
        this.syncFromControllerDetail(detail);
        eventBus.emit(
          FOUNDRY_EVENTS.CONTROLLER_READY,
          { windowId: MAIN_CONTROLLER_WINDOW_ID, courseId: detail?.activeCourse || null },
          "education-controller"
        );
      };

      const onState = (ev: Event) => {
        const detail = (ev as CustomEvent).detail;
        this.syncFromControllerDetail(detail);
      };

      const onFocus = () => {
        windowManager.focus(MAIN_CONTROLLER_WINDOW_ID);
      };

      const onCourse = (ev: Event) => {
        const courseId = (ev as CustomEvent).detail?.courseId || null;
        if (courseId && courseId !== this.lastKnownCourse) {
          this.lastKnownCourse = courseId;
          sharedContextManager.updateContext({ activeCourseId: courseId });
          eventBus.emit(FOUNDRY_EVENTS.COURSE_CHANGED, { courseId }, "education-controller");
        }
      };

      host.addEventListener("foundry:controller-ready", onReady);
      host.addEventListener("foundry:controller-state", onState);
      host.addEventListener("foundry:controller-focus", onFocus);
      host.addEventListener("foundry:course-changed", onCourse);

      this.cleanupFns.push(() => {
        host.removeEventListener("foundry:controller-ready", onReady);
        host.removeEventListener("foundry:controller-state", onState);
        host.removeEventListener("foundry:controller-focus", onFocus);
        host.removeEventListener("foundry:course-changed", onCourse);
      });
    }

    const unsubSettings = settingsManager.subscribe((nextSettings) => {
      this.controller?.setCompanionGap?.(nextSettings.windowManagement.companionGap);
    });
    this.cleanupFns.push(unsubSettings);

    return () => this.unbind();
  }

  private syncFromControllerDetail(detail: any) {
    if (!detail) return;
    if (detail.frameReady) this.frameReady = true;

    const runtimeState = !detail.visible
      ? "hidden"
      : detail.minimized
      ? "minimized"
      : detail.expanded
      ? "expanded"
      : "normal";

    windowManager.syncFromHost(MAIN_CONTROLLER_WINDOW_ID, {
      position: { x: Math.round(detail.x), y: Math.round(detail.y) },
      size: { width: Math.round(detail.w), height: Math.round(detail.h) },
      state: runtimeState,
      visible: Boolean(detail.visible),
    });

    const openCompanions: string[] = Array.isArray(detail.openCompanionIds) ? detail.openCompanionIds : [];
    const nextActiveApps = new Set<string>();
    if (detail.visible) nextActiveApps.add("education-controller");
    if (detail.aiOpen) nextActiveApps.add("education-ai");
    if (detail.activeSection === "files") nextActiveApps.add("knowledge-base");
    if (detail.activeSection === "settings") nextActiveApps.add("education-settings");

    // Sync companion child window visibility
    COMPANION_APP_MAPPINGS.forEach((mapping) => {
      const isOpen = Boolean(
        detail.visible &&
          !detail.minimized &&
          mapping.sidecarId &&
          openCompanions.includes(mapping.sidecarId)
      );
      if (isOpen) nextActiveApps.add(mapping.appId);

      const currentChild = windowManager.getWindow(mapping.windowId);
      if (currentChild && !detail.minimized) {
        if (currentChild.visible !== isOpen) {
          windowManager.syncFromHost(mapping.windowId, {
            visible: isOpen,
            state: isOpen ? "normal" : "hidden",
            wasVisibleBeforeParentMinimize: false,
          });
        }
      }
    });

    // Emit app:opened / app:closed diffs
    nextActiveApps.forEach((appId) => {
      if (!this.activeInternalApps.has(appId)) {
        eventBus.emit(FOUNDRY_EVENTS.APP_OPENED, { appId }, "education-controller");
      }
    });
    this.activeInternalApps.forEach((appId) => {
      if (!nextActiveApps.has(appId)) {
        eventBus.emit(FOUNDRY_EVENTS.APP_CLOSED, { appId }, "education-controller");
      }
    });
    this.activeInternalApps = nextActiveApps;

    if (detail.activeCourse && detail.activeCourse !== this.lastKnownCourse) {
      this.lastKnownCourse = detail.activeCourse;
      sharedContextManager.updateContext({ activeCourseId: detail.activeCourse });
      eventBus.emit(FOUNDRY_EVENTS.COURSE_CHANGED, { courseId: detail.activeCourse }, "education-controller");
    }

    sharedContextManager.updateContext({
      openApplicationIds: Array.from(nextActiveApps),
    });
  }

  unbind(): void {
    this.cleanupFns.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
    this.cleanupFns = [];
    this.controller = null;
    this.activeInternalApps.clear();
    this.frameReady = false;
  }

  isMounted(): boolean {
    return this.controller !== null;
  }

  isFrameReady(): boolean {
    return Boolean(this.controller && (this.frameReady || this.controller.getInternalWorkspaceState?.().frameReady));
  }

  getController(): EducationControllerInstance | null {
    return this.controller;
  }

  getState() {
    if (!this.controller) return null;
    return this.controller.getInternalWorkspaceState?.() ?? this.controller.getState();
  }

  show(): boolean {
    if (!this.controller) return false;
    this.controller.show();
    windowManager.focus(MAIN_CONTROLLER_WINDOW_ID);
    return true;
  }

  hide(): boolean {
    if (!this.controller) return false;
    this.controller.hide();
    return true;
  }

  openAI(): boolean {
    if (!this.controller) return false;
    this.controller.openAI();
    windowManager.focus(MAIN_CONTROLLER_WINDOW_ID);
    return true;
  }

  openSection(section: string): boolean {
    if (!this.controller) return false;
    const ok = this.controller.openSection(section);
    windowManager.focus(MAIN_CONTROLLER_WINDOW_ID);
    return ok;
  }

  openApp(appId: string): { ok: boolean; error?: string } {
    if (!this.controller) {
      return { ok: false, error: "Education Controller is not mounted" };
    }
    this.controller.show();
    windowManager.focus(MAIN_CONTROLLER_WINDOW_ID);

    if (appId === "education-controller") {
      return { ok: true };
    }

    if (appId === "education-ai") {
      this.controller.openAI();
      return { ok: true };
    }

    if (appId === "knowledge-base") {
      this.ensureNavSectionOpen("files");
      return { ok: true };
    }

    if (appId === "education-settings") {
      this.ensureNavSectionOpen("settings");
      return { ok: true };
    }

    const mapping = COMPANION_APP_MAPPINGS.find((m) => m.appId === appId);
    if (!mapping) {
      return { ok: false, error: `App "${appId}" is not hosted by Education Controller` };
    }

    const doc = this.controller.getFrame?.()?.contentDocument;
    const win = this.controller.getFrame?.()?.contentWindow as any;
    if (!doc || !win) {
      return { ok: false, error: "Education Controller document is not ready yet" };
    }

    if (mapping.isProfileTray) {
      const tray = doc.getElementById("bottomProfileTray");
      if (tray && tray.classList.contains("hidden")) {
        doc.getElementById("ticketCard")?.click();
      }
      return { ok: true };
    }

    const workspace = doc.getElementById("educationWorkspace");
    const classFlag = mapping.sidecarId ? mapping.sidecarId.replace("Sidecar", "") + "-open" : "";
    const alreadyOpen = Boolean(workspace && classFlag && workspace.classList.contains(classFlag));

    if (mapping.navSection) {
      if (!alreadyOpen && typeof win.switchNavSection === "function") {
        win.switchNavSection(mapping.navSection);
      }
      return { ok: true };
    }

    if (typeof mapping.studyIndex === "number") {
      if (!alreadyOpen && typeof win.openStudyApp === "function") {
        win.openStudyApp(mapping.studyIndex);
      }
      return { ok: true };
    }

    return { ok: false, error: `No launch handler available for ${appId}` };
  }

  closeApp(appId: string): { ok: boolean; error?: string } {
    if (!this.controller) {
      return { ok: false, error: "Education Controller is not mounted" };
    }
    if (appId === "education-controller") {
      this.controller.hide();
      return { ok: true };
    }

    const doc = this.controller.getFrame?.()?.contentDocument;
    const win = this.controller.getFrame?.()?.contentWindow as any;
    if (!doc || !win) {
      return { ok: false, error: "Education Controller document is not ready" };
    }

    if (appId === "education-ai") {
      const aiView = doc.getElementById("educationAIView");
      if (aiView && !aiView.hidden && typeof win.switchNavSection === "function") {
        win.switchNavSection("ai");
      }
      return { ok: true };
    }

    if (appId === "knowledge-base" || appId === "education-settings") {
      if (typeof win.switchNavSection === "function") {
        win.switchNavSection("home");
      }
      return { ok: true };
    }

    const mapping = COMPANION_APP_MAPPINGS.find((m) => m.appId === appId);
    if (!mapping) {
      return { ok: false, error: `Unknown controller app: ${appId}` };
    }

    if (mapping.closeButtonIds) {
      for (const btnId of mapping.closeButtonIds) {
        const btn = doc.getElementById(btnId);
        if (btn) {
          btn.click();
          return { ok: true };
        }
      }
    }

    return { ok: true };
  }

  focusApp(appId: string): { ok: boolean; error?: string } {
    const state = this.getAppRuntimeStatus(appId);
    if (state === "hidden" || state === "installed") {
      return this.openApp(appId);
    }
    windowManager.focus(MAIN_CONTROLLER_WINDOW_ID);
    return { ok: true };
  }

  private ensureNavSectionOpen(section: string) {
    const doc = this.controller?.getFrame?.()?.contentDocument;
    const win = this.controller?.getFrame?.()?.contentWindow as any;
    if (!doc || !win) return;
    if (section === "files") {
      const v = doc.getElementById("centerFilesView");
      if (v && v.classList.contains("hidden")) win.switchNavSection?.("files");
      return;
    }
    if (section === "settings") {
      const v = doc.getElementById("centerSettingsView");
      if (v && v.classList.contains("hidden")) win.switchNavSection?.("settings");
      return;
    }
    win.switchNavSection?.(section);
  }

  getAppRuntimeStatus(appId: string): "running" | "hidden" | "installed" | "error" {
    if (!this.controller) return "installed";
    const s = this.getState() as any;
    if (!s) return "installed";

    if (appId === "education-controller") {
      if (!s.visible) return "hidden";
      return "running";
    }
    if (appId === "education-ai") {
      return s.visible && s.aiOpen ? "running" : "installed";
    }
    if (appId === "knowledge-base") {
      return s.visible && s.activeSection === "files" ? "running" : "installed";
    }
    if (appId === "education-settings") {
      return s.visible && s.activeSection === "settings" ? "running" : "installed";
    }

    const mapping = COMPANION_APP_MAPPINGS.find((m) => m.appId === appId);
    if (mapping && mapping.sidecarId) {
      const openCompanions: string[] = Array.isArray(s.openCompanionIds) ? s.openCompanionIds : [];
      if (openCompanions.includes(mapping.sidecarId)) {
        return s.minimized || !s.visible ? "hidden" : "running";
      }
      return "installed";
    }

    return "installed";
  }

  getVerifiedFrameWindow(): Window | null {
    return this.controller?.getFrame?.()?.contentWindow || null;
  }
}

export const educationControllerAdapter = new EducationControllerAdapterService();
