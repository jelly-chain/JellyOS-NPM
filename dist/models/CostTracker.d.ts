/**
 * CostTracker — tracks per-session and lifetime token usage and cost.
 *
 * Uses OpenRouter response headers (x-credit-used) when available,
 * otherwise estimates from the model registry's pricing data.
 * Emits budget warnings and provides cost reports via tool/command.
 */
import type { ModelRegistry } from "./ModelRegistry.js";
export interface UsageEntry {
    model: string;
    timestamp: number;
    promptTokens: number;
    completionTokens: number;
    /** Estimated cost in nano-dollars (billionths of a dollar) */
    estimatedCost: number;
    /** Duration in ms */
    duration: number;
}
export interface SessionUsage {
    promptTokens: number;
    completionTokens: number;
    estimatedCost: number;
    calls: number;
    errors: number;
}
export interface LifetimeUsage {
    promptTokens: number;
    completionTokens: number;
    estimatedCost: number;
    calls: number;
    modelsUsed: Set<string>;
}
export declare class CostTracker {
    private modelReg;
    private session;
    private lifetime;
    private budgetSession;
    private budgetLifetime;
    private budgetWarned;
    constructor(modelReg: ModelRegistry);
    record(modelId: string, promptTokens: number, completionTokens: number, duration: number): void;
    recordError(): void;
    private maybeWarnBudget;
    getBudgetStatus(): {
        session: SessionUsage;
        lifetime: LifetimeUsage;
        warnings: string[];
    };
    /** True if the next call would exceed the session budget. */
    wouldExceed(estimatedCallCost: number): boolean;
    private loadLifetime;
    saveLifetime(): void;
    private formatNano;
    statusLine(): string;
    report(): string;
    readonly costReportParams: import("@sinclair/typebox").TObject<{}>;
    costReportTool(): Promise<{
        content: Array<{
            type: "text";
            text: string;
        }>;
        details: Record<string, unknown>;
    }>;
    resetSession(): void;
}
//# sourceMappingURL=CostTracker.d.ts.map