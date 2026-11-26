/**
 * Foundry Stage 2 — Frontend AIProviderAdapter & Ollama Adapter (Phase 07)
 * Supports BOTH:
 * - Local Backend Proxy Mode: calls Foundry Express server (/api/ai/* -> Ollama)
 * - Direct Browser / Local Bridge Mode: calls user-configured local bridge/Ollama URL
 *   directly from browser with clear CORS/HTTPS diagnostics when blocked.
 */
import {
  AIErrorCode,
  AIProviderConnectionMode,
  OllamaModel,
  OllamaRunningModel,
  OllamaSettings,
} from "./types";

export interface OllamaConnectionProbe {
  ok: boolean;
  connected: boolean;
  baseUrl: string;
  version: string | null;
  latencyMs: number;
  errorCode?: AIErrorCode;
  error?: string;
  guidance?: string;
  models?: OllamaModel[];
}

export interface StreamChatCallbacks {
  onMeta?: (meta: { requestId: string; model: string }) => void;
  onChunk?: (chunk: string, thinking?: string) => void;
  onToolCalls?: (toolCalls: Array<{ id?: string; function: { name: string; arguments: Record<string, any> } }>) => void;
  onDone?: (info: {
    model?: string;
    doneReason?: string;
    metrics?: {
      promptEvalCount?: number;
      evalCount?: number;
      totalDurationNs?: number;
      evalDurationNs?: number;
      tokensPerSec?: number;
    };
  }) => void;
  onError?: (err: { code: AIErrorCode; message: string; guidance?: string }) => void;
}

export interface AIProviderClientAdapter {
  readonly id: string;
  testConnection(settings: OllamaSettings): Promise<OllamaConnectionProbe>;
  discoverModels(settings: OllamaSettings): Promise<OllamaModel[]>;
  getRunningModels(settings: OllamaSettings): Promise<OllamaRunningModel[]>;
  getModelInfo(settings: OllamaSettings, model: string): Promise<{
    model: string;
    capabilities: string[];
    supportsTools: boolean;
    supportsVision: boolean;
    supportsThinking: boolean;
    contextLength: number | null;
    details: Record<string, any>;
  }>;
  testGenerate(settings: OllamaSettings, model: string, prompt: string): Promise<{
    response: string;
    latencyMs: number;
    metrics?: any;
  }>;
  streamChat(
    params: {
      requestId: string;
      conversationId: string;
      model: string;
      messages: Array<{
        role: string;
        content: string;
        tool_calls?: any[];
        tool_name?: string;
      }>;
      tools?: any[];
      settings: OllamaSettings;
    },
    callbacks: StreamChatCallbacks,
    signal: AbortSignal
  ): Promise<void>;
  cancelGeneration(requestId: string, mode: AIProviderConnectionMode): Promise<void>;
}

export function isHostedBrowserOrigin(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host !== "localhost" && host !== "127.0.0.1" && host !== "::1";
}

function normalizeOrigin(rawUrl: string): string {
  const u = new URL(rawUrl.trim());
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw Object.assign(new Error(`Unsupported protocol ${u.protocol}`), { code: "INVALID_URL" });
  }
  return u.origin;
}

function classifyBrowserDirectError(err: any, baseUrl: string): {
  code: AIErrorCode;
  message: string;
  guidance: string;
} {
  if (err?.name === "AbortError") {
    return {
      code: "TIMEOUT",
      message: `Direct request to ${baseUrl} timed out or was cancelled.`,
      guidance: "Verify local Ollama/bridge is running and responsive.",
    };
  }
  const isHttpsPage = typeof window !== "undefined" && window.location.protocol === "https:";
  const isHttpTarget = baseUrl.startsWith("http://");
  const isLoopback = baseUrl.includes("127.0.0.1") || baseUrl.includes("localhost");

  if (isHttpsPage && isHttpTarget && !isLoopback) {
    return {
      code: "CORS_OR_MIXED_CONTENT",
      message: `Browser blocked HTTPS -> HTTP mixed-content request to ${baseUrl}.`,
      guidance: "Use an https:// local bridge tunnel (e.g. Caddy/ngrok/Cloudflare Tunnel) or run Foundry locally on http://localhost:3000.",
    };
  }

  return {
    code: "CORS_OR_MIXED_CONTENT",
    message: `Browser could not connect directly to ${baseUrl}.`,
    guidance: `Ensure Ollama is running with CORS allowed for this origin: set OLLAMA_ORIGINS="${typeof window !== "undefined" ? window.location.origin : "*"}" before starting \`ollama serve\`, or use an HTTPS local AI bridge.`,
  };
}

export class OllamaFrontendAdapter implements AIProviderClientAdapter {
  public readonly id = "ollama";

  async testConnection(settings: OllamaSettings): Promise<OllamaConnectionProbe> {
    if (settings.connectionMode === "direct") {
      return this.testDirect(settings.baseUrl, settings.timeoutMs);
    }
    try {
      const res = await fetch("/api/ai/providers/ollama/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: settings.baseUrl }),
      });
      const data = await res.json();
      let guidance = data.guidance || "";
      if (!data.connected && isHostedBrowserOrigin() && settings.baseUrl.includes("127.0.0.1")) {
        guidance =
          "Foundry server is running remotely and cannot reach 127.0.0.1 on your machine. Run Foundry locally with `ollama serve`, or switch Connection Mode to 'Direct Browser / Local Bridge' and configure OLLAMA_ORIGINS.";
      }
      return {
        ok: Boolean(data.ok),
        connected: Boolean(data.connected),
        baseUrl: data.baseUrl || settings.baseUrl,
        version: data.version || null,
        latencyMs: Number(data.latencyMs || 0),
        errorCode: data.errorCode,
        error: data.error,
        guidance: guidance || undefined,
        models: Array.isArray(data.models) ? data.models : undefined,
      };
    } catch (err: any) {
      return {
        ok: false,
        connected: false,
        baseUrl: settings.baseUrl,
        version: null,
        latencyMs: 0,
        errorCode: "OLLAMA_UNREACHABLE",
        error: err?.message || "Failed to contact Foundry AI backend.",
      };
    }
  }

  private async testDirect(baseUrl: string, timeoutMs: number): Promise<OllamaConnectionProbe> {
    let origin = baseUrl;
    try {
      origin = normalizeOrigin(baseUrl);
    } catch (err: any) {
      return {
        ok: false,
        connected: false,
        baseUrl,
        version: null,
        latencyMs: 0,
        errorCode: "INVALID_URL",
        error: err?.message || "Invalid URL",
      };
    }

    const t0 = Date.now();
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), Math.min(8000, timeoutMs || 5000));
    try {
      const res = await fetch(`${origin}/api/version`, { signal: ctrl.signal });
      const latencyMs = Date.now() - t0;
      if (!res.ok) {
        return {
          ok: false,
          connected: false,
          baseUrl: origin,
          version: null,
          latencyMs,
          errorCode: "HTTP_ERROR",
          error: `HTTP ${res.status} from ${origin}/api/version`,
        };
      }
      const data = await res.json();
      const models = await this.discoverDirect(origin, timeoutMs).catch(() => []);
      return {
        ok: true,
        connected: true,
        baseUrl: origin,
        version: data?.version || "unknown",
        latencyMs,
        models,
      };
    } catch (err: any) {
      const classified = classifyBrowserDirectError(err, origin);
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
      window.clearTimeout(timer);
    }
  }

  async discoverModels(settings: OllamaSettings): Promise<OllamaModel[]> {
    if (settings.connectionMode === "direct") {
      return this.discoverDirect(normalizeOrigin(settings.baseUrl), settings.timeoutMs);
    }
    const qs = encodeURIComponent(settings.baseUrl);
    const res = await fetch(`/api/ai/providers/ollama/models?baseUrl=${qs}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw Object.assign(new Error(data.error || "Failed to list Ollama models"), {
        code: data.errorCode || "OLLAMA_UNREACHABLE",
        guidance: data.guidance,
      });
    }
    return Array.isArray(data.models) ? data.models : [];
  }

  private async discoverDirect(origin: string, timeoutMs: number): Promise<OllamaModel[]> {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), Math.min(10000, timeoutMs || 8000));
    try {
      const res = await fetch(`${origin}/api/tags`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data?.models) ? data.models : [];
    } finally {
      window.clearTimeout(timer);
    }
  }

  async getRunningModels(settings: OllamaSettings): Promise<OllamaRunningModel[]> {
    if (settings.connectionMode === "direct") {
      const origin = normalizeOrigin(settings.baseUrl);
      const res = await fetch(`${origin}/api/ps`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data?.models) ? data.models : [];
    }
    const qs = encodeURIComponent(settings.baseUrl);
    const res = await fetch(`/api/ai/providers/ollama/running-models?baseUrl=${qs}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to fetch running models");
    }
    return Array.isArray(data.models) ? data.models : [];
  }

  async getModelInfo(settings: OllamaSettings, model: string) {
    if (settings.connectionMode === "direct") {
      const origin = normalizeOrigin(settings.baseUrl);
      const res = await fetch(`${origin}/api/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      if (!res.ok) {
        throw Object.assign(new Error(`Model info failed (HTTP ${res.status})`), {
          code: res.status === 404 ? "MODEL_NOT_FOUND" : "HTTP_ERROR",
        });
      }
      const data = await res.json();
      const caps: string[] = Array.isArray(data?.capabilities) ? data.capabilities.map(String) : [];
      const template = typeof data?.template === "string" ? data.template : "";
      let contextLength: number | null = null;
      if (data?.model_info && typeof data.model_info === "object") {
        for (const [k, v] of Object.entries(data.model_info)) {
          if (k.endsWith(".context_length") && typeof v === "number") {
            contextLength = v;
            break;
          }
        }
      }
      return {
        model,
        capabilities: caps,
        supportsTools: caps.includes("tools") || template.includes(".Tools"),
        supportsVision: caps.includes("vision"),
        supportsThinking: caps.includes("thinking"),
        contextLength,
        details: data?.details || {},
      };
    }

    const res = await fetch("/api/ai/providers/ollama/model-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: settings.baseUrl, model }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw Object.assign(new Error(data.error || "Failed to inspect model"), {
        code: data.errorCode || "HTTP_ERROR",
      });
    }
    return data.info;
  }

  async testGenerate(settings: OllamaSettings, model: string, prompt: string) {
    if (settings.connectionMode === "direct") {
      const origin = normalizeOrigin(settings.baseUrl);
      const t0 = Date.now();
      const res = await fetch(`${origin}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature: settings.temperature,
            num_ctx: settings.numCtx,
            num_predict: Math.min(256, settings.numPredict),
          },
          keep_alive: settings.keepAlive,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }
      const data = await res.json();
      return {
        response: data?.response || "",
        latencyMs: Date.now() - t0,
        metrics: {
          promptEvalCount: data?.prompt_eval_count,
          evalCount: data?.eval_count,
        },
      };
    }

    const res = await fetch("/api/ai/providers/ollama/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: settings.baseUrl, model, prompt }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw Object.assign(new Error(data.error || "Test generation failed"), {
        code: data.errorCode || "OLLAMA_UNREACHABLE",
        guidance: data.guidance,
      });
    }
    return {
      response: data.response || "",
      latencyMs: Number(data.latencyMs || 0),
      metrics: data.metrics,
    };
  }

  async streamChat(
    params: {
      requestId: string;
      conversationId: string;
      model: string;
      messages: Array<{ role: string; content: string; tool_calls?: any[]; tool_name?: string }>;
      tools?: any[];
      settings: OllamaSettings;
    },
    callbacks: StreamChatCallbacks,
    signal: AbortSignal
  ): Promise<void> {
    const { settings } = params;
    const isDirect = settings.connectionMode === "direct";
    const url = isDirect ? `${normalizeOrigin(settings.baseUrl)}/api/chat` : "/api/ai/chat";

    const requestBody = isDirect
      ? {
          model: params.model,
          messages: params.messages,
          tools: params.tools && params.tools.length > 0 ? params.tools : undefined,
          stream: settings.streaming,
          keep_alive: settings.keepAlive,
          options: {
            temperature: settings.temperature,
            num_ctx: settings.numCtx,
            num_predict: settings.numPredict,
            top_p: settings.topP,
            top_k: settings.topK,
            repeat_penalty: settings.repeatPenalty,
          },
        }
      : {
          requestId: params.requestId,
          conversationId: params.conversationId,
          baseUrl: settings.baseUrl,
          model: params.model,
          messages: params.messages,
          tools: params.tools && params.tools.length > 0 ? params.tools : undefined,
          stream: settings.streaming,
          keep_alive: settings.keepAlive,
          timeoutMs: settings.timeoutMs,
          options: {
            temperature: settings.temperature,
            num_ctx: settings.numCtx,
            num_predict: settings.numPredict,
            top_p: settings.topP,
            top_k: settings.topK,
            repeat_penalty: settings.repeatPenalty,
          },
        };

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal,
      });
    } catch (err: any) {
      if (signal.aborted || err?.name === "AbortError") {
        callbacks.onError?.({ code: "CANCELLED", message: "Generation cancelled by user." });
        return;
      }
      if (isDirect) {
        const classified = classifyBrowserDirectError(err, settings.baseUrl);
        callbacks.onError?.({
          code: classified.code,
          message: classified.message,
          guidance: classified.guidance,
        });
      } else {
        callbacks.onError?.({
          code: "OLLAMA_UNREACHABLE",
          message: err?.message || "Failed to reach Foundry AI endpoint.",
        });
      }
      return;
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      let parsed: any = null;
      try {
        parsed = JSON.parse(txt);
      } catch {}
      const msg = parsed?.error || txt || `HTTP ${res.status}`;
      const code: AIErrorCode =
        parsed?.errorCode ||
        (res.status === 404 || msg.toLowerCase().includes("not found")
          ? "MODEL_NOT_FOUND"
          : msg.toLowerCase().includes("does not support tools")
          ? "TOOLS_UNSUPPORTED"
          : "HTTP_ERROR");
      callbacks.onError?.({ code, message: msg, guidance: parsed?.guidance });
      return;
    }

    // Non-streaming JSON response
    if (!settings.streaming) {
      const data = await res.json();
      if (isDirect) {
        if (data?.message?.content) {
          callbacks.onChunk?.(data.message.content, data.message.thinking);
        }
        if (Array.isArray(data?.message?.tool_calls) && data.message.tool_calls.length > 0) {
          callbacks.onToolCalls?.(data.message.tool_calls);
        }
        callbacks.onDone?.({
          model: data?.model || params.model,
          doneReason: data?.done_reason || "stop",
          metrics: {
            promptEvalCount: data?.prompt_eval_count,
            evalCount: data?.eval_count,
            evalDurationNs: data?.eval_duration,
          },
        });
      } else {
        if (data.content) callbacks.onChunk?.(data.content);
        if (Array.isArray(data.toolCalls) && data.toolCalls.length > 0) {
          callbacks.onToolCalls?.(data.toolCalls);
        }
        callbacks.onDone?.({ model: data.model || params.model, metrics: data.metrics });
      }
      return;
    }

    if (!res.body) {
      callbacks.onError?.({ code: "MALFORMED_STREAM", message: "Empty stream body." });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let doneCalled = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;

          let parsed: any;
          try {
            parsed = JSON.parse(line);
          } catch {
            callbacks.onError?.({
              code: "MALFORMED_STREAM",
              message: `Malformed NDJSON stream line: ${line.slice(0, 100)}`,
            });
            return;
          }

          if (isDirect) {
            if (parsed?.error) {
              callbacks.onError?.({ code: "HTTP_ERROR", message: String(parsed.error) });
              return;
            }
            if (parsed?.message?.content || parsed?.message?.thinking) {
              callbacks.onChunk?.(parsed.message.content || "", parsed.message.thinking);
            }
            if (Array.isArray(parsed?.message?.tool_calls) && parsed.message.tool_calls.length > 0) {
              callbacks.onToolCalls?.(parsed.message.tool_calls);
            }
            if (parsed?.done) {
              doneCalled = true;
              const evalCount = parsed?.eval_count;
              const evalDur = parsed?.eval_duration;
              callbacks.onDone?.({
                model: parsed?.model || params.model,
                doneReason: parsed?.done_reason || "stop",
                metrics: {
                  promptEvalCount: parsed?.prompt_eval_count,
                  evalCount,
                  totalDurationNs: parsed?.total_duration,
                  evalDurationNs: evalDur,
                  tokensPerSec:
                    evalCount && evalDur ? Number((evalCount / (evalDur / 1e9)).toFixed(2)) : undefined,
                },
              });
            }
          } else {
            if (parsed.type === "meta") {
              callbacks.onMeta?.({ requestId: parsed.requestId, model: parsed.model });
            } else if (parsed.type === "chunk") {
              callbacks.onChunk?.(parsed.content || "", parsed.thinking);
            } else if (parsed.type === "tool_calls" && Array.isArray(parsed.toolCalls)) {
              callbacks.onToolCalls?.(parsed.toolCalls);
            } else if (parsed.type === "done") {
              doneCalled = true;
              callbacks.onDone?.({
                model: parsed.model,
                doneReason: parsed.doneReason,
                metrics: parsed.metrics,
              });
            } else if (parsed.type === "error") {
              doneCalled = true;
              callbacks.onError?.({
                code: parsed.errorCode || "HTTP_ERROR",
                message: parsed.error || "Streaming error",
              });
              return;
            }
          }
        }
      }
      if (!doneCalled) {
        callbacks.onDone?.({ model: params.model, doneReason: "eof" });
      }
    } catch (err: any) {
      if (signal.aborted || err?.name === "AbortError") {
        callbacks.onError?.({ code: "CANCELLED", message: "Generation cancelled by user." });
      } else {
        callbacks.onError?.({
          code: "MALFORMED_STREAM",
          message: err?.message || "Stream interrupted unexpectedly.",
        });
      }
    }
  }

  async cancelGeneration(requestId: string, mode: AIProviderConnectionMode): Promise<void> {
    if (mode === "direct") return;
    try {
      await fetch("/api/ai/chat/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
    } catch {}
  }
}

export const ollamaFrontendAdapter = new OllamaFrontendAdapter();
