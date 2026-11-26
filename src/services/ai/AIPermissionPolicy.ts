/**
 * Foundry Stage 2 — AI Permission Policy & Scoped Approval Manager (Phase 10)
 * Extends Stage 1 PermissionManager with AI operating modes (Chat | Assist | Execute | Review),
 * category-based default policies, and single-operation scoped approvals.
 */
import { persistenceManager } from "../PersistenceManager";
import { eventBus } from "../EventBus";
import {
  AIOperatingMode,
  AIPolicyDecision,
  AIToolPermissionCategory,
  PendingApproval,
} from "./types";

const AI_POLICY_STORAGE_KEY = "foundry-ai-permission-policy-v1";

export const DEFAULT_AI_TOOL_POLICY: Record<AIToolPermissionCategory, AIPolicyDecision> = {
  read: "allow",
  open_focus: "allow",
  create_modify: "ask_first",
  move_multiple: "ask_first",
  change_app_data: "ask_first",
  delete_data: "deny",
  external_share: "deny",
  system_command: "deny",
};

const IMMUTABLE_DENY_CATEGORIES = new Set<AIToolPermissionCategory>([
  "delete_data",
  "external_share",
  "system_command",
]);

interface PendingResolver {
  approval: PendingApproval;
  resolve: (approved: boolean) => void;
}

class AIPermissionPolicyService {
  private operatingMode: AIOperatingMode = "assist";
  private requireApproval = true;
  private categoryPolicy: Record<AIToolPermissionCategory, AIPolicyDecision> = {
    ...DEFAULT_AI_TOOL_POLICY,
  };
  private pendingApprovals: Map<string, PendingResolver> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.load();
  }

  private load() {
    const saved = persistenceManager.getJson<{
      operatingMode?: AIOperatingMode;
      requireApproval?: boolean;
      categoryPolicy?: Partial<Record<AIToolPermissionCategory, AIPolicyDecision>>;
    }>(AI_POLICY_STORAGE_KEY);

    if (saved) {
      if (saved.operatingMode && ["chat", "assist", "execute", "review"].includes(saved.operatingMode)) {
        this.operatingMode = saved.operatingMode;
      }
      if (typeof saved.requireApproval === "boolean") {
        this.requireApproval = saved.requireApproval;
      }
      if (saved.categoryPolicy) {
        (Object.keys(DEFAULT_AI_TOOL_POLICY) as AIToolPermissionCategory[]).forEach((cat) => {
          if (IMMUTABLE_DENY_CATEGORIES.has(cat)) {
            this.categoryPolicy[cat] = "deny";
          } else if (
            saved.categoryPolicy?.[cat] &&
            ["allow", "ask_first", "deny"].includes(saved.categoryPolicy[cat]!)
          ) {
            this.categoryPolicy[cat] = saved.categoryPolicy[cat]!;
          }
        });
      }
    }
  }

  private save() {
    persistenceManager.setJson(AI_POLICY_STORAGE_KEY, {
      operatingMode: this.operatingMode,
      requireApproval: this.requireApproval,
      categoryPolicy: this.categoryPolicy,
    });
  }

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch {}
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getOperatingMode(): AIOperatingMode {
    return this.operatingMode;
  }

  setOperatingMode(mode: AIOperatingMode): void {
    if (!["chat", "assist", "execute", "review"].includes(mode)) return;
    this.operatingMode = mode;
    this.save();
    this.notify();
    eventBus.emit("ai:mode-changed", { mode }, "ai-permission-policy");
  }

  getRequireApproval(): boolean {
    return this.requireApproval;
  }

  setRequireApproval(req: boolean): void {
    this.requireApproval = Boolean(req);
    this.save();
    this.notify();
  }

  getPolicy(): Record<AIToolPermissionCategory, AIPolicyDecision> {
    return { ...this.categoryPolicy };
  }

  setCategoryDecision(category: AIToolPermissionCategory, decision: AIPolicyDecision): boolean {
    if (IMMUTABLE_DENY_CATEGORIES.has(category)) {
      return false;
    }
    this.categoryPolicy[category] = decision;
    this.save();
    this.notify();
    return true;
  }

  isCategoryLocked(category: AIToolPermissionCategory): boolean {
    return IMMUTABLE_DENY_CATEGORIES.has(category);
  }

  /**
   * Evaluate effective policy decision given both operating mode and category rules.
   */
  evaluateTool(category: AIToolPermissionCategory, modeOverride?: AIOperatingMode): {
    decision: AIPolicyDecision;
    reason?: string;
  } {
    const mode = modeOverride || this.operatingMode;

    // Permanently blocked destructive/external/system categories
    if (IMMUTABLE_DENY_CATEGORIES.has(category)) {
      return {
        decision: "deny",
        reason: `Category "${category}" is denied by Foundry Stage 2 safety policy.`,
      };
    }

    if (mode === "chat") {
      return {
        decision: "deny",
        reason: `Operating mode is "Chat" (conversational only; tool execution is disabled).`,
      };
    }

    if (mode === "review") {
      if (category === "read") {
        return { decision: "allow" };
      }
      return {
        decision: "deny",
        reason: `Operating mode is "Review" (read-only analysis; mutations are blocked).`,
      };
    }

    const configured = this.categoryPolicy[category] || DEFAULT_AI_TOOL_POLICY[category];
    if (configured === "deny") {
      return {
        decision: "deny",
        reason: `Permission policy denies "${category}" operations.`,
      };
    }

    if (mode === "execute") {
      // Execute permits configured non-destructive tools unless user explicitly set ask_first AND requireApproval is true on move_multiple/change_app_data
      if (category === "read" || category === "open_focus" || category === "create_modify") {
        return { decision: "allow" };
      }
      return {
        decision: configured === "ask_first" && !this.requireApproval ? "allow" : configured,
      };
    }

    // Default "assist" mode
    if (configured === "ask_first" && !this.requireApproval) {
      return { decision: "allow" };
    }
    return { decision: configured };
  }

  /**
   * Create a single-operation scoped approval token bound strictly to toolName + validatedArgs.
   */
  requestApproval(params: {
    conversationId: string;
    requestId: string;
    toolName: string;
    validatedArgs: Record<string, any>;
    category: AIToolPermissionCategory;
    summary: string;
  }): { approval: PendingApproval; promise: Promise<boolean> } {
    const approvalId = `apr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const approval: PendingApproval = {
      approvalId,
      conversationId: params.conversationId,
      requestId: params.requestId,
      toolName: params.toolName,
      validatedArgs: JSON.parse(JSON.stringify(params.validatedArgs || {})),
      summary: params.summary,
      category: params.category,
      createdAt: Date.now(),
      status: "pending",
    };

    let resolveFn!: (approved: boolean) => void;
    const promise = new Promise<boolean>((resolve) => {
      resolveFn = resolve;
    });

    this.pendingApprovals.set(approvalId, { approval, resolve: resolveFn });
    this.notify();
    eventBus.emit("ai:approval-requested", { approval }, "ai-permission-policy");

    return { approval, promise };
  }

  resolveApproval(
    approvalId: string,
    approved: boolean,
    expectedScope?: { toolName?: string; conversationId?: string }
  ): PendingApproval | null {
    const entry = this.pendingApprovals.get(approvalId);
    if (!entry) return null;

    if (expectedScope?.toolName && entry.approval.toolName !== expectedScope.toolName) {
      return null;
    }
    if (expectedScope?.conversationId && entry.approval.conversationId !== expectedScope.conversationId) {
      return null;
    }

    entry.approval.status = approved ? "approved" : "rejected";
    this.pendingApprovals.delete(approvalId);
    entry.resolve(approved);
    this.notify();
    eventBus.emit(
      "ai:approval-resolved",
      { approvalId, approved, toolName: entry.approval.toolName },
      "ai-permission-policy"
    );
    return { ...entry.approval };
  }

  cancelPendingForConversation(conversationId: string): void {
    for (const [id, entry] of this.pendingApprovals.entries()) {
      if (entry.approval.conversationId === conversationId) {
        entry.approval.status = "rejected";
        this.pendingApprovals.delete(id);
        entry.resolve(false);
      }
    }
    this.notify();
  }

  getPendingApprovals(conversationId?: string): PendingApproval[] {
    const list: PendingApproval[] = [];
    this.pendingApprovals.forEach((entry) => {
      if (!conversationId || entry.approval.conversationId === conversationId) {
        list.push({ ...entry.approval });
      }
    });
    return list;
  }
}

export const aiPermissionPolicy = new AIPermissionPolicyService();
