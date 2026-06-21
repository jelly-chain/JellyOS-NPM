export { TradeExecutor, TradeOrder, Fill, TradeStatus, ExecutionConfig } from './TradeExecutor.js';
export { PositionManager, Position, PositionStatus, PositionConfig } from './PositionManager.js';
export { PortfolioManager, PortfolioSummary, AllocationStrategy } from './PortfolioManager.js';
export { RiskManager, RiskLimit, RiskCheck } from './RiskManager.js';
import { ContextStore } from '../context/ContextStore.js';
import { Metrics } from '../core/utils/Metrics.js';
import { TradeExecutor } from './TradeExecutor.js';
import { PositionManager } from './PositionManager.js';
import { PortfolioManager } from './PortfolioManager.js';
import { RiskManager } from './RiskManager.js';
export declare class TradingEngine {
    private tradeExecutor;
    private positionManager;
    private portfolioManager;
    private riskManager;
    private logger;
    constructor(context: ContextStore, metrics: Metrics, initialCapital?: number);
    getTradeExecutor(): TradeExecutor;
    getPositionManager(): PositionManager;
    getPortfolioManager(): PortfolioManager;
    getRiskManager(): RiskManager;
}
export declare const createTradingEngine: (context: ContextStore, metrics: Metrics, capital?: number) => TradingEngine;
//# sourceMappingURL=Index.d.ts.map