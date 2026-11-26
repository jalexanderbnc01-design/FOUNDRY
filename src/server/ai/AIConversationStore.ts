/**
 * Foundry Stage 2 — Durable SQLite AI Persistence Store
 * Persists AI provider settings, conversations, messages, and execution/usage logs
 * using node:sqlite with parameterized prepared statements.
 */
import { DatabaseSync, StatementSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_OLLAMA_SETTINGS, OllamaSettingsConfig } from "./OllamaAdapter";

export interface StoredConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string | null;
  systemPrompt: string;
  mode: string;
  activeCourseId: string | null;
  activeApplicationId: string | null;
  attachments: any[];
  selectedCanvasObjectIds: string[];
  toolHistory: any[];
  messages?: StoredMessage[];
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  createdAt: number;
  status: string;
  model?: string | null;
  attachments?: any[];
  toolCalls?: any[];
  toolResults?: any[];
  activity?: any[];
  sources?: any[];
  approval?: any;
  metrics?: any;
  error?: any;
}

export interface StoredUsageLog {
  requestId: string;
  conversationId: string;
  provider: string;
  model: string;
  startTime: number;
  firstTokenLatencyMs: number | null;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  tokensPerSec: number | null;
  estimatedMetrics: boolean;
  toolCallsCount: number;
  cancelled: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: number;
}

export class AIConversationStore {
  private dbPath: string;
  private db: DatabaseSync | null = null;
  private initialized = false;

  private stmtGetSetting: StatementSync | null = null;
  private stmtPutSetting: StatementSync | null = null;
  private stmtListConversations: StatementSync | null = null;
  private stmtGetConversation: StatementSync | null = null;
  private stmtUpsertConversation: StatementSync | null = null;
  private stmtDeleteConversation: StatementSync | null = null;
  private stmtGetMessages: StatementSync | null = null;
  private stmtUpsertMessage: StatementSync | null = null;
  private stmtDeleteMessagesForConv: StatementSync | null = null;
  private stmtInsertUsage: StatementSync | null = null;
  private stmtListUsage: StatementSync | null = null;

  constructor(customPath?: string) {
    this.dbPath =
      customPath || path.join(process.cwd(), "data", "whiteboard", "ai.sqlite");
  }

  public initialize(): void {
    if (this.initialized && this.db) return;
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSync(this.dbPath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec("PRAGMA synchronous = NORMAL;");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ai_conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        model TEXT,
        system_prompt TEXT NOT NULL DEFAULT '',
        mode TEXT NOT NULL DEFAULT 'assist',
        active_course_id TEXT,
        active_application_id TEXT,
        attachments_json TEXT NOT NULL DEFAULT '[]',
        selected_canvas_object_ids_json TEXT NOT NULL DEFAULT '[]',
        tool_history_json TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS ai_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        model TEXT,
        attachments_json TEXT,
        tool_calls_json TEXT,
        tool_results_json TEXT,
        activity_json TEXT,
        sources_json TEXT,
        approval_json TEXT,
        metrics_json TEXT,
        error_json TEXT,
        FOREIGN KEY(conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_messages(conversation_id, created_at ASC);

      CREATE TABLE IF NOT EXISTS ai_usage_logs (
        request_id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        first_token_latency_ms INTEGER,
        duration_ms INTEGER NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        tokens_per_sec REAL,
        estimated_metrics INTEGER NOT NULL DEFAULT 1,
        tool_calls_count INTEGER NOT NULL DEFAULT 0,
        cancelled INTEGER NOT NULL DEFAULT 0,
        error_code TEXT,
        error_message TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage_logs(created_at DESC);
    `);

    this.stmtGetSetting = this.db.prepare("SELECT value_json FROM ai_settings WHERE key = ?");
    this.stmtPutSetting = this.db.prepare(`
      INSERT INTO ai_settings (key, value_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `);

    this.stmtListConversations = this.db.prepare(
      "SELECT * FROM ai_conversations ORDER BY updated_at DESC LIMIT 100"
    );
    this.stmtGetConversation = this.db.prepare("SELECT * FROM ai_conversations WHERE id = ?");
    this.stmtUpsertConversation = this.db.prepare(`
      INSERT INTO ai_conversations (
        id, title, created_at, updated_at, model, system_prompt, mode,
        active_course_id, active_application_id, attachments_json,
        selected_canvas_object_ids_json, tool_history_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        updated_at = excluded.updated_at,
        model = excluded.model,
        system_prompt = excluded.system_prompt,
        mode = excluded.mode,
        active_course_id = excluded.active_course_id,
        active_application_id = excluded.active_application_id,
        attachments_json = excluded.attachments_json,
        selected_canvas_object_ids_json = excluded.selected_canvas_object_ids_json,
        tool_history_json = excluded.tool_history_json
    `);
    this.stmtDeleteConversation = this.db.prepare("DELETE FROM ai_conversations WHERE id = ?");

    this.stmtGetMessages = this.db.prepare(
      "SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC"
    );
    this.stmtUpsertMessage = this.db.prepare(`
      INSERT INTO ai_messages (
        id, conversation_id, role, content, created_at, status, model,
        attachments_json, tool_calls_json, tool_results_json, activity_json,
        sources_json, approval_json, metrics_json, error_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        role = excluded.role,
        content = excluded.content,
        status = excluded.status,
        model = excluded.model,
        attachments_json = excluded.attachments_json,
        tool_calls_json = excluded.tool_calls_json,
        tool_results_json = excluded.tool_results_json,
        activity_json = excluded.activity_json,
        sources_json = excluded.sources_json,
        approval_json = excluded.approval_json,
        metrics_json = excluded.metrics_json,
        error_json = excluded.error_json
    `);
    this.stmtDeleteMessagesForConv = this.db.prepare(
      "DELETE FROM ai_messages WHERE conversation_id = ?"
    );

    this.stmtInsertUsage = this.db.prepare(`
      INSERT INTO ai_usage_logs (
        request_id, conversation_id, provider, model, start_time,
        first_token_latency_ms, duration_ms, input_tokens, output_tokens,
        tokens_per_sec, estimated_metrics, tool_calls_count, cancelled,
        error_code, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(request_id) DO UPDATE SET
        first_token_latency_ms = excluded.first_token_latency_ms,
        duration_ms = excluded.duration_ms,
        input_tokens = excluded.input_tokens,
        output_tokens = excluded.output_tokens,
        tokens_per_sec = excluded.tokens_per_sec,
        estimated_metrics = excluded.estimated_metrics,
        tool_calls_count = excluded.tool_calls_count,
        cancelled = excluded.cancelled,
        error_code = excluded.error_code,
        error_message = excluded.error_message
    `);
    this.stmtListUsage = this.db.prepare(
      "SELECT * FROM ai_usage_logs ORDER BY created_at DESC LIMIT ?"
    );

    this.initialized = true;
  }

  public getOllamaSettings(): OllamaSettingsConfig {
    this.initialize();
    const row = this.stmtGetSetting!.get("ollama") as { value_json?: string } | undefined;
    if (!row?.value_json) {
      return { ...DEFAULT_OLLAMA_SETTINGS };
    }
    try {
      const parsed = JSON.parse(row.value_json);
      return {
        ...DEFAULT_OLLAMA_SETTINGS,
        ...parsed,
        automaticFallback: false,
      };
    } catch {
      return { ...DEFAULT_OLLAMA_SETTINGS };
    }
  }

  public updateOllamaSettings(partial: Partial<OllamaSettingsConfig>): OllamaSettingsConfig {
    this.initialize();
    const current = this.getOllamaSettings();
    const next: OllamaSettingsConfig = {
      ...current,
      ...partial,
      automaticFallback: false,
      temperature: clampNum(partial.temperature ?? current.temperature, 0, 2, 0.3),
      numCtx: Math.round(clampNum(partial.numCtx ?? current.numCtx, 512, 131072, 4096)),
      numPredict: Math.round(clampNum(partial.numPredict ?? current.numPredict, 64, 32768, 1024)),
      topP: clampNum(partial.topP ?? current.topP, 0.01, 1, 0.9),
      topK: Math.round(clampNum(partial.topK ?? current.topK, 1, 500, 40)),
      repeatPenalty: clampNum(partial.repeatPenalty ?? current.repeatPenalty, 0.5, 2.5, 1.1),
      timeoutMs: Math.round(clampNum(partial.timeoutMs ?? current.timeoutMs, 2000, 300000, 60000)),
    };
    this.stmtPutSetting!.run("ollama", JSON.stringify(next), Date.now());
    return next;
  }

  public listConversations(): StoredConversation[] {
    this.initialize();
    const rows = this.stmtListConversations!.all() as any[];
    return rows.map((r) => this.mapConversationRow(r, false));
  }

  public getConversation(id: string): StoredConversation | null {
    this.initialize();
    const row = this.stmtGetConversation!.get(id) as any;
    if (!row) return null;
    return this.mapConversationRow(row, true);
  }

  public saveConversation(conv: StoredConversation): StoredConversation {
    this.initialize();
    const now = Date.now();
    this.stmtUpsertConversation!.run(
      conv.id,
      conv.title || "New Conversation",
      conv.createdAt || now,
      conv.updatedAt || now,
      conv.model ?? null,
      conv.systemPrompt || "",
      conv.mode || "assist",
      conv.activeCourseId ?? null,
      conv.activeApplicationId ?? null,
      JSON.stringify(conv.attachments || []),
      JSON.stringify(conv.selectedCanvasObjectIds || []),
      JSON.stringify(conv.toolHistory || [])
    );

    if (Array.isArray(conv.messages)) {
      this.stmtDeleteMessagesForConv!.run(conv.id);
      for (const m of conv.messages) {
        this.stmtUpsertMessage!.run(
          m.id,
          conv.id,
          m.role,
          m.content || "",
          m.createdAt || now,
          m.status || "completed",
          m.model ?? null,
          m.attachments ? JSON.stringify(m.attachments) : null,
          m.toolCalls ? JSON.stringify(m.toolCalls) : null,
          m.toolResults ? JSON.stringify(m.toolResults) : null,
          m.activity ? JSON.stringify(m.activity) : null,
          m.sources ? JSON.stringify(m.sources) : null,
          m.approval ? JSON.stringify(m.approval) : null,
          m.metrics ? JSON.stringify(m.metrics) : null,
          m.error ? JSON.stringify(m.error) : null
        );
      }
    }
    return this.getConversation(conv.id)!;
  }

  public deleteConversation(id: string): boolean {
    this.initialize();
    const res = this.stmtDeleteConversation!.run(id);
    return Number(res.changes || 0) > 0;
  }

  public recordUsage(entry: StoredUsageLog): void {
    this.initialize();
    this.stmtInsertUsage!.run(
      entry.requestId,
      entry.conversationId || "",
      entry.provider || "ollama",
      entry.model || "",
      entry.startTime || Date.now(),
      entry.firstTokenLatencyMs ?? null,
      Math.max(0, Math.round(entry.durationMs || 0)),
      Math.max(0, Math.round(entry.inputTokens || 0)),
      Math.max(0, Math.round(entry.outputTokens || 0)),
      entry.tokensPerSec ?? null,
      entry.estimatedMetrics ? 1 : 0,
      Math.max(0, Math.round(entry.toolCallsCount || 0)),
      entry.cancelled ? 1 : 0,
      entry.errorCode ?? null,
      entry.errorMessage ?? null,
      entry.createdAt || Date.now()
    );
  }

  public getUsage(limit = 100): { logs: StoredUsageLog[]; summary: Record<string, any> } {
    this.initialize();
    const rows = this.stmtListUsage!.all(Math.min(500, Math.max(1, limit))) as any[];
    const logs: StoredUsageLog[] = rows.map((r) => ({
      requestId: r.request_id,
      conversationId: r.conversation_id,
      provider: r.provider,
      model: r.model,
      startTime: r.start_time,
      firstTokenLatencyMs: r.first_token_latency_ms,
      durationMs: r.duration_ms,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      tokensPerSec: r.tokens_per_sec,
      estimatedMetrics: Boolean(r.estimated_metrics),
      toolCallsCount: r.tool_calls_count,
      cancelled: Boolean(r.cancelled),
      errorCode: r.error_code,
      errorMessage: r.error_message,
      createdAt: r.created_at,
    }));

    const totalRequests = logs.length;
    const totalInputTokens = logs.reduce((s, l) => s + l.inputTokens, 0);
    const totalOutputTokens = logs.reduce((s, l) => s + l.outputTokens, 0);
    const completed = logs.filter((l) => !l.cancelled && !l.errorCode);
    const latencies = completed
      .map((l) => l.firstTokenLatencyMs)
      .filter((v): v is number => typeof v === "number" && v >= 0);
    const avgFirstTokenLatencyMs = latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;

    return {
      logs,
      summary: {
        totalRequests,
        completedRequests: completed.length,
        cancelledRequests: logs.filter((l) => l.cancelled).length,
        failedRequests: logs.filter((l) => Boolean(l.errorCode) && !l.cancelled).length,
        totalInputTokens,
        totalOutputTokens,
        avgFirstTokenLatencyMs,
      },
    };
  }

  private mapConversationRow(row: any, includeMessages: boolean): StoredConversation {
    const conv: StoredConversation = {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      model: row.model ?? null,
      systemPrompt: row.system_prompt || "",
      mode: row.mode || "assist",
      activeCourseId: row.active_course_id ?? null,
      activeApplicationId: row.active_application_id ?? null,
      attachments: safeParseJson(row.attachments_json, []),
      selectedCanvasObjectIds: safeParseJson(row.selected_canvas_object_ids_json, []),
      toolHistory: safeParseJson(row.tool_history_json, []),
    };
    if (includeMessages) {
      const mRows = this.stmtGetMessages!.all(row.id) as any[];
      conv.messages = mRows.map((m) => ({
        id: m.id,
        conversationId: m.conversation_id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
        status: m.status,
        model: m.model ?? null,
        attachments: safeParseJson(m.attachments_json, undefined),
        toolCalls: safeParseJson(m.tool_calls_json, undefined),
        toolResults: safeParseJson(m.tool_results_json, undefined),
        activity: safeParseJson(m.activity_json, undefined),
        sources: safeParseJson(m.sources_json, undefined),
        approval: safeParseJson(m.approval_json, undefined),
        metrics: safeParseJson(m.metrics_json, undefined),
        error: safeParseJson(m.error_json, undefined),
      }));
    }
    return conv;
  }
}

function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function clampNum(val: any, min: number, max: number, fallback: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export const aiStore = new AIConversationStore();
