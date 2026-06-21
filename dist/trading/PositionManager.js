import { Logger } from '../core/utils/Logger.js';
export var PositionStatus;
(function (PositionStatus) {
    PositionStatus["OPEN"] = "open";
    PositionStatus["CLOSED"] = "closed";
    PositionStatus["STOPPED"] = "stopped";
    PositionStatus["LIQUIDATED"] = "liquidated";
})(PositionStatus || (PositionStatus = {}));
export class PositionManager {
    logger;
    metrics;
    config;
    positions = new Map();
    closedPositions = [];
    trailingStops = new Map();
    constructor(metrics, config) {
        this.metrics = metrics;
        this.logger = new Logger('PositionManager');
        this.config = { defaultStopLoss: 0.05, defaultTakeProfit: 0.15, maxLeverage: 5, trailingStop: true, trailingStopDistance: 0.02, ...config };
    }
    openPosition(params) {
        const id = `pos:${params.symbol}:${Date.now()}`;
        const position = {
            id, symbol: params.symbol, side: params.side, entryPrice: params.entryPrice,
            currentPrice: params.entryPrice, quantity: params.quantity, entryTime: Date.now(),
            updatedTime: Date.now(), realizedPnL: 0, unrealizedPnL: 0, fees: 0,
            status: PositionStatus.OPEN, strategy: params.strategy || 'manual', tags: params.tags || [],
            stopLoss: params.stopLoss || params.entryPrice * (1 - (params.side === 'long' ? this.config.defaultStopLoss : -this.config.defaultStopLoss)),
            takeProfit: params.takeProfit || params.entryPrice * (1 + (params.side === 'long' ? this.config.defaultTakeProfit : -this.config.defaultTakeProfit)),
            leverage: params.leverage || 1,
        };
        this.positions.set(id, position);
        this.metrics.increment('positions.opened', 1, { symbol: position.symbol, side: position.side });
        this.logger.info(`Opened ${position.side} position ${id}: ${position.quantity} ${position.symbol} @ ${position.entryPrice}`);
        return position;
    }
    closePosition(positionId, closePrice) {
        const position = this.positions.get(positionId);
        if (!position)
            return null;
        const exitPrice = closePrice || position.currentPrice;
        const grossPnL = position.side === 'long'
            ? (exitPrice - position.entryPrice) * position.quantity
            : (position.entryPrice - exitPrice) * position.quantity;
        position.realizedPnL = grossPnL * position.leverage - position.fees;
        position.currentPrice = exitPrice;
        position.status = PositionStatus.CLOSED;
        position.updatedTime = Date.now();
        this.positions.delete(positionId);
        this.closedPositions.push(position);
        this.metrics.increment('positions.closed', 1, { symbol: position.symbol });
        this.logger.info(`Closed position ${positionId}: PnL ${position.realizedPnL}`);
        return position;
    }
    updatePrice(positionId, newPrice) {
        const position = this.positions.get(positionId);
        if (!position)
            return null;
        const prevPrice = position.currentPrice;
        position.currentPrice = newPrice;
        position.updatedTime = Date.now();
        position.unrealizedPnL = position.side === 'long'
            ? (newPrice - position.entryPrice) * position.quantity * position.leverage
            : (position.entryPrice - newPrice) * position.quantity * position.leverage;
        if (this.config.trailingStop)
            this.updateTrailingStop(position, newPrice);
        const shouldStop = this.shouldTriggerStop(position);
        if (shouldStop)
            return this.closePosition(positionId, newPrice);
        return position;
    }
    updateTrailingStop(position, newPrice) {
        const stopKey = position.id;
        const currentStop = this.trailingStops.get(stopKey) || position.stopLoss;
        if (position.side === 'long' && newPrice > currentStop + this.config.trailingStopDistance) {
            const newStop = newPrice - this.config.trailingStopDistance;
            this.trailingStops.set(stopKey, newStop);
            position.stopLoss = newStop;
        }
        else if (position.side === 'short' && newPrice < currentStop - this.config.trailingStopDistance) {
            const newStop = newPrice + this.config.trailingStopDistance;
            this.trailingStops.set(stopKey, newStop);
            position.stopLoss = newStop;
        }
    }
    shouldTriggerStop(position) {
        if (position.side === 'long' && position.currentPrice <= position.stopLoss)
            return true;
        if (position.side === 'long' && position.currentPrice >= position.takeProfit)
            return true;
        if (position.side === 'short' && position.currentPrice >= position.stopLoss)
            return true;
        if (position.side === 'short' && position.currentPrice <= position.takeProfit)
            return true;
        return false;
    }
    getPosition(positionId) { return this.positions.get(positionId); }
    getOpenPositions() { return [...this.positions.values()]; }
    getPositionsBySymbol(symbol) {
        return [...this.positions.values()].filter(p => p.symbol === symbol);
    }
    getClosedPositions(limit = 50) { return this.closedPositions.slice(-limit); }
    getStats() {
        const open = this.getOpenPositions();
        const totalUnrealized = open.reduce((s, p) => s + p.unrealizedPnL, 0);
        const totalRealized = this.closedPositions.reduce((s, p) => s + p.realizedPnL, 0);
        const totalValue = open.reduce((s, p) => s + p.currentPrice * p.quantity, 0);
        const wins = this.closedPositions.filter(p => p.realizedPnL > 0).length;
        const losses = this.closedPositions.filter(p => p.realizedPnL < 0).length;
        return {
            openPositions: open.length, closedPositions: this.closedPositions.length,
            totalUnrealizedPnL: totalUnrealized, totalRealizedPnL: totalRealized,
            totalValue, totalPnL: totalRealized + totalUnrealized,
            winRate: wins + losses > 0 ? wins / (wins + losses) : 0, wins, losses,
            totalFees: this.closedPositions.reduce((s, p) => s + p.fees, 0),
        };
    }
    /** Total realized + unrealized PnL — used by AutoVault for sweep decisions */
    getTotalPnL() {
        const stats = this.getStats();
        return stats.totalPnL;
    }
    /** Total portfolio value from open positions */
    getTotalValue() {
        return this.getOpenPositions().reduce((s, p) => s + p.currentPrice * p.quantity * p.leverage, 0);
    }
    close() {
        this.positions.clear();
        this.closedPositions = [];
        this.trailingStops.clear();
        this.logger.info('PositionManager closed');
    }
}
//# sourceMappingURL=PositionManager.js.map