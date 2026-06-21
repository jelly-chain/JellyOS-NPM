import { Metrics } from '../core/utils/Metrics.js';
import { PositionManager } from './PositionManager.js';
export interface PortfolioSummary {
    totalValue: number;
    cash: number;
    allocated: number;
    positions: number;
    diversification: number;
    concentration: Record<string, number>;
    exposure: {
        long: number;
        short: number;
        net: number;
    };
    performance: {
        totalReturn: number;
        dailyReturn: number;
        weeklyReturn: number;
        monthlyReturn: number;
        sharpeRatio: number;
        maxDrawdown: number;
        winRate: number;
        avgWin: number;
        avgLoss: number;
        profitFactor: number;
    };
    timestamp: number;
}
export interface AllocationStrategy {
    type: 'equal' | 'weighted' | 'risk-parity' | 'momentum';
    weights?: Record<string, number>;
    maxPositionSize: number;
    minPositionSize: number;
    rebalanceThreshold: number;
}
export declare class PortfolioManager {
    private logger;
    private metrics;
    private positionManager;
    private config;
    private cashReserve;
    constructor(positionManager: PositionManager, metrics: Metrics, initialCapital?: number, config?: Partial<AllocationStrategy>);
    getSummary(): PortfolioSummary;
    calculateAllocation(symbol: string, price: number, score: number): number;
    checkRebalanceNeeded(): boolean;
    addCash(amount: number): void;
    deductCash(amount: number): void;
    getCash(): number;
    setAllocationStrategy(strategy: Partial<AllocationStrategy>): void;
}
//# sourceMappingURL=PortfolioManager.d.ts.map