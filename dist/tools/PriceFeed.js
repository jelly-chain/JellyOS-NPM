/**
 * PriceFeed — real-time price aggregation from CoinGecko and Binance.
 *
 * Provides:
 *  - Background polling with configurable intervals
 *  - Multi-source aggregation (prioritises Binance for precision, CG for breadth)
 *  - 24h change, volume, and market cap tracking
 *  - In-memory price cache for tool lookups
 *  - Exposed as tools for the AI to query
 */
import { Type } from "@sinclair/typebox";
import { EventEmitter } from "node:events";
// ── CoinGecko ID map (common symbols) ────────────────────────────────────────
const SYMBOL_TO_ID = {
    btc: "bitcoin",
    eth: "ethereum",
    sol: "solana",
    bnb: "binancecoin",
    xrp: "ripple",
    ada: "cardano",
    doge: "dogecoin",
    dot: "polkadot",
    matic: "matic-network",
    avax: "avalanche-2",
    link: "chainlink",
    uni: "uniswap",
    atom: "cosmos",
    arb: "arbitrum",
    op: "optimism",
    near: "near",
    apt: "aptos",
    sui: "sui",
    sei: "sei-network",
    inj: "injective-protocol",
    tia: "celestia",
    wld: "worldcoin-wld",
    pepe: "pepe",
    wif: "dogwifcoin",
    bonk: "bonk",
    floki: "floki",
    shib: "shiba-inu",
    aave: "aave",
    mkr: "maker",
    ldo: "lido-dao",
    ens: "ethereum-name-service",
    pendle: "pendle",
    ltc: "litecoin",
    bch: "bitcoin-cash",
    etc: "ethereum-classic",
    fil: "filecoin",
    trx: "tron",
    usdc: "usd-coin",
    usdt: "tether",
    dai: "dai",
};
// ── PriceFeed class ──────────────────────────────────────────────────────────
export class PriceFeed extends EventEmitter {
    prices = new Map();
    pollInterval;
    timer;
    tracking = new Set(["btc", "eth", "sol", "bnb", "matic", "arb", "op", "avax"]);
    constructor(pollIntervalMs = 60_000) {
        super();
        this.pollInterval = pollIntervalMs;
    }
    // ── Lifecycle ────────────────────────────────────────────────────────────
    start() {
        this.fetchAll();
        this.timer = setInterval(() => this.fetchAll(), this.pollInterval);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }
    /** Add symbols to track. IDs are auto-resolved from the symbol map. */
    track(...symbols) {
        for (const s of symbols)
            this.tracking.add(s.toLowerCase());
    }
    // ── Fetch ────────────────────────────────────────────────────────────────
    async fetchAll() {
        // #17: Fan-out to Binance (primary) + CoinGecko (secondary)
        // Binance: no rate limits on public endpoints, real-time order book prices
        // CoinGecko: covers long-tail tokens Binance doesn't list, includes market cap
        const [binanceResult, cgResult] = await Promise.allSettled([
            this.fetchBinance(),
            this.fetchCoinGecko(),
        ]);
        let updated = false;
        // Binance wins for price precision on listed pairs
        if (binanceResult.status === "fulfilled") {
            for (const tick of binanceResult.value) {
                this.prices.set(tick.symbol.toLowerCase(), tick);
                updated = true;
            }
        }
        // CoinGecko fills gaps (market cap data, unlisted tokens)
        if (cgResult.status === "fulfilled") {
            for (const tick of cgResult.value) {
                const key = tick.symbol.toLowerCase();
                const existing = this.prices.get(key);
                if (!existing) {
                    // Token not on Binance — add from CoinGecko
                    this.prices.set(key, tick);
                    updated = true;
                }
                else if (tick.marketCap > 0) {
                    // Enrich Binance tick with market cap from CoinGecko
                    existing.marketCap = tick.marketCap;
                }
            }
        }
        if (updated)
            this.emit("prices", [...this.prices.values()]);
    }
    async fetchBinance() {
        // Build list of USDT pairs for tracked symbols
        const pairs = [...this.tracking]
            .map(s => s.toUpperCase() + "USDT")
            .filter(s => !s.startsWith("USDT") && !s.startsWith("DAI")); // skip stablecoins
        if (!pairs.length)
            return [];
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(pairs))}`;
        const res = await fetch(url, {
            signal: AbortSignal.timeout(8_000),
            headers: { "User-Agent": "JellyOS/1.0" },
        });
        if (!res.ok)
            throw new Error(`Binance ticker HTTP ${res.status}`);
        const data = await res.json();
        return data.map(d => ({
            symbol: d.symbol.replace(/USDT$/, ""),
            price: parseFloat(d.lastPrice),
            change24h: parseFloat(d.priceChangePercent),
            volume24h: parseFloat(d.quoteVolume),
            marketCap: 0, // Binance doesn't provide market cap — CoinGecko fills this
            high24h: parseFloat(d.highPrice),
            low24h: parseFloat(d.lowPrice),
            source: "binance",
            timestamp: Date.now(),
        }));
    }
    async fetchCoinGecko() {
        const ids = [...this.tracking]
            .map(s => SYMBOL_TO_ID[s])
            .filter((id) => Boolean(id))
            .join(",");
        if (!ids)
            return [];
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false`, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "JellyOS/1.0" } });
        if (!res.ok)
            throw new Error(`CoinGecko HTTP ${res.status}`);
        const data = await res.json();
        return data.map(coin => ({
            symbol: coin.symbol.toUpperCase(),
            price: coin.current_price,
            change24h: coin.price_change_percentage_24h ?? 0,
            volume24h: coin.total_volume ?? 0,
            marketCap: coin.market_cap ?? 0,
            high24h: coin.high_24h ?? 0,
            low24h: coin.low_24h ?? 0,
            source: "coingecko",
            timestamp: Date.now(),
        }));
    }
    // ── Query ─────────────────────────────────────────────────────────────────
    get(symbol) {
        return this.prices.get(symbol.toLowerCase());
    }
    getMultiple(symbols) {
        return symbols.map(s => this.get(s)).filter(Boolean);
    }
    getAll() {
        return [...this.prices.values()];
    }
    getTopMovers(limit = 5) {
        return [...this.prices.values()]
            .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
            .slice(0, limit);
    }
    formatPrice(tick) {
        const changeStr = tick.change24h >= 0
            ? `+${tick.change24h.toFixed(2)}%`
            : `${tick.change24h.toFixed(2)}%`;
        const priceStr = tick.price < 1
            ? `$${tick.price.toFixed(6)}`
            : tick.price < 100
                ? `$${tick.price.toFixed(2)}`
                : `$${tick.price.toLocaleString()}`;
        return `${tick.symbol.padEnd(6)} ${priceStr} ${changeStr}`;
    }
    /** Compact ticker line for the status bar. */
    tickerLine(maxSymbols = 5) {
        return [...this.prices.values()]
            .slice(0, maxSymbols)
            .map(t => {
            const sign = t.change24h >= 0 ? "▲" : "▼";
            const p = t.price < 1 ? t.price.toFixed(4) : t.price.toFixed(0);
            return `${t.symbol} $${p} ${sign}${Math.abs(t.change24h).toFixed(1)}%`;
        })
            .join(" · ");
    }
}
// ── Singleton ─────────────────────────────────────────────────────────────────
export const priceFeed = new PriceFeed();
// ── Tool: get_prices ─────────────────────────────────────────────────────────
export const getPricesParams = Type.Object({
    symbols: Type.Array(Type.String(), { description: "Symbols to fetch (e.g. btc, eth, sol)" }),
});
export async function getPricesTool(_id, params) {
    const ticks = priceFeed.getAll();
    if (ticks.length === 0) {
        return {
            content: [{ type: "text", text: "No price data available yet. Please wait for the first price update." }],
            details: {},
        };
    }
    const requested = params.symbols.map(s => s.toLowerCase());
    const results = ticks.filter(t => requested.includes(t.symbol.toLowerCase()));
    if (results.length === 0) {
        return {
            content: [{ type: "text", text: `No data for: ${params.symbols.join(", ")}. Available: ${ticks.map(t => t.symbol).join(", ")}` }],
            details: {},
        };
    }
    const text = results.map(t => priceFeed.formatPrice(t)).join("\n");
    return {
        content: [{ type: "text", text }],
        details: results.reduce((acc, t) => {
            acc[t.symbol] = { price: t.price, change24h: t.change24h, volume24h: t.volume24h, marketCap: t.marketCap, source: t.source };
            return acc;
        }, {}),
    };
}
// ── Tool: get_top_movers ─────────────────────────────────────────────────────
export const topMoversParams = Type.Object({
    limit: Type.Optional(Type.Number({ default: 5, description: "Number of top movers to show" })),
});
export async function topMoversTool(_id, params) {
    const movers = priceFeed.getTopMovers(params.limit ?? 5);
    const text = movers.map(t => priceFeed.formatPrice(t)).join("\n");
    return {
        content: [{ type: "text", text: text || "No data available" }],
        details: { count: movers.length },
    };
}
// ── Tool: get_market_overview ────────────────────────────────────────────────
export const marketOverviewParams = Type.Object({});
export async function marketOverviewTool() {
    const ticks = priceFeed.getAll();
    if (ticks.length === 0) {
        return {
            content: [{ type: "text", text: "No market data available yet." }],
            details: {},
        };
    }
    const totalCap = ticks.reduce((s, t) => s + t.marketCap, 0);
    const avgChange = ticks.reduce((s, t) => s + t.change24h, 0) / ticks.length;
    const gainers = ticks.filter(t => t.change24h > 0).length;
    const losers = ticks.filter(t => t.change24h < 0).length;
    const text = [
        `Market Overview (${ticks.length} assets tracked)`,
        `Total Market Cap: $${(totalCap / 1e9).toFixed(1)}B`,
        `Avg 24h Change: ${avgChange >= 0 ? "+" : ""}${avgChange.toFixed(2)}%`,
        `Gainers: ${gainers} | Losers: ${losers}`,
        `---`,
        ...ticks.slice(0, 10).map(t => priceFeed.formatPrice(t)),
    ].join("\n");
    return {
        content: [{ type: "text", text }],
        details: {
            totalMarketCap: totalCap,
            avgChange24h: avgChange,
            gainers,
            losers,
            assets: ticks.length,
        },
    };
}
//# sourceMappingURL=PriceFeed.js.map