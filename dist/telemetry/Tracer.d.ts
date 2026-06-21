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
export interface Span {
    spanId: string;
    name: string;
    startMs: number;
    durationMs?: number;
    status: "ok" | "error" | "aborted";
    attrs: Record<string, unknown>;
}
export interface Trace {
    traceId: string;
    sessionId: string;
    prompt: string;
    startMs: number;
    durationMs?: number;
    spans: Span[];
    totalCost?: number;
    modelUsed?: string;
}
export declare class Tracer {
    /** @internal exposed for AgentRunner span lookup */
    readonly trace: Trace;
    constructor(sessionId: string, prompt: string);
    /** Start a named span, returns spanId */
    startSpan(name: string, attrs?: Record<string, unknown>): string;
    /** End a span by ID */
    endSpan(spanId: string, status?: "ok" | "error" | "aborted", attrs?: Record<string, unknown>): void;
    /** Record model call details */
    recordModel(spanId: string, model: string, promptTokens: number, completionTokens: number, costNano: number): void;
    /** Flush trace to disk */
    flush(status?: "ok" | "error" | "aborted"): void;
    get traceId(): string;
    /** Read last N traces from disk for /traces command */
    static readRecent(limit?: number): Trace[];
    /** Format traces for REPL display */
    static formatSummary(traces: Trace[]): string;
}
//# sourceMappingURL=Tracer.d.ts.map