import { Logger } from '../core/utils/Logger.js';
export class PortfolioManager {
    logger;
    metrics;
    positionManager;
    config;
    cashReserve;
    constructor(positionManager, metrics, initialCapital = 100000, config) {
        this.positionManager = positionManager;
        this.metrics = metrics;
        this.logger = new Logger('PortfolioManager');
        this.cashReserve = initialCapital;
        this.config = {
            type: 'risk-parity', maxPositionSize: 0.2, minPositionSize: 0.02, rebalanceThreshold: 0.05,
            ...config,
        };
    }
    getSummary() {
        const positions = this.positionManager.getOpenPositions();
        const closedPositions = this.positionManager.getClosedPositions();
        const totalAllocated = positions.reduce((s, p) => s + p.currentPrice * p.quantity, 0);
        const totalValue = this.cashReserve + totalAllocated;
        const unrealizedPnL = positions.reduce((s, p) => s + p.unrealizedPnL, 0);
        const realizedPnL = closedPositions.reduce((s, p) => s + p.realizedPnL, 0);
        const totalReturn = (realizedPnL + unrealizedPnL) / (totalValue - realizedPnL - unrealizedPnL);
        const concentration = {};
        for (const pos of positions) {
            concentration[pos.symbol] = totalValue > 0 ? (pos.currentPrice * pos.quantity) / totalValue : 0;
        }
        const longExposure = positions.filter(p => p.side === 'long').reduce((s, p) => s + p.currentPrice * p.quantity, 0);
        const shortExposure = positions.filter(p => p.side === 'short').reduce((s, p) => s + p.currentPrice * p.quantity, 0);
        const uniqueSymbols = new Set(positions.map(p => p.symbol)).size;
        const diversification = positions.length > 0 ? uniqueSymbols / positions.length : 0;
        const wins = closedPositions.filter(p => p.realizedPnL > 0).length;
        const losses = closedPositions.filter(p => p.realizedPnL < 0).length;
        const winRate = wins + losses > 0 ? wins / (wins + losses) : 0;
        const avgWin = wins > 0 ? closedPositions.filter(p => p.realizedPnL > 0).reduce((s, p) => s + p.realizedPnL, 0) / wins : 0;
        const avgLoss = losses > 0 ? Math.abs(closedPositions.filter(p => p.realizedPnL < 0).reduce((s, p) => s + p.realizedPnL, 0)) / losses : 0;
        return {
            totalValue, cash: this.cashReserve, allocated: totalAllocated,
            positions: positions.length, diversification, concentration,
            exposure: { long: longExposure, short: shortExposure, net: longExposure - shortExposure },
            performance: {
                totalReturn, dailyReturn: 0, weeklyReturn: 0,
                monthlyReturn: 0, sharpeRatio: 0, maxDrawdown: 0,
                winRate, avgWin, avgLoss, profitFactor: avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? Infinity : 0),
            },
            timestamp: Date.now(),
        };
    }
    calculateAllocation(symbol, price, score) {
        const maxAllocation = this.cashReserve * this.config.maxPositionSize;
        const minAllocation = this.cashReserve * this.config.minPositionSize;
        if (this.config.type === 'equal') {
            const positionCount = this.positionManager.getOpenPositions().length + 1;
            return Math.min(maxAllocation, this.cashReserve / positionCount);
        }
        if (this.config.type === 'momentum') {
            const normalizedScore = Math.max(0, Math.min(1, (score + 1) / 2));
            return Math.max(minAllocation, Math.min(maxAllocation, this.cashReserve * normalizedScore * 0.1));
        }
        return Math.max(minAllocation, Math.min(maxAllocation, this.cashReserve * 0.1));
    }
    checkRebalanceNeeded() {
        const summary = this.getSummary();
        if (summary.positions === 0)
            return false;
        for (const [, weight] of Object.entries(summary.concentration)) {
            if (Math.abs(weight - (this.config.weights?.['default'] || 0.1)) > this.config.rebalanceThreshold) {
                return true;
            }
        }
        return false;
    }
    addCash(amount) { this.cashReserve += amount; }
    deductCash(amount) { this.cashReserve = Math.max(0, this.cashReserve - amount); }
    getCash() { return this.cashReserve; }
    setAllocationStrategy(strategy) { this.config = { ...this.config, ...strategy }; }
}
//# sourceMappingURL=PortfolioManager.js.map