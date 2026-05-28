/**
 * Tracer — lightweight JSONL span tracing for agent observability. (#30)
 *
 * Zero external dependencies. Writes structured traces to ~/.jelly/traces.jsonl.
 * Each trace covers one user turn and records all model calls, tool dispatches,
 * and swarm sub-tasks with timing and status.
 *
 * View traces: cat ~/.jelly/traces.jsonl | jq
 * Last 5 traces: tail -5 ~/.jelly/traces.jsonl | jq
 * /traces command in REPL shows a formatted summary.
 */

import { appendFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { join }       from "node:path";
import { homedir }    from "node:os";
import { randomUUID } from "node:crypto";

const JELLY_HOME  = process.env.JELLYOS_HOME ?? join(homedir(), ".jelly");
const TRACES_FILE = join(JELLY_HOME, "traces.jsonl");

export interface Span {
  spanId:    string;
  name:      string;
  startMs:   number;
  durationMs?: number;
  status:    "ok" | "error" | "aborted";
  attrs:     Record<string, unknown>;
}

export interface Trace {
  traceId:   string;
  sessionId: string;
  prompt:    string;
  startMs:   number;
  durationMs?: number;
  spans:     Span[];
  totalCost?: number;
  modelUsed?: string;
}

export class Tracer {
  /** @internal exposed for AgentRunner span lookup */
  readonly trace: Trace;

  constructor(sessionId: string, prompt: string) {
    this.trace = {
      traceId:   randomUUID().slice(0, 12),
      sessionId,
      prompt:    prompt.slice(0, 200),
      startMs:   Date.now(),
      spans:     [],
    };
  }

  /** Start a named span, returns spanId */
  startSpan(name: string, attrs: Record<string, unknown> = {}): string {
    const spanId = randomUUID().slice(0, 8);
    this.trace.spans.push({ spanId, name, startMs: Date.now(), status: "ok", attrs });
    return spanId;
  }

  /** End a span by ID */
  endSpan(spanId: string, status: "ok" | "error" | "aborted" = "ok", attrs: Record<string, unknown> = {}): void {
    const span = this.trace.spans.find(s => s.spanId === spanId);
    if (!span) return;
    span.durationMs = Date.now() - span.startMs;
    span.status     = status;
    Object.assign(span.attrs, attrs);
  }

  /** Record model call details */
  recordModel(spanId: string, model: string, promptTokens: number, completionTokens: number, costNano: number): void {
    this.endSpan(spanId, "ok", { model, promptTokens, completionTokens, costNano });
    this.trace.modelUsed = model;
    this.trace.totalCost = (this.trace.totalCost ?? 0) + costNano;
  }

  /** Flush trace to disk */
  flush(status: "ok" | "error" | "aborted" = "ok"): void {
    this.trace.durationMs = Date.now() - this.trace.startMs;

    try {
      mkdirSync(JELLY_HOME, { recursive: true });
      appendFileSync(
        TRACES_FILE,
        JSON.stringify({ ...this.trace, status, ts: Date.now() }) + "\n",
        "utf-8",
      );
    } catch { /* best effort — tracing should never crash the agent */ }
  }

  get traceId(): string { return this.trace.traceId; }

  // ── Static helpers ────────────────────────────────────────────────────────

  /** Read last N traces from disk for /traces command */
  static readRecent(limit = 5): Trace[] {
    try {
      if (!existsSync(TRACES_FILE)) return [];
      const lines = readFileSync(TRACES_FILE, "utf-8")
        .trim().split("\n").filter(Boolean);
      return lines.slice(-limit).map(l => JSON.parse(l) as Trace).reverse();
    } catch { return []; }
  }

  /** Format traces for REPL display */
  static formatSummary(traces: Trace[]): string {
    if (traces.length === 0) return "No traces recorded yet.";

    return traces.map(t => {
      const duration = t.durationMs ? `${(t.durationMs / 1000).toFixed(1)}s` : "?s";
      const model    = t.modelUsed?.split("/").pop()?.slice(0, 20) ?? "?";
      const spans    = t.spans.length;
      const tools    = t.spans.filter(s => s.name.startsWith("tool:")).length;
      const cost     = t.totalCost ? `$${(t.totalCost / 1_000_000_000).toFixed(4)}` : "?";
      const prompt   = t.prompt.slice(0, 60);
      const errors   = t.spans.filter(s => s.status === "error").length;

      const lines = [
        `[${t.traceId}] ${new Date(t.startMs).toLocaleTimeString()} — ${duration} · ${model} · ${cost}`,
        `  Prompt: "${prompt}"`,
        `  Spans: ${spans} total, ${tools} tool calls${errors > 0 ? `, ${errors} errors` : ""}`,
      ];

      // Show tool spans
      for (const span of t.spans.filter(s => s.name.startsWith("tool:"))) {
        const icon = span.status === "ok" ? "✓" : "✗";
        const dur  = span.durationMs ? `${span.durationMs}ms` : "?";
        lines.push(`    ${icon} ${span.name.slice(5)} (${dur})`);
      }

      return lines.join("\n");
    }).join("\n\n");
  }
}
