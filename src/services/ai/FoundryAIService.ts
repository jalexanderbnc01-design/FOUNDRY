/**
 * Foundry Stage 2 — Central AI Engine Orchestrator (Phases 06–11)
 * Connects AI Chat UI -> Communication Bridge -> Foundry AI Service ->
 * Context Manager -> Tool Registry & Permission Policy -> Ollama Provider Adapter.
 */
import { communicationBridge } from "../CommunicationBridge";
import { eventBus } from "../EventBus";
import { sharedContextManager } from "../SharedContextManager";
import { aiProviderManager } from "./AIProviderManager";
import { conversationManager } from "./ConversationManager";
import { aiContextManager, estimateTokens } from "./AIContextManager";
import { aiPermissionPolicy } from "./AIPermissionPolicy";
import { aiToolRegistry, ToolError } from "./AIToolRegistry";
import { aiExecutionMonitor } from "./AIExecutionMonitor";
import { ragEngine } from "../rag/RAGEngine";
import { aiMemoryManager } from "./AIMemoryManager";
import {
  AIActivityStage,
  AIActivityStep,
  AIErrorCode,
  AIOperatingMode,
  AIToolCallRecord,
  ChatMessage,
  ContextAttachment,
  OllamaSettings,
  PendingApproval,
} from "./types";

const MAX_TOOL_ROUNDS = 5;

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function summarizeToolAction(toolName: string, args: Record<string, any>): string {
  switch (toolName) {
    case "canvas.create_note":
      return `Create sticky note: "${String(args.content || "").slice(0, 60)}"`;
    case "canvas.create_text":
      return `Create text object: "${String(args.content || "").slice(0, 60)}"`;
    case "canvas.create_shape":
      return `Create ${args.shapeType || "shape"}${args.content ? ` ("${String(args.content).slice(0, 40)}")` : ""}`;
    case "canvas.create_frame":
      return `Create frame "${String(args.title || "Untitled")}"`;
    case "canvas.connect_objects":
      return `Connect ${args.fromId} → ${args.toId}`;
    case "canvas.move_object":
      return `Move object ${args.id} to (${Math.round(args.x)}, ${Math.round(args.y)})`;
    case "canvas.focus_object":
      return `Focus canvas viewport on ${args.id}`;
    case "app.open":
      return `Open application "${args.appId}"`;
    case "app.close":
      return `Close application "${args.appId}"`;
    case "window.move":
      return `Move window ${args.windowId} to (${args.x}, ${args.y})`;
    case "window.resize":
      return `Resize window ${args.windowId} to ${args.width}×${args.height}`;
    default:
      return `Execute ${toolName}`;
  }
}

function buildSystemPrompt(mode: AIOperatingMode): string {
  const modeGuidance: Record<AIOperatingMode, string> = {
    chat: "Operating mode: CHAT (conversational only; workspace tools are disabled). Answer clearly and concisely.",
    review:
      "Operating mode: REVIEW (read-only analysis). You may inspect canvas/app state with read tools when supported, but never propose mutating changes as executed.",
    assist:
      "Operating mode: ASSIST (collaborative). You can read workspace context and invoke canvas/window/app tools when helpful; mutating operations require user approval.",
    execute:
      "Operating mode: EXECUTE. You can inspect and modify the workspace via available tools; destructive actions remain blocked.",
  };

  return [
    "You are Foundry AI, the integrated workspace assistant inside Foundry & Education Studio.",
    "Be accurate, concise, and helpful. Format technical answers cleanly using Markdown.",
    "Never invent fake workspace objects, tool outputs, course grades, or citations that are not present in context or tool results.",
    "If a requested application lacks programmatic tool support (marked unavailable), clearly inform the user instead of pretending it ran.",
    modeGuidance[mode],
  ].join("\n");
}

interface ActiveGenerationHandle {
  requestId: string;
  conversationId: string;
  assistantMessageId: string;
  controller: AbortController;
}

class FoundryAIServiceImpl {
  private initialized = false;
  private bridgeRegistered = false;
  private activeGenerations: Map<string, ActiveGenerationHandle> = new Map(); // conversationId -> handle
  private listeners: Set<() => void> = new Set();
  private openSettingsCallback: ((tab?: string) => void) | null = null;
  private pushThrottleTimer: number | null = null;

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setOpenSettingsCallback(cb: ((tab?: string) => void) | null) {
    this.openSettingsCallback = cb;
  }

  private broadcastState(immediate = false) {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch {}
    });

    if (immediate) {
      if (this.pushThrottleTimer !== null && typeof window !== "undefined") {
        window.clearTimeout(this.pushThrottleTimer);
        this.pushThrottleTimer = null;
      }
      communicationBridge.pushEventToFrame("education-ai", "ai:state-updated", this.getStateSnapshot());
      return;
    }

    if (this.pushThrottleTimer === null && typeof window !== "undefined") {
      this.pushThrottleTimer = window.setTimeout(() => {
        this.pushThrottleTimer = null;
        communicationBridge.pushEventToFrame("education-ai", "ai:state-updated", this.getStateSnapshot());
      }, 45);
    }
  }

  async initialize(): Promise<void> {
    if (!this.bridgeRegistered) {
      this.registerBridgeOperations();
      this.bridgeRegistered = true;
    }

    if (this.initialized) return;
    this.initialized = true;

    communicationBridge.setAIStatusChecker(() => aiProviderManager.getStatus().connected);

    aiProviderManager.subscribe(() => this.broadcastState(true));
    conversationManager.subscribe(() => this.broadcastState(false));
    aiPermissionPolicy.subscribe(() => this.broadcastState(true));
    aiExecutionMonitor.subscribe(() => this.broadcastState(false));
    sharedContextManager.subscribe(() => this.broadcastState(false));

    await Promise.all([
      aiProviderManager.initialize().catch(() => {}),
      conversationManager.syncFromBackend().catch(() => {}),
      aiExecutionMonitor.syncFromBackend().catch(() => {}),
    ]);

    this.broadcastState(true);
  }

  private registerBridgeOperations() {
    communicationBridge.registerModule("foundry-host", {
      "ai.get_state": () => this.getStateSnapshot(),
      "ai.send_message": (payload) =>
        this.sendMessage({
          text: String(payload?.text || ""),
          conversationId: payload?.conversationId,
          attachments: Array.isArray(payload?.attachments) ? payload.attachments : undefined,
        }),
      "ai.cancel_generation": (payload) =>
        this.cancelGeneration(payload?.conversationId),
      "ai.regenerate": (payload) =>
        this.regenerate(payload?.conversationId, payload?.messageId),
      "ai.edit_and_resend": (payload) =>
        this.editAndResend(
          String(payload?.conversationId || conversationManager.getActive().id),
          String(payload?.messageId || ""),
          String(payload?.text || "")
        ),
      "ai.approve_tool": (payload) =>
        this.approveTool(String(payload?.approvalId || "")),
      "ai.reject_tool": (payload) =>
        this.rejectTool(String(payload?.approvalId || "")),
      "ai.select_model": async (payload) => {
        const model = payload?.model ? String(payload.model) : null;
        await aiProviderManager.selectModel(model);
        const active = conversationManager.getActive();
        conversationManager.updateConversation(active.id, { model });
        this.broadcastState(true);
        return this.getStateSnapshot();
      },
      "ai.set_mode": (payload) => {
        const mode = String(payload?.mode || "assist") as AIOperatingMode;
        aiPermissionPolicy.setOperatingMode(mode);
        const active = conversationManager.getActive();
        conversationManager.updateConversation(active.id, { mode });
        this.broadcastState(true);
        return this.getStateSnapshot();
      },
      "ai.new_conversation": () => {
        const settings = aiProviderManager.getSettings();
        const conv = conversationManager.createConversation({
          mode: aiPermissionPolicy.getOperatingMode(),
          model: settings.selectedModel,
        });
        this.broadcastState(true);
        return conv;
      },
      "ai.select_conversation": (payload) => {
        const conv = conversationManager.selectConversation(String(payload?.conversationId || ""));
        this.broadcastState(true);
        return conv;
      },
      "ai.delete_conversation": (payload) => {
        const ok = conversationManager.deleteConversation(String(payload?.conversationId || ""));
        this.broadcastState(true);
        return { deleted: ok };
      },
      "ai.attach_item": (payload) => {
        const active = conversationManager.getActive();
        if (payload?.kind === "canvas_selection") {
          const att = aiContextManager.createCanvasObjectsAttachment();
          if (!att) {
            return { attached: false, reason: "No canvas objects available to attach." };
          }
          conversationManager.addAttachment(active.id, att);
        } else if (payload?.attachment) {
          conversationManager.addAttachment(active.id, payload.attachment as ContextAttachment);
        } else if (payload?.title && payload?.content) {
          conversationManager.addAttachment(active.id, {
            id: genId("att"),
            kind: payload.kind || "file",
            title: String(payload.title).slice(0, 120),
            subtitle: payload.subtitle ? String(payload.subtitle).slice(0, 120) : "Attached context",
            content: String(payload.content),
            mimeType: payload.mimeType,
            removable: true,
          });
        }
        this.broadcastState(true);
        return this.getStateSnapshot();
      },
      "ai.remove_context_item": (payload) => {
        const active = conversationManager.getActive();
        conversationManager.removeAttachmentOrDisableContext(active.id, String(payload?.contextId || ""));
        this.broadcastState(true);
        return this.getStateSnapshot();
      },
      "ai.inspect_context": () => {
        const active = conversationManager.getActive();
        const settings = aiProviderManager.getSettings();
        return aiContextManager.inspectCurrentContext(active, {
          maxContextTokens: settings.numCtx,
          outputReserveTokens: settings.numPredict,
        });
      },
      "ai.test_connection": async () => {
        const probe = await aiProviderManager.testAndDiscover();
        this.broadcastState(true);
        return probe;
      },
      "ai.refresh_models": async () => {
        const models = await aiProviderManager.refreshModels();
        this.broadcastState(true);
        return { models };
      },
      "ai.update_ollama_settings": async (payload) => {
        const next = await aiProviderManager.updateSettings(payload as Partial<OllamaSettings>);
        this.broadcastState(true);
        return next;
      },
      "ai.list_tools": () => aiToolRegistry.listTools(true),
      "ai.get_diagnostics": () => ({
        providerStatus: aiProviderManager.getStatus(),
        summary: aiExecutionMonitor.getSummary(),
        runs: aiExecutionMonitor.getRuns().slice(0, 20),
        tools: aiToolRegistry.listTools(true).map((t) => ({
          name: t.name,
          category: t.category,
          available: t.available,
        })),
      }),
      "ai.open_settings": (payload) => {
        this.openSettingsCallback?.(payload?.tab || "ollama");
        return { opened: true, tab: payload?.tab || "ollama" };
      },
    });
  }

  getStateSnapshot() {
    const settings = aiProviderManager.getSettings();
    const providerStatus = aiProviderManager.getStatus();
    const activeConv = conversationManager.getActive();
    const activeHandle = this.activeGenerations.get(activeConv.id);
    const contextItems = aiContextManager.collectCandidateContext(activeConv);
    const contextBudget = aiContextManager.inspectCurrentContext(activeConv, {
      maxContextTokens: settings.numCtx,
      outputReserveTokens: settings.numPredict,
    });

    return {
      providerStatus,
      settings,
      models: aiProviderManager.getModels(),
      runningModels: aiProviderManager.getRunningModels(),
      operatingMode: aiPermissionPolicy.getOperatingMode(),
      activeConversation: activeConv,
      conversations: conversationManager.list().map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt,
        messageCount: c.messages.length,
        mode: c.mode,
      })),
      contextItems,
      contextBudget,
      isGenerating: Boolean(activeHandle),
      activeRequestId: activeHandle?.requestId || null,
      executionSummary: aiExecutionMonitor.getSummary(),
    };
  }

  async sendMessage(params: {
    text: string;
    conversationId?: string;
    attachments?: ContextAttachment[];
  }): Promise<{ started: boolean; conversationId: string; requestId?: string; error?: string }> {
    const trimmed = (params.text || "").trim();
    if (!trimmed) {
      return { started: false, conversationId: conversationManager.getActive().id, error: "Message cannot be empty." };
    }

    const conv = params.conversationId
      ? conversationManager.get(params.conversationId) || conversationManager.getActive()
      : conversationManager.getActive();

    // Cancel any existing generation on this conversation first
    if (this.activeGenerations.has(conv.id)) {
      await this.cancelGeneration(conv.id);
    }

    if (params.attachments?.length) {
      for (const att of params.attachments) {
        conversationManager.addAttachment(conv.id, att);
      }
    }

    const refreshedConv = conversationManager.get(conv.id) || conv;
    const contextItems = aiContextManager.collectCandidateContext(refreshedConv);

    // 1. Append user message
    conversationManager.appendMessage(conv.id, {
      role: "user",
      content: trimmed,
      status: "completed",
      attachments: contextItems.filter((c) => c.kind === "file" || c.kind === "canvas_selection" || c.kind === "note"),
    });

    // 2. Run assistant generation asynchronously (returning handle info immediately so UI stays snappy)
    const requestId = genId("ai_req");
    void this.executeAssistantTurn(conv.id, trimmed, requestId);

    return { started: true, conversationId: conv.id, requestId };
  }

  async regenerate(conversationId?: string, messageId?: string) {
    const conv = conversationId
      ? conversationManager.get(conversationId) || conversationManager.getActive()
      : conversationManager.getActive();

    if (this.activeGenerations.has(conv.id)) {
      await this.cancelGeneration(conv.id);
    }

    const msgs = conv.messages || [];
    let targetIdx = messageId ? msgs.findIndex((m) => m.id === messageId) : msgs.length - 1;
    if (targetIdx < 0) targetIdx = msgs.length - 1;
    if (targetIdx < 0) return { started: false };

    // Walk backward to find preceding user message
    let userIdx = -1;
    for (let i = targetIdx; i >= 0; i--) {
      if (msgs[i].role === "user") {
        userIdx = i;
        break;
      }
    }
    if (userIdx === -1) return { started: false, error: "No user prompt found to regenerate." };

    const promptText = msgs[userIdx].content;
    // Truncate everything after that user message
    conversationManager.truncateFromMessage(conv.id, msgs[userIdx].id, false);
    const requestId = genId("ai_req");
    void this.executeAssistantTurn(conv.id, promptText, requestId);
    return { started: true, conversationId: conv.id, requestId };
  }

  async editAndResend(conversationId: string, messageId: string, newText: string) {
    const trimmed = (newText || "").trim();
    if (!trimmed) return { started: false, error: "Edited message cannot be empty." };

    const conv = conversationManager.get(conversationId) || conversationManager.getActive();
    if (this.activeGenerations.has(conv.id)) {
      await this.cancelGeneration(conv.id);
    }

    const target = conv.messages.find((m) => m.id === messageId && m.role === "user");
    if (!target) return { started: false, error: "User message not found." };

    conversationManager.truncateFromMessage(conv.id, messageId, true);
    return this.sendMessage({ text: trimmed, conversationId: conv.id });
  }

  async cancelGeneration(conversationId?: string): Promise<{ cancelled: boolean }> {
    const targetId = conversationId || conversationManager.getActive().id;
    const handle = this.activeGenerations.get(targetId);
    aiPermissionPolicy.cancelPendingForConversation(targetId);

    if (!handle) {
      return { cancelled: false };
    }

    handle.controller.abort();
    const settings = aiProviderManager.getSettings();
    await aiProviderManager.getAdapter().cancelGeneration(handle.requestId, settings.connectionMode);
    this.activeGenerations.delete(targetId);
    this.broadcastState(true);
    return { cancelled: true };
  }

  approveTool(approvalId: string): { resolved: boolean } {
    const res = aiPermissionPolicy.resolveApproval(approvalId, true);
    this.broadcastState(true);
    return { resolved: Boolean(res) };
  }

  rejectTool(approvalId: string): { resolved: boolean } {
    const res = aiPermissionPolicy.resolveApproval(approvalId, false);
    this.broadcastState(true);
    return { resolved: Boolean(res) };
  }

  private async executeAssistantTurn(conversationId: string, userPrompt: string, requestId: string) {
    const convBefore = conversationManager.get(conversationId);
    if (!convBefore) return;

    const settings = aiProviderManager.getSettings();
    const operatingMode = aiPermissionPolicy.getOperatingMode();
    const startTime = Date.now();
    const controller = new AbortController();

    const activity: AIActivityStep[] = [];
    const addActivity = (stage: AIActivityStage, label: string, detail?: string) => {
      activity.push({
        id: genId("act"),
        stage,
        label,
        detail,
        timestamp: Date.now(),
      });
    };

    const failEarly = (code: AIErrorCode, message: string, guidance?: string) => {
      addActivity("failed", message, guidance);
      const durationMs = Date.now() - startTime;
      const errMsg = conversationManager.appendMessage(conversationId, {
        role: "assistant",
        content: "",
        status: "error",
        model: convBefore.model || settings.selectedModel,
        activity: [...activity],
        error: { code, message, guidance, retryable: true },
        metrics: {
          requestId,
          model: convBefore.model || settings.selectedModel || "unselected",
          provider: "ollama",
          startTime,
          firstTokenLatencyMs: null,
          durationMs,
          inputTokens: 0,
          outputTokens: 0,
          tokensPerSec: null,
          estimated: true,
        },
      });

      aiExecutionMonitor.finishRun({
        requestId,
        conversationId,
        provider: "ollama",
        model: errMsg.model || "unselected",
        startTime,
        firstTokenLatencyMs: null,
        durationMs,
        inputTokens: 0,
        outputTokens: 0,
        tokensPerSec: null,
        estimatedMetrics: true,
        toolCallsCount: 0,
        cancelled: false,
        errorCode: code,
        errorMessage: message,
      });

      this.broadcastState(true);
    };

    // 1. Check Ollama enabled & live probe if currently unverified/disconnected
    if (!settings.enabled) {
      failEarly(
        "OLLAMA_UNREACHABLE",
        "Ollama provider is disabled in Foundry Settings.",
        "Enable Ollama in Settings → Ollama & AI Engine."
      );
      return;
    }

    let status = aiProviderManager.getStatus();
    if (!status.connected) {
      addActivity("connecting", `Checking Ollama connection (${settings.baseUrl})...`);
      await aiProviderManager.testAndDiscover();
      status = aiProviderManager.getStatus();
      if (!status.connected) {
        failEarly(
          status.errorCode || "OLLAMA_UNREACHABLE",
          status.error || `Cannot reach Ollama at ${settings.baseUrl}.`,
          status.guidance || "Start local Ollama (`ollama serve`) or configure Endpoint in Settings."
        );
        return;
      }
    }

    const activeModel = convBefore.model || aiProviderManager.getSettings().selectedModel;
    if (!activeModel) {
      failEarly(
        "MODEL_NOT_SELECTED",
        "No Ollama model is selected.",
        "Install a model (e.g. `ollama pull qwen2.5:7b`) and select it in the model menu or Settings."
      );
      return;
    }

    // 2. Prepare context & check token budget
    addActivity("preparing_context", "Assembling workspace & conversation context...");
    const systemPrompt = buildSystemPrompt(operatingMode);
    // Exclude the just-appended user message from history because preparePromptWithBudget appends userPrompt cleanly
    const convForBudget = {
      ...convBefore,
      messages: convBefore.messages.slice(0, -1),
    };

    const prepared = aiContextManager.preparePromptWithBudget({
      conversation: convForBudget,
      userPrompt,
      systemPrompt,
      budget: {
        maxContextTokens: settings.numCtx,
        outputReserveTokens: settings.numPredict,
      },
    });

    if (prepared.breakdown.overflow) {
      failEarly(
        "CONTEXT_OVERFLOW",
        `Prompt exceeds configured context window (${prepared.breakdown.totalEstimatedInputTokens} est. tokens > ${prepared.breakdown.availableInputTokens} available input tokens).`,
        "Shorten your prompt, remove attached context cards, or increase num_ctx in Settings → Ollama & AI Engine."
      );
      return;
    }

    // 3. Append streaming placeholder assistant message
    const assistantMsg = conversationManager.appendMessage(conversationId, {
      role: "assistant",
      content: "",
      status: "streaming",
      model: activeModel,
      activity: [...activity],
      sources: prepared.sources,
      toolCalls: [],
      approval: null,
      error: null,
    });

    this.activeGenerations.set(conversationId, {
      requestId,
      conversationId,
      assistantMessageId: assistantMsg.id,
      controller,
    });
    aiExecutionMonitor.startRun(requestId);
    this.broadcastState(true);

    // 4. Determine tool definitions based on operating mode & model capabilities
    let toolsPayload: any[] | undefined;
    if (operatingMode !== "chat") {
      let modelCaps = aiProviderManager.getCachedModelCapabilities(activeModel);
      if (!modelCaps) {
        try {
          const inspected = await aiProviderManager.inspectModel(activeModel);
          modelCaps = {
            capabilities: inspected.capabilities,
            supportsTools: inspected.supportsTools,
            supportsVision: inspected.supportsVision,
            supportsThinking: inspected.supportsThinking,
            contextLength: inspected.contextLength,
            details: inspected.details,
          };
        } catch {
          modelCaps = null;
        }
      }

      if (modelCaps && !modelCaps.supportsTools) {
        addActivity(
          "loading_model",
          `Model "${activeModel}" does not advertise tool calling; running text completion.`
        );
      } else {
        const availableTools = aiToolRegistry.listTools(false).filter((t) => {
          if (operatingMode === "review") return t.category === "read";
          return true;
        });
        if (availableTools.length > 0) {
          toolsPayload = aiToolRegistry.getOllamaTools(new Set(availableTools.map((t) => t.name)));
        }
      }
    }

    // 4.5. Stage 3 — RAG & Persistent AI Memory Injection
    const activeCourse = sharedContextManager.getContext().activeCourseId;
    const ragResult = await ragEngine.retrieve(userMessage.content, { courseId: activeCourse || undefined });
    const relevantMemories = await aiMemoryManager.getRelevantMemories({ courseId: activeCourse || undefined });
    const memoryText = aiMemoryManager.formatMemoriesForPrompt(relevantMemories);

    let augmentedSystem = systemPrompt;
    if (memoryText) {
      augmentedSystem += `\n\n${memoryText}`;
    }
    if (ragResult.contextBlock) {
      augmentedSystem += `\n\n${ragResult.contextBlock}`;
    }

    // 5. Bounded Ollama tool-calling & streaming loop
    let llmMessages: Array<{
      role: string;
      content: string;
      tool_calls?: any[];
      tool_name?: string;
    }> = [...prepared.messages];

    if (augmentedSystem !== systemPrompt) {
      if (llmMessages.length > 0 && llmMessages[0].role === "system") {
        llmMessages[0] = { ...llmMessages[0], content: augmentedSystem };
      } else {
        llmMessages.unshift({ role: "system", content: augmentedSystem });
      }
    }

    let accumulatedContent = "";
    const toolRecords: AIToolCallRecord[] = [];
    let firstTokenLatencyMs: number | null = null;
    let totalPromptEvalTokens = 0;
    let totalEvalTokens = 0;
    let sawRealPromptTokens = false;
    let sawRealEvalTokens = false;
    let lastTokensPerSec: number | null = null;
    let streamError: { code: AIErrorCode; message: string; guidance?: string } | null = null;
    let cancelled = false;

    const adapter = aiProviderManager.getAdapter();

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        if (controller.signal.aborted) {
          cancelled = true;
          break;
        }

        addActivity(
          "generating",
          round === 0
            ? `Streaming response from ${activeModel}...`
            : `Continuing response after tool execution (step ${round + 1})...`
        );
        conversationManager.updateMessage(conversationId, assistantMsg.id, {
          activity: [...activity],
          status: "streaming",
        });
        this.broadcastState(true);

        let roundText = "";
        let roundToolCalls: Array<{ id?: string; function: { name: string; arguments: Record<string, any> } }> = [];
        let roundError: { code: AIErrorCode; message: string; guidance?: string } | null = null;

        await adapter.streamChat(
          {
            requestId: round === 0 ? requestId : `${requestId}_r${round}`,
            conversationId,
            model: activeModel,
            messages: llmMessages,
            tools: toolsPayload,
            settings: aiProviderManager.getSettings(),
          },
          {
            onChunk: (chunk) => {
              if (!chunk) return;
              if (firstTokenLatencyMs === null) {
                firstTokenLatencyMs = Date.now() - startTime;
              }
              roundText += chunk;
              accumulatedContent += chunk;
              conversationManager.updateMessage(
                conversationId,
                assistantMsg.id,
                { content: accumulatedContent },
                false
              );
              this.broadcastState(false);
            },
            onToolCalls: (tcs) => {
              roundToolCalls = roundToolCalls.concat(tcs);
            },
            onDone: (info) => {
              if (typeof info.metrics?.promptEvalCount === "number") {
                totalPromptEvalTokens += info.metrics.promptEvalCount;
                sawRealPromptTokens = true;
              }
              if (typeof info.metrics?.evalCount === "number") {
                totalEvalTokens += info.metrics.evalCount;
                sawRealEvalTokens = true;
              }
              if (typeof info.metrics?.tokensPerSec === "number") {
                lastTokensPerSec = info.metrics.tokensPerSec;
              }
            },
            onError: (err) => {
              roundError = err;
            },
          },
          controller.signal
        );

        if (controller.signal.aborted || roundError?.code === "CANCELLED") {
          cancelled = true;
          break;
        }

        if (roundError) {
          // Graceful retry without tools if model rejects tools at runtime despite /api/show
          if (roundError.code === "TOOLS_UNSUPPORTED" && toolsPayload) {
            addActivity("loading_model", `${activeModel} rejected tool schemas — retrying without tools`);
            toolsPayload = undefined;
            continue;
          }
          streamError = roundError;
          break;
        }

        if (roundToolCalls.length === 0) {
          break;
        }

        // Record assistant tool-call message for next turn
        llmMessages.push({
          role: "assistant",
          content: roundText,
          tool_calls: roundToolCalls,
        });

        // Execute each tool sequentially with validation & permission enforcement
        for (const tc of roundToolCalls) {
          if (controller.signal.aborted) {
            cancelled = true;
            break;
          }

          const rawName = tc.function?.name || "unknown";
          const rawArgs = tc.function?.arguments || {};
          addActivity("requesting_tool", `Tool requested: ${rawName}`);

          const toolDef = aiToolRegistry.getTool(rawName);
          if (!toolDef) {
            const rec: AIToolCallRecord = {
              id: tc.id || genId("tc"),
              toolName: rawName,
              arguments: rawArgs,
              status: "failed",
              error: `Unknown tool "${rawName}"`,
            };
            toolRecords.push(rec);
            llmMessages.push({
              role: "tool",
              tool_name: rawName,
              content: JSON.stringify({ ok: false, errorCode: "UNKNOWN_OPERATION", error: rec.error }),
            });
            continue;
          }

          if (!toolDef.available) {
            const rec: AIToolCallRecord = {
              id: tc.id || genId("tc"),
              toolName: toolDef.name,
              arguments: rawArgs,
              status: "unavailable",
              error: toolDef.unavailableReason || "Tool unavailable",
            };
            toolRecords.push(rec);
            llmMessages.push({
              role: "tool",
              tool_name: toolDef.name,
              content: JSON.stringify({
                ok: false,
                errorCode: "UNAVAILABLE_OPERATION",
                error: rec.error,
              }),
            });
            continue;
          }

          const validation = aiToolRegistry.validateArguments(toolDef, rawArgs);
          if (!validation.valid) {
            const rec: AIToolCallRecord = {
              id: tc.id || genId("tc"),
              toolName: toolDef.name,
              arguments: rawArgs,
              status: "failed",
              error: validation.errors.join(" "),
            };
            toolRecords.push(rec);
            llmMessages.push({
              role: "tool",
              tool_name: toolDef.name,
              content: JSON.stringify({
                ok: false,
                errorCode: "VALIDATION_ERROR",
                error: rec.error,
              }),
            });
            continue;
          }

          const evalRes = aiPermissionPolicy.evaluateTool(toolDef.category);
          if (evalRes.decision === "deny") {
            const rec: AIToolCallRecord = {
              id: tc.id || genId("tc"),
              toolName: toolDef.name,
              arguments: validation.sanitizedArgs,
              status: "denied",
              error: evalRes.reason || "Denied by permission policy",
            };
            toolRecords.push(rec);
            addActivity("failed", `Denied ${toolDef.name}`, rec.error);
            llmMessages.push({
              role: "tool",
              tool_name: toolDef.name,
              content: JSON.stringify({
                ok: false,
                errorCode: "PERMISSION_DENIED",
                error: rec.error,
              }),
            });
            continue;
          }

          if (evalRes.decision === "ask_first") {
            const summary = summarizeToolAction(toolDef.name, validation.sanitizedArgs);
            const { approval, promise } = aiPermissionPolicy.requestApproval({
              conversationId,
              requestId,
              toolName: toolDef.name,
              validatedArgs: validation.sanitizedArgs,
              category: toolDef.category,
              summary,
            });

            addActivity("awaiting_approval", `Awaiting user approval for ${toolDef.name}`, summary);
            conversationManager.updateMessage(
              conversationId,
              assistantMsg.id,
              {
                status: "awaiting_approval",
                approval,
                activity: [...activity],
                toolCalls: [...toolRecords],
              },
              true
            );
            this.broadcastState(true);

            const approved = await promise;
            if (controller.signal.aborted) {
              cancelled = true;
              break;
            }

            const resolvedApproval: PendingApproval = {
              ...approval,
              status: approved ? "approved" : "rejected",
            };
            conversationManager.updateMessage(
              conversationId,
              assistantMsg.id,
              {
                status: "streaming",
                approval: resolvedApproval,
              },
              false
            );

            if (!approved) {
              const rec: AIToolCallRecord = {
                id: tc.id || genId("tc"),
                toolName: toolDef.name,
                arguments: validation.sanitizedArgs,
                status: "rejected",
                error: "User rejected operation.",
              };
              toolRecords.push(rec);
              addActivity("failed", `Rejected ${toolDef.name} by user`);
              llmMessages.push({
                role: "tool",
                tool_name: toolDef.name,
                content: JSON.stringify({
                  ok: false,
                  errorCode: "PERMISSION_DENIED",
                  error: "User rejected this operation.",
                }),
              });
              continue;
            }
          }

          // Execute validated & permitted tool
          const toolT0 = Date.now();
          addActivity("executing_tool", `Executing ${toolDef.name}...`);
          conversationManager.updateMessage(conversationId, assistantMsg.id, {
            activity: [...activity],
          });
          this.broadcastState(true);

          try {
            const toolResult = await aiToolRegistry.executeValidated(toolDef.name, validation.sanitizedArgs);
            const toolDur = Date.now() - toolT0;
            const rec: AIToolCallRecord = {
              id: tc.id || genId("tc"),
              toolName: toolDef.name,
              arguments: validation.sanitizedArgs,
              status: "executed",
              result: toolResult,
              durationMs: toolDur,
            };
            toolRecords.push(rec);
            addActivity("receiving_result", `Completed ${toolDef.name} (${toolDur}ms)`);
            llmMessages.push({
              role: "tool",
              tool_name: toolDef.name,
              content: JSON.stringify({ ok: true, result: toolResult }),
            });
          } catch (err: any) {
            const toolDur = Date.now() - toolT0;
            const rec: AIToolCallRecord = {
              id: tc.id || genId("tc"),
              toolName: toolDef.name,
              arguments: validation.sanitizedArgs,
              status: err instanceof ToolError && err.code === "UNAVAILABLE_OPERATION" ? "unavailable" : "failed",
              error: err?.message || "Tool execution failed",
              durationMs: toolDur,
            };
            toolRecords.push(rec);
            addActivity("failed", `${toolDef.name} failed`, rec.error);
            llmMessages.push({
              role: "tool",
              tool_name: toolDef.name,
              content: JSON.stringify({
                ok: false,
                errorCode: err instanceof ToolError ? err.code : "OPERATION_FAILED",
                error: rec.error,
              }),
            });
          }
        }

        if (cancelled) break;
        if (accumulatedContent && roundToolCalls.length > 0 && !accumulatedContent.endsWith("\n")) {
          accumulatedContent += "\n\n";
        }
      }
    } finally {
      this.activeGenerations.delete(conversationId);
    }

    const durationMs = Date.now() - startTime;
    const estimatedInputTokens = prepared.breakdown.totalEstimatedInputTokens;
    const estimatedOutputTokens = estimateTokens(accumulatedContent);
    const inputTokens = sawRealPromptTokens ? totalPromptEvalTokens : estimatedInputTokens;
    const outputTokens = sawRealEvalTokens ? totalEvalTokens : estimatedOutputTokens;
    const estimated = !(sawRealPromptTokens && sawRealEvalTokens);

    if (cancelled) {
      addActivity("cancelled", "Generation stopped by user");
    } else if (streamError) {
      addActivity("failed", streamError.message, streamError.guidance);
    } else {
      addActivity(
        "completed",
        `Completed in ${durationMs}ms (${outputTokens} tokens${estimated ? " est." : ""}${lastTokensPerSec ? `, ${lastTokensPerSec} tok/s` : ""})`
      );
    }

    if (ragResult?.citationText && accumulatedContent.trim() && !accumulatedContent.includes("Sources:")) {
      accumulatedContent = accumulatedContent.trimEnd() + ragResult.citationText;
    }

    const finalStatus: ChatMessage["status"] = cancelled
      ? "cancelled"
      : streamError
      ? "error"
      : "completed";

    const msgMetrics = {
      requestId,
      model: activeModel,
      provider: "ollama",
      startTime,
      firstTokenLatencyMs,
      durationMs,
      inputTokens,
      outputTokens,
      tokensPerSec: lastTokensPerSec,
      estimated,
    };

    const mergedSources = [
      ...(prepared.sources || []),
      ...(ragResult?.chunks?.map((c) => ({
        id: c.id,
        kind: "file" as const,
        title: c.metadata.documentName || "Course Document",
        subtitle: c.metadata.sectionHeading || (c.metadata.pageNumber ? `Page ${c.metadata.pageNumber}` : "Source Excerpt"),
        content: c.content,
        removable: false,
      })) || []),
    ];

    conversationManager.updateMessage(
      conversationId,
      assistantMsg.id,
      {
        content: accumulatedContent,
        status: finalStatus,
        activity: [...activity],
        sources: mergedSources,
        toolCalls: [...toolRecords],
        approval: null,
        metrics: msgMetrics,
        error: streamError ? { ...streamError, retryable: true } : null,
      },
      true
    );

    if (toolRecords.length > 0) {
      const latestConv = conversationManager.get(conversationId);
      if (latestConv) {
        conversationManager.updateConversation(
          conversationId,
          { toolHistory: [...latestConv.toolHistory, ...toolRecords].slice(-50) },
          true
        );
      }
    }

    aiExecutionMonitor.finishRun({
      requestId,
      conversationId,
      provider: "ollama",
      model: activeModel,
      startTime,
      firstTokenLatencyMs,
      durationMs,
      inputTokens,
      outputTokens,
      tokensPerSec: lastTokensPerSec,
      estimatedMetrics: estimated,
      toolCallsCount: toolRecords.length,
      cancelled,
      errorCode: streamError?.code || null,
      errorMessage: streamError?.message || null,
    });

    eventBus.emit(
      "ai:turn-finished",
      { conversationId, requestId, status: finalStatus, model: activeModel },
      "foundry-ai-service"
    );

    this.broadcastState(true);
  }
}

export const foundryAIService = new FoundryAIServiceImpl();
