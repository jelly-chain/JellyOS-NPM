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
import { ToolDispatcher, forecastContextGrowth } from "./ToolDispatcher.js";
import { SwarmRouter }     from "./SwarmRouter.js";
import type { Registry }   from "../api/Registry.js";
import type { SessionManager } from "../session/SessionManager.js";
import type { SessionContext } from "../api/ExtensionAPI.js";
import type { ModelRegistry } from "../models/ModelRegistry.js";
import type { CostTracker }   from "../models/CostTracker.js";
import type { GoalManager }   from "../session/GoalManager.js";
import type { ContextStore }  from "../session/ContextStore.js";
import { priceFeed }  from "../tools/PriceFeed.js";
import { newsFeed }   from "../tools/NewsSentiment.js";
import { Tracer }     from "../telemetry/Tracer.js";

export type RunnerEvent =
  | { type: "text_delta";       text: string }
  | { type: "tool_start";       name: string; args: string }
  | { type: "tool_done";        name: string; result: string; isError: boolean }
  | { type: "model_fallback";   from: string; to: string; reason: string }
  | { type: "swarm_subtask";    task: string; model: string; ms: number; remaining: number }
  | { type: "swarm_review";     subCount: number }
  | { type: "turn_done" }
  | { type: "error";            message: string }
  /** #10: Approval gate — TUI pauses and waits for user y/n */
  | { type: "approval_request"; toolName: string; args: string; approve: (yes: boolean) => void };

export type RunnerEventHandler = (event: RunnerEvent) => void;

const MAX_TOOL_ROUNDS  = 12;
const REFLECT_AT_ROUND = 6;

// ── #37: Task-type detection + model routing ────────────────────────────────

type TaskType = "price_check" | "ta_analysis" | "strategy" | "code" | "news_summary" | "prediction" | "general";

function detectTaskType(message: string): TaskType {
  const m = message.toLowerCase();
  if (/\bhow much|price of|worth|cost of|current price\b/.test(m))           return "price_check";
  if (/\brsi|macd|bollinger|technical|chart|candle|ohlcv\b/.test(m))         return "ta_analysis";
  if (/\bcode|script|write|implement|function|typescript|python\b/.test(m))  return "code";
  if (/\bpredict|forecast|will.*price|going to|expect.*price\b/.test(m))     return "prediction";
  if (/\bnews|sentiment|latest|headlines|today.*market\b/.test(m))           return "news_summary";
  if (/\bstrategy|plan|portfolio|risk|position|trade\b/.test(m))             return "strategy";
  return "general";
}

// Task → tier mapping: cheap tasks go to workers, deep tasks go to orchestrators
const TASK_TIER_MAP: Record<TaskType, import("../models/ModelRegistry.js").ModelTier> = {
  price_check:  "worker",       // fast cheap answer: $0.02-0.10/M
  news_summary: "worker",       // simple text summarization
  code:         "worker",       // qwen3-coder, deepseek are great
  ta_analysis:  "analyst",      // needs math accuracy
  general:      "analyst",      // balanced
  strategy:     "orchestrator", // needs deep reasoning
  prediction:   "orchestrator", // thinking model for max effect
};

/** Effect level → swarm behaviour config */
const EFFECT_SWARM: Record<string, { threshold: number; maxAgents: number }> = {
  eco:    { threshold: 999,  maxAgents: 0 }, // never swarm
  normal: { threshold: 999,  maxAgents: 0 }, // never swarm
  turbo:  { threshold: 40,   maxAgents: 2 },
  max:    { threshold: 30,   maxAgents: 5 },
};

export class AgentRunner {
  private modelChain:    ModelConfig[];
  private dispatcher:   ToolDispatcher;
  private swarmRouter:  SwarmRouter;
  private modelRegistry?: ModelRegistry;
  private costTracker?:   CostTracker;
  private abortController: AbortController | null = null;

  /** #25: Cancel the current in-flight stream immediately */
  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  constructor(
    private registry:    Registry,
    private session:     SessionManager,
    private onEvent:     RunnerEventHandler,
    private sessionCtx:  SessionContext,
    private effectLevel: string = "normal",
    modelReg?:     ModelRegistry,
    costTracker?:  CostTracker,
    private goalManager?:  GoalManager,
    private contextStore?: ContextStore,
  ) {
    this.modelRegistry = modelReg;
    this.costTracker   = costTracker;
    this.modelChain = resolveModelChain(modelReg);
    this.dispatcher = new ToolDispatcher(registry);
    const sc = EFFECT_SWARM[effectLevel] ?? EFFECT_SWARM["normal"]!;
    this.swarmRouter = new SwarmRouter({
      maxAgents:           sc.maxAgents,
      complexityThreshold: sc.threshold,
    }, modelReg);
  }

  /**
   * Live reconfigure effect level without recreating the runner.
   * Called by the /effect REPL command immediately on each invocation so that
   * the next user turn uses the new swarm config.
   */
  setEffectLevel(level: string): void {
    this.effectLevel = level;
    this.modelChain = resolveModelChain(this.modelRegistry);
    const sc = EFFECT_SWARM[level] ?? EFFECT_SWARM["normal"]!;
    this.swarmRouter = new SwarmRouter({
      maxAgents:           sc.maxAgents,
      complexityThreshold: sc.threshold,
    }, this.modelRegistry);
  }

  /** Run one user turn — may invoke multiple tool rounds and model fallbacks internally */
  async run(userMessage: string): Promise<void> {
    // #30: Start trace for this turn
    const sessionId = `jelly-${Date.now().toString(36)}`;
    const tracer    = new Tracer(sessionId, userMessage);

    // 1. Fire before_agent_start hooks
    await this.registry.fireHook("before_agent_start", this.sessionCtx);

    // 2. #38: Rebuild dynamic system prompt each turn
    const basePrompt   = this.registry.getSystemPrompt();
    const dynamicSuffix = this.buildDynamicSystemSuffix();
    this.session.setSystemPrompt(basePrompt + dynamicSuffix);

    // 3. #40/#32: Pre-flight context pressure check — smart compact if needed
    const pressure = this.session.getContextPressure();
    if (pressure.pct >= 85 && pressure.pct < 95) {
      // #32: Try tier-2 summarization with cheap model before hard-dropping turns
      await this.session.summarizeOldTurns(async (messages) => {
        const chain = resolveModelChain(this.modelRegistry);
        // Use cheapest available model for summarization (worker or free tier)
        const summaryCfg = chain[chain.length - 1] ?? chain[0]!;
        const client     = new ModelClient(summaryCfg, this.modelRegistry);
        const preview    = messages
          .map(m => `${m.role}: ${typeof m.content === "string" ? m.content.slice(0, 150) : "[tool call]"}`)
          .join("\n");
        let out = "";
        for await (const chunk of client.stream([
          { role: "system",  content: "Summarize the following conversation in 3-5 bullet points. Be specific about prices, decisions, and findings." },
          { role: "user",    content: preview },
        ], [])) {
          if (chunk.type === "delta" && chunk.text) out += chunk.text;
        }
        return out || "(summary unavailable)";
      });
    } else if (pressure.pct >= 95) {
      this.session.forceCompact();
    }

    // 4. #33: Guard swarm against insufficient context headroom
    if (this.swarmRouter.shouldSwarm(userMessage)) {
      if (!this.session.getContextPressure().turboReady) {
        this.onEvent({ type: "text_delta", text: "\u26a1 Compacting context for turbo mode...\n" });
        this.session.forceCompact();
      }
      await this.runSwarm(userMessage);
      return;
    }

    // 5. #16: Inject live market context into the user message
    const enriched = await this.buildLiveContext(userMessage);
    this.session.addMessage({ role: "user", content: enriched });
    await this.runSingleAgent(userMessage, tracer);
    tracer.flush("ok");
    this.onEvent({ type: "turn_done" });
  }

  // ── #16: Live market context injection ─────────────────────────────────────
  private async buildLiveContext(message: string): Promise<string> {
    const parts: string[] = [];

    // Extract ticker symbols mentioned in the message
    const tickerRe = /\b(BTC|ETH|SOL|BNB|MATIC|ARB|OP|AVAX|LINK|UNI|DOGE|XRP|ADA|DOT|ATOM|NEAR|SUI|APT|PEPE|AAVE|WIF|BONK)\b/gi;
    const mentioned = [...new Set((message.match(tickerRe) ?? []).map(s => s.toLowerCase()))];

    if (mentioned.length > 0) {
      const ticks = priceFeed.getMultiple(mentioned);
      if (ticks.length > 0) {
        parts.push("Current prices: " + ticks.map(t => priceFeed.formatPrice(t)).join(" | "));
      }
    }

    // News sentiment badge if message is analysis/sentiment related
    if (/sentiment|news|market|mood|bullish|bearish|fear|greed/i.test(message)) {
      const badge = newsFeed.statusBadge();
      if (badge && badge !== "📰 ?") parts.push(`News: ${badge}`);
    }

    if (parts.length === 0) return message;
    return `<live_context>\n${parts.join("\n")}\n</live_context>\n\n${message}`;
  }

  // ── #38: Dynamic system prompt suffix ──────────────────────────────────────
  private buildDynamicSystemSuffix(): string {
    const sections: string[] = [];

    // Active goals
    const goals = this.goalManager?.getActive() ?? [];
    if (goals.length > 0) {
      sections.push(`\n## Active Goals\n${goals.map(g => `- [${g.id}] ${g.text}`).join("\n")}`);
    }

    // Active task context references
    const activeTasks = this.contextStore?.getActiveTasks() ?? [];
    if (activeTasks.length > 0) {
      sections.push(`\n## Saved Task Context\n` +
        activeTasks.map(t => this.contextStore!.getReference(t.taskId)).join("\n"));
    }

    // Context pressure advisory
    const pressure = this.session.getContextPressure();
    if (pressure.level === "red" || pressure.level === "critical") {
      sections.push(
        `\n## ⚠ Context Window at ${pressure.pct}%\n` +
        `Be concise. Prefer short summaries. Use read_task_context() for historical data rather than repeating it. ` +
        `${pressure.turboReady ? "" : "Swarm mode is temporarily paused to preserve headroom."}`,
      );
    }

    // Effect level advisory
    if (this.effectLevel === "eco") {
      sections.push("\n## Mode: ECO\nBe brief. Minimize tool calls. Prefer one tool per response.");
    }

    return sections.join("");
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
      this.contextStore, // #39: offload sub-results to disk
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

  async runSingleAgent(userMessage?: string, tracer?: Tracer): Promise<void> {
    const openAITools = this.registry.toOpenAITools();
    const t0          = Date.now();
    this.abortController = new AbortController();
    const abortSignal    = this.abortController.signal;
    let   rounds         = 0;

    // #37: Route to appropriate model tier based on task type
    let taskModelChain = this.modelChain;
    if (userMessage && this.modelRegistry) {
      const taskType  = detectTaskType(userMessage);
      const targetTier = TASK_TIER_MAP[taskType];
      // For max effect + prediction tasks, enable thinking mode
      const useThinking = this.effectLevel === "max" && taskType === "prediction";
      const taskModel   = this.modelRegistry.pick(targetTier);
      if (taskModel) {
        const cfg = this.modelRegistry.buildConfig(
          taskModel.id,
          this.modelChain[0]?.maxTokens ?? 8192,
          this.modelChain[0]?.temperature ?? 0.7,
          targetTier,
        );
        if (cfg) {
          if (useThinking) { cfg.thinkingEnabled = true; cfg.thinkingBudget = 8000; }
          taskModelChain = [cfg, ...this.modelChain.filter(m => m.model !== cfg.model)];
        }
      }
    }

    while (rounds < MAX_TOOL_ROUNDS) {
      rounds++;
      const messages = this.session.getMessages();
      let   assistantText    = "";
      let   pendingToolCalls: ToolCall[] = [];
      let   modelError: string | null    = null;
      let   usageTokens: { prompt_tokens: number; completion_tokens: number } | null = null;

      // Try model chain — rotate on 429/5xx
      for (let mi = 0; mi < taskModelChain.length; mi++) {
        const cfg    = taskModelChain[mi]!;
        const client = new ModelClient(cfg, this.modelRegistry);
        assistantText    = "";
        pendingToolCalls = [];
        modelError       = null;

        let gotError    = false;
        let isRateLimit = false;

        for await (const chunk of client.stream(messages, openAITools, abortSignal)) {
          if (chunk.type === "delta" && chunk.text) {
            assistantText += chunk.text;
            this.onEvent({ type: "text_delta", text: chunk.text });
          } else if (chunk.type === "tool_call" && chunk.tool_calls) {
            pendingToolCalls = chunk.tool_calls;
          } else if (chunk.type === "done" && chunk.finish_reason === "aborted") {
            // #25: Stream was aborted by user — clean exit
            this.onEvent({ type: "turn_done" });
            return;
          } else if (chunk.type === "done" && chunk.usage) {
            usageTokens = chunk.usage;
          } else if (chunk.type === "error") {
            modelError  = chunk.error ?? "Unknown model error";
            gotError    = true;
            this.costTracker?.recordError(); // #1: track errors
            // Rotate on 429 rate-limit OR any 5xx server error
            isRateLimit = /429|rate.?limit/i.test(modelError)
              || (chunk.status !== undefined && chunk.status >= 500);
            break;
          }
        }

        if (!gotError) break; // success — use this model's output

        // Rotate to next model on rate-limit or server errors
        const nextCfg = taskModelChain[mi + 1];

        // Save any partial text the user already saw before rotating
        if (assistantText.trim()) {
          this.session.addMessage({ role: "assistant", content: assistantText + "\n\n[connection interrupted — retrying with fallback model]" });
        }

        if (nextCfg && isRateLimit) {
          this.onEvent({
            type:   "model_fallback",
            from:   cfg.model,
            to:     nextCfg.model,
            reason: modelError ?? "rate limit",
          });
          continue;
        }

        // Non-recoverable error or no more fallbacks — commit partial text if any
        if (assistantText.trim()) {
          this.session.addMessage({ role: "assistant", content: assistantText });
        }
        this.onEvent({ type: "error", message: modelError ?? "Model error" });
        return;
      }

      if (modelError && assistantText === "" && pendingToolCalls.length === 0) {
        this.onEvent({ type: "error", message: modelError });
        return;
      }

      // #1: Record cost for this model call
      if (this.costTracker && !modelError) {
        const cfg = this.modelChain[0]!;
        if (usageTokens) {
          this.costTracker.record(cfg.model, usageTokens.prompt_tokens, usageTokens.completion_tokens, Date.now() - t0);
        } else {
          // Fallback: estimate from char counts (~4 chars per token)
          const allMsgs   = this.session.getMessages();
          const promptChars = allMsgs.reduce((n, m) => n + (typeof m.content === "string" ? m.content.length : 0), 0);
          const promptTok   = Math.ceil(promptChars / 4);
          const completeTok = Math.ceil(assistantText.length / 4);
          this.costTracker.record(cfg.model, promptTok, completeTok, Date.now() - t0);
        }
        usageTokens = null; // reset for next round
      }

      // Save assistant turn
      const assistantMsg: Message = {
        role:    "assistant",
        content: assistantText || null,
        ...(pendingToolCalls.length > 0 ? { tool_calls: pendingToolCalls } : {}),
      };
      this.session.addMessage(assistantMsg);

      if (pendingToolCalls.length === 0) break;

      // #9: Reflection — at mid-point, force model to assess progress
      if (rounds === REFLECT_AT_ROUND) {
        this.session.addMessage({
          role:    "user",
          content: `[AGENT REFLECTION — round ${rounds}/${MAX_TOOL_ROUNDS}] ` +
            `You have used ${rounds} tool calls. ` +
            `Summarize what you have found so far, then decide: ` +
            `(a) you have enough to answer — do so now, or ` +
            `(b) you need specific additional data — state exactly what and use ONE more tool. ` +
            `Do not call tools unless you have a clear remaining gap.`,
        });
      }

      // #10: Check for tools requiring approval before dispatching
      const approvedCalls: ToolCall[] = [];
      for (const tc of pendingToolCalls) {
        const toolDef = this.registry.getTool(tc.function.name);
        if (toolDef?.requiresApproval) {
          const approved = await new Promise<boolean>((resolve) => {
            this.onEvent({
              type:     "approval_request",
              toolName: tc.function.name,
              args:     tc.function.arguments,
              approve:  resolve,
            });
            // Auto-deny after 60 seconds if no response
            setTimeout(() => resolve(false), 60_000);
          });
          if (!approved) {
            // Inject a denial message so model knows it was blocked
            this.session.addMessage({
              role:         "tool",
              content:      `Tool "${tc.function.name}" was denied by user. Do not retry without asking explicitly.`,
              name:         tc.function.name,
              tool_call_id: tc.id,
            });
            this.onEvent({ type: "tool_done", name: tc.function.name, result: "[DENIED by user]", isError: true });
            continue;
          }
        }
        approvedCalls.push(tc);
      }

      for (const tc of approvedCalls) {
        this.onEvent({ type: "tool_start", name: tc.function.name, args: tc.function.arguments });
        tracer?.startSpan(`tool:${tc.function.name}`, { args: tc.function.arguments.slice(0, 100) });
      }

      if (approvedCalls.length === 0) continue;

      // #40: Pre-tool context budget forecast — compact proactively if needed
      const forecastedGrowth = forecastContextGrowth(approvedCalls);
      const currentChars     = this.session.charCount();
      const forecastedPct    = (currentChars + forecastedGrowth) / 80_000 * 100;
      if (forecastedPct > 90) {
        // Pre-compact before tools add more content
        this.session.forceCompact();
        this.onEvent({ type: "text_delta", text: `\n⚡ Pre-compacting context (forecast: ${forecastedPct.toFixed(0)}% after tools)\n` });
      }

      const results = await this.dispatcher.dispatch(approvedCalls);

      for (const r of results) {
        this.onEvent({ type: "tool_done", name: r.name, result: r.content, isError: r.isError });
        // #30: End tool span
        const toolSpan = tracer?.trace?.spans?.slice().reverse().find(
          (s: { name: string }) => s.name === `tool:${r.name}` && !(s as { durationMs?: number }).durationMs
        );
        if (toolSpan) tracer?.endSpan(toolSpan.spanId, r.isError ? "error" : "ok", { resultLen: r.content.length });
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
