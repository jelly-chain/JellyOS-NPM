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
import { type Static } from "@sinclair/typebox";
export declare const fearGreedParams: import("@sinclair/typebox").TObject<{
    days: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
}>;
export declare function getFearGreedTool(_id: string, params: Static<typeof fearGreedParams>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
    details: {
        current: number;
        classification: string;
        avg7: number;
        trend: number[];
        direction: string;
    };
} | {
    content: {
        type: "text";
        text: string;
    }[];
    details: {
        current?: undefined;
        classification?: undefined;
        avg7?: undefined;
        trend?: undefined;
        direction?: undefined;
    };
}>;
export declare const fundingRatesParams: import("@sinclair/typebox").TObject<{
    symbol: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
}>;
export declare function getFundingRatesTool(_id: string, params: Static<typeof fundingRatesParams>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
    details: {
        symbol: string;
        currentRate: number;
        annualizedPct: number;
        sentiment: string;
        history: {
            fundingRate: string;
            fundingTime: number;
        }[];
    };
} | {
    content: {
        type: "text";
        text: string;
    }[];
    details: {
        symbol?: undefined;
        currentRate?: undefined;
        annualizedPct?: undefined;
        sentiment?: undefined;
        history?: undefined;
    };
}>;
export declare const btcMempoolParams: import("@sinclair/typebox").TObject<{}>;
export declare function getBtcMempoolTool(): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
    details: {
        pendingTxs: number;
        vsizeMB: number;
        fees: {
            fastestFee: number;
            halfHourFee: number;
            hourFee: number;
            economyFee: number;
        };
    };
} | {
    content: {
        type: "text";
        text: string;
    }[];
    details: {
        pendingTxs?: undefined;
        vsizeMB?: undefined;
        fees?: undefined;
    };
}>;
export declare const defiTvlParams: import("@sinclair/typebox").TObject<{
    chain: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
}>;
export declare function getDefiTvlTool(_id: string, params: Static<typeof defiTvlParams>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
    details: {
        chain: string;
        tvl: number;
        change7d: string | null;
        chains?: undefined;
        totalTvl?: undefined;
    };
} | {
    content: {
        type: "text";
        text: string;
    }[];
    details: {
        chains: {
            name: string;
            tvl: number;
        }[];
        totalTvl: number;
        chain?: undefined;
        tvl?: undefined;
        change7d?: undefined;
    };
} | {
    content: {
        type: "text";
        text: string;
    }[];
    details: {
        chain?: undefined;
        tvl?: undefined;
        change7d?: undefined;
        chains?: undefined;
        totalTvl?: undefined;
    };
}>;
export declare const solanaStatsParams: import("@sinclair/typebox").TObject<{}>;
export declare function getSolanaStatsTool(): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
    details: {
        avgTps: number;
        maxTps: number;
        latestSlot: number;
        samples: number[];
    };
} | {
    content: {
        type: "text";
        text: string;
    }[];
    details: {
        avgTps?: undefined;
        maxTps?: undefined;
        latestSlot?: undefined;
        samples?: undefined;
    };
}>;
//# sourceMappingURL=MarketSentiment.d.ts.map