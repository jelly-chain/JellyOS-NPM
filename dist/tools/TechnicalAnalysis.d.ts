/**
 * Technical Analysis Toolkit — RSI, MACD, EMA, Bollinger Bands,
 * moving averages, volume profile, and signal detection.
 *
 * All calculations are pure math on price arrays — no external API needed.
 * Designed to be exposed as tools the AI can call autonomously.
 */
import { type Static } from "@sinclair/typebox";
export interface OHLCV {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
export interface AnalysisResult {
    indicator: string;
    value: number | number[];
    signal?: "bullish" | "bearish" | "neutral";
    metadata?: Record<string, unknown>;
}
export declare function sma(prices: number[], period: number): number[];
export declare function ema(prices: number[], period: number): number[];
export declare function rsi(prices: number[], period?: number): number[];
export declare function macd(prices: number[], fast?: number, slow?: number, signal?: number): {
    macd: number[];
    signal: number[];
    histogram: number[];
};
export declare function bollingerBands(prices: number[], period?: number, deviations?: number): {
    upper: number[];
    middle: number[];
    lower: number[];
    width: number[];
};
export declare function atr(highs: number[], lows: number[], closes: number[], period?: number): number[];
export declare function volumeProfile(volumes: number[], prices: number[], levels?: number): {
    priceRange: string;
    volume: number;
    pct: number;
}[];
export declare function detectCrossovers(fast: number[], slow: number[]): {
    type: "golden_cross" | "death_cross" | null;
    index: number;
};
export declare function rsiSignal(rsiValues: number[]): AnalysisResult;
export declare function bollingerSignal(price: number, bands: {
    upper: number[];
    lower: number[];
}): AnalysisResult;
export declare function macdSignal(macdData: {
    macd: number[];
    signal: number[];
    histogram: number[];
}): AnalysisResult;
export declare function fullAnalysis(ohlcv: OHLCV[]): AnalysisResult[];
export declare const analyzeTAParams: import("@sinclair/typebox").TObject<{
    prices: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TNumber>;
    highs: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TNumber>>;
    lows: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TNumber>>;
    volumes: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TNumber>>;
}>;
export declare const rsiParams: import("@sinclair/typebox").TObject<{
    prices: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TNumber>;
    period: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
}>;
export declare const macdParams: import("@sinclair/typebox").TObject<{
    prices: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TNumber>;
    fast: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
    slow: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
    signal: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
}>;
export declare const getCandlesParams: import("@sinclair/typebox").TObject<{
    symbol: import("@sinclair/typebox").TString;
    interval: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
    analyze: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TBoolean>;
}>;
export declare function getCandlesTool(_id: string, params: Static<typeof getCandlesParams>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
    details: {
        symbol?: undefined;
        interval?: undefined;
        candleCount?: undefined;
        latest?: undefined;
        priceChangePercent?: undefined;
    };
} | {
    content: {
        type: "text";
        text: string;
    }[];
    details: {
        symbol: string;
        interval: string;
        candleCount: number;
        latest: {
            close: number;
            high: number;
            low: number;
            volume: number;
        };
        priceChangePercent: number;
    };
}>;
//# sourceMappingURL=TechnicalAnalysis.d.ts.map