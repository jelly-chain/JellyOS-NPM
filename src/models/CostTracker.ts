/**
 * CostTracker — tracks per-session and lifetime token usage and cost.
 *
 * Uses OpenRouter response headers (x-credit-used) when available,
 * otherwise estimates from the model registry's pricing data.
 * Emits budget warnings and provides cost reports via tool/command.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ModelRegistry } from "./ModelRegistry.js";
import { Type, type Static } from "@sinclair/typebox";

const JELLY_HOME  = process.env.JELLYOS_HOME ?? join(homedir(), ".jelly");
const COST_FILE   = join(JELLY_HOME, "usage.json");

// ── Types ────────────────────────────────────────────────────────────────────

export interface UsageEntry {
  model:       string;
  timestamp:   number;
  promptTokens:   number;
  completionTokens: number;
  /** Estimated cost in nano-dollars (billionths of a dollar) */
  estimatedCost: number;
  /** Duration in ms */
  duration: number;
}

export interface SessionUsage {
  promptTokens:      number;
  completionTokens:   number;
  estimatedCost:      number;
  calls:              number;
  errors:             number;
}

export interface LifetimeUsage {
  promptTokens:      number;
  completionTokens:   number;
  estimatedCost:      number;
  calls:              number;
  modelsUsed:         Set<string>;
}

// ── CostTracker class ─────────────────────────────────────────────────────────

const DEFAULT_BUDGET_PER_SESSION = 1_000_000_000_000; // $1.00 in nano-dollars
const DEFAULT_BUDGET_LIFETIME    = 25_000_000_000_000; // $25.00

export class CostTracker {
  private modelReg:       ModelRegistry;
  private session:        SessionUsage  = { promptTokens: 0, completionTokens: 0, estimatedCost: 0, calls: 0, errors: 0 };
  private lifetime:       LifetimeUsage = { promptTokens: 0, completionTokens: 0, estimatedCost: 0, calls: 0, modelsUsed: new Set() };
  private budgetSession:  number;
  private budgetLifetime: number;
  private budgetWarned    = false;

  constructor(modelReg: ModelRegistry) {
    this.modelReg       = modelReg;
    this.budgetSession  = parseInt(process.env.JELLY_BUDGET_SESSION ?? String(DEFAULT_BUDGET_PER_SESSION));
    this.budgetLifetime = parseInt(process.env.JELLY_BUDGET_LIFETIME ?? String(DEFAULT_BUDGET_LIFETIME));
    this.loadLifetime();
  }

  // ── Recording ─────────────────────────────────────────────────────────────

  record(modelId: string, promptTokens: number, completionTokens: number, duration: number): void {
    const tm       = this.modelReg["modelMap"]?.get(modelId);
    const costPer1K = tm?.costPer1K ?? 50_000; // fallback: 50 nano-dollars/1K (=$0.00005/1K)
    const estimatedCost = Math.round(costPer1K * (promptTokens + completionTokens) / 1000);

    const entry: UsageEntry = { model: modelId, timestamp: Date.now(), promptTokens, completionTokens, estimatedCost, duration };

    // Session
    this.session.promptTokens     += promptTokens;
    this.session.completionTokens += completionTokens;
    this.session.estimatedCost    += estimatedCost;
    this.session.calls++;

    // Lifetime
    this.lifetime.promptTokens     += promptTokens;
    this.lifetime.completionTokens += completionTokens;
    this.lifetime.estimatedCost    += estimatedCost;
    this.lifetime.calls++;
    this.lifetime.modelsUsed.add(modelId);

    this.maybeWarnBudget();
  }

  recordError(): void {
    this.session.errors++;
    this.lifetime.calls++;
  }

  // ── Budget ────────────────────────────────────────────────────────────────

  private maybeWarnBudget(): void {
    if (this.session.estimatedCost > this.budgetSession * 0.8 && !this.budgetWarned) {
      this.budgetWarned = true;
      // Budget warning is surfaced via getBudgetStatus() — callers can check
    }
  }

  getBudgetStatus(): { session: SessionUsage; lifetime: LifetimeUsage; warnings: string[] } {
    const warnings: string[] = [];
    const pctSession  = this.session.estimatedCost / this.budgetSession * 100;
    const pctLifetime = this.lifetime.estimatedCost / this.budgetLifetime * 100;

    if (pctSession >= 90) warnings.push(`⚠ Session budget at ${pctSession.toFixed(0)}% — near limit`);
    else if (pctSession >= 75) warnings.push(`⚡ Session budget at ${pctSession.toFixed(0)}%`);
    if (pctLifetime >= 90) warnings.push(`⚠ Lifetime budget at ${pctLifetime.toFixed(0)}% — near limit`);
    else if (pctLifetime >= 75) warnings.push(`⚡ Lifetime budget at ${pctLifetime.toFixed(0)}%`);

    return { session: { ...this.session }, lifetime: { ...this.lifetime, modelsUsed: new Set(this.lifetime.modelsUsed) }, warnings };
  }

  /** True if the next call would exceed the session budget. */
  wouldExceed(estimatedCallCost: number): boolean {
    return this.session.estimatedCost + estimatedCallCost > this.budgetSession;
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private loadLifetime(): void {
    try {
      if (!existsSync(COST_FILE)) return;
      const raw = JSON.parse(readFileSync(COST_FILE, "utf-8"));
      this.lifetime.promptTokens     = raw.promptTokens     ?? 0;
      this.lifetime.completionTokens = raw.completionTokens ?? 0;
      this.lifetime.estimatedCost    = raw.estimatedCost    ?? 0;
      this.lifetime.calls            = raw.calls            ?? 0;
      this.lifetime.modelsUsed       = new Set(raw.modelsUsed ?? []);
    } catch { /* best effort */ }
  }

  saveLifetime(): void {
    try {
      mkdirSync(JELLY_HOME, { recursive: true });
      writeFileSync(COST_FILE, JSON.stringify({
        promptTokens:     this.lifetime.promptTokens,
        completionTokens: this.lifetime.completionTokens,
        estimatedCost:    this.lifetime.estimatedCost,
        calls:            this.lifetime.calls,
        modelsUsed:       [...this.lifetime.modelsUsed],
      }));
    } catch { /* best effort */ }
  }

  // ── Formatting ─────────────────────────────────────────────────────────────

  private formatNano(cost: number): string {
    return `$${(cost / 1_000_000_000).toFixed(4)}`;
  }

  statusLine(): string {
    return `${this.formatNano(this.session.estimatedCost)} · ${this.session.calls}calls`;
  }

  report(): string {
    const s = this.session;
    return [
      `Session: ${s.calls} calls · ${s.errors} errors · ${this.formatNano(s.estimatedCost)}`,
      `  Prompt:      ${s.promptTokens.toLocaleString()} tokens`,
      `  Completion:  ${s.completionTokens.toLocaleString()} tokens`,
      `Lifetime: ${this.lifetime.calls} calls · ${this.formatNano(this.lifetime.estimatedCost)}`,
      `  Models used: ${this.lifetime.modelsUsed.size}`,
    ].join("\n");
  }

  // ── Tool: cost_report ──────────────────────────────────────────────────────

  readonly costReportParams = Type.Object({});

  async costReportTool(): Promise<{
    content: Array<{ type: "text"; text: string }>;
    details: Record<string, unknown>;
  }> {
    const status = this.getBudgetStatus();
    let text = this.report();
    if (status.warnings.length > 0) {
      text += "\n\n" + status.warnings.join("\n");
    }
    return {
      content: [{ type: "text", text }],
      details: {
        session_cost_nano:   status.session.estimatedCost,
        lifetime_cost_nano:  status.lifetime.estimatedCost,
        session_calls:       status.session.calls,
        lifetime_calls:      status.lifetime.calls,
        models_used:         status.lifetime.modelsUsed.size,
        warnings:            status.warnings,
      },
    };
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  resetSession(): void {
    this.session = { promptTokens: 0, completionTokens: 0, estimatedCost: 0, calls: 0, errors: 0 };
    this.budgetWarned = false;
  }
}
