/**
 * App — root Ink component.
 * Multi-pane TUI with context bar, syntax-highlighted tool output,
 * live side panel with ticker/prices, and command palette triggered via /palette.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { Type } from "@sinclair/typebox";
import { StatusBar }    from "./StatusBar.js";
import { REPL }         from "./REPL.js";
import { ModelSelector } from "./ModelSelector.js";
import type { ChatMessage } from "./REPL.js";
import { makeTheme, T, JELLY_COLORS } from "./theme.js";
import { Registry }     from "../api/Registry.js";
import { AgentRunner }  from "../runner/AgentRunner.js";
import { SessionManager } from "../session/SessionManager.js";
import type { SessionContext, UIContext } from "../api/ExtensionAPI.js";
import { resolveModelConfig } from "../runner/ModelClient.js";
import type { ModelRegistry } from "../models/ModelRegistry.js";
import type { CostTracker }   from "../models/CostTracker.js";
import { priceFeed, getPricesTool, topMoversTool, marketOverviewTool, getPricesParams, topMoversParams, marketOverviewParams } from "../tools/PriceFeed.js";
import { getNewsTool, getNewsParams } from "../tools/NewsSentiment.js";
import { analyzeTAParams, getCandlesParams, getCandlesTool } from "../tools/TechnicalAnalysis.js";
import { fullAnalysis } from "../tools/TechnicalAnalysis.js";
import { newsFeed } from "../tools/NewsSentiment.js";
import {
  getFearGreedTool, fearGreedParams,
  getFundingRatesTool, fundingRatesParams,
  getBtcMempoolTool, btcMempoolParams,
  getDefiTvlTool, defiTvlParams,
  getSolanaStatsTool, solanaStatsParams,
} from "../tools/MarketSentiment.js";
import { contextStore }  from "../session/ContextStore.js";
import { goalManager }   from "../session/GoalManager.js";
import { memoryStore }   from "../session/MemoryStore.js";
import { agentScheduler } from "../scheduler/AgentScheduler.js";
import { Tracer }         from "../telemetry/Tracer.js";

// ── Context window tracking (#33) ───────────────────────────────────────────
function getContextBar(session: SessionManager | null): { pct: number; bar: string; color: string; turboReady: boolean } {
  if (!session) return { pct: 0, bar: "░".repeat(20), color: JELLY_COLORS.dim, turboReady: true };
  const pressure = session.getContextPressure();
  const filled   = Math.round(pressure.pct / 5);
  const color    = pressure.level === "critical" ? JELLY_COLORS.error
                 : pressure.level === "red"      ? JELLY_COLORS.warn
                 : pressure.level === "yellow"   ? JELLY_COLORS.header
                 : JELLY_COLORS.success;
  return {
    pct:        pressure.pct,
    bar:        "█".repeat(Math.min(filled, 20)) + "░".repeat(Math.max(0, 20 - filled)),
    color,
    turboReady: pressure.turboReady,
  };
}

// ── Syntax-highlighted JSON formatter ───────────────────────────────────────
function highlightJson(obj: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (obj === null) return T.dim("null");
  if (typeof obj === "boolean") return T.warn(String(obj));
  if (typeof obj === "number") return T.success(String(obj));
  if (typeof obj === "string") {
    if (obj.startsWith("0x") && obj.length > 10) return T.header(obj.slice(0, 10) + "…");
    return T.accent(`"${obj}"`);
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    if (obj.length <= 3) return `[${obj.map(v => highlightJson(v, 0)).join(", ")}]`;
    return `[\n${obj.slice(0, 5).map(v => `${pad}  ${highlightJson(v, indent + 1)}`).join(",\n")}${obj.length > 5 ? `\n${pad}  …${obj.length - 5} more` : ""}\n${pad}]`;
  }
  if (typeof obj === "object") {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    return `{\n${entries.slice(0, 8).map(([k, v]) => `${pad}  ${T.accent(k)}: ${highlightJson(v, indent + 1)}`).join(",\n")}${entries.length > 8 ? `\n${pad}  …${entries.length - 8} more` : ""}\n${pad}}`;
  }
  return String(obj);
}

function formatToolContent(text: string): string {
  try {
    const obj = JSON.parse(text);
    return highlightJson(obj);
  } catch {
    return text.length > 300 ? text.slice(0, 300) + T.dim("\n…[truncated]") : text;
  }
}

// ── App Props ───────────────────────────────────────────────────────────────
export interface AppProps {
  registry:    Registry;
  systemPrompt?: string;
  effectLevel?: string;
  chain?:       string;
  modelReg?:    ModelRegistry;
  costTracker?: CostTracker;
  onNotifyReady?: (fn: (msg: string) => void) => void;
  onStatusReady?: (fn: (key: string, val: string) => void) => void;
  onModelSelectorReady?: (fn: (query?: string) => void) => void;
}

let _msgIdCounter = 0;
function nextId() { return String(++_msgIdCounter); }

// Unique session ID for memory persistence
const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function App({
  registry,
  systemPrompt,
  effectLevel: initialEffect = "normal",
  chain:       initialChain  = "ethereum",
  modelReg,
  costTracker,
  onNotifyReady,
  onStatusReady,
  onModelSelectorReady,
}: AppProps) {
  const { exit }                      = useApp();
  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [streaming, setStreaming]     = useState("");
  const [toolRunning, setToolRunning] = useState<string | null>(null);
  const [disabled, setDisabled]       = useState(false);
  const [vaultLocked, setVaultLocked] = useState(true);
  const [effectLevel, setEffectLevel] = useState(initialEffect);
  const [chain, setChain]             = useState(initialChain);
  const [statusBadges, setStatusBadges] = useState<Record<string, string>>({});
  const [ticker, setTicker]           = useState("");
  const [costBadge, setCostBadge]     = useState("");
  const [newsBadge, setNewsBadge]     = useState("");
  // ── Sidebar live data state ─────────────────────────────────────────────
  const [sidebarTickers, setSidebarTickers] = useState<Array<{symbol: string, price: number, changePct: number}>>([]);
  const [sidebarNews, setSidebarNews]       = useState<Array<{title: string, sentiment: number, source: string}>>([]);
  const [rotationSlots, setRotationSlots]   = useState<Array<{id: string, tier: string} | null>>([null, null, null, null, null]);
  // ── Model selector overlay state ──────────────────────────────────────
  const [showModelSelector, setShowModelSelector]         = useState(false);
  const [modelSelectorInitialQuery, setModelSelectorInitialQuery] = useState("");
  const runnerRef                     = useRef<AgentRunner | null>(null);
  const sessionRef                    = useRef<SessionManager | null>(null);
  const sessionCtxRef                 = useRef<SessionContext | null>(null);
  const theme                         = makeTheme();

  let modelName = "no-model";
  try { modelName = resolveModelConfig(modelReg).model; } catch { /* shown via banner */ }

  const push = useCallback((msg: Omit<ChatMessage, "id" | "ts">) => {
    setMessages(prev => [...prev, { ...msg, id: nextId(), ts: Date.now() }]);
  }, []);

  const notify = useCallback((content: string) => {
    push({ role: "notify", content });
  }, [push]);

  const setStatus = useCallback((key: string, value: string) => {
    setStatusBadges(prev => ({ ...prev, [key]: value }));
    if (key === "vault") setVaultLocked(!value.includes("🔓") && !value.includes("unlocked"));
    if (key === "chain" || key === "active_chain") setChain(value);
    if (key === "effect_level") setEffectLevel(value);
  }, []);

  const uiCtx: UIContext = {
    notify, setStatus,
    setTheme(_n) {},
    setHeader(_f) {},
    showModelSelector: (query?: string) => {
      setModelSelectorInitialQuery(query ?? "");
      setShowModelSelector(true);
    },
    theme,
  };

  // Register built-in tools
  function registerBuiltinTools(): void {
    if (!modelReg) return;
    const mk = modelReg as any;
    registry.addTool({ name: "list_models", label: "List Models", description: "Search and filter available AI models by name, provider, or tier.", parameters: mk.listModelsParams, execute: (id: string, p: any) => mk.listModelsTool(id, p) });
    registry.addTool({ name: "pick_model", label: "Pick Model", description: "Find the cheapest available model meeting requirements.", parameters: mk.pickModelParams, execute: (id: string, p: any) => mk.pickModelTool(id, p) });
    registry.addTool({ name: "model_summary", label: "Model Summary", description: "Get a summary of available model tiers and counts.", parameters: mk.summaryParams, execute: () => mk.summaryTool() });
    if (costTracker) {
      registry.addTool({ name: "cost_report", label: "Cost Report", description: "Show session and lifetime token usage.", parameters: costTracker.costReportParams, execute: () => costTracker.costReportTool() });
    }
    registry.addTool({ name: "get_prices", label: "Get Prices", description: "Get current prices and 24h change.", parameters: getPricesParams, execute: (id: string, p: any) => getPricesTool(id, p) });
    registry.addTool({ name: "get_top_movers", label: "Top Movers", description: "Assets with largest 24h price movement.", parameters: topMoversParams, execute: (id: string, p: any) => topMoversTool(id, p) });
    registry.addTool({ name: "get_market_overview", label: "Market Overview", description: "Aggregated market data.", parameters: marketOverviewParams, execute: () => marketOverviewTool() });
    registry.addTool({ name: "get_news",  label: "Get News",  description: "Crypto news headlines with sentiment scoring.", parameters: getNewsParams,  execute: (id: string, p: any) => getNewsTool(id, p) });
    // #18: OHLCV candles from Binance + TA analysis
    registry.addTool({ name: "get_candles", label: "Get Candles", description: "Fetch OHLCV candlestick data from Binance and run technical analysis (RSI, MACD, Bollinger, EMA). Use this before analyze_ta.", parameters: getCandlesParams, execute: (id: string, p: any) => getCandlesTool(id, p) });
    // #20: Free market sentiment tools
    registry.addTool({ name: "get_fear_greed",   label: "Fear & Greed",    description: "Crypto Fear & Greed Index with 7-day history.", parameters: fearGreedParams,    execute: (id: string, p: any) => getFearGreedTool(id, p) });
    registry.addTool({ name: "get_funding_rates", label: "Funding Rates",   description: "Binance perpetual funding rates — shows long/short bias.", parameters: fundingRatesParams, execute: (id: string, p: any) => getFundingRatesTool(id, p) });
    registry.addTool({ name: "get_btc_mempool",   label: "BTC Mempool",     description: "Bitcoin mempool stats and recommended fee rates.", parameters: btcMempoolParams,   execute: () => getBtcMempoolTool() });
    registry.addTool({ name: "get_defi_tvl",      label: "DeFi TVL",        description: "DeFiLlama TVL by chain or all chains.", parameters: defiTvlParams,       execute: (id: string, p: any) => getDefiTvlTool(id, p) });
    registry.addTool({ name: "get_solana_stats",  label: "Solana Stats",    description: "Solana network TPS and health.", parameters: solanaStatsParams,  execute: () => getSolanaStatsTool() });
    // #31: Ephemeral task context
    registry.addTool({ name: "read_task_context", label: "Read Task Context", description: "Read saved task context from a previous multi-step operation.", parameters: Type.Object({ taskId: Type.String({ description: "Task ID from a previous task reference" }) }), execute: (id: string, p: any) => contextStore.readContextTool(id, p) });
    registry.addTool({ name: "list_tasks",        label: "List Tasks",       description: "List active and recent task context folders.", parameters: Type.Object({}), execute: () => contextStore.listTasksTool() });
    // #12: Goal management
    registry.addTool({ name: "set_goal",        label: "Set Goal",        description: "Set a persistent cross-session goal for the agent to monitor.", parameters: goalManager.setGoalParams,     execute: (id: string, p: any) => goalManager.setGoalTool(id, p) });
    registry.addTool({ name: "complete_goal",   label: "Complete Goal",   description: "Mark a goal as completed.",                                    parameters: goalManager.completeGoalParams, execute: (id: string, p: any) => goalManager.completeGoalTool(id, p) });
    registry.addTool({ name: "list_goals",      label: "List Goals",      description: "List active or all persistent goals.",                        parameters: goalManager.listGoalsParams,    execute: (id: string, p: any) => goalManager.listGoalsTool(id, p) });
    registry.addTool({ name: "add_goal_note",   label: "Add Goal Note",   description: "Add a progress note to an existing goal.",                   parameters: goalManager.addGoalNoteParams,  execute: (id: string, p: any) => goalManager.addGoalNoteTool(id, p) });
    registry.addTool({ name: "analyze_ta", label: "Technical Analysis", description: "RSI, MACD, Bollinger, EMA crossover, ATR. Tip: use get_candles first to fetch real price data.", parameters: analyzeTAParams, execute: async (_id: string, p: any) => {
      const closes = p.prices as number[];
      const candles = closes.map((c, i) => ({ timestamp: 0, open: c, high: (p.highs as number[] | undefined)?.[i] ?? c, low: (p.lows as number[] | undefined)?.[i] ?? c, close: c, volume: (p.volumes as number[] | undefined)?.[i] ?? 0 }));
      const results = fullAnalysis(candles);
      const summary = results.find((r: any) => r.indicator === "SUMMARY");
      const text = results.map((r: any) => {
        const s = r.signal === "bullish" ? "🟢" : r.signal === "bearish" ? "🔴" : "⚪";
        const v = Array.isArray(r.value) ? `[${r.value.length}]` : typeof r.value === "number" ? r.value : "-";
        return `${s} ${r.indicator}: ${v}`;
      }).join("\n");
      return { content: [{ type: "text" as const, text: `Technical Analysis:\n${text}` }], details: { results, overall_signal: summary?.signal, overall_score: summary?.value } };
    } });
  }

  useEffect(() => { onNotifyReady?.(notify); onStatusReady?.(setStatus); }, []);

  // ── Expose model selector trigger to extensions ──────────────────────────
  useEffect(() => {
    onModelSelectorReady?.((initialQuery?: string) => {
      setModelSelectorInitialQuery(initialQuery ?? "");
      setShowModelSelector(true);
    });
  }, [onModelSelectorReady]);

  useEffect(() => {
    registerBuiltinTools();
    priceFeed.track("btc", "eth", "sol", "bnb", "matic", "arb", "op", "avax", "link", "uni", "doge", "xrp", "ada", "dot", "atom", "near", "sui", "apt", "pepe", "aave");
    priceFeed.start();
    newsFeed.start();

    // #11: Register scheduler tools
    registry.addTool({ name: "schedule_task",  label: "Schedule Task",  description: "Schedule a recurring or one-shot agent task (cron or price trigger).", parameters: agentScheduler.addTaskParams,    execute: (id: string, p: any) => agentScheduler.addTaskTool(id, p) });
    registry.addTool({ name: "list_schedule",  label: "List Schedule",  description: "List all scheduled tasks.",                                           parameters: agentScheduler.listTasksParams,  execute: (id: string, p: any) => agentScheduler.listTasksTool(id, p) });
    registry.addTool({ name: "remove_schedule",label: "Remove Schedule",description: "Remove a scheduled task by ID.",                                      parameters: agentScheduler.removeTaskParams, execute: (id: string, p: any) => agentScheduler.removeTaskTool(id, p) });

    // Start scheduler — fires agent turns autonomously
    agentScheduler.start((task) => {
      push({ role: "system", content: T.muted(`⏰ Scheduler: running "${task.name}"`) });
      // Only fire if agent is not currently busy
      if (!disabled && runnerRef.current) {
        setDisabled(true); setStreaming("");
        runnerRef.current.run(`[SCHEDULED TASK: ${task.name}] ${task.prompt}`)
          .catch((e: Error) => notify(T.error(`Scheduler error: ${e.message}`)));
      }
    });

    const tickerInterval = setInterval(() => {
      setTicker(priceFeed.tickerLine(6));
      if (costTracker) setCostBadge(costTracker.statusLine());
      setNewsBadge(newsFeed.statusBadge());
      // Update sidebar live data
      const allTicks = priceFeed.getAll();
      setSidebarTickers(allTicks.slice(0, 8).map(t => ({ symbol: t.symbol, price: t.price, changePct: t.change24h })));
      const latestNews = newsFeed.getLatest();
      if (latestNews?.items) {
        setSidebarNews(latestNews.items.slice(0, 6).map(item => ({ title: item.title ?? item.source ?? "News", sentiment: item.sentiment ?? 0, source: item.source ?? "" })));
      }
      // Read rotation slots from context.json
      try {
        const JELLY_HOME = process.env.JELLYOS_HOME ?? join(homedir(), ".jelly");
        const ctxPath = join(JELLY_HOME, "context.json");
        if (existsSync(ctxPath)) {
          const store = JSON.parse(readFileSync(ctxPath, "utf-8"));
          if (store.rotationSlots) setRotationSlots(store.rotationSlots);
        }
      } catch { /* non-fatal */ }
    }, 3_000);

    const saveInterval = setInterval(() => { costTracker?.saveLifetime(); }, 60_000);

    const session = new SessionManager();
    session.setSystemPrompt(registry.getSystemPrompt() || systemPrompt || "You are JellyOS, an autonomous AI trading agent.");
    sessionRef.current = session;

    const sessionCtx: SessionContext = { ui: uiCtx, hasUI: true, config: { OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, ALCHEMY_KEY: process.env.ALCHEMY_KEY, DEFAULT_MODEL: process.env.DEFAULT_MODEL } };
    sessionCtxRef.current = sessionCtx;

    registry.fireHook("session_start", sessionCtx).then(() => {
      // #7: Inject memory context into system prompt
      if (memoryStore.isAvailable) {
        const memCtx = memoryStore.buildContextBlock(sessionId);
        if (memCtx) {
          session.setSystemPrompt((session.getSystemPrompt() || "") + memCtx);
        }
      }
      // #12: Inject active goals into system prompt
      const goalCtx = goalManager.buildContextBlock();
      if (goalCtx) {
        session.setSystemPrompt((session.getSystemPrompt() || "") + goalCtx);
      }
      push({ role: "system", content: T.muted("Session started. Type /help for commands.") });
    });

    const runner = new AgentRunner(registry, session, (event) => {
      if (event.type === "text_delta") setStreaming(prev => prev + event.text);
      else if (event.type === "tool_start") setToolRunning(event.name);
      else if (event.type === "tool_done") {
        setToolRunning(null);
        // Format tool output with syntax highlighting
        const formatted = formatToolContent(event.result);
        push({ role: "tool", content: formatted, toolName: event.name, isError: event.isError });
      } else if (event.type === "turn_done") {
        setDisabled(false); setToolRunning(null);
        setStreaming(prev => {
          if (prev.trim()) {
            push({ role: "assistant", content: prev });
            memoryStore.save(sessionId, "assistant", prev); // #7 persist to memory
          }
          return "";
        });
      } else if (event.type === "error") {
        setDisabled(false); setToolRunning(null); setStreaming("");
        notify(T.error(`Error: ${event.message}`));
      } else if (event.type === "approval_request") {
        // #10: Show approval prompt — user must type y or n
        setToolRunning(null);
        const { toolName, args, approve } = event;
        let parsed = "";
        try { parsed = JSON.stringify(JSON.parse(args), null, 2).slice(0, 200); } catch { parsed = args.slice(0, 200); }
        push({
          role:    "notify",
          content: `⚠️  APPROVAL REQUIRED\n\nTool: ${toolName}\nArgs: ${parsed}\n\nType /approve or /deny to continue.`,
        });
        // Store the approve callback so /approve /deny commands can resolve it
        (runnerRef as unknown as { current: AgentRunner & { _pendingApproval?: (b: boolean) => void } }).current!._pendingApproval = approve;
      }
    }, sessionCtx, effectLevel, modelReg, costTracker, goalManager, contextStore);
    runnerRef.current = runner;

    setTicker(priceFeed.tickerLine(6));
    if (costTracker) setCostBadge(costTracker.statusLine());
    setNewsBadge(newsFeed.statusBadge());
    // Initial sidebar data fetch (before interval fires)
    const initialTicks = priceFeed.getAll();
    setSidebarTickers(initialTicks.slice(0, 8).map(t => ({ symbol: t.symbol, price: t.price, changePct: t.change24h })));
    const initialNews = newsFeed.getLatest();
    if (initialNews?.items) {
      setSidebarNews(initialNews.items.slice(0, 6).map(item => ({ title: item.title ?? item.source ?? "News", sentiment: item.sentiment ?? 0, source: item.source ?? "" })));
    }

    return () => {
      if (sessionCtxRef.current) registry.fireHook("session_end", sessionCtxRef.current).catch(() => {});
      priceFeed.stop(); newsFeed.stop(); agentScheduler.stop();
      clearInterval(tickerInterval); clearInterval(saveInterval);
      costTracker?.saveLifetime();
    };
  }, []);

  useEffect(() => { runnerRef.current?.setEffectLevel(effectLevel); }, [effectLevel]);

  // ── Ctrl-C to exit ──────────────────────────────────────────────────────
  useInput((_input, key) => {
    if (key.ctrl && _input === "c") {
      push({ role: "system", content: T.muted("Goodbye 🪼") });
      costTracker?.saveLifetime();
      setTimeout(exit, 200);
    }
  });

  // ── Input handler ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (raw: string) => {
    const input = raw.trim();
    if (!input) return;

    if (input.startsWith("/")) {
      const [cmd, ...rest] = input.slice(1).split(" ");
      const args = rest.join(" ");

      if (cmd === "exit" || cmd === "quit") {
        push({ role: "system", content: T.muted("Goodbye 🪼") });
        costTracker?.saveLifetime();
        setTimeout(exit, 200);
        return;
      }

      if (cmd === "help") {
        const lines = registry.listCommands().map(([n, d]) => T.accent(`/${n}`.padEnd(16)) + " " + d.description);
        notify("Commands:\n" + lines.join("\n") + "\n\nTools: list_models, pick_model, get_prices, get_news, analyze_ta, cost_report, get_market_overview, get_top_movers, model_summary");
        return;
      }

      if (cmd === "models") {
        if (!modelReg) { notify(T.error("Model registry not available")); return; }
        const result = await modelReg.listModelsTool("", { query: rest.join(" ") || undefined, limit: 20, available_only: true });
        notify(result.content[0]!.text);
        return;
      }
      if (cmd === "cost") {
        if (!costTracker) { notify(T.error("Cost tracker not available")); return; }
        const result = await costTracker.costReportTool();
        notify(result.content[0]!.text);
        return;
      }
      if (cmd === "news") {
        const result = await getNewsTool("", { limit: 15 });
        notify(result.content[0]!.text);
        return;
      }
      if (cmd === "prices") {
        const result = await getPricesTool("", { symbols: args ? args.split(/\s+/) : ["btc", "eth", "sol"] });
        notify(result.content[0]!.text);
        return;
      }
      if (cmd === "palette") {
        // Command palette — list all commands and tools
        const lines = registry.listCommands().map(([n, d]) => T.accent(`/${n}`.padEnd(16)) + " " + d.description);
        const tools = registry.listTools().map(t => T.success(`🔧 ${t.name.padEnd(22)}`) + " " + T.muted(t.description.slice(0, 50)));
        notify("Command Palette\n\n" + lines.join("\n") + "\n\nTools:\n" + tools.join("\n"));
        return;
      }
      if (cmd === "effect" && ["eco", "normal", "turbo", "max"].includes(args.trim().toLowerCase())) {
        setEffectLevel(args.trim().toLowerCase());
        notify(T.accent(`Effect → ${args.trim().toUpperCase()}`));
        return;
      }

      // #12: Goal commands
      if (cmd === "goals" || cmd === "goal") {
        const subCmd = args.trim().split(" ")[0];
        if (subCmd === "add") {
          const text = args.trim().slice(4).trim();
          if (!text) { notify(T.error("Usage: /goal add <text>")); return; }
          const result = await goalManager.setGoalTool("", { text });
          notify(result.content[0]!.text);
        } else if (subCmd === "done" || subCmd === "complete") {
          const id = args.trim().split(" ")[1];
          if (!id) { notify(T.error("Usage: /goal done <id>")); return; }
          const result = await goalManager.completeGoalTool("", { id });
          notify(result.content[0]!.text);
        } else {
          const result = await goalManager.listGoalsTool("", { status: "all" });
          notify(result.content[0]!.text);
        }
        return;
      }

      // #31: Task context commands
      if (cmd === "tasks") {
        const result = await contextStore.listTasksTool();
        notify(result.content[0]!.text);
        return;
      }
      if (cmd === "keep" && args.trim()) {
        const ok = contextStore.keepTask(args.trim());
        notify(ok ? T.success(`Task ${args.trim()} marked for permanent retention.`) : T.error(`Task ${args.trim()} not found.`));
        return;
      }

      // #10: Approval gate responses
      if (cmd === "approve" || cmd === "y") {
        const pending = (runnerRef as unknown as { current: AgentRunner & { _pendingApproval?: (b: boolean) => void } }).current?._pendingApproval;
        if (pending) { pending(true); push({ role: "system", content: T.success("✅ Tool approved.") }); }
        else notify(T.error("No pending approval."));
        return;
      }
      if (cmd === "deny" || cmd === "n") {
        const pending = (runnerRef as unknown as { current: AgentRunner & { _pendingApproval?: (b: boolean) => void } }).current?._pendingApproval;
        if (pending) { pending(false); push({ role: "system", content: T.error("❌ Tool denied.") }); }
        else notify(T.error("No pending approval."));
        return;
      }

      // #30: Traces command
      if (cmd === "traces") {
        const recent = Tracer.readRecent(5);
        notify(Tracer.formatSummary(recent));
        return;
      }

      // #11: Scheduler commands
      if (cmd === "schedule" || cmd === "sched") {
        const result = await agentScheduler.listTasksTool("", { enabled_only: false });
        notify(result.content[0]!.text);
        return;
      }

      // #7: Memory search
      if (cmd === "memory" && args.trim()) {
        const results = memoryStore.search(args.trim(), 8);
        if (results.length === 0) { notify(T.muted("No memories found for: " + args.trim())); return; }
        const lines = results.map(r => `[${new Date(r.ts).toLocaleDateString()} ${r.role}] ${r.content.slice(0, 120)}`);
        notify(`Memory search: "${args.trim()}"\n${lines.join("\n")}`);
        return;
      }

      const def = registry.getCommand(cmd);
      if (!def) { notify(T.error(`Unknown: /${cmd} — try /help or /palette`)); return; }
      try { await def.handler(args, { ui: uiCtx }); } catch (e: any) { notify(T.error(`Error: ${e.message}`)); }
      return;
    }

    if (!runnerRef.current) { notify(T.error("Agent not ready")); return; }
    push({ role: "user", content: input });
    memoryStore.save(sessionId, "user", input); // #7 persist user message
    setDisabled(true); setStreaming("");
    try { await runnerRef.current.run(input); } catch (e: any) { setDisabled(false); notify(T.error(`Error: ${e.message}`)); }
  }, [registry, exit, push, notify, uiCtx, modelReg, costTracker]);

  // ── Handle model selection ───────────────────────────────────────────
  const handleModelSelect = useCallback((modelId: string) => {
    setShowModelSelector(false);
    try {
      const JELLY_HOME = process.env.JELLYOS_HOME ?? join(homedir(), ".jelly");
      const envFile = join(JELLY_HOME, ".env");
      mkdirSync(JELLY_HOME, { recursive: true });
      const content = existsSync(envFile) ? readFileSync(envFile, "utf-8") : "";
      const re = /^DEFAULT_MODEL=.*$/m;
      const line = `DEFAULT_MODEL=${modelId}`;
      writeFileSync(envFile, re.test(content) ? content.replace(re, line) : content + "\n" + line + "\n", "utf-8");
      process.env.DEFAULT_MODEL = modelId;
      const ctxPath = join(JELLY_HOME, "context.json");
      const store = existsSync(ctxPath) ? JSON.parse(readFileSync(ctxPath, "utf-8")) : {};
      store.model = modelId;
      // Also save as rotation slot 1 (primary)
      const tier = modelReg?.getTier?.(modelId) ?? "worker";
      const slots = store.rotationSlots ?? [null, null, null, null, null];
      slots[0] = { id: modelId, tier };
      store.rotationSlots = slots;
      writeFileSync(ctxPath, JSON.stringify(store, null, 2), "utf-8");
    } catch { /* non-fatal */ }
    notify(T.accent(`Model set to: ${modelId}\nRestart jellyos to apply.`));
  }, [notify]);

  const handleModelCancel = useCallback(() => {
    setShowModelSelector(false);
  }, []);

  const modelList = useMemo(() => {
    if (!modelReg) return [] as Array<{ id: string; tier: string }>;
    const tiers = ["orchestrator", "analyst", "worker", "free"];
    const items: Array<{ id: string; tier: string }> = [];
    for (const tier of tiers) {
      const pool = (modelReg as any).getPool(tier);
      for (const tm of pool) {
        if (tm.available && tm.failures < 3) {
          items.push({ id: tm.model.id, tier });
        }
      }
    }
    return items;
  }, [modelReg]);

  const ctx = getContextBar(sessionRef.current);
  const statusLine = [ticker, costBadge, newsBadge, ...Object.values(statusBadges)].filter(Boolean).join("  ") || null;

  // ── Sidebar helper functions ───────────────────────────────────────────────
  const changeColor = (pct: number) => pct > 0 ? JELLY_COLORS.success : pct < 0 ? JELLY_COLORS.error : JELLY_COLORS.muted;
  const changeArrow = (pct: number) => pct > 0 ? "▲" : pct < 0 ? "▼" : "─";
  const SIDEBAR_W = 42;

  // ── Overlay: model selector ────────────────────────────────────────────
  if (showModelSelector) {
    return (
      <Box flexDirection="column">
        <StatusBar model={modelName} chain={chain} vaultLocked={vaultLocked} effectLevel={effectLevel} toolRunning={toolRunning} connected={true} statusLine={statusLine} />
        <ModelSelector
          models={modelList}
          currentModelId={process.env.DEFAULT_MODEL ?? ""}
          onSelect={handleModelSelect}
          onCancel={handleModelCancel}
          initialQuery={modelSelectorInitialQuery}
        />
      </Box>
    );
  }

  // ── Multi-pane layout ────────────────────────────────────────────────────
  return (
    <Box flexDirection="column">
      <StatusBar model={modelName} chain={chain} vaultLocked={vaultLocked} effectLevel={effectLevel} toolRunning={toolRunning} connected={true} statusLine={statusLine} />
      <Box flexDirection="row" flexGrow={1} overflow="hidden">
        {/* Side panel — fixed live panels */}
        <Box flexDirection="column" width={SIDEBAR_W} flexShrink={0}>
          {/* Ticker Panel */}
          <Box flexDirection="column" borderStyle="round" borderColor={JELLY_COLORS.dim} paddingX={1}>
            <Text bold>
              📡 Ticker
              {rotationSlots.filter(s => s && s.id).length > 0 && (
                <Text color="#6b7280"> ↻{rotationSlots.filter(s => s && s.id).length}</Text>
              )}
            </Text>
            {sidebarTickers.length > 0 ? sidebarTickers.map((t, i) => {
              const arrow = changeArrow(t.changePct);
              const col = changeColor(t.changePct);
              const pctStr = (t.changePct > 0 ? "+" : "") + t.changePct.toFixed(1) + "%";
              return <Text key={i} color={col}>{t.symbol.padEnd(8)}${String(t.price).padStart(9)} {arrow}{pctStr}</Text>;
            }) : <Text color={JELLY_COLORS.muted}>Loading prices…</Text>}
          </Box>

          {/* Context Panel */}
          <Box flexDirection="column" borderStyle="round" borderColor={JELLY_COLORS.dim} paddingX={1} marginTop={1}>
            <Text bold>Context</Text>
            <Text color={ctx.color}>{ctx.bar} {ctx.pct}%</Text>
            {ctx.turboReady ? null : <Text color={JELLY_COLORS.warn}>⚠ no turbo</Text>}
          </Box>

          {/* Effect Panel */}
          <Box flexDirection="column" borderStyle="round" borderColor={JELLY_COLORS.dim} paddingX={1} marginTop={1}>
            <Text bold>Effect</Text>
            <Text color={effectLevel === "eco" ? "#22c55e" : effectLevel === "turbo" ? "#f59e0b" : effectLevel === "max" ? "#ef4444" : JELLY_COLORS.accent}>
              {effectLevel.toUpperCase()}
            </Text>
          </Box>

          {/* News Panel */}
          <Box flexDirection="column" borderStyle="round" borderColor={JELLY_COLORS.dim} paddingX={1} marginTop={1}>
            <Text bold>News</Text>
            {sidebarNews.length > 0 ? sidebarNews.map((n, i) => {
              const sentColor = n.sentiment > 0.3 ? JELLY_COLORS.success : n.sentiment < -0.3 ? JELLY_COLORS.error : JELLY_COLORS.muted;
              const sentPct = Math.round((n.sentiment + 1) * 50);
              const title = n.title.length > 28 ? n.title.slice(0, 26) + "…" : n.title;
              return (
                <Box key={i} flexDirection="row" justifyContent="space-between">
                  <Text color={JELLY_COLORS.muted}>{title}</Text>
                  <Text color={sentColor}>{sentPct}%</Text>
                </Box>
              );
            }) : <Text color={JELLY_COLORS.muted}>Loading news…</Text>}
          </Box>

          {/* Feeds Panel */}
          <Box flexDirection="column" borderStyle="round" borderColor={JELLY_COLORS.dim} paddingX={1} marginTop={1}>
            <Text bold>Feeds</Text>
            <Text color={JELLY_COLORS.muted}>[coingecko] SOLANA…</Text>
            <Text color={JELLY_COLORS.muted}>[coingecko] ETHEREUM…</Text>
            <Text color={JELLY_COLORS.muted}>[etherscan] BTC Price…</Text>
            <Text color={JELLY_COLORS.muted}>[etherscan] ETF Gas…</Text>
            <Text color={JELLY_COLORS.muted}>[binance] XRPUSDT 24h…</Text>
            <Text color={JELLY_COLORS.muted}>[binance] AVAXUSDT 24h…</Text>
            <Text color={JELLY_COLORS.muted}>[binance] SOLUSDT 24h…</Text>
          </Box>
        </Box>

        {/* Main REPL */}
        <Box flexDirection="column" flexGrow={1}>
          <REPL
            messages={messages}
            streamingText={streaming}
            toolRunning={toolRunning}
            onSubmit={handleSubmit}
            disabled={disabled}
            onAbort={() => {
              runnerRef.current?.abort();
              setDisabled(false);
              setToolRunning(null);
              setStreaming(prev => {
                if (prev.trim()) push({ role: "assistant", content: prev + " \u2014 [interrupted]" });
                return "";
              });
              push({ role: "system", content: T.dim("— stream interrupted —") });
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
