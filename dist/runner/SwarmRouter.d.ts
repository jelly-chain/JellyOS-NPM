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
export interface SwarmConfig {
    /** Maximum parallel workers (hard cap: 5). Default: min(cpuCount, 3). */
    maxAgents?: number;
    /** Complexity score threshold above which swarm activates. Default: 40. */
    complexityThreshold?: number;
}
export interface SubTaskResult {
    task: string;
    result: string;
    model: string;
    ms: number;
}
/**
 * Returns a score 0–100 reflecting prompt complexity.
 * Tuned so "check ETH price" ≈ 10, "analyze ETH and BTC then predict" ≈ 55.
 */
export declare function scoreComplexity(prompt: string): number;
/**
 * Splits a complex prompt into 2–5 focused sub-task strings.
 * Uses simple heuristics so no extra model call is needed.
 */
export declare function decompose(prompt: string, maxTasks: number): string[];
export declare class SwarmRouter {
    private maxAgents;
    private complexityThreshold;
    constructor(cfg?: SwarmConfig);
    /** True when the prompt is complex enough to warrant swarm execution. */
    shouldSwarm(prompt: string): boolean;
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
    run(prompt: string, systemPrompt: string, onProgress: (result: SubTaskResult, remaining: number) => void): Promise<{
        synthesis: string;
        subResults: SubTaskResult[];
    }>;
}
//# sourceMappingURL=SwarmRouter.d.ts.map