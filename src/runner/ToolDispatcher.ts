/**
 * ToolDispatcher — executes tool calls from the model response.
 * Looks up tool by name in the Registry, validates params, runs execute().
 */

import { Value }    from "@sinclair/typebox/value";
import type { Registry } from "../api/Registry.js";
import type { ToolCall } from "./ModelClient.js";

/**
 * Attempt to repair common JSON errors from model output.
 * Handles trailing commas, single quotes, unquoted keys.
 * Returns original string if repair doesn't help.
 */
function repairJson(raw: string): string {
  try { JSON.parse(raw); return raw; } catch { /* fall through to repair */ }
  const repaired = raw
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]")
    .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3') // unquoted keys
    .replace(/:\s*'([^']*)'/g, ': "$1"');           // single-quoted values
  try { JSON.parse(repaired); return repaired; } catch { return raw; }
}

export interface ToolResult {
  tool_call_id: string;
  name:         string;
  content:      string;
  isError:      boolean;
}

const TOOL_TIMEOUT_MS   = 30_000;
const CIRCUIT_OPEN_MS   = 300_000;
const CIRCUIT_THRESHOLD = 3;

// #40: Estimated output sizes per tool (chars) for pre-dispatch budget forecasting
const TOOL_OUTPUT_ESTIMATES: Record<string, number> = {
  get_candles:          8_000,  // 100 OHLCV + TA = ~8KB
  analyze_ta:           2_000,
  get_prices:             500,
  get_top_movers:         800,
  get_market_overview:   1_000,
  get_news:             4_000,
  get_fear_greed:         400,
  get_funding_rates:      600,
  get_btc_mempool:        400,
  get_defi_tvl:         2_000,
  get_solana_stats:       300,
  list_models:          3_000,
  list_tasks:             500,
  read_task_context:    6_000,
  cost_report:            400,
  list_goals:             600,
  model_summary:          400,
  _default:             2_000,
};

/** #40: Estimate chars that will be added to context by dispatching these calls */
export function forecastContextGrowth(calls: { function: { name: string } }[]): number {
  return calls.reduce((sum, tc) => {
    const est = TOOL_OUTPUT_ESTIMATES[tc.function.name] ?? TOOL_OUTPUT_ESTIMATES["_default"]!;
    return sum + est;
  }, 0);
}

export class ToolDispatcher {
  private failureCounts = new Map<string, number>();
  private openCircuits  = new Map<string, number>(); // toolName → openUntil timestamp

  constructor(private registry: Registry) {}

  async dispatch(calls: ToolCall[]): Promise<ToolResult[]> {
    return Promise.all(calls.map(tc => this.execute(tc)));
  }

  private async execute(tc: ToolCall): Promise<ToolResult> {
    const toolName = tc.function.name;

    // #6: Circuit breaker — fast-fail if tool has been consistently broken
    const openUntil = this.openCircuits.get(toolName) ?? 0;
    if (Date.now() < openUntil) {
      const remainMs = Math.ceil((openUntil - Date.now()) / 1000);
      return {
        tool_call_id: tc.id,
        name:         toolName,
        content:      `Tool "${toolName}" is temporarily unavailable (circuit open for ${remainMs}s after repeated failures). Use a different approach or try again later.`,
        isError:      true,
      };
    }

    try {
      const result = await this.executeWithTimeout(tc);
      // Reset failure count on success
      this.failureCounts.delete(toolName);
      return result;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      const failures = (this.failureCounts.get(toolName) ?? 0) + 1;
      this.failureCounts.set(toolName, failures);

      if (failures >= CIRCUIT_THRESHOLD) {
        this.openCircuits.set(toolName, Date.now() + CIRCUIT_OPEN_MS);
        this.failureCounts.delete(toolName);
        return {
          tool_call_id: tc.id,
          name:         toolName,
          content:      `Tool "${toolName}" failed ${CIRCUIT_THRESHOLD} times in a row. Circuit opened for 5 minutes. Error: ${errMsg}`,
          isError:      true,
        };
      }

      return {
        tool_call_id: tc.id,
        name:         toolName,
        content:      `Tool error (failure ${failures}/${CIRCUIT_THRESHOLD}): ${errMsg}`,
        isError:      true,
      };
    }
  }

  private async executeWithTimeout(tc: ToolCall): Promise<ToolResult> {
    // Race tool execution against a hard timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Tool "${tc.function.name}" timed out after ${TOOL_TIMEOUT_MS / 1000}s`)), TOOL_TIMEOUT_MS)
    );
    return Promise.race([this.executeInner(tc), timeoutPromise]);
  }

  private async executeInner(tc: ToolCall): Promise<ToolResult> {
    const tool = this.registry.getTool(tc.function.name);
    if (!tool) {
      return {
        tool_call_id: tc.id,
        name:         tc.function.name,
        content:      `Unknown tool: ${tc.function.name}`,
        isError:      true,
      };
    }

    let params: unknown;
    try {
      // #8: attempt JSON repair before hard-failing on malformed model output
      params = JSON.parse(repairJson(tc.function.arguments || "{}"));
    } catch {
      return {
        tool_call_id: tc.id,
        name:         tc.function.name,
        content:      `Invalid JSON arguments (repair failed): ${tc.function.arguments}`,
        isError:      true,
      };
    }

    // Validate params against the tool's TypeBox schema
    if (!Value.Check(tool.parameters, params)) {
      const errors = [...Value.Errors(tool.parameters, params)]
        .slice(0, 3)
        .map(e => `${e.path}: ${e.message}`)
        .join("; ");
      return {
        tool_call_id: tc.id,
        name:         tc.function.name,
        content:      `Parameter validation failed: ${errors}`,
        isError:      true,
      };
    }

    try {
      const result  = await tool.execute(tc.id, params as any);
      const content = result.content.map(c => c.text).join("\n");
      return { tool_call_id: tc.id, name: tc.function.name, content, isError: false };
    } catch (e: any) {
      return {
        tool_call_id: tc.id,
        name:         tc.function.name,
        content:      `Tool error: ${e?.message ?? String(e)}`,
        isError:      true,
      };
    }
  }
}
