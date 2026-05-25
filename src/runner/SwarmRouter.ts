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

// ── Task decomposition ───────────────────────────────────────────────────────

/**
 * Splits a complex prompt into 2–5 focused sub-task strings.
 * Uses simple heuristics so no extra model call is needed.
 */
export function decompose(prompt: string, maxTasks: number): string[] {
  const cap = Math.max(2, Math.min(maxTasks, 5));

  // Split on explicit conjunctions / punctuation
  const parts = prompt
    .split(/,\s*| and | also | then | additionally | plus /i)
    .map(s => s.trim())
    .filter(s => s.length > 4);

  if (parts.length >= 2) {
    return parts.slice(0, cap);
  }

  // Fallback: split action verbs into separate sub-questions
  const verbMatches = [...prompt.matchAll(/\b(analyze|compare|predict|scan|check|estimate|evaluate)\b[^,.?]*/gi)];
  if (verbMatches.length >= 2) {
    return verbMatches.slice(0, cap).map(m => m[0].trim());
  }

  // Cannot decompose meaningfully → return as-is (single task)
  return [prompt];
}

// ── Reviewer synthesis ───────────────────────────────────────────────────────

async function reviewerSynthesize(
  originalPrompt: string,
  results: SubTaskResult[],
  systemPrompt: string,
): Promise<string> {
  const chain  = resolveModelChain();
  const cfg    = chain[0]!;
  const client = new ModelClient(cfg);

  const context = results
    .map((r, i) => `### Sub-task ${i + 1}: ${r.task}\n${r.result}`)
    .join("\n\n");

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content:
        `You are a synthesis reviewer. The following sub-tasks were run in response to the user's original request.\n\n` +
        `**Original request:** ${originalPrompt}\n\n${context}\n\n` +
        `Write a concise, unified answer that directly addresses the original request using all the above findings.`,
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

  constructor(cfg: SwarmConfig = {}) {
    const cpus              = os.cpus().length;
    this.maxAgents          = Math.min(cfg.maxAgents ?? Math.min(cpus, 3), 5);
    this.complexityThreshold = cfg.complexityThreshold ?? 40;
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
    prompt:       string,
    systemPrompt: string,
    onProgress:   (result: SubTaskResult, remaining: number) => void,
  ): Promise<{ synthesis: string; subResults: SubTaskResult[] }> {
    const tasks      = decompose(prompt, this.maxAgents);
    const chain      = resolveModelChain();
    const subResults: SubTaskResult[] = [];

    // Split tasks into groups of 3 (the required "groups-of-3" planner)
    const GROUP_SIZE = 3;
    const batches: string[][] = [];
    for (let i = 0; i < tasks.length; i += GROUP_SIZE) {
      batches.push(tasks.slice(i, i + GROUP_SIZE));
    }

    let modelIdx = 1; // reserve chain[0] for reviewer

    const runOne = async (task: string, mIdx: number, remaining: number): Promise<void> => {
      const cfg    = chain[mIdx % chain.length] ?? chain[0]!;
      const client = new ModelClient(cfg);
      const msgs: Message[] = [
        { role: "system", content: systemPrompt },
        { role: "user",   content: task },
      ];

      const t0  = Date.now();
      let   out = "";
      for await (const chunk of client.stream(msgs, [])) {
        if (chunk.type === "delta" && chunk.text) out += chunk.text;
      }

      const r: SubTaskResult = {
        task,
        result: out || "(no output)",
        model:  cfg.model,
        ms:     Date.now() - t0,
      };
      subResults.push(r);
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

    const synthesis = await reviewerSynthesize(prompt, subResults, systemPrompt);
    return { synthesis, subResults };
  }
}
