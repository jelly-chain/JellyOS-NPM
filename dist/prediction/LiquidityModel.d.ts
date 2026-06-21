import { Metrics } from '../core/utils/Metrics.js';
export interface LiquidityAnalysis {
    symbol: string;
    spread: number;
    depth: number;
    slippage: number;
    volume24h: number;
    liquidityScore: number;
    orderBookImbalance: number;
    timestamp: number;
}
export interface SlippageEstimate {
    symbol: string;
    tradeSize: number;
    estimatedSlippage: number;
    priceImpact: number;
    expectedFillPrice: number;
    confidence: number;
}
export declare class LiquidityModel {
    private logger;
    private metrics;
    private liquidityCache;
    constructor(metrics: Metrics);
    analyzeLiquidity(symbol: string, orderBook: {
        bids: [number, number][];
        asks: [number, number][];
    }, volume24h: number): Promise<LiquidityAnalysis>;
    private calculateSpread;
    private calculateDepth;
    private estimateSlippageFromBook;
    private calculateImbalance;
    private computeLiquidityScore;
    estimateSlippage(symbol: string, tradeSize: number, currentPrice: number): Promise<SlippageEstimate>;
    getLiquidity(symbol: string): Promise<LiquidityAnalysis | null>;
    clearCache(): void;
}
//# sourceMappingURL=LiquidityModel.d.ts.map