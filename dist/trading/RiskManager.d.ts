import { Metrics } from '../core/utils/Metrics.js';
import { Position, PositionManager } from './PositionManager.js';
export interface RiskLimit {
    maxDrawdown: number;
    maxDailyLoss: number;
    maxLeverage: number;
    maxConcentration: number;
    maxPositionSize: number;
    minLiquidity: number;
}
export interface RiskCheck {
    passed: boolean;
    violations: string[];
    details: Record<string, number>;
}
export declare class RiskManager {
    private logger;
    private metrics;
    private positionManager;
    private limits;
    private dailyLoss;
    private dailyResetTime;
    constructor(positionManager: PositionManager, metrics: Metrics, limits?: Partial<RiskLimit>);
    canOpenPosition(symbol: string, size: number, leverage: number, portfolioValue: number): RiskCheck;
    canClosePosition(position: Position): boolean;
    checkPortfolioRisk(portfolioValue: number, initialPortfolioValue: number): RiskCheck;
    recordPnL(pnl: number): void;
    private resetDailyIfNeeded;
    private getDailyReset;
    getLimits(): RiskLimit;
    setLimits(limits: Partial<RiskLimit>): void;
}
//# sourceMappingURL=RiskManager.d.ts.map