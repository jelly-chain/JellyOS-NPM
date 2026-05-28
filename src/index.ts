/**
 * @jellyos/agent — public API
 *
 * Extension files import from here:
 *   import { Type } from "@jellyos/agent"
 *   import type { ExtensionAPI } from "@jellyos/agent"
 */

// Re-export TypeBox Type builder — drop-in for Pi's @earendil-works/pi-ai
export { Type, type Static } from "@sinclair/typebox";

// Extension API types
export type {
  ExtensionAPI,
  ExtensionModule,
  CommandDef,
  CommandContext,
  UIContext,
  ThemeContext,
  ToolDef,
  ToolContent,
  SkillDef,
  SessionEvent,
  SessionContext,
} from "./api/ExtensionAPI.js";

// text() helper — same as what Pi provides
export { text } from "./api/ExtensionAPI.js";

// Registry (for advanced use / testing)
export { Registry } from "./api/Registry.js";

// Runner components
export { AgentRunner }    from "./runner/AgentRunner.js";
export { ModelClient, resolveModelConfig } from "./runner/ModelClient.js";
export { ToolDispatcher } from "./runner/ToolDispatcher.js";

// Loader (for embedding the agent in other tools)
export { loadExtension } from "./loader.js";

// Theme
export { makeTheme, T, JELLY_COLORS } from "./tui/theme.js";

// Model intelligence
export { ModelRegistry, modelRegistry, classifyModel } from "./models/ModelRegistry.js";
export { CostTracker } from "./models/CostTracker.js";
export type { OpenRouterModel, TieredModel, TieredPool, ModelTier } from "./models/ModelRegistry.js";
export type { UsageEntry, SessionUsage, LifetimeUsage } from "./models/CostTracker.js";

// Tools
export { fullAnalysis, rsi, macd, ema, sma, bollingerBands, atr, getCandlesTool, getCandlesParams } from "./tools/TechnicalAnalysis.js";
export { PriceFeed, priceFeed, getPricesTool, topMoversTool, marketOverviewTool } from "./tools/PriceFeed.js";
export { NewsFeed, newsFeed, getNewsTool, scoreSentiment } from "./tools/NewsSentiment.js";
export {
  getFearGreedTool, fundingRatesParams, getFundingRatesTool,
  getBtcMempoolTool, getDefiTvlTool, getSolanaStatsTool,
} from "./tools/MarketSentiment.js";
export type { OHLCV, AnalysisResult } from "./tools/TechnicalAnalysis.js";
export type { PriceTick } from "./tools/PriceFeed.js";
export type { NewsItem, SentimentReport } from "./tools/NewsSentiment.js";

// Session / Memory / Goals / Context
export { SessionManager } from "./session/SessionManager.js";
export { MemoryStore, memoryStore } from "./session/MemoryStore.js";
export { GoalManager, goalManager } from "./session/GoalManager.js";
export { ContextStore, contextStore } from "./session/ContextStore.js";
export type { MemoryEntry, RecentSession } from "./session/MemoryStore.js";
export type { Goal } from "./session/GoalManager.js";
export type { TaskContext } from "./session/ContextStore.js";
export type { ContextPressure } from "./session/SessionManager.js";

// MCP server
export { MCPServer } from "./mcp/server.js";

// Scheduler
export { AgentScheduler, agentScheduler } from "./scheduler/AgentScheduler.js";
export type { ScheduledTask, PriceTrigger } from "./scheduler/AgentScheduler.js";

// Telemetry
export { Tracer } from "./telemetry/Tracer.js";
export type { Span, Trace } from "./telemetry/Tracer.js";
