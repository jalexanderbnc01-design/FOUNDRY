/**
 * Foundry Stage 2 — Central AI Engine Shared Types (Phases 06–11)
 */

export type AIErrorCode =
  | "OLLAMA_UNREACHABLE"
  | "CONNECTION_REFUSED"
  | "HOST_UNREACHABLE"
  | "TIMEOUT"
  | "INVALID_URL"
  | "MODEL_NOT_SELECTED"
  | "MODEL_NOT_FOUND"
  | "TOOLS_UNSUPPORTED"
  | "MALFORMED_STREAM"
  | "CANCELLED"
  | "CONTEXT_OVERFLOW"
  | "PERMISSION_DENIED"
  | "APPROVAL_REQUIRED"
  | "VALIDATION_ERROR"
  | "CORS_OR_MIXED_CONTENT"
  | "UNAVAILABLE_OPERATION"
  | "HTTP_ERROR";

export type AIOperatingMode = "chat" | "assist" | "execute" | "review";

export type AIProviderConnectionMode = "backend" | "direct";

export interface OllamaSettings {
  enabled: boolean;
  baseUrl: string;
  connectionMode: AIProviderConnectionMode;
  selectedModel: string | null;
  streaming: boolean;
  temperature: number;
  numCtx: number;
  numPredict: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  keepAlive: string;
  timeoutMs: number;
  automaticFallback: boolean;
  autoDiscoverOnStartup: boolean;
}

export const DEFAULT_FRONTEND_OLLAMA_SETTINGS: OllamaSettings = {
  enabled: true,
  baseUrl: "http://127.0.0.1:11434",
  connectionMode: "backend",
  selectedModel: null,
  streaming: true,
  temperature: 0.3,
  numCtx: 4096,
  numPredict: 1024,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  keepAlive: "5m",
  timeoutMs: 60000,
  automaticFallback: false,
  autoDiscoverOnStartup: true,
};

export interface OllamaModel {
  name: string;
  model: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
  capabilities?: string[];
  supportsTools?: boolean;
  supportsVision?: boolean;
  supportsThinking?: boolean;
  contextLength?: number | null;
}

export interface OllamaRunningModel {
  name: string;
  model: string;
  size?: number;
  size_vram?: number;
  expires_at?: string;
}

export interface ProviderStatus {
  providerId: "ollama";
  enabled: boolean;
  connectionMode: AIProviderConnectionMode;
  baseUrl: string;
  connected: boolean;
  verified: boolean;
  version: string | null;
  latencyMs: number | null;
  lastCheckedAt: number | null;
  errorCode: AIErrorCode | null;
  error: string | null;
  guidance: string | null;
  isHostedOrigin: boolean;
}

export interface ContextAttachment {
  id: string;
  kind: "workspace" | "course" | "canvas_selection" | "canvas_object" | "application" | "file" | "note";
  title: string;
  subtitle?: string;
  content: string;
  mimeType?: string;
  truncated?: boolean;
  originalChars?: number;
  removable: boolean;
}

export interface ContextBudgetBreakdown {
  maxContextTokens: number;
  outputReserveTokens: number;
  availableInputTokens: number;
  systemTokens: number;
  contextTokens: number;
  historyTokens: number;
  promptTokens: number;
  totalEstimatedInputTokens: number;
  items: Array<{
    id: string;
    title: string;
    kind: ContextAttachment["kind"];
    estimatedTokens: number;
    included: boolean;
    removable: boolean;
    truncated?: boolean;
    reason?: string;
  }>;
  overflow: boolean;
}

export type AIActivityStage =
  | "connecting"
  | "loading_model"
  | "preparing_context"
  | "generating"
  | "requesting_tool"
  | "awaiting_approval"
  | "executing_tool"
  | "receiving_result"
  | "completed"
  | "cancelled"
  | "failed";

export interface AIActivityStep {
  id: string;
  stage: AIActivityStage;
  label: string;
  detail?: string;
  timestamp: number;
  durationMs?: number;
}

export interface AIToolCallRecord {
  id: string;
  toolName: string;
  arguments: Record<string, any>;
  status: "pending_approval" | "approved" | "rejected" | "denied" | "executed" | "failed" | "unavailable";
  result?: any;
  error?: string;
  durationMs?: number;
}

export interface PendingApproval {
  approvalId: string;
  conversationId: string;
  requestId: string;
  toolName: string;
  validatedArgs: Record<string, any>;
  summary: string;
  category: string;
  createdAt: number;
  status: "pending" | "approved" | "rejected";
}

export interface ChatSourceRef {
  id: string;
  title: string;
  detail: string;
  kind: string;
}

export interface ChatMessageMetrics {
  requestId: string;
  model: string;
  provider: string;
  startTime: number;
  firstTokenLatencyMs: number | null;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  tokensPerSec: number | null;
  estimated: boolean;
}

export interface ChatMessageError {
  code: AIErrorCode | string;
  message: string;
  guidance?: string;
  retryable?: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  createdAt: number;
  status: "streaming" | "awaiting_approval" | "completed" | "cancelled" | "error";
  model?: string | null;
  attachments?: ContextAttachment[];
  toolCalls?: AIToolCallRecord[];
  activity?: AIActivityStep[];
  sources?: ChatSourceRef[];
  approval?: PendingApproval | null;
  metrics?: ChatMessageMetrics | null;
  error?: ChatMessageError | null;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string | null;
  systemPrompt: string;
  mode: AIOperatingMode;
  activeCourseId: string | null;
  activeApplicationId: string | null;
  attachments: ContextAttachment[];
  selectedCanvasObjectIds: string[];
  disabledContextIds?: string[];
  toolHistory: AIToolCallRecord[];
  messages: ChatMessage[];
}

export interface AIExecutionMetric {
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
}

export type AIToolPermissionCategory =
  | "read"
  | "open_focus"
  | "create_modify"
  | "move_multiple"
  | "change_app_data"
  | "delete_data"
  | "external_share"
  | "system_command";

export type AIPolicyDecision = "allow" | "ask_first" | "deny";

export interface AIToolDefinition {
  name: string;
  namespace: string;
  description: string;
  category: AIToolPermissionCategory;
  available: boolean;
  unavailableReason?: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  handler?: (args: Record<string, any>) => Promise<any> | any;
}
