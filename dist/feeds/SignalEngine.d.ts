import { FeedManager } from './FeedManager.js';
import { EventEmitter } from 'events';
export interface TradingSignal {
    id: string;
    asset: string;
    direction: 'long' | 'short' | 'neutral';
    strength: number;
    sources: string[];
    rationale: string;
    suggestedEntry?: number;
    suggestedStopLoss?: number;
    suggestedTakeProfit?: number;
    timestamp: number;
    expiresAt: number;
    confidence: number;
}
export declare class SignalEngine extends EventEmitter {
    private feeds;
    private logger;
    private signals;
    private maxSignals;
    constructor(feeds: FeedManager);
    private processItem;
    private emitSignal;
    private extractSignal;
    private makeSignal;
    /**
     * Returns the net directional score across active signals (-N to +N).
     * This is NOT real PnL — it is a synthetic confidence-weighted signal summary.
     * AutoVault should use PositionManager.getStats().totalUnrealizedPnL instead.
     */
    getNetPnL(): number;
    /**
     * Returns the real PnL from the PositionManager if available.
     * Falls back to the synthetic signal score above.
     */
    getRealPnL(positionManager?: any): number;
    getActiveSignals(asset?: string): TradingSignal[];
    getSummary(): string;
    getStats(): any;
}
//# sourceMappingURL=SignalEngine.d.ts.map