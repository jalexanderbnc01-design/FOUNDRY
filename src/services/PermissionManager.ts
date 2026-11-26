/**
 * Foundry Permission Manager (Phase 5.7).
 * Enforces operation-level and app-level authorization with explicit states:
 * allow | ask_first | deny | unavailable
 */
import { persistenceManager, STORAGE_KEYS } from "./PersistenceManager";

export type PermissionState = "allow" | "ask_first" | "deny" | "unavailable";

export type PermissionScope =
  | "workspace.read"
  | "selection.read"
  | "app.open"
  | "window.manage"
  | "app.state.read"
  | "shared_state.write"
  | "external.communicate"
  | "privileged.execute"
  | "ai.execute"
  | "canvas.destructive";

export interface PermissionRule {
  scope: PermissionScope;
  label: string;
  description: string;
  state: PermissionState;
  mutable: boolean;
}

export interface PermissionEvaluation {
  allowed: boolean;
  state: PermissionState;
  scope: PermissionScope;
  reason?: string;
}

type ApprovalCallback = (request: {
  source: string;
  operation: string;
  scope: PermissionScope;
}) => Promise<boolean> | boolean;

const DEFAULT_RULES: Record<PermissionScope, PermissionRule> = {
  "workspace.read": {
    scope: "workspace.read",
    label: "Reading Workspace Information",
    description: "Read active board metadata, workspace ID, and viewport coordinates.",
    state: "allow",
    mutable: true,
  },
  "selection.read": {
    scope: "selection.read",
    label: "Reading Canvas Selections",
    description: "Inspect currently selected canvas object IDs and counts.",
    state: "allow",
    mutable: true,
  },
  "app.open": {
    scope: "app.open",
    label: "Opening Applications",
    description: "Launch, focus, or close registered workspace applications.",
    state: "allow",
    mutable: true,
  },
  "window.manage": {
    scope: "window.manage",
    label: "Managing Windows",
    description: "Move, resize, minimize, restore, expand, or focus registered windows.",
    state: "allow",
    mutable: true,
  },
  "app.state.read": {
    scope: "app.state.read",
    label: "Reading Application State",
    description: "Query runtime state, manifest capabilities, and controller visibility.",
    state: "allow",
    mutable: true,
  },
  "shared_state.write": {
    scope: "shared_state.write",
    label: "Modifying Shared State",
    description: "Mutate shared workspace context or persistent preferences from modules.",
    state: "ask_first",
    mutable: true,
  },
  "external.communicate": {
    scope: "external.communicate",
    label: "External Communication",
    description: "Cross-origin or external iframe bridge messaging beyond registered handshakes.",
    state: "deny",
    mutable: true,
  },
  "privileged.execute": {
    scope: "privileged.execute",
    label: "Privileged Operations",
    description: "Unregistered or privileged host operations (default denied in Stage 1).",
    state: "deny",
    mutable: false,
  },
  "ai.execute": {
    scope: "ai.execute",
    label: "Foundry AI Assistant & Bridge",
    description: "Stage 2 interactive AI chat inference and policy-checked tool execution.",
    state: "allow",
    mutable: true,
  },
  "canvas.destructive": {
    scope: "canvas.destructive",
    label: "Destructive Canvas Operations",
    description: "Bulk delete or overwrite workspace elements via external module requests.",
    state: "deny",
    mutable: false,
  },
};

class PermissionManagerService {
  private rules: Map<PermissionScope, PermissionRule> = new Map();
  private appOverrides: Map<string, Partial<Record<PermissionScope, PermissionState>>> = new Map();
  private externalCommRestricted = true;
  private approvalHandler: ApprovalCallback | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    Object.values(DEFAULT_RULES).forEach((rule) => {
      this.rules.set(rule.scope, { ...rule });
    });
    this.load();
  }

  private load() {
    const saved = persistenceManager.getJson<{
      rules?: Partial<Record<PermissionScope, PermissionState>>;
      appOverrides?: Record<string, Partial<Record<PermissionScope, PermissionState>>>;
      externalCommRestricted?: boolean;
    }>(STORAGE_KEYS.PERMISSIONS);

    if (saved?.rules) {
      (Object.entries(saved.rules) as [PermissionScope, PermissionState][]).forEach(([scope, state]) => {
        const rule = this.rules.get(scope);
        if (rule && rule.mutable && ["allow", "ask_first", "deny", "unavailable"].includes(state)) {
          rule.state = state;
        }
      });
    }
    if (saved?.appOverrides) {
      Object.entries(saved.appOverrides).forEach(([appId, overrides]) => {
        this.appOverrides.set(appId, overrides);
      });
    }
    if (typeof saved?.externalCommRestricted === "boolean") {
      this.externalCommRestricted = saved.externalCommRestricted;
    }
  }

  private save() {
    const rulesObj: Partial<Record<PermissionScope, PermissionState>> = {};
    this.rules.forEach((r, k) => {
      rulesObj[k] = r.state;
    });
    const overridesObj: Record<string, Partial<Record<PermissionScope, PermissionState>>> = {};
    this.appOverrides.forEach((v, k) => {
      overridesObj[k] = v;
    });
    persistenceManager.setJson(STORAGE_KEYS.PERMISSIONS, {
      rules: rulesObj,
      appOverrides: overridesObj,
      externalCommRestricted: this.externalCommRestricted,
    });
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setApprovalHandler(handler: ApprovalCallback | null): void {
    this.approvalHandler = handler;
  }

  getRules(): PermissionRule[] {
    return Array.from(this.rules.values()).map((r) => ({ ...r }));
  }

  getRule(scope: PermissionScope): PermissionRule | undefined {
    const r = this.rules.get(scope);
    return r ? { ...r } : undefined;
  }

  setRuleState(scope: PermissionScope, state: PermissionState): boolean {
    const rule = this.rules.get(scope);
    if (!rule || !rule.mutable) return false;
    rule.state = state;
    this.save();
    this.notify();
    return true;
  }

  setAppOverride(appId: string, scope: PermissionScope, state: PermissionState | null): void {
    const rule = this.rules.get(scope);
    if (!rule || !rule.mutable) return;
    const existing = this.appOverrides.get(appId) || {};
    if (state === null) {
      delete existing[scope];
    } else {
      existing[scope] = state;
    }
    this.appOverrides.set(appId, existing);
    this.save();
    this.notify();
  }

  getAppOverrides(): Record<string, Partial<Record<PermissionScope, PermissionState>>> {
    const out: Record<string, Partial<Record<PermissionScope, PermissionState>>> = {};
    this.appOverrides.forEach((v, k) => {
      out[k] = { ...v };
    });
    return out;
  }

  isExternalCommRestricted(): boolean {
    return this.externalCommRestricted;
  }

  setExternalCommRestricted(restricted: boolean): void {
    this.externalCommRestricted = restricted;
    this.save();
    this.notify();
  }

  getScopeForOperation(operation: string): PermissionScope {
    if (
      operation === "system.ping" ||
      operation === "system.get_status" ||
      operation === "system.get_version" ||
      operation === "system.get_capabilities" ||
      operation.startsWith("app.list") ||
      operation === "app.get" ||
      operation === "app.get_status" ||
      operation === "app.get_capabilities" ||
      operation === "window.list" ||
      operation === "window.get" ||
      operation === "controller.get_state"
    ) {
      return "app.state.read";
    }
    if (operation.startsWith("workspace.")) return "workspace.read";
    if (operation.startsWith("selection.")) return "selection.read";
    if (operation === "app.open" || operation === "app.close" || operation === "app.focus") return "app.open";
    if (
      operation.startsWith("window.") ||
      operation === "controller.show" ||
      operation === "controller.hide" ||
      operation === "controller.open_section" ||
      operation === "controller.open_ai"
    ) {
      return "window.manage";
    }
    if (operation.startsWith("ai.")) return "ai.execute";
    if (operation.startsWith("canvas.delete") || operation.startsWith("canvas.clear")) return "canvas.destructive";
    if (operation.startsWith("context.set") || operation.startsWith("shared_state.")) return "shared_state.write";
    return "privileged.execute";
  }

  async evaluate(
    source: string,
    operation: string,
    explicitScope?: PermissionScope
  ): Promise<PermissionEvaluation> {
    const scope = explicitScope || this.getScopeForOperation(operation);
    const baseRule = this.rules.get(scope);
    if (!baseRule) {
      return {
        allowed: false,
        state: "deny",
        scope,
        reason: `Unknown permission scope: ${scope}`,
      };
    }

    const appRuleState = this.appOverrides.get(source)?.[scope];
    let effectiveState: PermissionState = appRuleState || baseRule.state;

    // Locked Stage 1 non-mutable restrictions cannot be elevated by app overrides
    if (!baseRule.mutable) {
      effectiveState = baseRule.state;
    }

    if (scope === "external.communicate" && this.externalCommRestricted) {
      return {
        allowed: false,
        state: "deny",
        scope,
        reason: "External communication is restricted by host policy",
      };
    }

    if (effectiveState === "allow") {
      return { allowed: true, state: "allow", scope };
    }

    if (effectiveState === "unavailable") {
      return {
        allowed: false,
        state: "unavailable",
        scope,
        reason: `Operation "${operation}" requires "${scope}" which is unavailable in Stage 1`,
      };
    }

    if (effectiveState === "ask_first") {
      if (this.approvalHandler) {
        try {
          const approved = await this.approvalHandler({ source, operation, scope });
          return approved
            ? { allowed: true, state: "ask_first", scope }
            : {
                allowed: false,
                state: "ask_first",
                scope,
                reason: `User declined "${operation}" (${scope})`,
              };
        } catch {
          return {
            allowed: false,
            state: "ask_first",
            scope,
            reason: `Approval prompt failed for "${operation}"`,
          };
        }
      }
      return {
        allowed: false,
        state: "ask_first",
        scope,
        reason: `Operation "${operation}" requires interactive approval (${scope})`,
      };
    }

    return {
      allowed: false,
      state: "deny",
      scope,
      reason: `Permission denied for "${source}" executing "${operation}" (${scope})`,
    };
  }
}

export const permissionManager = new PermissionManagerService();
