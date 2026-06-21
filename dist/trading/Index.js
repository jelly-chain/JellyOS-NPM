export { TradeExecutor, TradeStatus } from './TradeExecutor.js';
export { PositionManager, PositionStatus } from './PositionManager.js';
export { PortfolioManager } from './PortfolioManager.js';
export { RiskManager } from './RiskManager.js';
import { TradeExecutor } from './TradeExecutor.js';
import { PositionManager } from './PositionManager.js';
import { PortfolioManager } from './PortfolioManager.js';
import { RiskManager } from './RiskManager.js';
export class TradingEngine {
    tradeExecutor;
    positionManager;
    portfolioManager;
    riskManager;
    logger;
    constructor(context, metrics, initialCapital) {
        this.positionManager = new PositionManager(metrics);
        this.portfolioManager = new PortfolioManager(this.positionManager, metrics, initialCapital);
        this.riskManager = new RiskManager(this.positionManager, metrics);
        this.tradeExecutor = new TradeExecutor(context, metrics);
        this.logger = { info: (msg) => console.log(`[TradingEngine] ${msg}`) };
    }
    getTradeExecutor() { return this.tradeExecutor; }
    getPositionManager() { return this.positionManager; }
    getPortfolioManager() { return this.portfolioManager; }
    getRiskManager() { return this.riskManager; }
}
export const createTradingEngine = (context, metrics, capital) => new TradingEngine(context, metrics, capital);
//# sourceMappingURL=Index.js.map