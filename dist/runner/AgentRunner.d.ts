/**
 * AgentRunner — the core agentic loop.
 *
 * 1. Fires before_agent_start hooks (prompt injection, live context)
 * 2. Streams model response (with multi-model fallback rotation)
 * 3. If model returns tool calls → dispatch → feed results back → continue
 * 4. Emits events so the TUI can render incrementally
 */
import type { Registry } from "../api/Registry.js";
import type { SessionManager } from "../session/SessionManager.js";
import type { SessionContext } from "../api/ExtensionAPI.js";
export type RunnerEvent = {
    type: "text_delta";
    text: string;
} | {
    type: "tool_start";
    name: string;
    args: string;
} | {
    type: "tool_done";
    name: string;
    result: string;
    isError: boolean;
} | {
    type: "model_fallback";
    from: string;
    to: string;
    reason: string;
} | {
    type: "swarm_subtask";
    task: string;
    model: string;
    ms: number;
    remaining: number;
} | {
    type: "swarm_review";
    subCount: number;
} | {
    type: "turn_done";
} | {
    type: "error";
    message: string;
};
export type RunnerEventHandler = (event: RunnerEvent) => void;
export declare class AgentRunner {
    private registry;
    private session;
    private onEvent;
    private sessionCtx;
    private effectLevel;
    private modelChain;
    private dispatcher;
    private swarmRouter;
    constructor(registry: Registry, session: SessionManager, onEvent: RunnerEventHandler, sessionCtx: SessionContext, effectLevel?: string);
    /**
     * Live reconfigure effect level without recreating the runner.
     * Called by the /effect REPL command immediately on each invocation so that
     * the next user turn uses the new swarm config.
     */
    setEffectLevel(level: string): void;
    /** Run one user turn — may invoke multiple tool rounds and model fallbacks internally */
    run(userMessage: string): Promise<void>;
    private runSwarm;
    runSingleAgent(): Promise<void>;
}
//# sourceMappingURL=AgentRunner.d.ts.map