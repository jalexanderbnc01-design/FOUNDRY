/**
 * Foundry Stage 2 — Backend Ollama Provider Adapter & Provider Contract (Phase 07)
 * Implements validated communication with local or user-configured Ollama servers
 * over /api/version, /api/tags, /api/ps, /api/show, /api/chat, and /api/generate.
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
  | "HTTP_ERROR";

export interface OllamaSettingsConfig {
  enabled: boolean;
  baseUrl: string;
  connectionMode: "backend" | "direct";
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

export const DEFAULT_OLLAMA_SETTINGS: OllamaSettingsConfig = {
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

export interface OllamaModelInfo {
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
  contextLength?: number;
}

export interface OllamaRunningModel {
  name: string;
  model: string;
  size?: number;
  size_vram?: number;
  expires_at?: string;
  details?: Record<string, any>;
}

export interface OllamaModelInspectResult {
  model: string;
  capabilities: string[];
  supportsTools: boolean;
  supportsVision: boolean;
  supportsThinking: boolean;
  contextLength: number | null;
  details: Record<string, any>;
  parameters: string;
}

export interface OllamaConnectionTestResult {
  ok: boolean;
  connected: boolean;
  baseUrl: string;
  version: string | null;
  latencyMs: number;
  errorCode?: AIErrorCode;
  error?: string;
  guidance?: string;
}

export interface OllamaToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface OllamaChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    id?: string;
    function: {
      name: string;
      arguments: Record<string, any> | string;
    };
  }>;
  tool_name?: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  tools?: OllamaToolDefinition[];
  stream?: boolean;
  options?: {
    temperature?: number;
    num_ctx?: number;
    num_predict?: number;
    top_p?: number;
    top_k?: number;
    repeat_penalty?: number;
  };
  keep_alive?: string;
}

export interface OllamaStreamEvent {
  type: "chunk" | "tool_calls" | "done" | "error";
  content?: string;
  thinking?: string;
  toolCalls?: Array<{
    id?: string;
    function: {
      name: string;
      arguments: Record<string, any>;
    };
  }>;
  model?: string;
  doneReason?: string;
  metrics?: {
    promptEvalCount?: number;
    evalCount?: number;
    totalDurationNs?: number;
    loadDurationNs?: number;
    promptEvalDurationNs?: number;
    evalDurationNs?: number;
    tokensPerSec?: number;
  };
  errorCode?: AIErrorCode;
  error?: string;
}

export interface AIProviderAdapter {
  readonly id: string;
  readonly name: string;
  testConnection(baseUrl: string, timeoutMs?: number): Promise<OllamaConnectionTestResult>;
  discoverModels(baseUrl: string, timeoutMs?: number): Promise<OllamaModelInfo[]>;
  getRunningModels(baseUrl: string, timeoutMs?: number): Promise<OllamaRunningModel[]>;
  getModelInfo(baseUrl: string, model: string, timeoutMs?: number): Promise<OllamaModelInspectResult>;
  generate(
    baseUrl: string,
    payload: {
      model: string;
      prompt: string;
      options?: OllamaChatRequest["options"];
      keep_alive?: string;
    },
    timeoutMs?: number
  ): Promise<{ response: string; metrics: OllamaStreamEvent["metrics"] }>;
  streamChat(
    baseUrl: string,
    payload: OllamaChatRequest,
    onEvent: (event: OllamaStreamEvent) => void,
    signal?: AbortSignal,
    timeoutMs?: number
  ): Promise<void>;
}

const BLOCKED_METADATA_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal",
  "metadata.goog",
  "metadata",
]);

export function validateOllamaBaseUrl(rawUrl: string): { ok: true; origin: string } | { ok: false; error: string } {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { ok: false, error: "Ollama base URL is required" };
  }
  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: `Invalid Ollama URL format: "${trimmed}"` };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: `Unsupported URL protocol "${parsed.protocol}". Use http:// or https://.` };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "Credentials inside the Ollama URL are not permitted." };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    BLOCKED_METADATA_HOSTS.has(host) ||
    host.startsWith("169.254.") ||
    host === "0.0.0.0"
  ) {
    return { ok: false, error: `Host "${host}" is blocked by Foundry endpoint security policy.` };
  }

  return { ok: true, origin: parsed.origin };
}

function classifyNetworkError(err: any, baseUrl: string): { code: AIErrorCode; message: string; guidance: string } {
  const name = err?.name || "";
  const causeCode = err?.cause?.code || err?.code || "";
  const msg = String(err?.message || err || "Unknown network failure");

  if (name === "AbortError" || causeCode === "ABORT_ERR") {
    if (err?.isUserCancel) {
      return {
        code: "CANCELLED",
        message: "Generation cancelled by user.",
        guidance: "",
      };
    }
    return {
      code: "TIMEOUT",
      message: `Ollama request to ${baseUrl} timed out.`,
      guidance: "Verify Ollama is responsive, model weights fit in memory, or increase Timeout (ms) in Ollama Settings.",
    };
  }

  if (causeCode === "ECONNREFUSED" || msg.includes("ECONNREFUSED")) {
    return {
      code: "CONNECTION_REFUSED",
      message: `Connection refused at ${baseUrl}.`,
      guidance:
        "Ensure Ollama is running locally (`ollama serve`), or if Foundry runs in a cloud preview, switch Connection Mode to 'Direct Browser / Local Bridge' with OLLAMA_ORIGINS configured.",
    };
  }

  if (causeCode === "ENOTFOUND" || causeCode === "EAI_AGAIN" || causeCode === "EHOSTUNREACH") {
    return {
      code: "HOST_UNREACHABLE",
      message: `Host unreachable for ${baseUrl} (${causeCode}).`,
      guidance: "Check the configured Ollama URL or local AI bridge hostname.",
    };
  }

  return {
    code: "OLLAMA_UNREACHABLE",
    message: `Unable to reach Ollama at ${baseUrl}: ${msg}`,
    guidance: "Start Ollama (`ollama serve`) or verify your Direct/Local AI Bridge URL.",
  };
}

function computeTokensPerSec(evalCount?: number, evalDurationNs?: number): number | undefined {
  if (
    typeof evalCount === "number" &&
    typeof evalDurationNs === "number" &&
    evalCount > 0 &&
    evalDurationNs > 0
  ) {
    return Number((evalCount / (evalDurationNs / 1e9)).toFixed(2));
  }
  return undefined;
}

export class OllamaProviderAdapter implements AIProviderAdapter {
  public readonly id = "ollama";
  public readonly name = "Ollama";

  async testConnection(baseUrl: string, timeoutMs = 5000): Promise<OllamaConnectionTestResult> {
    const validated = validateOllamaBaseUrl(baseUrl);
    if (validated.ok === false) {
      return {
        ok: false,
        connected: false,
        baseUrl,
        version: null,
        latencyMs: 0,
        errorCode: "INVALID_URL",
        error: validated.error,
        guidance: "Enter a valid http:// or https:// Ollama endpoint such as http://127.0.0.1:11434.",
      };
    }

    const origin = validated.origin;
    const t0 = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(15000, timeoutMs)));

    try {
      const res = await fetch(`${origin}/api/version`, {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      const latencyMs = Date.now() - t0;

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        return {
          ok: false,
          connected: false,
          baseUrl: origin,
          version: null,
          latencyMs,
          errorCode: "HTTP_ERROR",
          error: `Ollama returned HTTP ${res.status}${bodyText ? `: ${bodyText.slice(0, 160)}` : ""}`,
          guidance: "Verify the configured URL points to an active Ollama API server.",
        };
      }

      const data = await res.json().catch(() => null);
      if (!data || typeof data.version !== "string") {
        return {
          ok: false,
          connected: false,
          baseUrl: origin,
          version: null,
          latencyMs,
          errorCode: "HTTP_ERROR",
          error: "Endpoint responded, but did not return a valid Ollama /api/version payload.",
          guidance: "Check that the URL points to Ollama rather than another web service.",
        };
      }

      return {
        ok: true,
        connected: true,
        baseUrl: origin,
        version: data.version,
        latencyMs,
      };
    } catch (err: any) {
      const classified = classifyNetworkError(err, origin);
      return {
        ok: false,
        connected: false,
        baseUrl: origin,
        version: null,
        latencyMs: Date.now() - t0,
        errorCode: classified.code,
        error: classified.message,
        guidance: classified.guidance,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async discoverModels(baseUrl: string, timeoutMs = 8000): Promise<OllamaModelInfo[]> {
    const validated = validateOllamaBaseUrl(baseUrl);
    if (validated.ok === false) {
      throw Object.assign(new Error(validated.error), { code: "INVALID_URL" });
    }
    const origin = validated.origin;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(20000, timeoutMs)));

    try {
      const res = await fetch(`${origin}/api/tags`, {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw Object.assign(new Error(`Ollama /api/tags failed (HTTP ${res.status}): ${text}`), {
          code: "HTTP_ERROR",
        });
      }
      const data = await res.json();
      const models = Array.isArray(data?.models) ? data.models : [];
      return models.map((m: any) => ({
        name: String(m.name || m.model || ""),
        model: String(m.model || m.name || ""),
        modified_at: m.modified_at,
        size: typeof m.size === "number" ? m.size : undefined,
        digest: m.digest,
        details: m.details || undefined,
      }));
    } catch (err: any) {
      if (err?.code) throw err;
      const classified = classifyNetworkError(err, origin);
      throw Object.assign(new Error(classified.message), {
        code: classified.code,
        guidance: classified.guidance,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async getRunningModels(baseUrl: string, timeoutMs = 5000): Promise<OllamaRunningModel[]> {
    const validated = validateOllamaBaseUrl(baseUrl);
    if (validated.ok === false) {
      throw Object.assign(new Error(validated.error), { code: "INVALID_URL" });
    }
    const origin = validated.origin;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(15000, timeoutMs)));

    try {
      const res = await fetch(`${origin}/api/ps`, {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw Object.assign(new Error(`Ollama /api/ps failed (HTTP ${res.status}): ${text}`), {
          code: "HTTP_ERROR",
        });
      }
      const data = await res.json();
      return Array.isArray(data?.models) ? data.models : [];
    } catch (err: any) {
      if (err?.code) throw err;
      const classified = classifyNetworkError(err, origin);
      throw Object.assign(new Error(classified.message), {
        code: classified.code,
        guidance: classified.guidance,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async getModelInfo(baseUrl: string, model: string, timeoutMs = 8000): Promise<OllamaModelInspectResult> {
    const validated = validateOllamaBaseUrl(baseUrl);
    if (validated.ok === false) {
      throw Object.assign(new Error(validated.error), { code: "INVALID_URL" });
    }
    if (!model || typeof model !== "string") {
      throw Object.assign(new Error("Model name is required"), { code: "MODEL_NOT_SELECTED" });
    }
    const origin = validated.origin;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(20000, timeoutMs)));

    try {
      const res = await fetch(`${origin}/api/show`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ model }),
      });

      if (res.status === 404) {
        throw Object.assign(new Error(`Model "${model}" was not found in Ollama.`), {
          code: "MODEL_NOT_FOUND",
        });
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw Object.assign(new Error(`Ollama /api/show failed (HTTP ${res.status}): ${text}`), {
          code: "HTTP_ERROR",
        });
      }

      const data = await res.json();
      const capabilities: string[] = Array.isArray(data?.capabilities)
        ? data.capabilities.map((c: unknown) => String(c))
        : [];
      const templateStr = typeof data?.template === "string" ? data.template : "";
      const supportsTools =
        capabilities.includes("tools") || templateStr.includes(".Tools");
      const supportsVision = capabilities.includes("vision");
      const supportsThinking = capabilities.includes("thinking");

      let contextLength: number | null = null;
      if (data?.model_info && typeof data.model_info === "object") {
        for (const [k, v] of Object.entries(data.model_info)) {
          if (k.endsWith(".context_length") && typeof v === "number" && Number.isFinite(v)) {
            contextLength = v;
            break;
          }
        }
      }

      return {
        model,
        capabilities,
        supportsTools,
        supportsVision,
        supportsThinking,
        contextLength,
        details: data?.details || {},
        parameters: typeof data?.parameters === "string" ? data.parameters : "",
      };
    } catch (err: any) {
      if (err?.code) throw err;
      const classified = classifyNetworkError(err, origin);
      throw Object.assign(new Error(classified.message), {
        code: classified.code,
        guidance: classified.guidance,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async generate(
    baseUrl: string,
    payload: {
      model: string;
      prompt: string;
      options?: OllamaChatRequest["options"];
      keep_alive?: string;
    },
    timeoutMs = 30000
  ): Promise<{ response: string; metrics: OllamaStreamEvent["metrics"] }> {
    const validated = validateOllamaBaseUrl(baseUrl);
    if (validated.ok === false) {
      throw Object.assign(new Error(validated.error), { code: "INVALID_URL" });
    }
    const origin = validated.origin;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(2000, Math.min(180000, timeoutMs)));

    try {
      const res = await fetch(`${origin}/api/generate`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          model: payload.model,
          prompt: payload.prompt,
          stream: false,
          options: payload.options,
          keep_alive: payload.keep_alive,
        }),
      });

      if (res.status === 404) {
        throw Object.assign(new Error(`Model "${payload.model}" not found in Ollama.`), {
          code: "MODEL_NOT_FOUND",
        });
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw Object.assign(new Error(`Ollama /api/generate failed (HTTP ${res.status}): ${text}`), {
          code: "HTTP_ERROR",
        });
      }

      const data = await res.json();
      return {
        response: typeof data?.response === "string" ? data.response : "",
        metrics: {
          promptEvalCount: data?.prompt_eval_count,
          evalCount: data?.eval_count,
          totalDurationNs: data?.total_duration,
          loadDurationNs: data?.load_duration,
          promptEvalDurationNs: data?.prompt_eval_duration,
          evalDurationNs: data?.eval_duration,
          tokensPerSec: computeTokensPerSec(data?.eval_count, data?.eval_duration),
        },
      };
    } catch (err: any) {
      if (err?.code) throw err;
      const classified = classifyNetworkError(err, origin);
      throw Object.assign(new Error(classified.message), {
        code: classified.code,
        guidance: classified.guidance,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async streamChat(
    baseUrl: string,
    payload: OllamaChatRequest,
    onEvent: (event: OllamaStreamEvent) => void,
    signal?: AbortSignal,
    timeoutMs = 60000
  ): Promise<void> {
    const validated = validateOllamaBaseUrl(baseUrl);
    if (validated.ok === false) {
      onEvent({ type: "error", errorCode: "INVALID_URL", error: validated.error });
      return;
    }
    const origin = validated.origin;

    const internalCtrl = new AbortController();
    let timedOut = false;
    let userCancelled = false;

    const onExternalAbort = () => {
      userCancelled = true;
      internalCtrl.abort();
    };
    if (signal) {
      if (signal.aborted) {
        onEvent({ type: "error", errorCode: "CANCELLED", error: "Generation cancelled." });
        return;
      }
      signal.addEventListener("abort", onExternalAbort, { once: true });
    }

    const timer = setTimeout(() => {
      timedOut = true;
      internalCtrl.abort();
    }, Math.max(2000, Math.min(300000, timeoutMs)));

    try {
      const wantStream = payload.stream !== false;
      const bodyPayload: Record<string, any> = {
        model: payload.model,
        messages: payload.messages,
        stream: wantStream,
      };
      if (payload.tools && payload.tools.length > 0) {
        bodyPayload.tools = payload.tools;
      }
      if (payload.options) {
        bodyPayload.options = payload.options;
      }
      if (payload.keep_alive) {
        bodyPayload.keep_alive = payload.keep_alive;
      }

      const res = await fetch(`${origin}/api/chat`, {
        method: "POST",
        signal: internalCtrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const rawErr = await res.text().catch(() => "");
        let parsedMsg = rawErr;
        try {
          const j = JSON.parse(rawErr);
          if (j?.error) parsedMsg = j.error;
        } catch {}

        const lower = (parsedMsg || "").toLowerCase();
        if (res.status === 404 || lower.includes("not found")) {
          onEvent({
            type: "error",
            errorCode: "MODEL_NOT_FOUND",
            error: parsedMsg || `Model "${payload.model}" not found in Ollama.`,
          });
          return;
        }
        if (lower.includes("does not support tools")) {
          onEvent({
            type: "error",
            errorCode: "TOOLS_UNSUPPORTED",
            error: parsedMsg,
          });
          return;
        }
        onEvent({
          type: "error",
          errorCode: "HTTP_ERROR",
          error: `Ollama HTTP ${res.status}: ${parsedMsg || res.statusText}`,
        });
        return;
      }

      if (!wantStream) {
        const data = await res.json();
        if (data?.message?.content) {
          onEvent({ type: "chunk", content: data.message.content, thinking: data.message.thinking });
        }
        if (Array.isArray(data?.message?.tool_calls) && data.message.tool_calls.length > 0) {
          onEvent({
            type: "tool_calls",
            toolCalls: normalizeToolCalls(data.message.tool_calls),
          });
        }
        onEvent({
          type: "done",
          model: data?.model || payload.model,
          doneReason: data?.done_reason || "stop",
          metrics: {
            promptEvalCount: data?.prompt_eval_count,
            evalCount: data?.eval_count,
            totalDurationNs: data?.total_duration,
            loadDurationNs: data?.load_duration,
            promptEvalDurationNs: data?.prompt_eval_duration,
            evalDurationNs: data?.eval_duration,
            tokensPerSec: computeTokensPerSec(data?.eval_count, data?.eval_duration),
          },
        });
        return;
      }

      if (!res.body) {
        onEvent({
          type: "error",
          errorCode: "MALFORMED_STREAM",
          error: "Ollama returned an empty response body for streaming chat.",
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let emittedDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nlIdx: number;
        while ((nlIdx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nlIdx).trim();
          buffer = buffer.slice(nlIdx + 1);
          if (!line) continue;

          let parsed: any;
          try {
            parsed = JSON.parse(line);
          } catch {
            onEvent({
              type: "error",
              errorCode: "MALFORMED_STREAM",
              error: `Malformed JSON line in Ollama stream: ${line.slice(0, 120)}`,
            });
            return;
          }

          if (parsed?.error) {
            const lower = String(parsed.error).toLowerCase();
            onEvent({
              type: "error",
              errorCode: lower.includes("does not support tools")
                ? "TOOLS_UNSUPPORTED"
                : lower.includes("not found")
                ? "MODEL_NOT_FOUND"
                : "HTTP_ERROR",
              error: String(parsed.error),
            });
            return;
          }

          const msg = parsed?.message;
          if (msg) {
            if (typeof msg.content === "string" && msg.content.length > 0) {
              onEvent({
                type: "chunk",
                content: msg.content,
                thinking: typeof msg.thinking === "string" ? msg.thinking : undefined,
              });
            } else if (typeof msg.thinking === "string" && msg.thinking.length > 0) {
              onEvent({ type: "chunk", content: "", thinking: msg.thinking });
            }

            if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
              onEvent({
                type: "tool_calls",
                toolCalls: normalizeToolCalls(msg.tool_calls),
              });
            }
          }

          if (parsed?.done) {
            emittedDone = true;
            onEvent({
              type: "done",
              model: parsed?.model || payload.model,
              doneReason: parsed?.done_reason || "stop",
              metrics: {
                promptEvalCount: parsed?.prompt_eval_count,
                evalCount: parsed?.eval_count,
                totalDurationNs: parsed?.total_duration,
                loadDurationNs: parsed?.load_duration,
                promptEvalDurationNs: parsed?.prompt_eval_duration,
                evalDurationNs: parsed?.eval_duration,
                tokensPerSec: computeTokensPerSec(parsed?.eval_count, parsed?.eval_duration),
              },
            });
          }
        }
      }

      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim());
          if (parsed?.message?.content) {
            onEvent({ type: "chunk", content: parsed.message.content });
          }
          if (Array.isArray(parsed?.message?.tool_calls) && parsed.message.tool_calls.length > 0) {
            onEvent({ type: "tool_calls", toolCalls: normalizeToolCalls(parsed.message.tool_calls) });
          }
          if (parsed?.done && !emittedDone) {
            emittedDone = true;
            onEvent({
              type: "done",
              model: parsed?.model || payload.model,
              doneReason: parsed?.done_reason || "stop",
              metrics: {
                promptEvalCount: parsed?.prompt_eval_count,
                evalCount: parsed?.eval_count,
                totalDurationNs: parsed?.total_duration,
                loadDurationNs: parsed?.load_duration,
                promptEvalDurationNs: parsed?.prompt_eval_duration,
                evalDurationNs: parsed?.eval_duration,
                tokensPerSec: computeTokensPerSec(parsed?.eval_count, parsed?.eval_duration),
              },
            });
          }
        } catch {
          onEvent({
            type: "error",
            errorCode: "MALFORMED_STREAM",
            error: "Ollama stream ended with incomplete JSON chunk.",
          });
          return;
        }
      }

      if (!emittedDone) {
        onEvent({ type: "done", model: payload.model, doneReason: "eof" });
      }
    } catch (err: any) {
      if (userCancelled) {
        onEvent({ type: "error", errorCode: "CANCELLED", error: "Generation cancelled by user." });
      } else if (timedOut) {
        onEvent({
          type: "error",
          errorCode: "TIMEOUT",
          error: `Ollama streaming chat timed out after ${timeoutMs}ms.`,
        });
      } else {
        const classified = classifyNetworkError(err, origin);
        onEvent({ type: "error", errorCode: classified.code, error: classified.message });
      }
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onExternalAbort);
    }
  }
}

function normalizeToolCalls(rawCalls: any[]): Array<{
  id?: string;
  function: { name: string; arguments: Record<string, any> };
}> {
  return rawCalls
    .filter((c) => c && c.function && typeof c.function.name === "string")
    .map((c, idx) => {
      let args: Record<string, any> = {};
      if (typeof c.function.arguments === "string") {
        try {
          args = JSON.parse(c.function.arguments);
        } catch {
          args = {};
        }
      } else if (c.function.arguments && typeof c.function.arguments === "object") {
        args = c.function.arguments;
      }
      return {
        id: typeof c.id === "string" ? c.id : `tc_${Date.now()}_${idx}`,
        function: {
          name: c.function.name,
          arguments: args,
        },
      };
    });
}

export const ollamaAdapter = new OllamaProviderAdapter();
