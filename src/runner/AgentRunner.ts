/**
 * AgentRunner — the core agentic loop.
 *
 * 1. Fires before_agent_start hooks (prompt injection, live context)
 * 2. Streams model response (with multi-model fallback rotation)
 * 3. If model returns tool calls → dispatch → feed results back → continue
 * 4. Emits events so the TUI can render incrementally
 */

import {
  ModelClient,
  resolveModelChain,
  type Message,
  type ToolCall,
  type ModelConfig,
} from "./ModelClient.js";
import { ToolDispatcher }  from "./ToolDispatcher.js";
import { SwarmRouter }     from "./SwarmRouter.js";
import type { Registry }   from "../api/Registry.js";
import type { SessionManager } from "../session/SessionManager.js";
import type { SessionContext } from "../api/ExtensionAPI.js";

export type RunnerEvent =
  | { type: "text_delta";     text: string }
  | { type: "tool_start";     name: string; args: string }
  | { type: "tool_done";      name: string; result: string; isError: boolean }
  | { type: "model_fallback"; from: string; to: string; reason: string }
  | { type: "swarm_subtask";  task: string; model: string; ms: number; remaining: number }
  | { type: "swarm_review";   subCount: number }
  | { type: "turn_done" }
  | { type: "error";          message: string };

export type RunnerEventHandler = (event: RunnerEvent) => void;

const MAX_TOOL_ROUNDS = 12;

/** Effect level → swarm behaviour config */
const EFFECT_SWARM: Record<string, { threshold: number; maxAgents: number }> = {
  eco:    { threshold: 999,  maxAgents: 0 }, // never swarm
  normal: { threshold: 999,  maxAgents: 0 }, // never swarm
  turbo:  { threshold: 40,   maxAgents: 2 },
  max:    { threshold: 30,   maxAgents: 5 },
};

export class AgentRunner {
  private modelChain: ModelConfig[];
  private dispatcher: ToolDispatcher;
  private swarmRouter: SwarmRouter;

  constructor(
    private registry:    Registry,
    private session:     SessionManager,
    private onEvent:     RunnerEventHandler,
    private sessionCtx:  SessionContext,
    private effectLevel: string = "normal",
  ) {
    this.modelChain = resolveModelChain();
    this.dispatcher = new ToolDispatcher(registry);
    const sc = EFFECT_SWARM[effectLevel] ?? EFFECT_SWARM["normal"]!;
    this.swarmRouter = new SwarmRouter({
      maxAgents:           sc.maxAgents,
      complexityThreshold: sc.threshold,
    });
  }

  /**
   * Live reconfigure effect level without recreating the runner.
   * Called by the /effect REPL command immediately on each invocation so that
   * the next user turn uses the new swarm config.
   */
  setEffectLevel(level: string): void {
    this.effectLevel = level;
    // Rebuild model chain — eco/normal may want a different subset
    this.modelChain = resolveModelChain();
    const sc = EFFECT_SWARM[level] ?? EFFECT_SWARM["normal"]!;
    this.swarmRouter = new SwarmRouter({
      maxAgents:           sc.maxAgents,
      complexityThreshold: sc.threshold,
    });
  }

  /** Run one user turn — may invoke multiple tool rounds and model fallbacks internally */
  async run(userMessage: string): Promise<void> {
    // 1. Fire before_agent_start hooks — extension injects live context, system prompt
    await this.registry.fireHook("before_agent_start", this.sessionCtx);

    // 2. Sync system prompt from registry (extension may have called setSystemPrompt)
    this.session.setSystemPrompt(this.registry.getSystemPrompt());

    // 3. Check swarm eligibility before adding to history
    if (this.swarmRouter.shouldSwarm(userMessage)) {
      await this.runSwarm(userMessage);
      return;
    }

    // 4. Single-agent path — add user message to history
    this.session.addMessage({ role: "user", content: userMessage });
    await this.runSingleAgent();
    this.onEvent({ type: "turn_done" });
  }

  // ── Swarm path ─────────────────────────────────────────────────────────────

  private async runSwarm(userMessage: string): Promise<void> {
    const systemPrompt = this.registry.getSystemPrompt();

    const { synthesis, subResults } = await this.swarmRouter.run(
      userMessage,
      systemPrompt,
      (result, remaining) => {
        this.onEvent({
          type:      "swarm_subtask",
          task:      result.task,
          model:     result.model,
          ms:        result.ms,
          remaining,
        });
      },
    );

    this.onEvent({ type: "swarm_review", subCount: subResults.length });

    // Stream reviewer synthesis token-by-token (already complete — re-emit as deltas)
    for (const ch of synthesis) {
      this.onEvent({ type: "text_delta", text: ch });
    }

    // Save to session history as a single assistant message
    this.session.addMessage({ role: "user",      content: userMessage });
    this.session.addMessage({ role: "assistant", content: synthesis });
    this.onEvent({ type: "turn_done" });
  }

  // ── Single-agent path (also used for each sub-task in turbo/max) ────────────

  async runSingleAgent(): Promise<void> {
    const openAITools = this.registry.toOpenAITools();
    let   rounds      = 0;

    while (rounds < MAX_TOOL_ROUNDS) {
      rounds++;
      const messages = this.session.getMessages();
      let   assistantText    = "";
      let   pendingToolCalls: ToolCall[] = [];
      let   modelError: string | null    = null;

      // Try model chain — rotate on 429/5xx
      for (let mi = 0; mi < this.modelChain.length; mi++) {
        const cfg    = this.modelChain[mi]!;
        const client = new ModelClient(cfg);
        assistantText    = "";
        pendingToolCalls = [];
        modelError       = null;

        let gotError    = false;
        let isRateLimit = false;

        for await (const chunk of client.stream(messages, openAITools)) {
          if (chunk.type === "delta" && chunk.text) {
            assistantText += chunk.text;
            this.onEvent({ type: "text_delta", text: chunk.text });
          } else if (chunk.type === "tool_call" && chunk.tool_calls) {
            pendingToolCalls = chunk.tool_calls;
          } else if (chunk.type === "error") {
            modelError  = chunk.error ?? "Unknown model error";
            gotError    = true;
            // Rotate on 429 rate-limit OR any 5xx server error
            isRateLimit = /429|rate.?limit/i.test(modelError)
              || (chunk.status !== undefined && chunk.status >= 500);
            break;
          }
        }

        if (!gotError) break; // success — use this model's output

        // Rotate to next model on rate-limit or server errors
        const nextCfg = this.modelChain[mi + 1];
        if (nextCfg && isRateLimit) {
          this.onEvent({
            type:   "model_fallback",
            from:   cfg.model,
            to:     nextCfg.model,
            reason: modelError ?? "rate limit",
          });
          continue;
        }

        // Non-recoverable error or no more fallbacks
        this.onEvent({ type: "error", message: modelError ?? "Model error" });
        return;
      }

      if (modelError && assistantText === "" && pendingToolCalls.length === 0) {
        this.onEvent({ type: "error", message: modelError });
        return;
      }

      // Save assistant turn
      const assistantMsg: Message = {
        role:    "assistant",
        content: assistantText || null,
        ...(pendingToolCalls.length > 0 ? { tool_calls: pendingToolCalls } : {}),
      };
      this.session.addMessage(assistantMsg);

      if (pendingToolCalls.length === 0) break;

      // Dispatch tool calls
      for (const tc of pendingToolCalls) {
        this.onEvent({ type: "tool_start", name: tc.function.name, args: tc.function.arguments });
      }

      const results = await this.dispatcher.dispatch(pendingToolCalls);

      for (const r of results) {
        this.onEvent({ type: "tool_done", name: r.name, result: r.content, isError: r.isError });
        this.session.addMessage({
          role:         "tool",
          content:      r.content,
          name:         r.name,
          tool_call_id: r.tool_call_id,
        });
      }
    }
  }
}
