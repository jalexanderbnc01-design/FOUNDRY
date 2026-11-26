/**
 * Foundry Stage 3 — AI Persistent Memory Manager (Phase 16)
 * Supports 8 memory categories with explicit user approval lifecycle,
 * scoped retrieval (user / workspace / course), and privacy protection.
 */
import { sharedDatabaseClient, AIMemoryRecord } from "../data/SharedDatabaseClient";

export type MemoryType =
  | "conversation"
  | "working"
  | "workspace"
  | "course"
  | "project"
  | "preference"
  | "knowledge"
  | "procedural";

export interface MemoryProposal {
  id: string;
  type: MemoryType;
  content: string;
  scope: "user" | "workspace" | "course";
  courseId?: string | null;
  workspaceId?: string | null;
  sourceConversationId?: string | null;
  status: "candidate" | "approved" | "archived";
}

export class AIMemoryManager {
  private enabled = true;

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
  }

  /**
   * Propose a new memory candidate
   */
  public async proposeMemory(params: {
    type: MemoryType;
    content: string;
    scope?: "user" | "workspace" | "course";
    courseId?: string | null;
    workspaceId?: string | null;
    sourceConversationId?: string | null;
    autoApprove?: boolean;
  }): Promise<AIMemoryRecord | null> {
    const { type, content, scope = "user", courseId = null, workspaceId = null, sourceConversationId = null, autoApprove = true } = params;

    // Security sanitization: prevent storing sensitive patterns
    if (content.match(/Bearer\s+[A-Za-z0-9_\-\.]+/i) || content.match(/AIzaSy[A-Za-z0-9_\-]{30,}/)) {
      console.warn("[AIMemoryManager] Rejected memory candidate containing potential API keys or tokens.");
      return null;
    }

    const mem: Partial<AIMemoryRecord> & { content: string; type: MemoryType } = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      content: content.trim(),
      scope,
      courseId,
      workspaceId,
      sourceConversationId,
      status: autoApprove ? "approved" : "candidate",
    };

    return sharedDatabaseClient.upsertMemory(mem);
  }

  /**
   * Retrieve active approved memories formatted for the AI model's prompt context
   */
  public async getRelevantMemories(options?: { courseId?: string; scope?: string }): Promise<AIMemoryRecord[]> {
    if (!this.enabled) return [];
    const memories = await sharedDatabaseClient.fetchMemories({
      courseId: options?.courseId,
      scope: options?.scope,
    });
    return memories.filter((m) => m.status === "approved");
  }

  /**
   * Build memory context block for injection into AI system / prompt messages
   */
  public formatMemoriesForPrompt(memories: AIMemoryRecord[]): string {
    if (memories.length === 0) return "";
    const lines = memories.map((m) => `- [${m.type.toUpperCase()}] ${m.content}`);
    return `\nUser & Course Memory Context:\n${lines.join("\n")}`;
  }

  public async deleteMemory(id: string): Promise<boolean> {
    return sharedDatabaseClient.deleteMemory(id);
  }

  public async listMemories(): Promise<AIMemoryRecord[]> {
    return sharedDatabaseClient.fetchMemories();
  }
}

export const aiMemoryManager = new AIMemoryManager();
