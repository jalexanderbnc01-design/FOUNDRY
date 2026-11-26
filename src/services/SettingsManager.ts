/**
 * Foundry Centralized Settings Manager (Stage 1 Extended)
 */
import { persistenceManager, STORAGE_KEYS } from "./PersistenceManager";

export interface FoundrySettings {
  general: {
    workspaceName: string;
    autoSave: boolean;
    soundEffects: boolean;
  };
  appearance: {
    themeMode: "dark" | "light" | "system";
    uiScale: number;
    reducedMotion: boolean;
  };
  canvas: {
    defaultZoom: number;
    gridDotSpacing: number;
    snappingSensitivity: number;
    smartGuides: boolean;
  };
  navigation: {
    panSpeed: number;
    zoomSpeed: number;
    invertScroll: boolean;
  };
  drawing: {
    pressureSensitivity: boolean;
    defaultBrushSize: number;
    smoothingLevel: number;
  };
  windowManagement: {
    snapToEdges: boolean;
    cascadeOnOpen: boolean;
    rememberPositions: boolean;
    companionGap: number;
    defaultControllerWidth: number;
    defaultControllerHeight: number;
  };
  htmlEngine: {
    sandboxIsolation: boolean;
    allowScripts: boolean;
    defaultCardWidth: number;
    defaultCardHeight: number;
  };
  storage: {
    persistenceDriver: "localStorage" | "indexedDb" | "cloud";
    autoBackupIntervalMinutes: number;
  };
  collaboration: {
    showCursors: boolean;
    showLaserTrails: boolean;
    presencePollingRateMs: number;
  };
  permissions: {
    allowGuestEdits: boolean;
    requireApprovalForHtml: boolean;
  };
  integrations: {
    geminiAiEnabled: boolean;
    webhookUrl: string;
  };
}

class SettingsManagerService {
  private settings: FoundrySettings = {
    general: { workspaceName: "Foundry Workspace", autoSave: true, soundEffects: false },
    appearance: { themeMode: "dark", uiScale: 1.0, reducedMotion: false },
    canvas: { defaultZoom: 1.0, gridDotSpacing: 24, snappingSensitivity: 10, smartGuides: true },
    navigation: { panSpeed: 1.0, zoomSpeed: 1.15, invertScroll: false },
    drawing: { pressureSensitivity: true, defaultBrushSize: 4, smoothingLevel: 2.0 },
    windowManagement: {
      snapToEdges: true,
      cascadeOnOpen: true,
      rememberPositions: true,
      companionGap: 24,
      defaultControllerWidth: 600,
      defaultControllerHeight: 330,
    },
    htmlEngine: { sandboxIsolation: true, allowScripts: true, defaultCardWidth: 440, defaultCardHeight: 320 },
    storage: { persistenceDriver: "localStorage", autoBackupIntervalMinutes: 5 },
    collaboration: { showCursors: true, showLaserTrails: true, presencePollingRateMs: 1000 },
    permissions: { allowGuestEdits: true, requireApprovalForHtml: false },
    integrations: { geminiAiEnabled: true, webhookUrl: "" },
  };

  private listeners: Set<(settings: FoundrySettings) => void> = new Set();

  constructor() {
    this.load();
  }

  load() {
    try {
      const parsed = persistenceManager.getJson<Partial<FoundrySettings>>(STORAGE_KEYS.SETTINGS);
      if (parsed) {
        this.settings = {
          ...this.settings,
          ...parsed,
          general: { ...this.settings.general, ...(parsed.general || {}) },
          appearance: { ...this.settings.appearance, ...(parsed.appearance || {}) },
          canvas: { ...this.settings.canvas, ...(parsed.canvas || {}) },
          navigation: { ...this.settings.navigation, ...(parsed.navigation || {}) },
          drawing: { ...this.settings.drawing, ...(parsed.drawing || {}) },
          windowManagement: { ...this.settings.windowManagement, ...(parsed.windowManagement || {}) },
          htmlEngine: { ...this.settings.htmlEngine, ...(parsed.htmlEngine || {}) },
          storage: { ...this.settings.storage, ...(parsed.storage || {}) },
          collaboration: { ...this.settings.collaboration, ...(parsed.collaboration || {}) },
          permissions: { ...this.settings.permissions, ...(parsed.permissions || {}) },
          integrations: { ...this.settings.integrations, ...(parsed.integrations || {}) },
        };
      }
    } catch (e) {
      console.error("Failed to load Foundry settings:", e);
    }
  }

  save() {
    try {
      persistenceManager.setJson(STORAGE_KEYS.SETTINGS, this.settings);
    } catch (e) {
      console.error("Failed to save Foundry settings:", e);
    }
  }

  getSettings(): FoundrySettings {
    return JSON.parse(JSON.stringify(this.settings));
  }

  updateCategory<K extends keyof FoundrySettings>(category: K, values: Partial<FoundrySettings[K]>) {
    if (this.settings[category]) {
      this.settings[category] = { ...this.settings[category], ...values };
      this.save();
      const snapshot = this.getSettings();
      this.listeners.forEach((l) => l(snapshot));
    }
  }

  subscribe(listener: (settings: FoundrySettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const settingsManager = new SettingsManagerService();
