import { Metrics } from '../core/utils/Metrics.js';
export interface Position {
    id: string;
    symbol: string;
    side: 'long' | 'short';
    entryPrice: number;
    currentPrice: number;
    quantity: number;
    leverage: number;
    stopLoss: number;
    takeProfit: number;
    entryTime: number;
    updatedTime: number;
    realizedPnL: number;
    unrealizedPnL: number;
    fees: number;
    status: PositionStatus;
    strategy: string;
    tags: string[];
}
export declare enum PositionStatus {
    OPEN = "open",
    CLOSED = "closed",
    STOPPED = "stopped",
    LIQUIDATED = "liquidated"
}
export interface PositionConfig {
    defaultStopLoss: number;
    defaultTakeProfit: number;
    maxLeverage: number;
    trailingStop: boolean;
    trailingStopDistance: number;
}
export declare class PositionManager {
    private logger;
    private metrics;
    private config;
    private positions;
    private closedPositions;
    private trailingStops;
    constructor(metrics: Metrics, config?: Partial<PositionConfig>);
    openPosition(params: Partial<Position>): Position;
    closePosition(positionId: string, closePrice?: number): Position | null;
    updatePrice(positionId: string, newPrice: number): Position | null;
    private updateTrailingStop;
    private shouldTriggerStop;
    getPosition(positionId: string): Position | undefined;
    getOpenPositions(): Position[];
    getPositionsBySymbol(symbol: string): Position[];
    getClosedPositions(limit?: number): Position[];
    getStats(): {
        openPositions: number;
        closedPositions: number;
        totalUnrealizedPnL: number;
        totalRealizedPnL: number;
        totalValue: number;
        totalPnL: number;
        winRate: number;
        wins: number;
        losses: number;
        totalFees: number;
    };
    /** Total realized + unrealized PnL — used by AutoVault for sweep decisions */
    getTotalPnL(): number;
    /** Total portfolio value from open positions */
    getTotalValue(): number;
    close(): void;
}
//# sourceMappingURL=PositionManager.d.ts.map