/**
 * Foundry Stage 2 — AI Execution Monitor & Diagnostics Integration (Phase 11)
 * Records per-request AI execution metrics, first-token latency, token counts
 * (distinguishing Ollama actuals vs estimates), tool execution telemetry, and cancellations.
 */
import { diagnosticsManager } from "../DiagnosticsManager";
import { AIExecutionMetric } from "./types";

class AIExecutionMonitorService {
  private runs: AIExecutionMetric[] = [];
  private activeRunIds: Set<string> = new Set();
  private listeners: Set<() => void> = new Set();
  private readonly maxRuns = 100;

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch {}
    });
  }

  startRun(requestId: string) {
    this.activeRunIds.add(requestId);
    this.notify();
  }

  finishRun(metric: AIExecutionMetric, persistRemote = true) {
    this.activeRunIds.delete(metric.requestId);
    this.runs.unshift(metric);
    if (this.runs.length > this.maxRuns) {
      this.runs.length = this.maxRuns;
    }

    const status = metric.cancelled
      ? "warning"
      : metric.errorCode
      ? "error"
      : "success";

    diagnosticsManager.logExecution({
      source: "education-ai",
      operation: `ai.chat(${metric.model})`,
      target: metric.provider,
      status,
      durationMs: metric.durationMs,
      message: metric.cancelled
        ? `Cancelled AI generation (${metric.model})`
        : metric.errorCode
        ? `AI request failed (${metric.errorCode})`
        : `Completed AI response (${metric.outputTokens} tok${metric.estimatedMetrics ? " est." : ""}${metric.tokensPerSec ? `, ${metric.tokensPerSec} tok/s` : ""})`,
      error: metric.errorMessage,
    });

    if (persistRemote) {
      fetch("/api/ai/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metric),
      }).catch(() => {});
    }

    this.notify();
  }

  getRuns(): AIExecutionMetric[] {
    return this.runs.map((r) => ({ ...r }));
  }

  getActiveCount(): number {
    return this.activeRunIds.size;
  }

  getSummary() {
    const total = this.runs.length;
    const completed = this.runs.filter((r) => !r.cancelled && !r.errorCode);
    const latencies = completed
      .map((r) => r.firstTokenLatencyMs)
      .filter((v): v is number => typeof v === "number");
    const avgFirstTokenLatencyMs = latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;
    const totalInputTokens = this.runs.reduce((s, r) => s + r.inputTokens, 0);
    const totalOutputTokens = this.runs.reduce((s, r) => s + r.outputTokens, 0);

    return {
      activeCount: this.activeRunIds.size,
      totalRequests: total,
      completedRequests: completed.length,
      cancelledRequests: this.runs.filter((r) => r.cancelled).length,
      failedRequests: this.runs.filter((r) => Boolean(r.errorCode) && !r.cancelled).length,
      avgFirstTokenLatencyMs,
      totalInputTokens,
      totalOutputTokens,
    };
  }

  async syncFromBackend(): Promise<void> {
    try {
      const res = await fetch("/api/ai/usage?limit=50");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.logs) && this.runs.length === 0) {
        this.runs = data.logs;
        this.notify();
      }
    } catch {}
  }
}

export const aiExecutionMonitor = new AIExecutionMonitorService();
