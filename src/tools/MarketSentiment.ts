/**
 * MarketSentiment — free, no-key market data tools.
 *
 * #20: Fear & Greed Index (alternative.me)
 * #19: BTC Mempool stats (mempool.space — free, no key)
 * #19: ETH / EVM Gas prices (blocknative public — free)
 * #19: Solana TPS (public RPC — no key)
 * #19: DeFi TVL by chain (DeFiLlama — free, no key)
 * #20: Binance perp funding rates (public endpoint — no key)
 */

import { Type, type Static } from "@sinclair/typebox";

// ── Fear & Greed Index ────────────────────────────────────────────────────────

export const fearGreedParams = Type.Object({
  days: Type.Optional(Type.Number({ description: "Number of historical days to return (default: 7, max: 30)" })),
});

export async function getFearGreedTool(_id: string, params: Static<typeof fearGreedParams>) {
  const days = Math.min(params.days ?? 7, 30);
  try {
    const res  = await fetch(
      `https://api.alternative.me/fng/?limit=${days}`,
      { signal: AbortSignal.timeout(8_000), headers: { "User-Agent": "JellyOS/1.0" } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data   = await res.json() as { data: { value: string; value_classification: string; timestamp: string }[] };
    const items  = data.data ?? [];
    const current = items[0];
    if (!current) throw new Error("No data returned");

    const val     = parseInt(current.value);
    const emoji   = val >= 75 ? "😱 Extreme Greed" : val >= 55 ? "😀 Greed"
                  : val >= 45 ? "😐 Neutral"         : val >= 25 ? "😨 Fear"
                  : "😱 Extreme Fear";

    const trend = items.slice(0, 7).map(d => parseInt(d.value));
    const avg7  = Math.round(trend.reduce((a, b) => a + b, 0) / trend.length);
    const direction = trend.length > 1
      ? (trend[0]! > trend[trend.length - 1]! ? "↑ rising" : trend[0]! < trend[trend.length - 1]! ? "↓ falling" : "→ flat")
      : "";

    const historyLine = items.slice(0, Math.min(days, 7))
      .map(d => `${d.value}(${d.value_classification.slice(0,4)})`)
      .join(" → ");

    const text = [
      `Fear & Greed Index: ${val} — ${emoji}`,
      `7-day avg: ${avg7}  Trend: ${direction}`,
      `History: ${historyLine}`,
    ].join("\n");

    return {
      content: [{ type: "text" as const, text }],
      details: { current: val, classification: current.value_classification, avg7, trend, direction },
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { content: [{ type: "text" as const, text: `Fear & Greed fetch failed: ${msg}` }], details: {} };
  }
}

// ── Binance Perp Funding Rates ────────────────────────────────────────────────

export const fundingRatesParams = Type.Object({
  symbol: Type.Optional(Type.String({ description: "Symbol e.g. BTC, ETH (default: BTC)" })),
  limit:  Type.Optional(Type.Number({ description: "Number of historical funding periods (default: 8)" })),
});

export async function getFundingRatesTool(_id: string, params: Static<typeof fundingRatesParams>) {
  const sym   = (params.symbol?.toUpperCase() ?? "BTC").replace(/USDT$/, "") + "USDT";
  const limit = Math.min(params.limit ?? 8, 100);
  try {
    const res = await fetch(
      `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}&limit=${limit}`,
      { signal: AbortSignal.timeout(8_000), headers: { "User-Agent": "JellyOS/1.0" } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data    = await res.json() as { fundingRate: string; fundingTime: number }[];
    if (!data.length) throw new Error("No data");

    const current = data[data.length - 1]!;
    const rate    = parseFloat(current.fundingRate);
    const annRate = rate * 3 * 365 * 100; // 3x daily → annual %
    const sentiment = rate > 0.001 ? "Longs paying shorts (bullish bias)" :
                      rate < -0.001 ? "Shorts paying longs (bearish bias)" : "Neutral";

    const history = data.map(d => (parseFloat(d.fundingRate) * 100).toFixed(4) + "%").join(", ");

    const text = [
      `${sym} Funding Rate: ${(rate * 100).toFixed(4)}% per 8h`,
      `Annualized: ${annRate.toFixed(1)}%`,
      `Sentiment: ${sentiment}`,
      `History (${data.length} periods): ${history}`,
    ].join("\n");

    return {
      content: [{ type: "text" as const, text }],
      details: { symbol: sym, currentRate: rate, annualizedPct: annRate, sentiment, history: data },
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { content: [{ type: "text" as const, text: `Funding rate fetch failed for ${sym}: ${msg}` }], details: {} };
  }
}

// ── BTC Mempool Stats ─────────────────────────────────────────────────────────

export const btcMempoolParams = Type.Object({});

export async function getBtcMempoolTool() {
  try {
    const [statsRes, feesRes] = await Promise.all([
      fetch("https://mempool.space/api/mempool",              { signal: AbortSignal.timeout(8_000), headers: { "User-Agent": "JellyOS/1.0" } }),
      fetch("https://mempool.space/api/v1/fees/recommended",  { signal: AbortSignal.timeout(8_000), headers: { "User-Agent": "JellyOS/1.0" } }),
    ]);

    if (!statsRes.ok || !feesRes.ok) throw new Error("mempool.space API error");

    const stats = await statsRes.json() as { count: number; vsize: number; total_fee: number };
    const fees  = await feesRes.json() as { fastestFee: number; halfHourFee: number; hourFee: number; economyFee: number };

    const congestion = stats.count > 100_000 ? "🔴 HIGH" : stats.count > 50_000 ? "🟡 MEDIUM" : "🟢 LOW";

    const text = [
      `BTC Mempool`,
      `Pending txs:  ${stats.count.toLocaleString()}  Size: ${(stats.vsize / 1_000_000).toFixed(1)} MB`,
      `Congestion:   ${congestion}`,
      `Fee rates (sat/vB):`,
      `  Next block:  ${fees.fastestFee}`,
      `  ~30 min:     ${fees.halfHourFee}`,
      `  ~1 hour:     ${fees.hourFee}`,
      `  Economy:     ${fees.economyFee}`,
    ].join("\n");

    return {
      content: [{ type: "text" as const, text }],
      details: { pendingTxs: stats.count, vsizeMB: stats.vsize / 1_000_000, fees },
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { content: [{ type: "text" as const, text: `BTC mempool fetch failed: ${msg}` }], details: {} };
  }
}

// ── DeFi TVL ─────────────────────────────────────────────────────────────────

export const defiTvlParams = Type.Object({
  chain: Type.Optional(Type.String({ description: "Chain name e.g. ethereum, bsc, solana, arbitrum (omit for all chains)" })),
});

export async function getDefiTvlTool(_id: string, params: Static<typeof defiTvlParams>) {
  try {
    const url = params.chain
      ? `https://api.llama.fi/v2/historicalChainTvl/${encodeURIComponent(params.chain)}`
      : "https://api.llama.fi/v2/chains";

    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "JellyOS/1.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as unknown;

    if (params.chain) {
      // Historical TVL for one chain
      const arr = data as { date: number; tvl: number }[];
      if (!arr.length) throw new Error("No data for chain");
      const latest = arr[arr.length - 1]!;
      const prev7  = arr[Math.max(0, arr.length - 8)];
      const chg7   = prev7 ? ((latest.tvl - prev7.tvl) / prev7.tvl * 100).toFixed(1) : null;
      const text = [
        `DeFi TVL — ${params.chain}`,
        `Current TVL: $${(latest.tvl / 1e9).toFixed(2)}B`,
        chg7 ? `7-day change: ${parseFloat(chg7) >= 0 ? "+" : ""}${chg7}%` : "",
        `As of: ${new Date(latest.date * 1000).toLocaleDateString()}`,
      ].filter(Boolean).join("\n");
      return { content: [{ type: "text" as const, text }], details: { chain: params.chain, tvl: latest.tvl, change7d: chg7 } };
    } else {
      // All chains ranked by TVL
      const chains = (data as { name: string; tvl: number }[])
        .filter(c => c.tvl > 100_000_000)
        .sort((a, b) => b.tvl - a.tvl)
        .slice(0, 15);
      const totalTvl = chains.reduce((s, c) => s + c.tvl, 0);
      const rows = chains.map((c, i) =>
        `  ${String(i + 1).padStart(2)}. ${c.name.padEnd(16)} $${(c.tvl / 1e9).toFixed(2)}B`
      );
      const text = [
        `DeFi TVL by Chain (top 15)`,
        `Total tracked: $${(totalTvl / 1e9).toFixed(1)}B`,
        ...rows,
      ].join("\n");
      return { content: [{ type: "text" as const, text }], details: { chains, totalTvl } };
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { content: [{ type: "text" as const, text: `DeFi TVL fetch failed: ${msg}` }], details: {} };
  }
}

// ── Solana Network Stats ──────────────────────────────────────────────────────

export const solanaStatsParams = Type.Object({});

export async function getSolanaStatsTool() {
  try {
    const res = await fetch("https://api.mainnet-beta.solana.com", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "JellyOS/1.0" },
      body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getRecentPerformanceSamples", params: [5] }),
      signal:  AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json() as { result: { numTransactions: number; samplePeriodSecs: number; slot: number }[] };
    const samples = body.result ?? [];
    if (!samples.length) throw new Error("No samples");

    const tpsArr   = samples.map(s => Math.round(s.numTransactions / s.samplePeriodSecs));
    const avgTps   = Math.round(tpsArr.reduce((a, b) => a + b, 0) / tpsArr.length);
    const maxTps   = Math.max(...tpsArr);
    const latestSlot = samples[0]?.slot ?? 0;

    const health = avgTps > 3000 ? "🟢 Healthy" : avgTps > 1500 ? "🟡 Moderate" : "🔴 Degraded";

    const text = [
      `Solana Network Stats`,
      `TPS (avg 5 samples): ${avgTps.toLocaleString()}`,
      `TPS (peak sample):   ${maxTps.toLocaleString()}`,
      `Latest slot:         ${latestSlot.toLocaleString()}`,
      `Network health:      ${health}`,
    ].join("\n");

    return { content: [{ type: "text" as const, text }], details: { avgTps, maxTps, latestSlot, samples: tpsArr } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { content: [{ type: "text" as const, text: `Solana stats fetch failed: ${msg}` }], details: {} };
  }
}
