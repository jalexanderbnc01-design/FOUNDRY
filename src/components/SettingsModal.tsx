import React, { useEffect, useState } from "react";
import {
  X,
  Settings,
  Shield,
  Sliders,
  HardDrive,
  Cpu,
  Layers,
  Check,
  Activity,
  Network,
  Play,
  RotateCcw,
  RefreshCw,
  Trash2,
  Search,
  Lock,
  Sparkles,
  Zap,
  AlertCircle,
  BookOpen,
  Globe,
  GraduationCap,
  Database,
  FileText,
  CheckCircle2,
  ExternalLink,
  Plus,
} from "lucide-react";
import { settingsManager, FoundrySettings } from "../services/SettingsManager";
import {
  diagnosticsManager,
  ExecutionLogRecord,
  ExecutionLogStatus,
  SystemMetric,
} from "../services/DiagnosticsManager";
import { applicationRegistry, ApplicationManifest } from "../services/ApplicationRegistry";
import { windowManager, FoundryWindow } from "../services/WindowManager";
import {
  communicationBridge,
  BRIDGE_PROTOCOL,
  BRIDGE_VERSION,
  BridgeResponse,
} from "../services/CommunicationBridge";
import {
  permissionManager,
  PermissionRule,
  PermissionState,
} from "../services/PermissionManager";
import {
  persistenceManager,
  STORAGE_KEYS,
  StorageVerificationResult,
} from "../services/PersistenceManager";
import { aiProviderManager } from "../services/ai/AIProviderManager";
import { aiPermissionPolicy } from "../services/ai/AIPermissionPolicy";
import { aiExecutionMonitor } from "../services/ai/AIExecutionMonitor";
import { aiToolRegistry } from "../services/ai/AIToolRegistry";
import {
  AIExecutionMetric,
  AIOperatingMode,
  AIPolicyDecision,
  AIToolPermissionCategory,
  OllamaModel,
  OllamaRunningModel,
  OllamaSettings,
  ProviderStatus,
} from "../services/ai/types";
import { sharedDatabaseClient, AcademicCourse, AcademicAssignment, AcademicTask, KnowledgeDocument, AIMemoryRecord } from "../services/data/SharedDatabaseClient";
import { knowledgeBaseManager, SUPPORTED_EXTRACTION_FORMATS } from "../services/knowledge/KnowledgeBaseManager";
import { ragEngine, RAGSettings } from "../services/rag/RAGEngine";
import { aiMemoryManager } from "../services/ai/AIMemoryManager";
import { googleOAuthManager, GoogleAccountState, WORKSPACE_SERVICES } from "../services/google/GoogleOAuthManager";
import { synchronizationManager, SyncTarget } from "../services/sync/SynchronizationManager";
import { THEME } from "../theme";

export type SettingsTab =
  | "general"
  | "ollama"
  | "knowledge"
  | "google"
  | "academic"
  | "privacy"
  | "canvas"
  | "window"
  | "applications"
  | "bridge"
  | "permissions"
  | "storage"
  | "diagnostics";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}

const STATUS_BADGE_MAP: Record<string, { label: string; cls: string }> = {
  healthy: { label: "Healthy", cls: "bg-[#39E58C]/12 text-[#39E58C] border-[#39E58C]/30" },
  running: { label: "Running", cls: "bg-[#39E58C]/12 text-[#39E58C] border-[#39E58C]/30" },
  success: { label: "Success", cls: "bg-[#39E58C]/12 text-[#39E58C] border-[#39E58C]/30" },
  installed: { label: "Installed", cls: "bg-[#BCE5F8]/12 text-[#BCE5F8] border-[#BCE5F8]/30" },
  available: { label: "Available", cls: "bg-[#BCE5F8]/12 text-[#BCE5F8] border-[#BCE5F8]/30" },
  hidden: { label: "Hidden", cls: "bg-[#202327] text-[#8B929C] border-[#292C30]" },
  minimized: { label: "Minimized", cls: "bg-[#202327] text-[#8B929C] border-[#292C30]" },
  normal: { label: "Normal", cls: "bg-[#39E58C]/12 text-[#39E58C] border-[#39E58C]/30" },
  expanded: { label: "Expanded", cls: "bg-[#BCE5F8]/12 text-[#BCE5F8] border-[#BCE5F8]/30" },
  docked: { label: "Docked", cls: "bg-[#BCE5F8]/12 text-[#BCE5F8] border-[#BCE5F8]/30" },
  warning: { label: "Warning", cls: "bg-amber-500/12 text-amber-300 border-amber-500/30" },
  requires_configuration: {
    label: "Requires Config",
    cls: "bg-amber-500/12 text-amber-300 border-amber-500/30",
  },
  info: { label: "Info", cls: "bg-[#BCE5F8]/12 text-[#BCE5F8] border-[#BCE5F8]/30" },
  not_installed: { label: "Not Installed", cls: "bg-[#202327] text-[#8B929C] border-[#292C30]" },
  disabled: { label: "Disabled", cls: "bg-[#202327] text-[#8B929C] border-[#292C30]" },
  unverified: { label: "Unverified", cls: "bg-[#202327] text-[#8B929C] border-[#292C30]" },
  error: { label: "Error", cls: "bg-rose-500/12 text-rose-300 border-rose-500/30" },
};

function renderBadge(status: string, overrideLabel?: string) {
  const entry = STATUS_BADGE_MAP[status] || {
    label: status,
    cls: "bg-[#202327] text-[#8B929C] border-[#292C30]",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap ${entry.cls}`}
    >
      {overrideLabel || entry.label}
    </span>
  );
}

function formatTime(ts: number): string {
  if (!ts) return "Not checked";
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, initialTab }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || "general");
  const [settings, setSettings] = useState<FoundrySettings>(() => settingsManager.getSettings());
  const [savedNotice, setSavedNotice] = useState(false);

  const [windows, setWindows] = useState<FoundryWindow[]>(() => windowManager.getWindows());
  const [apps, setApps] = useState<ApplicationManifest[]>(() => applicationRegistry.list());
  const [appSearch, setAppSearch] = useState("");
  const [inspectedAppId, setInspectedAppId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ text: string; isError: boolean } | null>(null);

  const [rules, setRules] = useState<PermissionRule[]>(() => permissionManager.getRules());
  const [externalRestricted, setExternalRestricted] = useState<boolean>(() =>
    permissionManager.isExternalCommRestricted()
  );

  // Stage 2 AI & Ollama State
  const [ollamaSettings, setOllamaSettings] = useState<OllamaSettings>(() => aiProviderManager.getSettings());
  const [ollamaStatus, setOllamaStatus] = useState<ProviderStatus>(() => aiProviderManager.getStatus());
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>(() => aiProviderManager.getModels());
  const [runningModels, setRunningModels] = useState<OllamaRunningModel[]>(() => aiProviderManager.getRunningModels());
  const [isTestingOllama, setIsTestingOllama] = useState(false);
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [testGenPrompt, setTestGenPrompt] = useState("Reply with OK if you are operational.");
  const [testGenResult, setTestGenResult] = useState<{ ok: boolean; text: string; latencyMs?: number } | null>(null);
  const [isTestingGen, setIsTestingGen] = useState(false);
  const [aiMode, setAiMode] = useState<AIOperatingMode>(() => aiPermissionPolicy.getOperatingMode());
  const [aiRequireApproval, setAiRequireApproval] = useState<boolean>(() => aiPermissionPolicy.getRequireApproval());
  const [aiPolicy, setAiPolicy] = useState<Record<AIToolPermissionCategory, AIPolicyDecision>>(() =>
    aiPermissionPolicy.getPolicy()
  );
  const [aiRuns, setAiRuns] = useState<AIExecutionMetric[]>(() => aiExecutionMonitor.getRuns());
  const [aiSummary, setAiSummary] = useState(() => aiExecutionMonitor.getSummary());

  // Stage 3 Data Intelligence & Google State
  const [ragSettings, setRagSettings] = useState<RAGSettings>(() => ragEngine.getSettings());
  const [ragTestResult, setRagTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isTestingRag, setIsTestingRag] = useState(false);
  const [googleState, setGoogleState] = useState<GoogleAccountState>(() => googleOAuthManager.getState());
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);
  const [memoriesList, setMemoriesList] = useState<AIMemoryRecord[]>(() => sharedDatabaseClient.getMemories());
  const [newMemContent, setNewMemContent] = useState("");
  const [newMemType, setNewMemType] = useState<AIMemoryRecord["type"]>("preference");
  const [coursesList, setCoursesList] = useState<AcademicCourse[]>(() => sharedDatabaseClient.getCourses());
  const [assignmentsList, setAssignmentsList] = useState<AcademicAssignment[]>(() => sharedDatabaseClient.getAssignments());
  const [tasksList, setTasksList] = useState<AcademicTask[]>(() => sharedDatabaseClient.getTasks());
  const [docsList, setDocsList] = useState<KnowledgeDocument[]>(() => sharedDatabaseClient.getDocuments());
  const [dbStats, setDbStats] = useState<any>(null);
  const [syncTargetsList, setSyncTargetsList] = useState<SyncTarget[]>(() => synchronizationManager.getTargets());
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<SystemMetric[]>(() => diagnosticsManager.getMetrics());
  const [logFilter, setLogFilter] = useState<"all" | ExecutionLogStatus>("all");
  const [execLogs, setExecLogs] = useState<ExecutionLogRecord[]>(() =>
    diagnosticsManager.getExecutionLog("all")
  );
  const [bridgeHistory, setBridgeHistory] = useState<BridgeResponse[]>(() =>
    communicationBridge.getHistory()
  );
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [storageProbe, setStorageProbe] = useState<StorageVerificationResult | null>(() =>
    persistenceManager.getLastVerification()
  );

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;

    const refreshAll = () => {
      setSettings(settingsManager.getSettings());
      setWindows(windowManager.getWindows());
      setApps(applicationRegistry.list());
      setRules(permissionManager.getRules());
      setExternalRestricted(permissionManager.isExternalCommRestricted());
      setMetrics(diagnosticsManager.getMetrics());
      setExecLogs(diagnosticsManager.getExecutionLog(logFilter));
      setBridgeHistory(communicationBridge.getHistory());
      setOllamaSettings(aiProviderManager.getSettings());
      setOllamaStatus(aiProviderManager.getStatus());
      setOllamaModels(aiProviderManager.getModels());
      setRunningModels(aiProviderManager.getRunningModels());
      setAiMode(aiPermissionPolicy.getOperatingMode());
      setAiRequireApproval(aiPermissionPolicy.getRequireApproval());
      setAiPolicy(aiPermissionPolicy.getPolicy());
      setAiRuns(aiExecutionMonitor.getRuns());
      setAiSummary(aiExecutionMonitor.getSummary());
      setMemoriesList(sharedDatabaseClient.getMemories());
      setCoursesList(sharedDatabaseClient.getCourses());
      setAssignmentsList(sharedDatabaseClient.getAssignments());
      setTasksList(sharedDatabaseClient.getTasks());
      setDocsList(sharedDatabaseClient.getDocuments());
      setSyncTargetsList(synchronizationManager.getTargets());
    };

    refreshAll();
    sharedDatabaseClient.init().then(() => refreshAll());
    sharedDatabaseClient.getStats().then((s) => setDbStats(s));

    const unsubSettings = settingsManager.subscribe(refreshAll);
    const unsubWin = windowManager.subscribe(refreshAll);
    const unsubApps = applicationRegistry.subscribe(refreshAll);
    const unsubPerms = permissionManager.subscribe(refreshAll);
    const unsubDiag = diagnosticsManager.subscribe(refreshAll);
    const unsubAI = aiProviderManager.subscribe(refreshAll);
    const unsubPolicy = aiPermissionPolicy.subscribe(refreshAll);
    const unsubMonitor = aiExecutionMonitor.subscribe(refreshAll);
    const unsubGoogle = googleOAuthManager.subscribe((g) => setGoogleState(g));
    const unsubDb = sharedDatabaseClient.subscribe(refreshAll);

    return () => {
      unsubSettings();
      unsubWin();
      unsubApps();
      unsubPerms();
      unsubDiag();
      unsubAI();
      unsubPolicy();
      unsubMonitor();
      unsubGoogle();
      unsubDb();
    };
  }, [isOpen, logFilter]);

  useEffect(() => {
    if (!isOpen) return;
    setExecLogs(diagnosticsManager.getExecutionLog(logFilter));
  }, [isOpen, logFilter]);

  if (!isOpen) return null;

  const showFeedback = (text: string, isError = false) => {
    setActionFeedback({ text, isError });
    window.setTimeout(() => {
      setActionFeedback((curr) => (curr?.text === text ? null : curr));
    }, 3000);
  };

  const handleUpdate = <K extends keyof FoundrySettings>(
    category: K,
    values: Partial<FoundrySettings[K]>
  ) => {
    settingsManager.updateCategory(category, values);
    setSettings(settingsManager.getSettings());
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 1500);
  };

  const handleBridgePing = async () => {
    const req = communicationBridge.createRequest({
      source: "foundry-settings",
      target: "foundry-host",
      operation: "system.ping",
      payload: {},
    });
    const res = await communicationBridge.send(req);
    setBridgeHistory(communicationBridge.getHistory());
    if (res.success) {
      setPingResult(
        `OK (${res.requestId}) · ${BRIDGE_PROTOCOL} v${BRIDGE_VERSION} at ${formatTime(res.timestamp)}`
      );
    } else {
      setPingResult(`Error: ${res.error?.message || "Ping failed"}`);
    }
  };

  const handleVerifyStorage = () => {
    const res = persistenceManager.verifyStorage();
    setStorageProbe(res);
    diagnosticsManager.verifyAll();
  };

  const handleAppLaunch = (app: ApplicationManifest) => {
    const res = applicationRegistry.launch(app.id);
    if (!res.success) {
      showFeedback(res.error || `Could not launch ${app.name}`, true);
    } else {
      showFeedback(`${app.name} opened`);
    }
  };

  const handleAppFocus = (app: ApplicationManifest) => {
    const res = applicationRegistry.focus(app.id);
    if (!res.success) {
      showFeedback(res.error || `Could not focus ${app.name}`, true);
    } else {
      showFeedback(`${app.name} focused`);
    }
  };

  const handleAppClose = (app: ApplicationManifest) => {
    const res = applicationRegistry.close(app.id);
    if (!res.success) {
      showFeedback(res.error || `Could not hide ${app.name}`, true);
    } else {
      showFeedback(`${app.name} hidden`);
    }
  };

  const filteredApps = appSearch.trim()
    ? applicationRegistry.search(appSearch)
    : apps;

  const handleOllamaUpdate = async (patch: Partial<OllamaSettings>) => {
    await aiProviderManager.updateSettings(patch);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 1500);
  };

  const handleTestOllamaConnection = async () => {
    setIsTestingOllama(true);
    try {
      const { probe } = await aiProviderManager.testAndDiscover();
      if (probe.connected) {
        showFeedback(`Connected to Ollama v${probe.version || "?"} (${probe.latencyMs}ms)`);
      } else {
        showFeedback(probe.error || "Ollama connection failed", true);
      }
    } finally {
      setIsTestingOllama(false);
    }
  };

  const handleRefreshOllamaModels = async () => {
    setIsRefreshingModels(true);
    try {
      const models = await aiProviderManager.refreshModels();
      showFeedback(`Discovered ${models.length} installed Ollama model${models.length === 1 ? "" : "s"}`);
    } catch (err: any) {
      showFeedback(err?.message || "Failed to refresh Ollama models", true);
    } finally {
      setIsRefreshingModels(false);
    }
  };

  const handleTestGenerate = async () => {
    setIsTestingGen(true);
    setTestGenResult(null);
    try {
      const res = await aiProviderManager.testGenerate(testGenPrompt);
      setTestGenResult({ ok: true, text: res.response || "(empty response)", latencyMs: res.latencyMs });
    } catch (err: any) {
      setTestGenResult({ ok: false, text: err?.message || "Generation failed" });
    } finally {
      setIsTestingGen(false);
    }
  };

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ComponentType<any> }> = [
    { id: "general", label: "Workspace & General", icon: Settings },
    { id: "ollama", label: "Ollama & AI Engine", icon: Sparkles },
    { id: "knowledge", label: "Knowledge & Memory", icon: BookOpen },
    { id: "google", label: "APIs & Integrations", icon: Globe },
    { id: "academic", label: "Academic Management", icon: GraduationCap },
    { id: "privacy", label: "Data & Privacy", icon: Database },
    { id: "canvas", label: "Canvas & Engines", icon: Sliders },
    { id: "window", label: "Window Management", icon: Layers },
    { id: "applications", label: "Applications", icon: Cpu },
    { id: "bridge", label: "Communication Bridge", icon: Network },
    { id: "permissions", label: "Permissions", icon: Shield },
    { id: "storage", label: "Storage & Persistence", icon: HardDrive },
    { id: "diagnostics", label: "Diagnostics & Log", icon: Activity },
  ];

  const recentBridgeErrors = communicationBridge.getRecentErrors();
  const registeredHostOps = communicationBridge.getRegisteredOperations("foundry-host");
  const unavailableBridgeOps = communicationBridge.getUnavailableOperations();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl h-[740px] max-h-[90vh] rounded-xl border flex flex-col shadow-2xl overflow-hidden"
        style={{
          backgroundColor: THEME.panels,
          borderColor: THEME.borders,
          color: THEME.primaryText,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="h-13 px-5 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: THEME.borders, backgroundColor: THEME.mainBar }}
        >
          <div className="flex items-center gap-2.5">
            <Settings size={17} className="text-[#BCE5F8]" />
            <span className="font-semibold text-sm tracking-tight">
              Foundry System Settings
            </span>
            {savedNotice && (
              <span className="flex items-center gap-1 text-[11px] text-[#39E58C] bg-[#39E58C]/10 border border-[#39E58C]/25 px-2 py-0.5 rounded">
                <Check size={12} /> Saved
              </span>
            )}
            {actionFeedback && (
              <span
                className={`text-[11px] px-2 py-0.5 rounded border ${
                  actionFeedback.isError
                    ? "text-rose-300 bg-rose-500/10 border-rose-500/30"
                    : "text-[#BCE5F8] bg-[#BCE5F8]/10 border-[#BCE5F8]/30"
                }`}
              >
                {actionFeedback.text}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#202327] text-[#8B929C] hover:text-[#F5F5F5] cursor-pointer transition-colors"
            title="Close Settings"
          >
            <X size={17} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <nav
            className="w-56 border-r overflow-y-auto p-2.5 space-y-1 shrink-0"
            style={{ borderColor: THEME.borders, backgroundColor: THEME.mainBar }}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                    isActive
                      ? "bg-[#202327] text-[#F5F5F5] border border-[#292C30]"
                      : "text-[#8B929C] hover:text-[#F5F5F5] hover:bg-[#202327]/50 border border-transparent"
                  }`}
                >
                  <Icon size={15} className={isActive ? "text-[#BCE5F8]" : "text-[#8B929C]"} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Tab Pane */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === "general" && (
              <div className="space-y-5">
                <div className="border-b pb-3" style={{ borderColor: THEME.borders }}>
                  <h3 className="text-sm font-semibold text-[#F5F5F5]">Workspace & Appearance</h3>
                  <p className="text-xs text-[#8B929C] mt-0.5">
                    Configure workspace identity, saving preferences, and dark surface theme.
                  </p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#8B929C] mb-1.5">
                      Workspace Display Name
                    </label>
                    <input
                      type="text"
                      value={settings.general.workspaceName}
                      onChange={(e) => handleUpdate("general", { workspaceName: e.target.value })}
                      className="w-full max-w-md bg-[#101214] border border-[#292C30] rounded-lg px-3 py-2 text-xs text-[#F5F5F5] outline-none focus:border-[#BCE5F8]"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                    <div>
                      <label className="block text-xs font-medium text-[#8B929C] mb-1.5">
                        Color Theme
                      </label>
                      <select
                        value={settings.appearance.themeMode}
                        onChange={(e) =>
                          handleUpdate("appearance", { themeMode: e.target.value as any })
                        }
                        className="w-full bg-[#101214] border border-[#292C30] rounded-lg px-3 py-2 text-xs text-[#F5F5F5] outline-none focus:border-[#BCE5F8]"
                      >
                        <option value="dark">Foundry Dark (#0B0D0F)</option>
                        <option value="light">Light Mode</option>
                        <option value="system">System Preference</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#8B929C] mb-1.5 tabular-nums">
                        Interface Scale ({settings.appearance.uiScale.toFixed(2)}x)
                      </label>
                      <input
                        type="range"
                        min="0.8"
                        max="1.2"
                        step="0.05"
                        value={settings.appearance.uiScale}
                        onChange={(e) =>
                          handleUpdate("appearance", { uiScale: parseFloat(e.target.value) })
                        }
                        className="w-full accent-[#BCE5F8] mt-2"
                      />
                    </div>
                  </div>
                  <div className="divide-y divide-[#292C30] border-t border-b border-[#292C30] max-w-2xl">
                    <label className="flex items-center justify-between py-3 cursor-pointer">
                      <div>
                        <div className="text-xs font-medium text-[#F5F5F5]">
                          Automatic Workspace Persistence
                        </div>
                        <div className="text-[11px] text-[#8B929C]">
                          Persist canvas changes and sync operations automatically
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.general.autoSave}
                        onChange={(e) => handleUpdate("general", { autoSave: e.target.checked })}
                        className="w-4 h-4 accent-[#BCE5F8] cursor-pointer"
                      />
                    </label>
                    <label className="flex items-center justify-between py-3 cursor-pointer">
                      <div>
                        <div className="text-xs font-medium text-[#F5F5F5]">
                          Show Collaborator Cursors
                        </div>
                        <div className="text-[11px] text-[#8B929C]">
                          Render live peer cursors and names on canvas
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.collaboration.showCursors}
                        onChange={(e) =>
                          handleUpdate("collaboration", { showCursors: e.target.checked })
                        }
                        className="w-4 h-4 accent-[#BCE5F8] cursor-pointer"
                      />
                    </label>
                    <label className="flex items-center justify-between py-3 cursor-pointer">
                      <div>
                        <div className="text-xs font-medium text-[#F5F5F5]">
                          Interface Audio Feedback
                        </div>
                        <div className="text-[11px] text-[#8B929C]">
                          Play subtle interaction sound cues
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.general.soundEffects}
                        onChange={(e) =>
                          handleUpdate("general", { soundEffects: e.target.checked })
                        }
                        className="w-4 h-4 accent-[#BCE5F8] cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "ollama" && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: THEME.borders }}>
                  <div>
                    <h3 className="text-sm font-semibold text-[#F5F5F5]">
                      Ollama &amp; Local AI Engine (Stage 2)
                    </h3>
                    <p className="text-xs text-[#8B929C] mt-0.5">
                      Configure local Ollama connectivity, model discovery, and inference parameters. No silent cloud fallback.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTestOllamaConnection}
                      disabled={isTestingOllama}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#BCE5F8] text-[#0B0D0F] hover:opacity-90 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      <Zap size={12} />
                      {isTestingOllama ? "Testing..." : "Test Connection"}
                    </button>
                    <button
                      onClick={handleRefreshOllamaModels}
                      disabled={isRefreshingModels}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#202327] hover:bg-[#292C30] text-[#F5F5F5] border border-[#292C30] disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      <RefreshCw size={12} className={isRefreshingModels ? "animate-spin" : ""} />
                      Refresh Models
                    </button>
                  </div>
                </div>

                {/* Live Connection Banner */}
                <div
                  className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
                    ollamaStatus.connected
                      ? "border-[#39E58C]/30 bg-[#39E58C]/8"
                      : "border-[#292C30] bg-[#101214]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          ollamaStatus.connected
                            ? "bg-[#39E58C]"
                            : ollamaStatus.lastCheckedAt
                            ? "bg-rose-400"
                            : "bg-[#8B929C]"
                        }`}
                      />
                      <span className="font-medium text-[#F5F5F5]">
                        {ollamaStatus.connected
                          ? `Connected to Ollama v${ollamaStatus.version || "unknown"}`
                          : ollamaStatus.lastCheckedAt
                          ? "Ollama Disconnected"
                          : "Ollama Not Verified"}
                      </span>
                      {ollamaStatus.latencyMs !== null && ollamaStatus.connected && (
                        <span className="font-mono text-[11px] text-[#39E58C] tabular-nums">
                          {ollamaStatus.latencyMs}ms
                        </span>
                      )}
                    </div>
                    {renderBadge(
                      ollamaStatus.connected ? "healthy" : ollamaStatus.lastCheckedAt ? "error" : "unverified",
                      ollamaStatus.connected ? "Connected" : ollamaStatus.lastCheckedAt ? "Offline" : "Unverified"
                    )}
                  </div>
                  {ollamaStatus.error && (
                    <div className="text-[11px] text-rose-300">{ollamaStatus.error}</div>
                  )}
                  {ollamaStatus.guidance && (
                    <div className="text-[11px] text-[#8B929C] leading-relaxed">
                      {ollamaStatus.guidance}
                    </div>
                  )}
                  {ollamaStatus.isHostedOrigin && (
                    <div className="mt-1 p-2 rounded bg-[#17191C] border border-[#292C30] text-[11px] text-[#BCE5F8] flex items-start gap-2">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>
                        Running from a remote browser origin ({typeof window !== "undefined" ? window.location.origin : ""}). Use <b>Direct Browser / Local Bridge</b> mode with{" "}
                        <code className="px-1 py-0.5 rounded bg-[#0B0D0F]">OLLAMA_ORIGINS="{typeof window !== "undefined" ? window.location.origin : "*"}" ollama serve</code> or an HTTPS local tunnel.
                      </span>
                    </div>
                  )}
                </div>

                {/* Connection Config */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#8B929C] mb-1.5">
                      Connection Mode
                    </label>
                    <select
                      value={ollamaSettings.connectionMode}
                      onChange={(e) =>
                        handleOllamaUpdate({ connectionMode: e.target.value as "backend" | "direct" })
                      }
                      className="w-full bg-[#101214] border border-[#292C30] rounded-lg px-3 py-2 text-xs text-[#F5F5F5] outline-none focus:border-[#BCE5F8]"
                    >
                      <option value="backend">Local Foundry Backend Proxy (/api/ai → Ollama)</option>
                      <option value="direct">Direct Browser / Local AI Bridge (CORS)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B929C] mb-1.5">
                      Ollama Endpoint URL
                    </label>
                    <input
                      type="text"
                      value={ollamaSettings.baseUrl}
                      onChange={(e) => handleOllamaUpdate({ baseUrl: e.target.value })}
                      placeholder="http://127.0.0.1:11434"
                      className="w-full bg-[#101214] border border-[#292C30] rounded-lg px-3 py-2 text-xs font-mono text-[#F5F5F5] outline-none focus:border-[#BCE5F8]"
                    />
                  </div>
                </div>

                {/* Model Selection & Capabilities */}
                <div className="p-3.5 rounded-lg border border-[#292C30] bg-[#101214] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-medium text-[#F5F5F5]">
                        Active Ollama Model ({ollamaModels.length} discovered)
                      </div>
                      <div className="text-[11px] text-[#8B929C]">
                        Discovered live via <code className="font-mono">/api/tags</code>. Never hardcoded.
                      </div>
                    </div>
                    <select
                      value={ollamaSettings.selectedModel || ""}
                      onChange={(e) => aiProviderManager.selectModel(e.target.value || null)}
                      className="min-w-56 bg-[#17191C] border border-[#292C30] rounded-lg px-3 py-1.5 text-xs text-[#F5F5F5] outline-none focus:border-[#BCE5F8]"
                    >
                      {ollamaModels.length === 0 ? (
                        <option value="">No installed models detected</option>
                      ) : (
                        ollamaModels.map((m) => (
                          <option key={m.name} value={m.name}>
                            {m.name}
                            {m.details?.parameter_size ? ` (${m.details.parameter_size})` : ""}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {ollamaSettings.selectedModel && (() => {
                    const activeInfo = ollamaModels.find((m) => m.name === ollamaSettings.selectedModel);
                    if (!activeInfo) return null;
                    return (
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-[#17191C] border border-[#292C30] text-[#8B929C]">
                          Tools:{" "}
                          <b className={activeInfo.supportsTools ? "text-[#39E58C]" : "text-amber-300"}>
                            {activeInfo.supportsTools === undefined
                              ? "Inspecting..."
                              : activeInfo.supportsTools
                              ? "Supported"
                              : "Text-only"}
                          </b>
                        </span>
                        {activeInfo.contextLength && (
                          <span className="px-2 py-0.5 rounded bg-[#17191C] border border-[#292C30] text-[#8B929C] tabular-nums">
                            Model Max Ctx: <b className="text-[#F5F5F5]">{activeInfo.contextLength}</b>
                          </span>
                        )}
                        {activeInfo.details?.quantization_level && (
                          <span className="px-2 py-0.5 rounded bg-[#17191C] border border-[#292C30] text-[#8B929C]">
                            Quant: <b className="text-[#F5F5F5]">{activeInfo.details.quantization_level}</b>
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {runningModels.length > 0 && (
                    <div className="pt-2 border-t border-[#292C30] text-[11px] text-[#8B929C]">
                      Loaded in memory (`/api/ps`):{" "}
                      <span className="font-mono text-[#39E58C]">
                        {runningModels.map((r) => r.name).join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Inference Parameters */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#8B929C] mb-1 tabular-nums">
                      Temperature ({ollamaSettings.temperature.toFixed(2)})
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={2}
                      step={0.05}
                      value={ollamaSettings.temperature}
                      onChange={(e) =>
                        handleOllamaUpdate({ temperature: Math.max(0, Math.min(2, parseFloat(e.target.value) || 0)) })
                      }
                      className="w-full bg-[#101214] border border-[#292C30] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#F5F5F5] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#8B929C] mb-1">
                      Context Window (num_ctx)
                    </label>
                    <input
                      type="number"
                      min={512}
                      max={131072}
                      step={512}
                      value={ollamaSettings.numCtx}
                      onChange={(e) =>
                        handleOllamaUpdate({ numCtx: Math.max(512, parseInt(e.target.value || "4096", 10)) })
                      }
                      className="w-full bg-[#101214] border border-[#292C30] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#F5F5F5] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#8B929C] mb-1">
                      Max Output (num_predict)
                    </label>
                    <input
                      type="number"
                      min={64}
                      max={16384}
                      step={64}
                      value={ollamaSettings.numPredict}
                      onChange={(e) =>
                        handleOllamaUpdate({ numPredict: Math.max(64, parseInt(e.target.value || "1024", 10)) })
                      }
                      className="w-full bg-[#101214] border border-[#292C30] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#F5F5F5] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#8B929C] mb-1">
                      Keep Alive
                    </label>
                    <input
                      type="text"
                      value={ollamaSettings.keepAlive}
                      onChange={(e) => handleOllamaUpdate({ keepAlive: e.target.value })}
                      className="w-full bg-[#101214] border border-[#292C30] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#F5F5F5]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#8B929C] mb-1">
                      top_p
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={ollamaSettings.topP}
                      onChange={(e) =>
                        handleOllamaUpdate({ topP: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0.9)) })
                      }
                      className="w-full bg-[#101214] border border-[#292C30] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#F5F5F5] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#8B929C] mb-1">
                      top_k
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={ollamaSettings.topK}
                      onChange={(e) =>
                        handleOllamaUpdate({ topK: Math.max(1, parseInt(e.target.value || "40", 10)) })
                      }
                      className="w-full bg-[#101214] border border-[#292C30] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#F5F5F5] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#8B929C] mb-1">
                      repeat_penalty
                    </label>
                    <input
                      type="number"
                      min={0.5}
                      max={2.0}
                      step={0.05}
                      value={ollamaSettings.repeatPenalty}
                      onChange={(e) =>
                        handleOllamaUpdate({
                          repeatPenalty: Math.max(0.5, Math.min(2, parseFloat(e.target.value) || 1.1)),
                        })
                      }
                      className="w-full bg-[#101214] border border-[#292C30] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#F5F5F5] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#8B929C] mb-1">
                      Timeout (ms)
                    </label>
                    <input
                      type="number"
                      min={3000}
                      max={300000}
                      step={1000}
                      value={ollamaSettings.timeoutMs}
                      onChange={(e) =>
                        handleOllamaUpdate({ timeoutMs: Math.max(3000, parseInt(e.target.value || "60000", 10)) })
                      }
                      className="w-full bg-[#101214] border border-[#292C30] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#F5F5F5] tabular-nums"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="divide-y divide-[#292C30] border-t border-b border-[#292C30]">
                  <label className="flex items-center justify-between py-2.5 cursor-pointer">
                    <div>
                      <div className="text-xs font-medium text-[#F5F5F5]">Enable Ollama AI Engine</div>
                      <div className="text-[11px] text-[#8B929C]">Allow Foundry AI Chat to send prompts to Ollama</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={ollamaSettings.enabled}
                      onChange={(e) => handleOllamaUpdate({ enabled: e.target.checked })}
                      className="w-4 h-4 accent-[#BCE5F8] cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between py-2.5 cursor-pointer">
                    <div>
                      <div className="text-xs font-medium text-[#F5F5F5]">Stream Responses</div>
                      <div className="text-[11px] text-[#8B929C]">Stream tokens incrementally over NDJSON</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={ollamaSettings.streaming}
                      onChange={(e) => handleOllamaUpdate({ streaming: e.target.checked })}
                      className="w-4 h-4 accent-[#BCE5F8] cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between py-2.5 cursor-pointer">
                    <div>
                      <div className="text-xs font-medium text-[#F5F5F5]">Auto-Discover Models on Startup</div>
                      <div className="text-[11px] text-[#8B929C]">Probe Ollama and refresh installed model list when Foundry loads</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={ollamaSettings.autoDiscoverOnStartup}
                      onChange={(e) => handleOllamaUpdate({ autoDiscoverOnStartup: e.target.checked })}
                      className="w-4 h-4 accent-[#BCE5F8] cursor-pointer"
                    />
                  </label>
                </div>

                {/* Test Generation */}
                <div className="p-3.5 rounded-lg border border-[#292C30] bg-[#101214] space-y-2.5">
                  <div className="text-xs font-medium text-[#F5F5F5]">Test Live Generation</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testGenPrompt}
                      onChange={(e) => setTestGenPrompt(e.target.value)}
                      className="flex-1 bg-[#17191C] border border-[#292C30] rounded-lg px-3 py-1.5 text-xs text-[#F5F5F5] outline-none focus:border-[#BCE5F8]"
                    />
                    <button
                      onClick={handleTestGenerate}
                      disabled={isTestingGen}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#202327] hover:bg-[#292C30] text-[#BCE5F8] border border-[#292C30] disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      {isTestingGen ? "Running..." : "Test Generation"}
                    </button>
                  </div>
                  {testGenResult && (
                    <div
                      className={`p-2.5 rounded border text-xs font-mono whitespace-pre-wrap ${
                        testGenResult.ok
                          ? "border-[#39E58C]/30 bg-[#39E58C]/10 text-[#39E58C]"
                          : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                      }`}
                    >
                      {testGenResult.ok && testGenResult.latencyMs !== undefined
                        ? `[${testGenResult.latencyMs}ms] ${testGenResult.text}`
                        : testGenResult.text}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "canvas" && (
              <div className="space-y-5">
                <div className="border-b pb-3" style={{ borderColor: THEME.borders }}>
                  <h3 className="text-sm font-semibold text-[#F5F5F5]">
                    Canvas, Vector & HTML Engines
                  </h3>
                  <p className="text-xs text-[#8B929C] mt-0.5">
                    Viewport defaults, grid spacing, drawing smoothing, and iframe sandbox isolation.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl">
                  <div>
                    <label className="block text-xs font-medium text-[#8B929C] mb-1.5 tabular-nums">
                      Default Zoom ({Math.round(settings.canvas.defaultZoom * 100)}%)
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="1.5"
                      step="0.1"
                      value={settings.canvas.defaultZoom}
                      onChange={(e) =>
                        handleUpdate("canvas", { defaultZoom: parseFloat(e.target.value) })
                      }
                      className="w-full accent-[#BCE5F8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B929C] mb-1.5 tabular-nums">
                      Grid Dot Spacing ({settings.canvas.gridDotSpacing}px)
                    </label>
                    <input
                      type="range"
                      min="12"
                      max="48"
                      step="4"
                      value={settings.canvas.gridDotSpacing}
                      onChange={(e) =>
                        handleUpdate("canvas", { gridDotSpacing: parseInt(e.target.value, 10) })
                      }
                      className="w-full accent-[#BCE5F8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B929C] mb-1.5 tabular-nums">
                      Pan Speed Multiplier ({settings.navigation.panSpeed.toFixed(1)}x)
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={settings.navigation.panSpeed}
                      onChange={(e) =>
                        handleUpdate("navigation", { panSpeed: parseFloat(e.target.value) })
                      }
                      className="w-full accent-[#BCE5F8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B929C] mb-1.5 tabular-nums">
                      Path Smoothing Level ({settings.drawing.smoothingLevel.toFixed(1)})
                    </label>
                    <input
                      type="range"
                      min="1.0"
                      max="5.0"
                      step="0.5"
                      value={settings.drawing.smoothingLevel}
                      onChange={(e) =>
                        handleUpdate("drawing", { smoothingLevel: parseFloat(e.target.value) })
                      }
                      className="w-full accent-[#BCE5F8]"
                    />
                  </div>
                </div>
                <div className="divide-y divide-[#292C30] border-t border-b border-[#292C30] max-w-2xl">
                  <label className="flex items-center justify-between py-3 cursor-pointer">
                    <div>
                      <div className="text-xs font-medium text-[#F5F5F5]">Smart Alignment Guides</div>
                      <div className="text-[11px] text-[#8B929C]">
                        Display alignment snap guides while dragging objects
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.canvas.smartGuides}
                      onChange={(e) => handleUpdate("canvas", { smartGuides: e.target.checked })}
                      className="w-4 h-4 accent-[#BCE5F8] cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between py-3 cursor-pointer">
                    <div>
                      <div className="text-xs font-medium text-[#F5F5F5]">Invert Vertical Scroll</div>
                      <div className="text-[11px] text-[#8B929C]">
                        Invert wheel direction for vertical canvas pan
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.navigation.invertScroll}
                      onChange={(e) =>
                        handleUpdate("navigation", { invertScroll: e.target.checked })
                      }
                      className="w-4 h-4 accent-[#BCE5F8] cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between py-3 cursor-pointer">
                    <div>
                      <div className="text-xs font-medium text-[#F5F5F5]">
                        HTML Sandbox Isolation
                      </div>
                      <div className="text-[11px] text-[#8B929C]">
                        Render imported HTML cards inside sandboxed frames
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.htmlEngine.sandboxIsolation}
                      onChange={(e) =>
                        handleUpdate("htmlEngine", { sandboxIsolation: e.target.checked })
                      }
                      className="w-4 h-4 accent-[#BCE5F8] cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            )}

            {activeTab === "window" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: THEME.borders }}>
                  <div>
                    <h3 className="text-sm font-semibold text-[#F5F5F5]">
                      Window Management ({windows.length} registered)
                    </h3>
                    <p className="text-xs text-[#8B929C] mt-0.5">
                      Coordinate floating windows, companion gap spacing, and saved coordinates.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      windowManager.resetLayout();
                      showFeedback("Window positions reset to defaults");
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#202327] hover:bg-[#292C30] text-[#F5F5F5] border border-[#292C30] cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw size={13} className="text-[#BCE5F8]" />
                    Reset Window Positions
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#8B929C] mb-1.5 tabular-nums">
                      Companion Gap ({settings.windowManagement.companionGap}px)
                    </label>
                    <input
                      type="range"
                      min="16"
                      max="48"
                      step="2"
                      value={settings.windowManagement.companionGap}
                      onChange={(e) =>
                        handleUpdate("windowManagement", {
                          companionGap: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full accent-[#BCE5F8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B929C] mb-1.5">
                      Default Width (px)
                    </label>
                    <input
                      type="number"
                      min={360}
                      max={1200}
                      value={settings.windowManagement.defaultControllerWidth}
                      onChange={(e) =>
                        handleUpdate("windowManagement", {
                          defaultControllerWidth: Math.max(360, parseInt(e.target.value || "600", 10)),
                        })
                      }
                      className="w-full bg-[#101214] border border-[#292C30] rounded-lg px-3 py-1.5 text-xs text-[#F5F5F5] tabular-nums outline-none focus:border-[#BCE5F8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B929C] mb-1.5">
                      Default Height (px)
                    </label>
                    <input
                      type="number"
                      min={240}
                      max={900}
                      value={settings.windowManagement.defaultControllerHeight}
                      onChange={(e) =>
                        handleUpdate("windowManagement", {
                          defaultControllerHeight: Math.max(240, parseInt(e.target.value || "330", 10)),
                        })
                      }
                      className="w-full bg-[#101214] border border-[#292C30] rounded-lg px-3 py-1.5 text-xs text-[#F5F5F5] tabular-nums outline-none focus:border-[#BCE5F8]"
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between py-2.5 border-t border-b border-[#292C30] cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-[#F5F5F5]">Remember Window Positions</div>
                    <div className="text-[11px] text-[#8B929C]">
                      Persist window coordinates, size, and state in localStorage
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.windowManagement.rememberPositions}
                    onChange={(e) =>
                      handleUpdate("windowManagement", { rememberPositions: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#BCE5F8] cursor-pointer"
                  />
                </label>

                <div className="overflow-x-auto border border-[#292C30] rounded-lg bg-[#101214]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#292C30] text-[11px] text-[#8B929C]">
                        <th className="py-2 px-3 font-medium">Window</th>
                        <th className="py-2 px-3 font-medium">Mode</th>
                        <th className="py-2 px-3 font-medium">Bounds</th>
                        <th className="py-2 px-3 font-medium">State</th>
                        <th className="py-2 px-3 font-medium text-right">Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#292C30]">
                      {windows.map((w) => (
                        <tr key={w.windowId} className="hover:bg-[#17191C]">
                          <td className="py-2 px-3">
                            <div className="font-medium text-[#F5F5F5]">{w.title}</div>
                            <div className="text-[10px] font-mono text-[#8B929C]">
                              {w.windowId}
                              {w.parentWindowId ? ` → ${w.parentWindowId}` : ""}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-[11px] text-[#8B929C]">{w.displayMode}</td>
                          <td className="py-2 px-3 text-[11px] font-mono text-[#8B929C] tabular-nums whitespace-nowrap">
                            {w.position.x},{w.position.y} · {w.size.width}×{w.size.height}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5">
                              {renderBadge(w.state)}
                              {w.focused && (
                                <span className="text-[10px] text-[#BCE5F8] font-medium">Focused</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              {!w.visible ? (
                                <button
                                  onClick={() => windowManager.open(w.windowId)}
                                  className="px-2 py-1 rounded bg-[#202327] hover:bg-[#292C30] text-[11px] text-[#F5F5F5] cursor-pointer"
                                >
                                  Show
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => windowManager.focus(w.windowId)}
                                    className="px-2 py-1 rounded bg-[#202327] hover:bg-[#292C30] text-[11px] text-[#BCE5F8] cursor-pointer"
                                  >
                                    Focus
                                  </button>
                                  {w.windowId === "education-controller-main" &&
                                    (w.state === "minimized" ? (
                                      <button
                                        onClick={() => windowManager.restore(w.windowId)}
                                        className="px-2 py-1 rounded bg-[#202327] hover:bg-[#292C30] text-[11px] text-[#39E58C] cursor-pointer"
                                      >
                                        Restore
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => windowManager.minimize(w.windowId)}
                                        className="px-2 py-1 rounded bg-[#202327] hover:bg-[#292C30] text-[11px] text-[#8B929C] hover:text-[#F5F5F5] cursor-pointer"
                                      >
                                        Minimize
                                      </button>
                                    ))}
                                  <button
                                    onClick={() => windowManager.close(w.windowId)}
                                    className="px-2 py-1 rounded bg-[#202327] hover:bg-[#292C30] text-[11px] text-[#8B929C] hover:text-[#F5F5F5] cursor-pointer"
                                  >
                                    Hide
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "applications" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: THEME.borders }}>
                  <div>
                    <h3 className="text-sm font-semibold text-[#F5F5F5]">
                      Application Registry ({apps.length} manifests)
                    </h3>
                    <p className="text-xs text-[#8B929C] mt-0.5">
                      Installed apps, Stage 1 unconfigured apps, operational capabilities, and AI status.
                    </p>
                  </div>
                  <div className="relative w-64">
                    <Search size={13} className="absolute left-2.5 top-2.5 text-[#8B929C]" />
                    <input
                      type="text"
                      placeholder="Filter applications..."
                      value={appSearch}
                      onChange={(e) => setAppSearch(e.target.value)}
                      className="w-full bg-[#101214] border border-[#292C30] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#F5F5F5] outline-none focus:border-[#BCE5F8]"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto border border-[#292C30] rounded-lg bg-[#101214]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#292C30] text-[11px] text-[#8B929C]">
                        <th className="py-2 px-3 font-medium">Application</th>
                        <th className="py-2 px-3 font-medium">Category</th>
                        <th className="py-2 px-3 font-medium">Install</th>
                        <th className="py-2 px-3 font-medium">Runtime</th>
                        <th className="py-2 px-3 font-medium">AI</th>
                        <th className="py-2 px-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#292C30]">
                      {filteredApps.map((app) => {
                        const installed = applicationRegistry.isInstalled(app.id);
                        const isInspected = inspectedAppId === app.id;
                        const canOpenClose =
                          app.host === "education-controller" || app.id === "education-controller";

                        return (
                          <React.Fragment key={app.id}>
                            <tr className="hover:bg-[#17191C]">
                              <td className="py-2.5 px-3">
                                <div className="font-medium text-[#F5F5F5]">
                                  {app.name}{" "}
                                  <span className="text-[10px] font-mono text-[#8B929C] tabular-nums">
                                    v{app.version}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#8B929C] font-mono">{app.id}</div>
                              </td>
                              <td className="py-2.5 px-3 text-[11px] text-[#8B929C] capitalize">
                                {app.category}
                              </td>
                              <td className="py-2.5 px-3">
                                {installed
                                  ? renderBadge("installed", "Installed")
                                  : renderBadge("not_installed", "Not Installed")}
                              </td>
                              <td className="py-2.5 px-3">{renderBadge(app.status)}</td>
                              <td className="py-2.5 px-3 text-[11px] text-[#8B929C] whitespace-nowrap">
                                {app.ai.connected ? "Connected" : "Not Connected"}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="inline-flex items-center gap-1">
                                  {canOpenClose && (
                                    <>
                                      <button
                                        onClick={() => handleAppLaunch(app)}
                                        className="px-2 py-1 rounded bg-[#202327] hover:bg-[#292C30] text-[11px] text-[#BCE5F8] cursor-pointer"
                                      >
                                        Open
                                      </button>
                                      {app.status === "running" && (
                                        <>
                                          <button
                                            onClick={() => handleAppFocus(app)}
                                            className="px-2 py-1 rounded bg-[#202327] hover:bg-[#292C30] text-[11px] text-[#F5F5F5] cursor-pointer"
                                          >
                                            Focus
                                          </button>
                                          <button
                                            onClick={() => handleAppClose(app)}
                                            className="px-2 py-1 rounded bg-[#202327] hover:bg-[#292C30] text-[11px] text-[#8B929C] hover:text-[#F5F5F5] cursor-pointer"
                                          >
                                            Hide
                                          </button>
                                        </>
                                      )}
                                    </>
                                  )}
                                  {!installed && (
                                    <button
                                      onClick={() => handleAppLaunch(app)}
                                      className="px-2 py-1 rounded bg-[#202327] hover:bg-[#292C30] text-[11px] text-[#8B929C] cursor-pointer"
                                    >
                                      Test Launch
                                    </button>
                                  )}
                                  <button
                                    onClick={() =>
                                      setInspectedAppId(isInspected ? null : app.id)
                                    }
                                    className="px-2 py-1 rounded bg-[#202327] hover:bg-[#292C30] text-[11px] text-[#8B929C] hover:text-[#F5F5F5] cursor-pointer"
                                  >
                                    {isInspected ? "Close" : "Inspect"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isInspected && (
                              <tr className="bg-[#17191C]">
                                <td colSpan={6} className="p-3 text-[11px] space-y-2 border-t border-[#292C30]">
                                  <div className="text-[#F5F5F5]">{app.description}</div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                    <div>
                                      <span className="text-[#8B929C] block mb-0.5">
                                        Display Modes & Host
                                      </span>
                                      <span className="font-mono text-[#F5F5F5]">
                                        host={app.host} · modes=
                                        {app.displayModes.length ? app.displayModes.join(", ") : "none"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[#8B929C] block mb-0.5">Dependencies</span>
                                      <span className="font-mono text-[#F5F5F5]">
                                        {app.dependencies.length ? app.dependencies.join(", ") : "None"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[#8B929C] block mb-0.5">
                                        Operational Capabilities (Stage 1)
                                      </span>
                                      <span className="font-mono text-[#39E58C]">
                                        {app.capabilities.length ? app.capabilities.join(", ") : "None"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[#8B929C] block mb-0.5">
                                        Planned Capabilities (Stage 2)
                                      </span>
                                      <span className="font-mono text-[#8B929C]">
                                        {app.plannedCapabilities.length
                                          ? app.plannedCapabilities.join(", ")
                                          : "None"}
                                      </span>
                                    </div>
                                  </div>
                                  {app.recentErrors && app.recentErrors.length > 0 && (
                                    <div className="pt-1 text-rose-300 font-mono">
                                      Recent errors: {app.recentErrors.join(" | ")}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "bridge" && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: THEME.borders }}>
                  <div>
                    <h3 className="text-sm font-semibold text-[#F5F5F5]">
                      Communication Bridge ({BRIDGE_PROTOCOL} v{BRIDGE_VERSION})
                    </h3>
                    <p className="text-xs text-[#8B929C] mt-0.5">
                      Envelope validation, handshake status, registered operations, and correlated request history.
                    </p>
                  </div>
                  <button
                    onClick={handleBridgePing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#BCE5F8] text-[#0B0D0F] hover:opacity-90 cursor-pointer whitespace-nowrap"
                  >
                    <Play size={12} />
                    Run system.ping
                  </button>
                </div>

                {pingResult && (
                  <div className="px-3 py-2 rounded-lg border border-[#39E58C]/30 bg-[#39E58C]/10 text-xs font-mono text-[#39E58C]">
                    {pingResult}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg border border-[#292C30] bg-[#101214]">
                    <div className="text-[11px] text-[#8B929C]">Bridge Runtime</div>
                    <div className="mt-1 font-medium text-[#F5F5F5]">
                      {communicationBridge.isInitialized() ? "Initialized" : "Uninitialized"} ·{" "}
                      {communicationBridge.isTransportAttached()
                        ? "postMessage active"
                        : "Internal only"}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-[#292C30] bg-[#101214]">
                    <div className="text-[11px] text-[#8B929C]">Registered Operations</div>
                    <div className="mt-1 font-medium text-[#F5F5F5] tabular-nums">
                      {registeredHostOps.length} active · {unavailableBridgeOps.length} Stage 2 gated
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-[#292C30] bg-[#101214]">
                    <div className="text-[11px] text-[#8B929C]">Trusted Modules</div>
                    <div className="mt-1 font-medium text-[#F5F5F5] tabular-nums">
                      {communicationBridge.getConnectedModules().length} connected
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded-lg border border-[#292C30] bg-[#101214]">
                    <div className="text-[11px] font-medium text-[#8B929C] mb-2">
                      Registered Host Operations
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {registeredHostOps.map((op) => (
                        <span
                          key={op}
                          className="px-1.5 py-0.5 rounded bg-[#17191C] border border-[#292C30] font-mono text-[10px] text-[#F5F5F5]"
                        >
                          {op}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-[#292C30] bg-[#101214]">
                    <div className="text-[11px] font-medium text-[#8B929C] mb-2">
                      Unavailable Stage 2 Operations & Errors ({recentBridgeErrors.length})
                    </div>
                    <div className="space-y-1.5">
                      {unavailableBridgeOps.map((u) => (
                        <div key={u.operation} className="text-[11px] font-mono text-amber-300">
                          {u.operation}: <span className="text-[#8B929C]">{u.reason}</span>
                        </div>
                      ))}
                      {recentBridgeErrors.slice(0, 4).map((err) => (
                        <div key={err.requestId} className="text-[11px] text-rose-300 font-mono">
                          {err.operation} [{err.error?.code}]: {err.error?.message}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto border border-[#292C30] rounded-lg bg-[#101214]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#292C30] text-[11px] text-[#8B929C]">
                        <th className="py-2 px-3 font-medium">Time</th>
                        <th className="py-2 px-3 font-medium">Request ID</th>
                        <th className="py-2 px-3 font-medium">Operation</th>
                        <th className="py-2 px-3 font-medium">Target → Source</th>
                        <th className="py-2 px-3 font-medium">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#292C30]">
                      {bridgeHistory.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 px-3 text-center text-[#8B929C]">
                            No bridge requests dispatched yet. Run system.ping to test.
                          </td>
                        </tr>
                      ) : (
                        bridgeHistory.slice(0, 20).map((item) => (
                          <tr key={item.requestId} className="hover:bg-[#17191C]">
                            <td className="py-2 px-3 font-mono text-[11px] text-[#8B929C] tabular-nums whitespace-nowrap">
                              {formatTime(item.timestamp)}
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-[#8B929C]">
                              {item.requestId}
                            </td>
                            <td className="py-2 px-3 font-mono text-[#F5F5F5]">
                              {item.operation || "—"}
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-[#8B929C]">
                              {item.target} → {item.source}
                            </td>
                            <td className="py-2 px-3">
                              {item.success
                                ? renderBadge("success", "OK")
                                : renderBadge("error", item.error?.code || "Error")}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "permissions" && (
              <div className="space-y-5">
                <div className="border-b pb-3" style={{ borderColor: THEME.borders }}>
                  <h3 className="text-sm font-semibold text-[#F5F5F5]">
                    AI Tool Policy &amp; Access Control (Stage 2)
                  </h3>
                  <p className="text-xs text-[#8B929C] mt-0.5">
                    Configure AI operating modes, tool approval policy, and module bridge permissions. Destructive and external scopes remain locked Deny.
                  </p>
                </div>

                {/* AI Operating Mode & Approval Policy */}
                <div className="p-3.5 rounded-lg border border-[#292C30] bg-[#101214] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-[#F5F5F5]">AI Operating Mode</div>
                      <div className="text-[11px] text-[#8B929C]">
                        Chat = no tools · Review = read-only · Assist = ask before mutations · Execute = active tools
                      </div>
                    </div>
                    <select
                      value={aiMode}
                      onChange={(e) => aiPermissionPolicy.setOperatingMode(e.target.value as AIOperatingMode)}
                      className="bg-[#17191C] border border-[#292C30] rounded-lg px-3 py-1.5 text-xs text-[#F5F5F5] outline-none focus:border-[#BCE5F8] cursor-pointer"
                    >
                      <option value="chat">Chat (Conversational only)</option>
                      <option value="assist">Assist (Read + Ask before edits)</option>
                      <option value="execute">Execute (Workspace tool actions)</option>
                      <option value="review">Review (Read-only inspection)</option>
                    </select>
                  </div>
                  <label className="flex items-center justify-between pt-2 border-t border-[#292C30] cursor-pointer">
                    <span className="text-xs text-[#F5F5F5]">Require explicit user approval for Ask First operations</span>
                    <input
                      type="checkbox"
                      checked={aiRequireApproval}
                      onChange={(e) => aiPermissionPolicy.setRequireApproval(e.target.checked)}
                      className="w-4 h-4 accent-[#BCE5F8] cursor-pointer"
                    />
                  </label>
                </div>

                {/* AI Tool Categories */}
                <div className="divide-y divide-[#292C30] border border-[#292C30] rounded-lg bg-[#101214]">
                  {(
                    [
                      ["read", "Read canvas, apps, windows & active course", "read"],
                      ["open_focus", "Open / focus applications and canvas objects", "open_focus"],
                      ["create_modify", "Create or modify canvas notes, shapes, frames", "create_modify"],
                      ["move_multiple", "Move or resize objects and windows", "move_multiple"],
                      ["change_app_data", "Create or modify application study data", "change_app_data"],
                      ["delete_data", "Delete workspace or study data", "delete_data"],
                      ["external_share", "External sharing / network exfiltration", "external_share"],
                      ["system_command", "System / shell commands", "system_command"],
                    ] as Array<[AIToolPermissionCategory, string, string]>
                  ).map(([cat, label]) => {
                    const locked = aiPermissionPolicy.isCategoryLocked(cat);
                    const decision = aiPolicy[cat];
                    return (
                      <div key={cat} className="flex items-center justify-between gap-4 p-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-[#F5F5F5]">{label}</span>
                            <span className="text-[10px] font-mono text-[#8B929C]">{cat}</span>
                            {locked && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-rose-300">
                                <Lock size={10} /> Locked Deny
                              </span>
                            )}
                          </div>
                        </div>
                        {locked ? (
                          renderBadge("error", "Deny")
                        ) : (
                          <select
                            value={decision}
                            onChange={(e) =>
                              aiPermissionPolicy.setCategoryDecision(cat, e.target.value as AIPolicyDecision)
                            }
                            className="bg-[#17191C] border border-[#292C30] rounded-lg px-2.5 py-1 text-xs text-[#F5F5F5] outline-none focus:border-[#BCE5F8] cursor-pointer"
                          >
                            <option value="allow">Allow</option>
                            <option value="ask_first">Ask First</option>
                            <option value="deny">Deny</option>
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="border-b pb-2 pt-2" style={{ borderColor: THEME.borders }}>
                  <h4 className="text-xs font-semibold text-[#F5F5F5]">Module Bridge Scopes</h4>
                </div>

                <div className="divide-y divide-[#292C30] border border-[#292C30] rounded-lg bg-[#101214]">
                  {rules.map((rule) => (
                    <div key={rule.scope} className="flex items-center justify-between gap-4 p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[#F5F5F5]">{rule.label}</span>
                          <span className="text-[10px] font-mono text-[#8B929C]">{rule.scope}</span>
                          {!rule.mutable && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-[#8B929C]">
                              <Lock size={10} /> Stage 1 Locked
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#8B929C] mt-0.5">{rule.description}</div>
                      </div>
                      {rule.mutable ? (
                        <select
                          value={rule.state}
                          onChange={(e) =>
                            permissionManager.setRuleState(
                              rule.scope,
                              e.target.value as PermissionState
                            )
                          }
                          className="bg-[#17191C] border border-[#292C30] rounded-lg px-2.5 py-1 text-xs text-[#F5F5F5] outline-none focus:border-[#BCE5F8] cursor-pointer"
                        >
                          <option value="allow">Allow</option>
                          <option value="ask_first">Ask First</option>
                          <option value="deny">Deny</option>
                        </select>
                      ) : (
                        renderBadge(
                          rule.state === "unavailable" ? "requires_configuration" : "error",
                          rule.state === "unavailable" ? "Unavailable (Stage 2)" : "Denied"
                        )
                      )}
                    </div>
                  ))}
                </div>

                <div className="divide-y divide-[#292C30] border-t border-b border-[#292C30]">
                  <label className="flex items-center justify-between py-3 cursor-pointer">
                    <div>
                      <div className="text-xs font-medium text-[#F5F5F5]">
                        Restrict External Communication
                      </div>
                      <div className="text-[11px] text-[#8B929C]">
                        Block external cross-origin requests beyond verified host handshakes
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={externalRestricted}
                      onChange={(e) => permissionManager.setExternalCommRestricted(e.target.checked)}
                      className="w-4 h-4 accent-[#BCE5F8] cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between py-3 cursor-pointer">
                    <div>
                      <div className="text-xs font-medium text-[#F5F5F5]">Allow Guest Edits</div>
                      <div className="text-[11px] text-[#8B929C]">
                        Permit connected collaborators to edit board elements
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.permissions.allowGuestEdits}
                      onChange={(e) =>
                        handleUpdate("permissions", { allowGuestEdits: e.target.checked })
                      }
                      className="w-4 h-4 accent-[#BCE5F8] cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            )}

            {activeTab === "storage" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: THEME.borders }}>
                  <div>
                    <h3 className="text-sm font-semibold text-[#F5F5F5]">Storage & Persistence</h3>
                    <p className="text-xs text-[#8B929C] mt-0.5">
                      Manage browser persistence drivers and run real storage round-trip verification.
                    </p>
                  </div>
                  <button
                    onClick={handleVerifyStorage}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#202327] hover:bg-[#292C30] text-[#F5F5F5] border border-[#292C30] cursor-pointer"
                  >
                    <RefreshCw size={13} className="text-[#BCE5F8]" />
                    Verify Storage R/W
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#8B929C] mb-1.5">
                    Persistence Driver
                  </label>
                  <select
                    value={settings.storage.persistenceDriver}
                    onChange={(e) =>
                      handleUpdate("storage", { persistenceDriver: e.target.value as any })
                    }
                    className="w-full max-w-md bg-[#101214] border border-[#292C30] rounded-lg px-3 py-2 text-xs text-[#F5F5F5] outline-none"
                  >
                    <option value="localStorage">localStorage + Server SQLite Sync</option>
                    <option value="indexedDb">IndexedDB High Capacity</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-lg border border-[#292C30] bg-[#101214] text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#F5F5F5]">Last Storage Probe</span>
                    {storageProbe
                      ? renderBadge(
                          storageProbe.available && storageProbe.writable ? "healthy" : "error",
                          storageProbe.available && storageProbe.writable ? "Verified R/W" : "Failed"
                        )
                      : renderBadge("unverified")}
                  </div>
                  {storageProbe && (
                    <div className="text-[11px] text-[#8B929C] tabular-nums">
                      Keys in localStorage: {storageProbe.keyCount} · Checked at{" "}
                      {formatTime(storageProbe.verifiedAt)}
                      {storageProbe.error ? ` · ${storageProbe.error}` : ""}
                    </div>
                  )}
                </div>

                <div className="border border-[#292C30] rounded-lg bg-[#101214] p-3 text-xs space-y-1.5">
                  <div className="text-[11px] font-medium text-[#8B929C]">Managed Storage Keys</div>
                  {Object.entries(STORAGE_KEYS).map(([name, key]) => (
                    <div key={key} className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-[#8B929C]">{name}</span>
                      <span className="text-[#F5F5F5]">{key}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "diagnostics" && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: THEME.borders }}>
                  <div>
                    <h3 className="text-sm font-semibold text-[#F5F5F5]">
                      System Diagnostics & Execution Log
                    </h3>
                    <p className="text-xs text-[#8B929C] mt-0.5">
                      Live verified subsystem checks and bounded bridge/lifecycle execution trace.
                    </p>
                  </div>
                  <button
                    onClick={() => diagnosticsManager.verifyAll()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#BCE5F8] text-[#0B0D0F] hover:opacity-90 cursor-pointer whitespace-nowrap"
                  >
                    <RefreshCw size={12} />
                    Run Verification
                  </button>
                </div>

                {/* Subsystem Health Table */}
                <div className="overflow-x-auto border border-[#292C30] rounded-lg bg-[#101214]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#292C30] text-[11px] text-[#8B929C]">
                        <th className="py-2 px-3 font-medium">Subsystem</th>
                        <th className="py-2 px-3 font-medium">Status</th>
                        <th className="py-2 px-3 font-medium">Measurement</th>
                        <th className="py-2 px-3 font-medium text-right">Verified At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#292C30]">
                      {metrics.map((metric) => (
                        <tr key={metric.id} className="hover:bg-[#17191C]">
                          <td className="py-2 px-3 font-medium text-[#F5F5F5]">{metric.name}</td>
                          <td className="py-2 px-3">{renderBadge(metric.status)}</td>
                          <td className="py-2 px-3 text-[11px] text-[#8B929C]">
                            <span className="text-[#F5F5F5]">{String(metric.value)}</span>
                            {metric.message ? ` — ${metric.message}` : ""}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[11px] text-[#8B929C] tabular-nums whitespace-nowrap">
                            {formatTime(metric.timestamp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Stage 2 AI Execution Monitor */}
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-[#F5F5F5]">
                      AI Execution Monitor ({aiToolRegistry.listTools(false).length} active tools)
                    </h4>
                    <div className="text-[11px] font-mono text-[#8B929C] tabular-nums">
                      Runs: {aiSummary.totalRequests} · Completed: {aiSummary.completedRequests} · Cancelled: {aiSummary.cancelledRequests} · Failed: {aiSummary.failedRequests}
                      {aiSummary.avgFirstTokenLatencyMs !== null ? ` · Avg TTFT: ${aiSummary.avgFirstTokenLatencyMs}ms` : ""} · Tokens In/Out: {aiSummary.totalInputTokens}/{aiSummary.totalOutputTokens}
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-48 overflow-y-auto border border-[#292C30] rounded-lg bg-[#101214]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-[#101214]">
                        <tr className="border-b border-[#292C30] text-[11px] text-[#8B929C]">
                          <th className="py-1.5 px-3 font-medium">Model</th>
                          <th className="py-1.5 px-3 font-medium">Status</th>
                          <th className="py-1.5 px-3 font-medium">TTFT / Dur</th>
                          <th className="py-1.5 px-3 font-medium">Tokens (In/Out)</th>
                          <th className="py-1.5 px-3 font-medium text-right">Speed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#292C30]">
                        {aiRuns.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-3 px-3 text-center text-[#8B929C]">
                              No AI inference runs recorded yet.
                            </td>
                          </tr>
                        ) : (
                          aiRuns.slice(0, 20).map((run) => (
                            <tr key={run.requestId} className="hover:bg-[#17191C]">
                              <td className="py-1.5 px-3 font-mono text-[#F5F5F5]">{run.model}</td>
                              <td className="py-1.5 px-3">
                                {run.cancelled
                                  ? renderBadge("warning", "Cancelled")
                                  : run.errorCode
                                  ? renderBadge("error", run.errorCode)
                                  : renderBadge("success", "OK")}
                              </td>
                              <td className="py-1.5 px-3 font-mono text-[11px] text-[#8B929C] tabular-nums">
                                {run.firstTokenLatencyMs !== null ? `${run.firstTokenLatencyMs}ms` : "—"} / {run.durationMs}ms
                              </td>
                              <td className="py-1.5 px-3 font-mono text-[11px] text-[#8B929C] tabular-nums">
                                {run.inputTokens}/{run.outputTokens}
                                {run.estimatedMetrics ? " (est.)" : ""}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono text-[11px] text-[#8B929C] tabular-nums">
                                {run.tokensPerSec ? `${run.tokensPerSec} tok/s` : "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Execution Log */}
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {(
                        [
                          { id: "all", label: "All" },
                          { id: "info", label: "Information" },
                          { id: "success", label: "Success" },
                          { id: "warning", label: "Warning" },
                          { id: "error", label: "Error" },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setLogFilter(f.id)}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                            logFilter === f.id
                              ? "bg-[#202327] text-[#F5F5F5] border border-[#292C30]"
                              : "text-[#8B929C] hover:text-[#F5F5F5]"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => diagnosticsManager.clearExecutionLog()}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] text-[#8B929C] hover:text-[#F5F5F5] hover:bg-[#202327] cursor-pointer"
                    >
                      <Trash2 size={12} />
                      Clear Log
                    </button>
                  </div>

                  <div className="overflow-x-auto max-h-64 overflow-y-auto border border-[#292C30] rounded-lg bg-[#101214]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-[#101214] z-10">
                        <tr className="border-b border-[#292C30] text-[11px] text-[#8B929C]">
                          <th className="py-2 px-3 font-medium">Time</th>
                          <th className="py-2 px-3 font-medium">Source → Target</th>
                          <th className="py-2 px-3 font-medium">Operation</th>
                          <th className="py-2 px-3 font-medium">Status</th>
                          <th className="py-2 px-3 font-medium text-right">Duration</th>
                          <th className="py-2 px-3 font-medium">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#292C30]">
                        {execLogs.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-4 px-3 text-center text-[#8B929C]">
                              No execution log records match this filter.
                            </td>
                          </tr>
                        ) : (
                          execLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-[#17191C]">
                              <td className="py-2 px-3 font-mono text-[11px] text-[#8B929C] tabular-nums whitespace-nowrap">
                                {formatTime(log.timestamp)}
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px] text-[#8B929C] whitespace-nowrap">
                                {log.source} → {log.target}
                              </td>
                              <td className="py-2 px-3 font-mono text-[#F5F5F5] whitespace-nowrap">
                                {log.operation}
                              </td>
                              <td className="py-2 px-3">{renderBadge(log.status)}</td>
                              <td className="py-2 px-3 text-right font-mono text-[11px] text-[#8B929C] tabular-nums whitespace-nowrap">
                                {log.durationMs}ms
                              </td>
                              <td className="py-2 px-3 text-[11px] text-[#8B929C] max-w-xs truncate">
                                {log.error ? `${log.message} (${log.error})` : log.message}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
