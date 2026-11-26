/**
 * Foundry Stage 2 — AI Context Manager & Budget Enforcement (Phase 09)
 * Extends Stage 1 SharedContextManager with live canvas selections, workspace/course
 * context, attachments, Context Inspector data, and token budget truncation/checks.
 */
import { sharedContextManager } from "../SharedContextManager";
import { applicationRegistry } from "../ApplicationRegistry";
import { windowManager } from "../WindowManager";
import { BoardElement } from "../../types";
import {
  ChatMessage,
  ChatSourceRef,
  ContextAttachment,
  ContextBudgetBreakdown,
  Conversation,
} from "./types";

export interface ContextBudgetOptions {
  maxContextTokens: number;
  outputReserveTokens: number;
  maxHistoryMessages: number;
  maxAttachmentChars: number;
}

export interface HostCanvasSnapshotProvider {
  getWorkspaceInfo: () => {
    workspaceId: string;
    workspaceName: string;
    connectionStatus: string;
    elementCount: number;
  };
  getElements: () => BoardElement[];
  getSelectedElements: () => BoardElement[];
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function stripHtmlSummary(raw: string): string {
  return raw
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatElementSummary(el: BoardElement): string {
  const parts: string[] = [`[${el.type.toUpperCase()} id=${el.id}]`];
  if (el.title) parts.push(`title="${el.title}"`);
  if (el.shapeType) parts.push(`shape=${el.shapeType}`);
  parts.push(`pos=(${Math.round(el.x)},${Math.round(el.y)}) size=${Math.round(el.width)}x${Math.round(el.height)}`);
  if (el.content) {
    const clean = el.type === "html" ? stripHtmlSummary(el.content) : el.content;
    if (clean) parts.push(`text="${clean.slice(0, 600)}"`);
  }
  return parts.join(" ");
}

class AIContextManagerService {
  private hostProvider: HostCanvasSnapshotProvider | null = null;
  private maxAttachmentChars = 12000;
  private maxHistoryMessages = 24;

  setHostProvider(provider: HostCanvasSnapshotProvider | null) {
    this.hostProvider = provider;
  }

  setLimits(opts: { maxAttachmentChars?: number; maxHistoryMessages?: number }) {
    if (typeof opts.maxAttachmentChars === "number" && opts.maxAttachmentChars >= 500) {
      this.maxAttachmentChars = opts.maxAttachmentChars;
    }
    if (typeof opts.maxHistoryMessages === "number" && opts.maxHistoryMessages >= 2) {
      this.maxHistoryMessages = opts.maxHistoryMessages;
    }
  }

  /**
   * Collect live workspace, course, selection, and attachment context items
   * strictly from active runtime state (never fabricates items).
   */
  collectCandidateContext(conversation: Conversation): ContextAttachment[] {
    const items: ContextAttachment[] = [];
    const shared = sharedContextManager.getContext();
    const disabled = new Set(conversation.disabledContextIds || []);

    // 1. Active workspace summary (compact, removable)
    const wsInfo = this.hostProvider?.getWorkspaceInfo();
    const wsId = wsInfo?.workspaceId || shared.workspaceId || "default";
    const wsName = wsInfo?.workspaceName || shared.workspaceName || "Foundry Workspace";
    const elCount = wsInfo?.elementCount ?? 0;
    const wsItemId = `ctx_ws_${wsId}`;
    if (!disabled.has(wsItemId)) {
      items.push({
        id: wsItemId,
        kind: "workspace",
        title: `Workspace: ${wsName}`,
        subtitle: `${elCount} canvas objects · ${wsInfo?.connectionStatus || "local"}`,
        content: `Active Foundry Workspace "${wsName}" (id=${wsId}), objects=${elCount}, viewport=(x:${Math.round(shared.viewport.x)}, y:${Math.round(shared.viewport.y)}, zoom:${shared.viewport.zoom.toFixed(2)}).`,
        removable: true,
      });
    }

    // 2. Active course context (from Education Controller)
    if (shared.activeCourseId) {
      const courseId = `ctx_course_${shared.activeCourseId}`;
      if (!disabled.has(courseId)) {
        items.push({
          id: courseId,
          kind: "course",
          title: `Course: ${shared.activeCourseId}`,
          subtitle: shared.activeAssignmentId ? `Assignment: ${shared.activeAssignmentId}` : "Active Education Course",
          content: `Active Education Studio Course: ${shared.activeCourseId}${shared.activeAssignmentId ? `, Active Assignment: ${shared.activeAssignmentId}` : ""}.`,
          removable: true,
        });
      }
    }

    // 3. Selected canvas objects
    const selected = this.hostProvider?.getSelectedElements() || [];
    if (selected.length > 0) {
      const selId = "ctx_canvas_selection";
      if (!disabled.has(selId)) {
        const lines = selected.slice(0, 20).map((el) => "- " + formatElementSummary(el));
        if (selected.length > 20) {
          lines.push(`... (${selected.length - 20} more selected objects omitted)`);
        }
        items.push({
          id: selId,
          kind: "canvas_selection",
          title: `${selected.length} Selected Canvas Object${selected.length === 1 ? "" : "s"}`,
          subtitle: selected.slice(0, 3).map((e) => e.title || e.type).join(", "),
          content: `Currently selected canvas objects:\n${lines.join("\n")}`,
          removable: true,
        });
      }
    }

    // 4. Open apps & focused window context
    const openApps = shared.openApplicationIds.filter((id) => id !== "education-controller" && id !== "education-ai");
    if (openApps.length > 0) {
      const appCtxId = "ctx_open_apps";
      if (!disabled.has(appCtxId)) {
        const appNames = openApps
          .map((id) => applicationRegistry.get(id)?.name || id)
          .join(", ");
        const focused = shared.focusedWindowId
          ? windowManager.getWindow(shared.focusedWindowId)?.title || shared.focusedWindowId
          : null;
        items.push({
          id: appCtxId,
          kind: "application",
          title: `Open Apps (${openApps.length})`,
          subtitle: appNames,
          content: `Open Foundry companion apps: ${appNames}.${focused ? ` Focused window: ${focused}.` : ""}`,
          removable: true,
        });
      }
    }

    // 5. Explicit user-attached context cards / local files
    for (const att of conversation.attachments || []) {
      if (disabled.has(att.id)) continue;
      const raw = att.content || "";
      const truncated = raw.length > this.maxAttachmentChars;
      items.push({
        ...att,
        content: truncated ? raw.slice(0, this.maxAttachmentChars) + "\n[...truncated to fit attachment limit]" : raw,
        truncated,
        originalChars: raw.length,
        removable: true,
      });
    }

    return items;
  }

  /**
   * Build messages array & full ContextBudgetBreakdown for a given prompt and budget.
   */
  preparePromptWithBudget(params: {
    conversation: Conversation;
    userPrompt: string;
    systemPrompt: string;
    budget: Partial<ContextBudgetOptions>;
  }): {
    messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string; tool_calls?: any[]; tool_name?: string }>;
    breakdown: ContextBudgetBreakdown;
    sources: ChatSourceRef[];
    usedItems: ContextAttachment[];
  } {
    const maxContextTokens = Math.max(512, params.budget.maxContextTokens || 4096);
    const requestedOutput = Math.max(64, params.budget.outputReserveTokens || 512);
    const outputReserveTokens = Math.min(requestedOutput, Math.floor(maxContextTokens * 0.45));
    const availableInputTokens = Math.max(256, maxContextTokens - outputReserveTokens);

    const systemTokens = estimateTokens(params.systemPrompt);
    const promptTokens = estimateTokens(params.userPrompt);

    let remaining = availableInputTokens - systemTokens - promptTokens;
    const candidates = this.collectCandidateContext(params.conversation);
    const breakdownItems: ContextBudgetBreakdown["items"] = [];
    const includedContext: ContextAttachment[] = [];

    // 1. Fit optional context items cleanly within remaining budget (user attachments prioritized first)
    const prioritized = [...candidates].sort((a, b) => {
      const rank = (k: ContextAttachment["kind"]) =>
        k === "file" || k === "note" || k === "canvas_selection" || k === "canvas_object" ? 0 : 1;
      return rank(a.kind) - rank(b.kind);
    });

    for (const item of prioritized) {
      const est = estimateTokens(item.content) + 12;
      if (remaining >= est) {
        remaining -= est;
        includedContext.push(item);
        breakdownItems.push({
          id: item.id,
          title: item.title,
          kind: item.kind,
          estimatedTokens: est,
          included: true,
          removable: item.removable,
          truncated: item.truncated,
        });
      } else {
        breakdownItems.push({
          id: item.id,
          title: item.title,
          kind: item.kind,
          estimatedTokens: est,
          included: false,
          removable: item.removable,
          reason: "Omitted to stay within context token budget",
        });
      }
    }

    // 2. Fit recent conversation history within remaining budget
    const maxHist = params.budget.maxHistoryMessages || this.maxHistoryMessages;
    const rawHistory: ChatMessage[] = (params.conversation.messages || [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && m.content && m.status !== "error")
      .slice(-maxHist);

    const selectedHistory: ChatMessage[] = [];
    let historyTokens = 0;
    for (let i = rawHistory.length - 1; i >= 0; i--) {
      const m = rawHistory[i];
      const t = estimateTokens(m.content) + 8;
      if (remaining >= t) {
        remaining -= t;
        historyTokens += t;
        selectedHistory.unshift(m);
      } else {
        break;
      }
    }

    const contextTokens = includedContext.reduce((s, i) => s + estimateTokens(i.content) + 12, 0);
    const totalEstimatedInputTokens = systemTokens + contextTokens + historyTokens + promptTokens;
    const overflow = totalEstimatedInputTokens > availableInputTokens;

    const contextBlock =
      includedContext.length > 0
        ? "\n\n[WORKSPACE & ATTACHED CONTEXT]\n" +
          includedContext.map((c) => `### ${c.title}\n${c.content}`).join("\n\n")
        : "";

    const finalMessages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string }> = [
      {
        role: "system",
        content: params.systemPrompt + contextBlock,
      },
      ...selectedHistory.map((m) => ({
        role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "user",
        content: params.userPrompt,
      },
    ];

    const sources: ChatSourceRef[] = includedContext.map((c) => ({
      id: c.id,
      title: c.title,
      detail: c.subtitle || c.kind,
      kind: c.kind,
    }));

    return {
      messages: finalMessages,
      breakdown: {
        maxContextTokens,
        outputReserveTokens,
        availableInputTokens,
        systemTokens,
        contextTokens,
        historyTokens,
        promptTokens,
        totalEstimatedInputTokens,
        items: breakdownItems,
        overflow,
      },
      sources,
      usedItems: includedContext,
    };
  }

  inspectCurrentContext(conversation: Conversation, budget: Partial<ContextBudgetOptions>): ContextBudgetBreakdown {
    return this.preparePromptWithBudget({
      conversation,
      userPrompt: "",
      systemPrompt: conversation.systemPrompt || "Foundry AI Assistant",
      budget,
    }).breakdown;
  }

  createCanvasObjectsAttachment(): ContextAttachment | null {
    const selected = this.hostProvider?.getSelectedElements() || [];
    const target = selected.length > 0 ? selected : (this.hostProvider?.getElements() || []).slice(0, 15);
    if (target.length === 0) return null;
    const content = target.map((el) => "- " + formatElementSummary(el)).join("\n");
    return {
      id: `att_canvas_${Date.now()}`,
      kind: selected.length > 0 ? "canvas_selection" : "canvas_object",
      title: selected.length > 0 ? `${selected.length} Selected Objects` : `Canvas Snapshot (${target.length} objects)`,
      subtitle: target.slice(0, 2).map((e) => e.title || e.type).join(", "),
      content,
      removable: true,
    };
  }
}

export const aiContextManager = new AIContextManagerService();
