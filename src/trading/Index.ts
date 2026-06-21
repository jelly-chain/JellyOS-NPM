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

export class TradingEngine {
  private tradeExecutor: TradeExecutor;
  private positionManager: PositionManager;
  private portfolioManager: PortfolioManager;
  private riskManager: RiskManager;
  private logger: any;

  constructor(context: ContextStore, metrics: Metrics, initialCapital?: number) {
    this.positionManager = new PositionManager(metrics);
    this.portfolioManager = new PortfolioManager(this.positionManager, metrics, initialCapital);
    this.riskManager = new RiskManager(this.positionManager, metrics);
    this.tradeExecutor = new TradeExecutor(context, metrics);
    this.logger = { info: (msg: string) => console.log(`[TradingEngine] ${msg}`) };
  }

  getTradeExecutor(): TradeExecutor { return this.tradeExecutor; }
  getPositionManager(): PositionManager { return this.positionManager; }
  getPortfolioManager(): PortfolioManager { return this.portfolioManager; }
  getRiskManager(): RiskManager { return this.riskManager; }
}

export const createTradingEngine = (context: ContextStore, metrics: Metrics, capital?: number) => new TradingEngine(context, metrics, capital);