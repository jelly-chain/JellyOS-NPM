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
import { type Static } from "@sinclair/typebox";
import { EventEmitter } from "node:events";
export interface PriceTick {
    symbol: string;
    price: number;
    change24h: number;
    volume24h: number;
    marketCap: number;
    high24h: number;
    low24h: number;
    source: "coingecko" | "binance";
    timestamp: number;
}
export interface CoinGeckoCoin {
    id: string;
    symbol: string;
    name: string;
    current_price: number;
    price_change_percentage_24h: number;
    market_cap: number;
    total_volume: number;
    high_24h: number;
    low_24h: number;
}
export declare class PriceFeed extends EventEmitter {
    private prices;
    private pollInterval;
    private timer?;
    private tracking;
    constructor(pollIntervalMs?: number);
    start(): void;
    stop(): void;
    /** Add symbols to track. IDs are auto-resolved from the symbol map. */
    track(...symbols: string[]): void;
    fetchAll(): Promise<void>;
    private fetchBinance;
    private fetchCoinGecko;
    get(symbol: string): PriceTick | undefined;
    getMultiple(symbols: string[]): PriceTick[];
    getAll(): PriceTick[];
    getTopMovers(limit?: number): PriceTick[];
    formatPrice(tick: PriceTick): string;
    /** Compact ticker line for the status bar. */
    tickerLine(maxSymbols?: number): string;
}
export declare const priceFeed: PriceFeed;
export declare const getPricesParams: import("@sinclair/typebox").TObject<{
    symbols: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>;
}>;
export declare function getPricesTool(_id: string, params: Static<typeof getPricesParams>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
    details: Record<string, unknown>;
}>;
export declare const topMoversParams: import("@sinclair/typebox").TObject<{
    limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
}>;
export declare function topMoversTool(_id: string, params: Static<typeof topMoversParams>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
    details: {
        count: number;
    };
}>;
export declare const marketOverviewParams: import("@sinclair/typebox").TObject<{}>;
export declare function marketOverviewTool(): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
    details: {
        totalMarketCap?: undefined;
        avgChange24h?: undefined;
        gainers?: undefined;
        losers?: undefined;
        assets?: undefined;
    };
} | {
    content: {
        type: "text";
        text: string;
    }[];
    details: {
        totalMarketCap: number;
        avgChange24h: number;
        gainers: number;
        losers: number;
        assets: number;
    };
}>;
//# sourceMappingURL=PriceFeed.d.ts.map