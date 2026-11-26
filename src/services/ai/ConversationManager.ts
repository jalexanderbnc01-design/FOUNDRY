/**
 * Foundry Stage 2 — Conversation Manager (Phase 6.2 & 6.3)
 * Persists multi-turn conversations locally and syncs with Foundry SQLite backend.
 */
import { persistenceManager } from "../PersistenceManager";
import { sharedContextManager } from "../SharedContextManager";
import {
  AIOperatingMode,
  ChatMessage,
  ContextAttachment,
  Conversation,
} from "./types";

const CONVERSATIONS_STORAGE_KEY = "foundry-ai-conversations-v1";
const ACTIVE_CONV_STORAGE_KEY = "foundry-ai-active-conversation-v1";

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

class ConversationManagerService {
  private conversations: Map<string, Conversation> = new Map();
  private activeConversationId: string | null = null;
  private listeners: Set<() => void> = new Set();
  private initialized = false;

  constructor() {
    this.loadLocal();
    if (this.conversations.size === 0) {
      const fresh = this.createBlankConversation("New Chat");
      this.conversations.set(fresh.id, fresh);
      this.activeConversationId = fresh.id;
    } else if (!this.activeConversationId || !this.conversations.has(this.activeConversationId)) {
      const first = this.list()[0];
      this.activeConversationId = first?.id || null;
    }
  }

  private createBlankConversation(title = "New Chat", mode: AIOperatingMode = "assist"): Conversation {
    const ctx = sharedContextManager.getContext();
    const now = Date.now();
    return {
      id: genId("conv"),
      title,
      createdAt: now,
      updatedAt: now,
      model: null,
      systemPrompt: "",
      mode,
      activeCourseId: ctx.activeCourseId,
      activeApplicationId: ctx.activeApplicationId,
      attachments: [],
      selectedCanvasObjectIds: [...ctx.selectedCanvasObjectIds],
      disabledContextIds: [],
      toolHistory: [],
      messages: [],
    };
  }

  private loadLocal() {
    const saved = persistenceManager.getJson<Conversation[]>(CONVERSATIONS_STORAGE_KEY);
    if (Array.isArray(saved)) {
      saved.forEach((c) => {
        if (c && c.id) {
          this.conversations.set(c.id, {
            ...c,
            messages: Array.isArray(c.messages) ? c.messages : [],
            attachments: Array.isArray(c.attachments) ? c.attachments : [],
            selectedCanvasObjectIds: Array.isArray(c.selectedCanvasObjectIds) ? c.selectedCanvasObjectIds : [],
            disabledContextIds: Array.isArray(c.disabledContextIds) ? c.disabledContextIds : [],
            toolHistory: Array.isArray(c.toolHistory) ? c.toolHistory : [],
          });
        }
      });
    }
    const active = persistenceManager.getJson<string>(ACTIVE_CONV_STORAGE_KEY);
    if (typeof active === "string" && this.conversations.has(active)) {
      this.activeConversationId = active;
    }
  }

  private saveLocal() {
    const list = this.list().slice(0, 60);
    persistenceManager.setJson(CONVERSATIONS_STORAGE_KEY, list);
    if (this.activeConversationId) {
      persistenceManager.setJson(ACTIVE_CONV_STORAGE_KEY, this.activeConversationId);
    }
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

  async syncFromBackend(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const res = await fetch("/api/ai/conversations");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.conversations) && data.conversations.length > 0) {
        for (const summary of data.conversations.slice(0, 20)) {
          if (!this.conversations.has(summary.id)) {
            const detailRes = await fetch(`/api/ai/conversations/${encodeURIComponent(summary.id)}`);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              if (detailData?.conversation) {
                this.conversations.set(summary.id, {
                  ...detailData.conversation,
                  disabledContextIds: [],
                  messages: detailData.conversation.messages || [],
                });
              }
            }
          }
        }
        this.saveLocal();
        this.notify();
      }
    } catch {}
  }

  private persistToBackend(conv: Conversation) {
    fetch("/api/ai/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(conv),
    }).catch(() => {});
  }

  list(): Conversation[] {
    return Array.from(this.conversations.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  get(id: string): Conversation | null {
    const c = this.conversations.get(id);
    return c ? structuredCloneSafe(c) : null;
  }

  getActive(): Conversation {
    if (this.activeConversationId && this.conversations.has(this.activeConversationId)) {
      return structuredCloneSafe(this.conversations.get(this.activeConversationId)!);
    }
    const fresh = this.createBlankConversation("New Chat");
    this.conversations.set(fresh.id, fresh);
    this.activeConversationId = fresh.id;
    this.saveLocal();
    return structuredCloneSafe(fresh);
  }

  createConversation(opts?: { title?: string; mode?: AIOperatingMode; model?: string | null }): Conversation {
    const fresh = this.createBlankConversation(opts?.title || "New Chat", opts?.mode || "assist");
    if (opts?.model !== undefined) fresh.model = opts.model;
    this.conversations.set(fresh.id, fresh);
    this.activeConversationId = fresh.id;
    this.saveLocal();
    this.persistToBackend(fresh);
    this.notify();
    return structuredCloneSafe(fresh);
  }

  selectConversation(id: string): Conversation | null {
    const c = this.conversations.get(id);
    if (!c) return null;
    this.activeConversationId = id;
    this.saveLocal();
    this.notify();
    return structuredCloneSafe(c);
  }

  updateConversation(id: string, patch: Partial<Conversation>, syncRemote = true): Conversation | null {
    const c = this.conversations.get(id);
    if (!c) return null;
    const updated: Conversation = {
      ...c,
      ...patch,
      id: c.id,
      updatedAt: Date.now(),
    };
    this.conversations.set(id, updated);
    this.saveLocal();
    if (syncRemote) this.persistToBackend(updated);
    this.notify();
    return structuredCloneSafe(updated);
  }

  deleteConversation(id: string): boolean {
    const existed = this.conversations.delete(id);
    if (!existed) return false;
    fetch(`/api/ai/conversations/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    if (this.activeConversationId === id) {
      const remaining = this.list();
      if (remaining.length > 0) {
        this.activeConversationId = remaining[0].id;
      } else {
        const fresh = this.createBlankConversation("New Chat");
        this.conversations.set(fresh.id, fresh);
        this.activeConversationId = fresh.id;
      }
    }
    this.saveLocal();
    this.notify();
    return true;
  }

  appendMessage(conversationId: string, msg: Omit<ChatMessage, "id" | "conversationId" | "createdAt"> & { id?: string; createdAt?: number }): ChatMessage {
    const conv = this.conversations.get(conversationId) || this.getActive();
    const message: ChatMessage = {
      ...msg,
      id: msg.id || genId("msg"),
      conversationId: conv.id,
      createdAt: msg.createdAt || Date.now(),
    };
    conv.messages.push(message);
    // Auto-title conversation from first user prompt
    if (message.role === "user" && (conv.title === "New Chat" || conv.title === "New Conversation")) {
      const cleaned = message.content.trim().replace(/\s+/g, " ");
      if (cleaned) {
        conv.title = cleaned.length > 42 ? cleaned.slice(0, 42) + "..." : cleaned;
      }
    }
    conv.updatedAt = Date.now();
    this.conversations.set(conv.id, conv);
    this.saveLocal();
    this.persistToBackend(conv);
    this.notify();
    return structuredCloneSafe(message);
  }

  updateMessage(conversationId: string, messageId: string, patch: Partial<ChatMessage>, syncRemote = false): ChatMessage | null {
    const conv = this.conversations.get(conversationId);
    if (!conv) return null;
    const idx = conv.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return null;
    conv.messages[idx] = { ...conv.messages[idx], ...patch };
    conv.updatedAt = Date.now();
    this.conversations.set(conversationId, conv);
    if (syncRemote) {
      this.saveLocal();
      this.persistToBackend(conv);
    }
    this.notify();
    return structuredCloneSafe(conv.messages[idx]);
  }

  truncateFromMessage(conversationId: string, messageId: string, inclusive = true): Conversation | null {
    const conv = this.conversations.get(conversationId);
    if (!conv) return null;
    const idx = conv.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return null;
    conv.messages = conv.messages.slice(0, inclusive ? idx : idx + 1);
    conv.updatedAt = Date.now();
    this.conversations.set(conversationId, conv);
    this.saveLocal();
    this.persistToBackend(conv);
    this.notify();
    return structuredCloneSafe(conv);
  }

  addAttachment(conversationId: string, attachment: ContextAttachment): Conversation | null {
    const conv = this.conversations.get(conversationId);
    if (!conv) return null;
    if (!conv.attachments.some((a) => a.id === attachment.id)) {
      conv.attachments.push(attachment);
    }
    conv.disabledContextIds = (conv.disabledContextIds || []).filter((id) => id !== attachment.id);
    conv.updatedAt = Date.now();
    this.conversations.set(conversationId, conv);
    this.saveLocal();
    this.persistToBackend(conv);
    this.notify();
    return structuredCloneSafe(conv);
  }

  removeAttachmentOrDisableContext(conversationId: string, contextId: string): Conversation | null {
    const conv = this.conversations.get(conversationId);
    if (!conv) return null;
    const prevLen = conv.attachments.length;
    conv.attachments = conv.attachments.filter((a) => a.id !== contextId);
    if (conv.attachments.length === prevLen) {
      const disabled = new Set(conv.disabledContextIds || []);
      disabled.add(contextId);
      conv.disabledContextIds = Array.from(disabled);
    }
    conv.updatedAt = Date.now();
    this.conversations.set(conversationId, conv);
    this.saveLocal();
    this.notify();
    return structuredCloneSafe(conv);
  }
}

function structuredCloneSafe<T>(val: T): T {
  try {
    return JSON.parse(JSON.stringify(val));
  } catch {
    return val;
  }
}

export const conversationManager = new ConversationManagerService();
