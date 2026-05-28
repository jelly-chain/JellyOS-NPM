/**
 * MCP server entry — bootstraps the Registry with built-in tools
 * and starts the MCP stdio server.
 */
import { join }          from "node:path";
import { homedir }       from "node:os";
import { existsSync }    from "node:fs";
import { config as loadDotenv } from "dotenv";
import { Registry }      from "../api/Registry.js";
import { loadExtension } from "../loader.js";
import { MCPServer }     from "./server.js";
import { modelRegistry } from "../models/ModelRegistry.js";
import {
  getPricesTool, topMoversTool, marketOverviewTool,
  getPricesParams, topMoversParams, marketOverviewParams,
  priceFeed,
} from "../tools/PriceFeed.js";
import { getNewsTool, getNewsParams, newsFeed }    from "../tools/NewsSentiment.js";
import { getCandlesParams, getCandlesTool, analyzeTAParams, fullAnalysis } from "../tools/TechnicalAnalysis.js";
import {
  getFearGreedTool,    fearGreedParams,
  getFundingRatesTool, fundingRatesParams,
  getBtcMempoolTool,   btcMempoolParams,
  getDefiTvlTool,      defiTvlParams,
  getSolanaStatsTool,  solanaStatsParams,
} from "../tools/MarketSentiment.js";
import type { OHLCV } from "../tools/TechnicalAnalysis.js";

const JELLY_HOME = process.env.JELLYOS_HOME ?? join(homedir(), ".jelly");
const envPath    = join(JELLY_HOME, ".env");
if (existsSync(envPath)) loadDotenv({ path: envPath, override: false });

const registry = new Registry();

// Load optional extension from --extension arg
const extIdx = process.argv.indexOf("--extension");
const extPath = extIdx >= 0 ? process.argv[extIdx + 1] : null;
if (extPath && existsSync(extPath)) {
  try { await loadExtension(extPath, registry); } catch (e) {
    process.stderr.write(`[MCP] Extension load failed: ${e}\n`);
  }
}

// Register all built-in tools
await modelRegistry.initialise();
const mk = modelRegistry as unknown as Record<string, unknown>;
registry.addTool({ name: "list_models",   label: "List Models",   description: "Search available AI models.", parameters: (mk["listModelsParams"] as Parameters<typeof registry.addTool>[0]["parameters"]), execute: (id: string, p: unknown) => (mk["listModelsTool"] as Function)(id, p) });
registry.addTool({ name: "get_prices",    label: "Get Prices",    description: "Get live crypto prices.", parameters: getPricesParams,    execute: (id: string, p: unknown) => getPricesTool(id, p as { symbols: string[] }) });
registry.addTool({ name: "get_top_movers",label: "Top Movers",    description: "Top 24h price movers.",   parameters: topMoversParams,    execute: (id: string, p: unknown) => topMoversTool(id, p as { limit?: number }) });
registry.addTool({ name: "market_overview",label: "Market Overview", description: "Aggregated market data.", parameters: marketOverviewParams, execute: () => marketOverviewTool() });
registry.addTool({ name: "get_news",      label: "Get News",      description: "Crypto news + sentiment.", parameters: getNewsParams,      execute: (id: string, p: unknown) => getNewsTool(id, p as { limit?: number }) });
registry.addTool({ name: "get_candles",   label: "Get Candles",   description: "OHLCV + TA analysis from Binance.", parameters: getCandlesParams, execute: (id: string, p: unknown) => getCandlesTool(id, p as Parameters<typeof getCandlesTool>[1]) });
registry.addTool({ name: "get_fear_greed",label: "Fear & Greed",  description: "Crypto fear & greed index.", parameters: fearGreedParams,  execute: (id: string, p: unknown) => getFearGreedTool(id, p as { days?: number }) });
registry.addTool({ name: "get_funding_rates", label: "Funding Rates", description: "Perp funding rates.", parameters: fundingRatesParams, execute: (id: string, p: unknown) => getFundingRatesTool(id, p as { symbol?: string; limit?: number }) });
registry.addTool({ name: "get_btc_mempool",   label: "BTC Mempool",   description: "BTC mempool + fees.",  parameters: btcMempoolParams,   execute: () => getBtcMempoolTool() });
registry.addTool({ name: "get_defi_tvl",      label: "DeFi TVL",      description: "DeFiLlama TVL.",       parameters: defiTvlParams,       execute: (id: string, p: unknown) => getDefiTvlTool(id, p as { chain?: string }) });
registry.addTool({ name: "get_solana_stats",  label: "Solana Stats",  description: "Solana TPS + health.", parameters: solanaStatsParams,   execute: () => getSolanaStatsTool() });
registry.addTool({
  name: "analyze_ta", label: "Technical Analysis", description: "RSI, MACD, Bollinger on price arrays.",
  parameters: analyzeTAParams,
  execute: async (_id: string, p: unknown) => {
    const params = p as Parameters<typeof getCandlesTool>[1] & { prices: number[]; highs?: number[]; lows?: number[]; volumes?: number[] };
    const closes  = params.prices;
    const candles: OHLCV[] = closes.map((c: number, i: number) => ({
      timestamp: i, open: c, high: (params.highs?.[i] ?? c), low: (params.lows?.[i] ?? c), close: c, volume: (params.volumes?.[i] ?? 0),
    }));
    const results = fullAnalysis(candles);
    const text = results.map(r => {
      const s = r.signal === "bullish" ? "🟢" : r.signal === "bearish" ? "🔴" : "⚪";
      return `${s} ${r.indicator}: ${typeof r.value === "number" ? r.value.toFixed(2) : String(r.value)}`;
    }).join("\n");
    return { content: [{ type: "text" as const, text: `Technical Analysis:\n${text}` }], details: {} };
  },
});

// Start price + news feeds
priceFeed.track("btc", "eth", "sol", "bnb", "matic", "arb", "op", "avax");
priceFeed.start();
newsFeed.start();

// Start MCP server
const server = new MCPServer(registry);
await server.run();
