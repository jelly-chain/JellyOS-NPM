/**
 * SwarmRouter — complexity scoring and task decomposition.
 *
 * For complex prompts (score >= threshold) the runner decomposes the request
 * into 2–5 sub-tasks, executes them with a capped worker pool, then feeds all
 * results to a reviewer model that synthesises a final answer.
 *
 * Sub-task execution is sequential inside each worker slot to avoid hammering
 * the provider; concurrency is capped at Math.min(maxAgents, os.cpus().length).
 */

import os from "os";
import { ModelClient, resolveModelChain, type Message } from "./ModelClient.js";
import type { ModelRegistry } from "../models/ModelRegistry.js";
import type { ContextStore }  from "../session/ContextStore.js";

export interface SwarmConfig {
  /** Maximum parallel workers (hard cap: 5). Default: min(cpuCount, 3). */
  maxAgents?: number;
  /** Complexity score threshold above which swarm activates. Default: 40. */
  complexityThreshold?: number;
}

export interface SubTaskResult {
  task:   string;
  result: string;
  model:  string;
  ms:     number;
  error?: string;
}

// ── Complexity scoring ───────────────────────────────────────────────────────

const CONJUNCTION_RE   = /\b(and|also|then|additionally|plus|as well as|furthermore)\b/gi;
const MULTI_CHAIN_RE   = /\b(eth|btc|sol|bnb|avax|matic|cosmos|atom|arb|op)\b/gi;
const ACTION_VERB_RE   = /\b(analyze|compare|predict|scan|check|simulate|estimate|backtest|evaluate|assess)\b/gi;
const QUESTION_RE      = /\?/g;

/**
 * Returns a score 0–100 reflecting prompt complexity.
 * Tuned so "check ETH price" ≈ 10, "analyze ETH and BTC then predict" ≈ 55.
 */
export function scoreComplexity(prompt: string): number {
  const conjunctions = (prompt.match(CONJUNCTION_RE) ?? []).length;
  const chains       = new Set((prompt.match(MULTI_CHAIN_RE) ?? []).map(s => s.toLowerCase())).size;
  const actions      = (prompt.match(ACTION_VERB_RE) ?? []).length;
  const questions    = (prompt.match(QUESTION_RE) ?? []).length;
  const wordCount    = prompt.trim().split(/\s+/).length;

  return Math.min(
    100,
    conjunctions * 12 +
    chains       *  8 +
    actions      * 10 +
    questions    *  5 +
    Math.floor(wordCount / 8),
  );
}

// ── Task decomposition (# 29: LLM planner with heuristic fallback) ───────────

/**
 * LLM-based task planner. Uses a cheap worker model to decompose the prompt
 * into focused sub-tasks as a JSON array. Falls back to heuristics on failure.
 */
async function planSubtasks(
  prompt: string,
  maxTasks: number,
  modelReg?: ModelRegistry,
): Promise<string[]> {
  const cap = Math.max(2, Math.min(maxTasks, 5));

  // Attempt LLM decomposition with a cheap/fast model
  try {
    const chain  = resolveModelChain(modelReg);
    // Prefer a worker-tier model for planning (fast + cheap)
    const plannerCfg = chain.find(c => modelReg?.getTier(c.model) === "worker") ?? chain[chain.length - 1] ?? chain[0]!;
    const client = new ModelClient({ ...plannerCfg, temperature: 0.2 }, modelReg);

    const plannerPrompt =
      `Split the following request into exactly ${cap} focused, non-overlapping sub-tasks.\n` +
      `Each sub-task must be independently answerable using data tools.\n` +
      `Output ONLY a valid JSON array of strings. No explanation, no markdown.\n\n` +
      `Request: ${prompt}`;

    let output = "";
    for await (const chunk of client.stream([
      { role: "system",  content: "You output only valid JSON arrays of strings. No markdown, no explanation." },
      { role: "user",    content: plannerPrompt },
    ], [])) {
      if (chunk.type === "delta" && chunk.text) output += chunk.text;
      if (chunk.type === "error") throw new Error(chunk.error);
    }

    // Extract JSON array from output (model might wrap in markdown)
    const jsonMatch = output.match(/\[\s*"[\s\S]*?"\s*(?:,\s*"[\s\S]*?"\s*)*\]/);
    if (jsonMatch) {
      const tasks = JSON.parse(jsonMatch[0]) as unknown;
      if (Array.isArray(tasks) && tasks.every((t): t is string => typeof t === "string") && tasks.length >= 2) {
        return tasks.slice(0, cap);
      }
    }
  } catch {
    // Fall through to heuristic decomposition
  }

  return decomposeHeuristic(prompt, cap);
}

/** Original heuristic decomposer — used as fallback when LLM planner fails */
export function decomposeHeuristic(prompt: string, maxTasks: number): string[] {
  const cap = Math.max(2, Math.min(maxTasks, 5));

  const parts = prompt
    .split(/,\s*| and | also | then | additionally | plus /i)
    .map(s => s.trim())
    .filter(s => s.length > 4);

  if (parts.length >= 2) return parts.slice(0, cap);

  const verbMatches = [...prompt.matchAll(/\b(analyze|compare|predict|scan|check|estimate|evaluate)\b[^,.?]*/gi)];
  if (verbMatches.length >= 2) return verbMatches.slice(0, cap).map(m => m[0].trim());

  return [prompt];
}

/** Exported for tests — heuristic only, no model call */
export const decompose = decomposeHeuristic;

// ── Reviewer synthesis (#39: compact refs via ContextStore) ─────────────────

async function reviewerSynthesize(
  originalPrompt: string,
  allResults:     SubTaskResult[],
  systemPrompt:   string,
  modelReg?:      ModelRegistry,
  contextRef?:    string,
): Promise<string> {
  const chain  = resolveModelChain(modelReg);
  const cfg    = chain[0]!;
  const client = new ModelClient(cfg, modelReg);

  const results = allResults.filter(r => !r.error);

  // #39: If ContextStore holds the full results, send compact summaries + reference
  const context = contextRef
    ? results.map((r, i) =>
        `Sub-task ${i + 1} (${r.task.slice(0, 50)}): ${r.result.slice(0, 300)}...`
      ).join("\n") + `\n\n${contextRef}`
    : results
        .map((r, i) => `### Sub-task ${i + 1}: ${r.task}\n${r.result}`)
        .join("\n\n");

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content:
        `You are a synthesis reviewer. Sub-tasks were executed for the following request.\n\n` +
        `**Original request:** ${originalPrompt}\n\n` +
        `**Sub-task results:**\n${context}\n\n` +
        `Write a concise, unified answer that directly addresses the original request.`,
    },
  ];

  let out = "";
  for await (const chunk of client.stream(messages, [])) {
    if (chunk.type === "delta" && chunk.text) out += chunk.text;
  }
  return out || results.map(r => r.result).join("\n\n---\n\n");
}

// ── SwarmRouter class ────────────────────────────────────────────────────────

export class SwarmRouter {
  private maxAgents:           number;
  private complexityThreshold: number;
  private modelRegistry?:      ModelRegistry;

  constructor(cfg: SwarmConfig = {}, modelReg?: ModelRegistry) {
    const cpus              = os.cpus().length;
    this.maxAgents          = Math.min(cfg.maxAgents ?? Math.min(cpus, 3), 5);
    this.complexityThreshold = cfg.complexityThreshold ?? 40;
    this.modelRegistry       = modelReg;
  }

  /** True when the prompt is complex enough to warrant swarm execution. */
  shouldSwarm(prompt: string): boolean {
    return scoreComplexity(prompt) >= this.complexityThreshold;
  }

  /**
   * Decompose prompt into sub-tasks, execute them in groups of 3 (up to 5
   * agents total), then synthesise with a reviewer model.
   *
   * Groups-of-3 planner:
   *   tasks = decompose(prompt, maxAgents)     → 2–5 sub-tasks
   *   batches = chunk(tasks, 3)                → [[t1,t2,t3],[t4,t5]] for 5 tasks
   *   each batch runs in parallel; batches run sequentially
   *   reviewer model synthesises all results into a unified answer
   *
   * @param prompt        - Original user message
   * @param systemPrompt  - Current system prompt (passed to each sub-agent + reviewer)
   * @param onProgress    - Called as each sub-task completes
   */
  async run(
    prompt:        string,
    systemPrompt:  string,
    onProgress:    (result: SubTaskResult, remaining: number) => void,
    contextStore?: ContextStore,  // #39: optional store for offloading sub-results
  ): Promise<{ synthesis: string; subResults: SubTaskResult[] }> {
    // #29: Use LLM planner for task decomposition (falls back to heuristic)
    const tasks      = await planSubtasks(prompt, this.maxAgents, this.modelRegistry);
    const chain      = resolveModelChain(this.modelRegistry);
    const subResults: SubTaskResult[] = [];

    // #39: Open a task context folder to offload sub-results (saves context window)
    const taskCtx = contextStore?.openTask(`Swarm: ${prompt.slice(0, 60)}`);

    // Split tasks into groups of 3 (the required "groups-of-3" planner)
    const GROUP_SIZE = 3;
    const batches: string[][] = [];
    for (let i = 0; i < tasks.length; i += GROUP_SIZE) {
      batches.push(tasks.slice(i, i + GROUP_SIZE));
    }

    let modelIdx = 1; // reserve chain[0] for reviewer

    const runOne = async (task: string, mIdx: number, remaining: number): Promise<void> => {
      const cfg    = chain[mIdx % chain.length] ?? chain[0]!;
      const client = new ModelClient(cfg, this.modelRegistry);
      const msgs: Message[] = [
        { role: "system", content: systemPrompt },
        { role: "user",   content: task },
      ];

      const t0  = Date.now();
      let   out   = "";
      let   error: string | undefined;
      for await (const chunk of client.stream(msgs, [])) {
        if (chunk.type === "delta" && chunk.text) out += chunk.text;
        if (chunk.type === "error")              error = chunk.error ?? "Sub-task model error";
      }

      const r: SubTaskResult = {
        task,
        result: out || (error ? `(error: ${error})` : "(no output)"),
        model:  cfg.model,
        ms:     Date.now() - t0,
        error,
      };
      subResults.push(r);
      // #39: Write sub-result to context file instead of keeping raw in memory
      if (taskCtx && contextStore) {
        contextStore.appendFinding(taskCtx.taskId, `Sub-task: ${task.slice(0, 50)}`, r.result);
      }
      onProgress(r, remaining);
    };

    // Execute batches sequentially; within each batch run up to 3 in parallel
    let remaining = tasks.length;
    for (const batch of batches) {
      await Promise.all(
        batch.map(task => {
          remaining--;
          return runOne(task, modelIdx++, remaining);
        })
      );
    }

    // #39: Pass context reference to reviewer (compact path vs raw dump)
    const contextRef = taskCtx ? contextStore?.getReference(taskCtx.taskId) : undefined;
    const synthesis  = await reviewerSynthesize(prompt, subResults, systemPrompt, this.modelRegistry, contextRef);

    // Close the context folder (auto-deletes in 5s)
    if (taskCtx) contextStore?.closeTask(taskCtx.taskId);

    return { synthesis, subResults };
  }
}
