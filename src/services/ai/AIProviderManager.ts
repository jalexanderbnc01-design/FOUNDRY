/**
 * Foundry Stage 2 — AI Provider Manager (Phase 07)
 * Manages Ollama configuration, connection testing, model discovery, running models,
 * per-model capabilities, and truthful subsystem readiness status.
 */
import { eventBus } from "../EventBus";
import { persistenceManager } from "../PersistenceManager";
import { applicationRegistry } from "../ApplicationRegistry";
import { diagnosticsManager } from "../DiagnosticsManager";
import {
  isHostedBrowserOrigin,
  ollamaFrontendAdapter,
  OllamaConnectionProbe,
} from "./AIProviderAdapter";
import {
  DEFAULT_FRONTEND_OLLAMA_SETTINGS,
  OllamaModel,
  OllamaRunningModel,
  OllamaSettings,
  ProviderStatus,
} from "./types";

const OLLAMA_STORAGE_KEY = "foundry-ai-ollama-settings-v1";

class AIProviderManagerService {
  private settings: OllamaSettings = { ...DEFAULT_FRONTEND_OLLAMA_SETTINGS };
  private status: ProviderStatus = {
    providerId: "ollama",
    enabled: true,
    connectionMode: "backend",
    baseUrl: DEFAULT_FRONTEND_OLLAMA_SETTINGS.baseUrl,
    connected: false,
    verified: false,
    version: null,
    latencyMs: null,
    lastCheckedAt: null,
    errorCode: null,
    error: "Not verified yet. Run Test Connection to check Ollama.",
    guidance: null,
    isHostedOrigin: isHostedBrowserOrigin(),
  };
  private models: OllamaModel[] = [];
  private runningModels: OllamaRunningModel[] = [];
  private modelCapsCache: Map<
    string,
    {
      capabilities: string[];
      supportsTools: boolean;
      supportsVision: boolean;
      supportsThinking: boolean;
      contextLength: number | null;
      details: Record<string, any>;
    }
  > = new Map();
  private listeners: Set<() => void> = new Set();
  private initialized = false;

  constructor() {
    this.loadLocal();
    this.syncRegistryAndDiagnostics();
  }

  private loadLocal() {
    const saved = persistenceManager.getJson<Partial<OllamaSettings>>(OLLAMA_STORAGE_KEY);
    if (saved) {
      this.settings = {
        ...DEFAULT_FRONTEND_OLLAMA_SETTINGS,
        ...saved,
        automaticFallback: false,
      };
      this.status.enabled = this.settings.enabled;
      this.status.connectionMode = this.settings.connectionMode;
      this.status.baseUrl = this.settings.baseUrl;
    }
  }

  private saveLocal() {
    persistenceManager.setJson(OLLAMA_STORAGE_KEY, this.settings);
  }

  private notify() {
    this.syncRegistryAndDiagnostics();
    this.listeners.forEach((l) => {
      try {
        l();
      } catch {}
    });
  }

  private syncRegistryAndDiagnostics() {
    const connected = Boolean(this.settings.enabled && this.status.connected && this.status.verified);
    applicationRegistry.setAIState("education-ai", this.settings.enabled, connected);
    applicationRegistry.setAIState("education-controller", this.settings.enabled, connected);
    applicationRegistry.setAIState(
      "ai-tool-registry",
      this.settings.enabled,
      connected,
      connected ? "running" : "requires_configuration"
    );

    diagnosticsManager.reportMetric({
      id: "ai_runtime",
      name: "AI Runtime (Ollama)",
      status: !this.settings.enabled
        ? "warning"
        : connected
        ? "healthy"
        : this.status.lastCheckedAt
        ? "error"
        : "unverified",
      verified: connected,
      value: !this.settings.enabled
        ? "Disabled in settings"
        : connected
        ? `Ollama v${this.status.version || "?"} · ${this.models.length} models · ${this.settings.selectedModel || "no model selected"}`
        : this.status.error || "Not connected",
      message: `${this.settings.connectionMode} -> ${this.settings.baseUrl}`,
      timestamp: this.status.lastCheckedAt || Date.now(),
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSettings(): OllamaSettings {
    return { ...this.settings };
  }

  getStatus(): ProviderStatus {
    return { ...this.status };
  }

  getModels(): OllamaModel[] {
    return this.models.map((m) => ({ ...m }));
  }

  getRunningModels(): OllamaRunningModel[] {
    return this.runningModels.map((m) => ({ ...m }));
  }

  getAdapter() {
    return ollamaFrontendAdapter;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const res = await fetch("/api/ai/providers/ollama/status");
      if (res.ok) {
        const data = await res.json();
        // Sync server-stored settings if user hasn't explicitly customized locally
        const localSaved = persistenceManager.getJson<Partial<OllamaSettings>>(OLLAMA_STORAGE_KEY);
        if (!localSaved && data.baseUrl) {
          this.settings.baseUrl = data.baseUrl;
          this.settings.connectionMode = data.connectionMode || "backend";
          this.settings.selectedModel = data.selectedModel ?? null;
          this.settings.enabled = data.enabled !== false;
          this.saveLocal();
        }
      }
    } catch {}

    if (this.settings.enabled && this.settings.autoDiscoverOnStartup) {
      await this.testAndDiscover();
    } else {
      this.notify();
    }
  }

  async updateSettings(partial: Partial<OllamaSettings>): Promise<OllamaSettings> {
    const prevBase = this.settings.baseUrl;
    const prevMode = this.settings.connectionMode;
    this.settings = {
      ...this.settings,
      ...partial,
      automaticFallback: false,
    };
    this.saveLocal();

    this.status.enabled = this.settings.enabled;
    this.status.connectionMode = this.settings.connectionMode;
    this.status.baseUrl = this.settings.baseUrl;

    if (prevBase !== this.settings.baseUrl || prevMode !== this.settings.connectionMode) {
      this.status.connected = false;
      this.status.verified = false;
      this.status.version = null;
      this.models = [];
      this.modelCapsCache.clear();
    }

    try {
      await fetch("/api/ai/providers/ollama/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.settings),
      });
    } catch {}

    this.notify();
    eventBus.emit("ai:settings-updated", { settings: this.getSettings() }, "ai-provider-manager");
    return this.getSettings();
  }

  async selectModel(modelName: string | null): Promise<void> {
    await this.updateSettings({ selectedModel: modelName });
    if (modelName && this.status.connected) {
      await this.inspectModel(modelName).catch(() => null);
    }
  }

  async testConnection(): Promise<OllamaConnectionProbe> {
    if (!this.settings.enabled) {
      this.status = {
        ...this.status,
        enabled: false,
        connected: false,
        verified: false,
        version: null,
        lastCheckedAt: Date.now(),
        errorCode: "OLLAMA_UNREACHABLE",
        error: "Ollama provider is disabled in Foundry Settings.",
        guidance: "Enable Ollama in Settings -> Ollama & AI Engine.",
      };
      this.notify();
      return {
        ok: false,
        connected: false,
        baseUrl: this.settings.baseUrl,
        version: null,
        latencyMs: 0,
        errorCode: "OLLAMA_UNREACHABLE",
        error: this.status.error || undefined,
      };
    }

    const probe = await ollamaFrontendAdapter.testConnection(this.settings);
    this.status = {
      providerId: "ollama",
      enabled: this.settings.enabled,
      connectionMode: this.settings.connectionMode,
      baseUrl: probe.baseUrl || this.settings.baseUrl,
      connected: probe.connected,
      verified: probe.connected,
      version: probe.version,
      latencyMs: probe.latencyMs,
      lastCheckedAt: Date.now(),
      errorCode: probe.errorCode || null,
      error: probe.error || null,
      guidance: probe.guidance || null,
      isHostedOrigin: isHostedBrowserOrigin(),
    };

    if (probe.connected && Array.isArray(probe.models)) {
      this.applyDiscoveredModels(probe.models);
    } else if (!probe.connected) {
      this.models = [];
    }

    this.notify();
    eventBus.emit("ai:provider-status-changed", { status: this.getStatus() }, "ai-provider-manager");
    return probe;
  }

  async refreshModels(): Promise<OllamaModel[]> {
    if (!this.settings.enabled) {
      this.models = [];
      this.notify();
      return [];
    }
    try {
      const models = await ollamaFrontendAdapter.discoverModels(this.settings);
      this.applyDiscoveredModels(models);
      if (!this.status.connected) {
        this.status.connected = true;
        this.status.verified = true;
        this.status.error = null;
        this.status.errorCode = null;
        this.status.lastCheckedAt = Date.now();
      }
      // Also fetch running models silently
      this.runningModels = await ollamaFrontendAdapter.getRunningModels(this.settings).catch(() => []);
      this.notify();
      eventBus.emit("ai:models-updated", { models: this.getModels() }, "ai-provider-manager");
      return this.getModels();
    } catch (err: any) {
      this.models = [];
      this.status.connected = false;
      this.status.verified = false;
      this.status.errorCode = err?.code || "OLLAMA_UNREACHABLE";
      this.status.error = err?.message || "Failed to refresh Ollama models.";
      this.status.guidance = err?.guidance || null;
      this.status.lastCheckedAt = Date.now();
      this.notify();
      throw err;
    }
  }

  async testAndDiscover(): Promise<{ probe: OllamaConnectionProbe; models: OllamaModel[] }> {
    const probe = await this.testConnection();
    let models = this.getModels();
    if (probe.connected) {
      try {
        models = await this.refreshModels();
      } catch {}
    }
    return { probe, models };
  }

  private applyDiscoveredModels(rawModels: OllamaModel[]) {
    this.models = rawModels.map((m) => {
      const cached = this.modelCapsCache.get(m.name);
      return cached ? { ...m, ...cached } : m;
    });

    // If selectedModel is null or no longer present, pick first discovered model cleanly
    const names = this.models.map((m) => m.name);
    if (names.length > 0 && (!this.settings.selectedModel || !names.includes(this.settings.selectedModel))) {
      this.settings.selectedModel = names[0];
      this.saveLocal();
      fetch("/api/ai/providers/ollama/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedModel: this.settings.selectedModel }),
      }).catch(() => {});
    } else if (names.length === 0 && this.settings.selectedModel) {
      // Keep selectedModel null if none installed unless user manually typed one
      this.settings.selectedModel = null;
      this.saveLocal();
    }

    if (this.settings.selectedModel && !this.modelCapsCache.has(this.settings.selectedModel)) {
      this.inspectModel(this.settings.selectedModel).catch(() => null);
    }
  }

  async inspectModel(model: string) {
    const cached = this.modelCapsCache.get(model);
    if (cached) return { model, ...cached };

    const info = await ollamaFrontendAdapter.getModelInfo(this.settings, model);
    const entry = {
      capabilities: info.capabilities,
      supportsTools: info.supportsTools,
      supportsVision: info.supportsVision,
      supportsThinking: info.supportsThinking,
      contextLength: info.contextLength,
      details: info.details,
    };
    this.modelCapsCache.set(model, entry);
    this.models = this.models.map((m) => (m.name === model ? { ...m, ...entry } : m));
    this.notify();
    return info;
  }

  getCachedModelCapabilities(model: string | null) {
    if (!model) return null;
    return this.modelCapsCache.get(model) || null;
  }

  async testGenerate(prompt = "Reply with OK if you are operational.") {
    const model = this.settings.selectedModel;
    if (!model) {
      throw Object.assign(new Error("Select an Ollama model before running test generation."), {
        code: "MODEL_NOT_SELECTED",
      });
    }
    return ollamaFrontendAdapter.testGenerate(this.settings, model, prompt);
  }
}

export const aiProviderManager = new AIProviderManagerService();
