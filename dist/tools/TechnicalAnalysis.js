/**
 * Technical Analysis Toolkit — RSI, MACD, EMA, Bollinger Bands,
 * moving averages, volume profile, and signal detection.
 *
 * All calculations are pure math on price arrays — no external API needed.
 * Designed to be exposed as tools the AI can call autonomously.
 */
import { Type } from "@sinclair/typebox";
// ── Core calculations ────────────────────────────────────────────────────────
export function sma(prices, period) {
    if (prices.length < period)
        return [];
    const result = [];
    let sum = 0;
    for (let i = 0; i < prices.length; i++) {
        sum += prices[i];
        if (i >= period)
            sum -= prices[i - period];
        if (i >= period - 1)
            result.push(sum / period);
    }
    return result;
}
export function ema(prices, period) {
    if (prices.length < 2)
        return [];
    const k = 2 / (period + 1);
    const result = [prices[0]];
    for (let i = 1; i < prices.length; i++) {
        result.push(prices[i] * k + result[i - 1] * (1 - k));
    }
    return result;
}
export function rsi(prices, period = 14) {
    if (prices.length < period + 1)
        return [];
    const result = [];
    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i <= period; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff > 0)
            avgGain += diff;
        else
            avgLoss += Math.abs(diff);
    }
    avgGain /= period;
    avgLoss /= period;
    for (let i = period + 1; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? Math.abs(diff) : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        result.push(100 - (100 / (1 + rs)));
    }
    return result;
}
export function macd(prices, fast = 12, slow = 26, signal = 9) {
    const fastEMA = ema(prices, fast);
    const slowEMA = ema(prices, slow);
    const start = slowEMA.length - fastEMA.length;
    const macdLine = [];
    for (let i = 0; i < fastEMA.length; i++) {
        const slowIdx = start + i;
        if (slowIdx >= 0)
            macdLine.push(fastEMA[i] - slowEMA[slowIdx]);
    }
    if (macdLine.length < signal)
        return { macd: macdLine, signal: [], histogram: [] };
    const signalLine = ema(macdLine, signal);
    const hist = macdLine.slice(signal - 1).map((v, i) => v - (signalLine[i] ?? 0));
    // Align signal line with histogram
    const alignedSignal = signalLine;
    return { macd: macdLine, signal: alignedSignal, histogram: hist };
}
export function bollingerBands(prices, period = 20, deviations = 2) {
    const middle = sma(prices, period);
    const upper = [];
    const lower = [];
    const width = [];
    for (let i = period - 1; i < prices.length; i++) {
        const slice = prices.slice(i - period + 1, i + 1);
        const avg = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((sum, v) => sum + (v - avg) ** 2, 0) / period;
        const std = Math.sqrt(variance);
        upper.push(avg + deviations * std);
        lower.push(avg - deviations * std);
        width.push((2 * deviations * std) / avg * 100); // bandwidth %
    }
    return { upper, middle, lower, width };
}
export function atr(highs, lows, closes, period = 14) {
    if (highs.length < 2)
        return [];
    const tr = [];
    for (let i = 1; i < highs.length; i++) {
        tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    }
    return ema(tr, period);
}
export function volumeProfile(volumes, prices, levels = 10) {
    if (volumes.length === 0)
        return [];
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const step = (max - min) / levels;
    const profile = [];
    for (let i = 0; i < levels; i++) {
        profile.push({ volume: 0, low: min + i * step, high: min + (i + 1) * step });
    }
    for (let i = 0; i < volumes.length; i++) {
        const price = prices[i];
        for (let j = 0; j < levels; j++) {
            if (price >= profile[j].low && (j === levels - 1 || price < profile[j].high)) {
                profile[j].volume += volumes[i];
                break;
            }
        }
    }
    const totalVol = profile.reduce((s, p) => s + p.volume, 0);
    return profile.map(p => ({
        priceRange: `${p.low.toFixed(2)}-${p.high.toFixed(2)}`,
        volume: Math.round(p.volume),
        pct: totalVol > 0 ? Math.round(p.volume / totalVol * 100) : 0,
    }));
}
// ── Signal detection ─────────────────────────────────────────────────────────
export function detectCrossovers(fast, slow) {
    if (fast.length < 2 || slow.length < 2)
        return { type: null, index: -1 };
    const offset = slow.length - fast.length;
    for (let i = fast.length - 1; i >= Math.max(0, fast.length - 5); i--) {
        const prevFast = fast[i - 1];
        const prevSlow = slow[offset + i - 1];
        const currFast = fast[i];
        const currSlow = slow[offset + i];
        if (prevFast === undefined || prevSlow === undefined || currFast === undefined || currSlow === undefined)
            continue;
        if (prevFast <= prevSlow && currFast > currSlow)
            return { type: "golden_cross", index: i };
        if (prevFast >= prevSlow && currFast < currSlow)
            return { type: "death_cross", index: i };
    }
    return { type: null, index: -1 };
}
export function rsiSignal(rsiValues) {
    const last = rsiValues[rsiValues.length - 1];
    if (last === undefined)
        return { indicator: "RSI", value: 0, signal: "neutral" };
    if (last > 70)
        return { indicator: "RSI", value: Math.round(last * 100) / 100, signal: "bearish", metadata: { condition: "overbought" } };
    if (last < 30)
        return { indicator: "RSI", value: Math.round(last * 100) / 100, signal: "bullish", metadata: { condition: "oversold" } };
    return { indicator: "RSI", value: Math.round(last * 100) / 100, signal: "neutral" };
}
export function bollingerSignal(price, bands) {
    const upper = bands.upper[bands.upper.length - 1];
    const lower = bands.lower[bands.lower.length - 1];
    if (upper === undefined || lower === undefined)
        return { indicator: "Bollinger", value: 0, signal: "neutral" };
    const position = (price - lower) / (upper - lower);
    if (position > 0.95)
        return { indicator: "Bollinger", value: Math.round(position * 100), signal: "bearish", metadata: { condition: "upper band touch" } };
    if (position < 0.05)
        return { indicator: "Bollinger", value: Math.round(position * 100), signal: "bullish", metadata: { condition: "lower band touch" } };
    return { indicator: "Bollinger", value: Math.round(position * 100), signal: "neutral" };
}
export function macdSignal(macdData) {
    const hist = macdData.histogram;
    if (hist.length < 2)
        return { indicator: "MACD", value: 0, signal: "neutral" };
    const last = hist[hist.length - 1];
    const prev = hist[hist.length - 2];
    const value = Math.round(last * 1_000_000) / 1_000_000;
    if (last > 0 && prev <= 0)
        return { indicator: "MACD", value, signal: "bullish", metadata: { condition: "histogram crossed above zero" } };
    if (last < 0 && prev >= 0)
        return { indicator: "MACD", value, signal: "bearish", metadata: { condition: "histogram crossed below zero" } };
    if (last > prev)
        return { indicator: "MACD", value, signal: "bullish", metadata: { condition: "histogram rising" } };
    if (last < prev)
        return { indicator: "MACD", value, signal: "bearish", metadata: { condition: "histogram falling" } };
    return { indicator: "MACD", value, signal: "neutral" };
}
// ── Full analysis ────────────────────────────────────────────────────────────
export function fullAnalysis(ohlcv) {
    const closes = ohlcv.map(c => c.close);
    const highs = ohlcv.map(c => c.high);
    const lows = ohlcv.map(c => c.low);
    const volumes = ohlcv.map(c => c.volume);
    if (closes.length < 30)
        return [{ indicator: "ERROR", value: 0, signal: "neutral", metadata: { message: `Need 30+ candles, got ${closes.length}` } }];
    const results = [];
    // RSI
    const rsiVals = rsi(closes, 14);
    results.push(rsiSignal(rsiVals));
    // MACD
    const macdData = macd(closes, 12, 26, 9);
    results.push(macdSignal(macdData));
    // Bollinger
    const bb = bollingerBands(closes, 20, 2);
    results.push(bollingerSignal(closes[closes.length - 1], bb));
    // EMA crossover (12/26)
    const ema12 = ema(closes, 12);
    const ema26 = ema(closes, 26);
    const cross = detectCrossovers(ema12, ema26);
    results.push({
        indicator: "EMA Cross",
        value: cross.type === "golden_cross" ? 1 : cross.type === "death_cross" ? -1 : 0,
        signal: cross.type === "golden_cross" ? "bullish" : cross.type === "death_cross" ? "bearish" : "neutral",
        metadata: { type: cross.type, index: cross.index },
    });
    // ATR (volatility)
    const atrVals = atr(highs, lows, closes, 14);
    const lastATR = atrVals[atrVals.length - 1] ?? 0;
    results.push({
        indicator: "ATR",
        value: Math.round(lastATR * 100) / 100,
        signal: lastATR > closes[closes.length - 1] * 0.05 ? "bearish" : "neutral",
        metadata: { pct_of_price: Math.round(lastATR / closes[closes.length - 1] * 10000) / 100 },
    });
    // Volume profile
    const vp = volumeProfile(volumes.slice(-50), closes.slice(-50), 5);
    results.push({
        indicator: "Volume Profile",
        value: 0,
        signal: "neutral",
        metadata: { profile: vp },
    });
    // Simple moving averages
    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);
    const lastSma20 = sma20[sma20.length - 1] ?? 0;
    const lastSma50 = sma50[sma50.length - 1] ?? 0;
    const price = closes[closes.length - 1];
    results.push({
        indicator: "SMA Position",
        value: Math.round((price / lastSma20 - 1) * 10000) / 100,
        signal: price > lastSma20 && price > lastSma50 ? "bullish" : price < lastSma20 && price < lastSma50 ? "bearish" : "neutral",
        metadata: { sma20: Math.round(lastSma20 * 100) / 100, sma50: Math.round(lastSma50 * 100) / 100, price },
    });
    // Overall score
    const signals = results.filter(r => r.signal === "bullish" || r.signal === "bearish");
    const bullish = signals.filter(s => s.signal === "bullish").length;
    const bearish = signals.filter(s => s.signal === "bearish").length;
    results.push({
        indicator: "SUMMARY",
        value: bullish - bearish,
        signal: bullish > bearish ? "bullish" : bearish > bullish ? "bearish" : "neutral",
        metadata: { bullish_indicators: bullish, bearish_indicators: bearish, total: signals.length },
    });
    return results;
}
// ── Tool parameter schemas ───────────────────────────────────────────────────
export const analyzeTAParams = Type.Object({
    prices: Type.Array(Type.Number(), { description: "Array of closing prices (most recent last)" }),
    highs: Type.Optional(Type.Array(Type.Number(), { description: "High prices (optional, for ATR)" })),
    lows: Type.Optional(Type.Array(Type.Number(), { description: "Low prices (optional, for ATR)" })),
    volumes: Type.Optional(Type.Array(Type.Number(), { description: "Volume data (optional, for volume profile)" })),
});
export const rsiParams = Type.Object({
    prices: Type.Array(Type.Number(), { description: "Array of closing prices" }),
    period: Type.Optional(Type.Number({ default: 14, description: "RSI period" })),
});
export const macdParams = Type.Object({
    prices: Type.Array(Type.Number(), { description: "Array of closing prices" }),
    fast: Type.Optional(Type.Number({ default: 12 })),
    slow: Type.Optional(Type.Number({ default: 26 })),
    signal: Type.Optional(Type.Number({ default: 9 })),
});
// ── Tool: get_candles (#18 — fetch real OHLCV data from Binance) ─────────────
export const getCandlesParams = Type.Object({
    symbol: Type.String({ description: "Crypto symbol e.g. BTC, ETH, SOL" }),
    interval: Type.Optional(Type.String({ description: "Candle interval: 1m 5m 15m 1h 4h 1d (default: 1h)" })),
    limit: Type.Optional(Type.Number({ description: "Number of candles 1-500 (default: 100)" })),
    analyze: Type.Optional(Type.Boolean({ description: "Run full TA analysis on fetched candles (default: true)" })),
});
export async function getCandlesTool(_id, params) {
    const symbol = params.symbol.toUpperCase().replace(/USDT$/, "") + "USDT";
    const interval = params.interval ?? "1h";
    const limit = Math.min(Math.max(params.limit ?? 100, 10), 500);
    const analyze = params.analyze !== false;
    const VALID_INTERVALS = new Set(["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"]);
    if (!VALID_INTERVALS.has(interval)) {
        return {
            content: [{ type: "text", text: `Invalid interval "${interval}". Valid: ${[...VALID_INTERVALS].join(", ")}` }],
            details: {},
        };
    }
    try {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, { signal: AbortSignal.timeout(12_000), headers: { "User-Agent": "JellyOS/1.0" } });
        if (!res.ok) {
            return {
                content: [{ type: "text", text: `Binance API error ${res.status} for ${symbol}. Check symbol.` }],
                details: {},
            };
        }
        const raw = await res.json();
        const candles = raw.map(c => ({
            timestamp: c[0],
            open: parseFloat(c[1]),
            high: parseFloat(c[2]),
            low: parseFloat(c[3]),
            close: parseFloat(c[4]),
            volume: parseFloat(c[5]),
        }));
        const latest = candles[candles.length - 1];
        const oldest = candles[0];
        const chgPct = ((latest.close - oldest.close) / oldest.close * 100).toFixed(2);
        const priceStr = latest.close < 1
            ? `$${latest.close.toFixed(6)}`
            : `$${latest.close.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        const lines = [
            `${symbol} | ${interval} | ${candles.length} candles`,
            `Close: ${priceStr}  Period change: ${parseFloat(chgPct) >= 0 ? "+" : ""}${chgPct}%`,
            `High: $${latest.high.toLocaleString()}  Low: $${latest.low.toLocaleString()}`,
            `Volume (last bar): ${latest.volume.toLocaleString()}`,
        ];
        if (analyze && candles.length >= 30) {
            const results = fullAnalysis(candles);
            const summary = results.find(r => r.indicator === "SUMMARY");
            lines.push("", "── Technical Analysis ──");
            for (const r of results) {
                if (r.indicator === "SUMMARY")
                    continue;
                const icon = r.signal === "bullish" ? "🟢" : r.signal === "bearish" ? "🔴" : "⚪";
                const val = typeof r.value === "number" ? r.value.toFixed(2) : String(r.value);
                const meta = r.metadata?.condition ? ` (${String(r.metadata.condition)})` : "";
                lines.push(`  ${icon} ${r.indicator.padEnd(16)} ${val}${meta}`);
            }
            if (summary) {
                const icon = summary.signal === "bullish" ? "🟢" : summary.signal === "bearish" ? "🔴" : "⚪";
                lines.push("", `${icon} OVERALL: ${String(summary.signal).toUpperCase()} — ${String(summary.metadata?.bullish_indicators ?? 0)} bull / ${String(summary.metadata?.bearish_indicators ?? 0)} bear signals`);
            }
        }
        else if (analyze && candles.length < 30) {
            lines.push(`(need 30+ candles for TA, got ${candles.length} — increase limit)`);
        }
        return {
            content: [{ type: "text", text: lines.join("\n") }],
            details: {
                symbol, interval, candleCount: candles.length,
                latest: { close: latest.close, high: latest.high, low: latest.low, volume: latest.volume },
                priceChangePercent: parseFloat(chgPct),
            },
        };
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
            content: [{ type: "text", text: `Failed to fetch candles for ${symbol}: ${msg}` }],
            details: {},
        };
    }
}
//# sourceMappingURL=TechnicalAnalysis.js.map