import { Logger } from '../core/utils/Logger.js';
import { EventEmitter } from 'events';
export class SignalEngine extends EventEmitter {
    feeds;
    logger;
    signals = [];
    maxSignals = 50;
    constructor(feeds) {
        super();
        this.feeds = feeds;
        this.logger = new Logger('SignalEngine');
        // Subscribe to feed events and generate signals
        feeds.subscribe((item) => this.processItem(item));
    }
    processItem(item) {
        try {
            const signal = this.extractSignal(item);
            if (signal) {
                this.signals.unshift(signal);
                if (this.signals.length > this.maxSignals) {
                    this.signals = this.signals.slice(0, this.maxSignals);
                }
                // Broadcast to dashboard if connected
                this.emitSignal(signal);
            }
        }
        catch { /* ignore */ }
    }
    emitSignal(signal) {
        // Emit locally for subscribers (e.g., dashboard bridge)
        this.emit('signal_generated', signal);
    }
    extractSignal(item) {
        const now = Date.now();
        const expires = now + 3_600_000; // 1 hour default
        // Fear & Greed extremes
        if (item.source === 'alternative.me') {
            const score = item.metadata?.score;
            if (score !== undefined) {
                if (score <= 20) {
                    return this.makeSignal('BTC', 'long', 0.7, ['fear_greed'], `Extreme Fear (${score}) — historically good entry point`, now, expires, 0.6);
                }
                if (score >= 85) {
                    return this.makeSignal('BTC', 'short', 0.6, ['fear_greed'], `Extreme Greed (${score}) — potential distribution zone`, now, expires, 0.55);
                }
            }
        }
        // Large price moves
        if (item.category === 'price' && item.metadata?.change24h !== undefined) {
            const change = item.metadata.change24h;
            const asset = (item.metadata?.asset || 'BTC').toUpperCase();
            if (change <= -15) {
                return this.makeSignal(asset, 'long', 0.6, ['coingecko_prices'], `Sharp drop ${change.toFixed(1)}% — potential oversold bounce`, now, expires, 0.5);
            }
            if (change >= 20) {
                return this.makeSignal(asset, 'short', 0.55, ['coingecko_prices'], `Sharp pump ${change.toFixed(1)}% — potential local top`, now, expires, 0.45);
            }
        }
        // High funding rates → short signal (longs paying too much)
        if (item.source === 'coinglass' && item.metadata?.rates) {
            const rates = item.metadata.rates;
            const avgRate = rates.reduce((s, r) => s + (r.fundingRate || 0), 0) / (rates.length || 1);
            if (avgRate > 0.0008) {
                return this.makeSignal('BTC', 'short', 0.65, ['funding_rates'], `High funding rate (${(avgRate * 100).toFixed(4)}%) — longs overextended`, now, expires, 0.6);
            }
            if (avgRate < -0.0003) {
                return this.makeSignal('BTC', 'long', 0.6, ['funding_rates'], `Negative funding (${(avgRate * 100).toFixed(4)}%) — shorts overextended`, now, expires, 0.55);
            }
        }
        return null;
    }
    makeSignal(asset, direction, strength, sources, rationale, timestamp, expiresAt, confidence) {
        return {
            id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            asset, direction, strength, sources, rationale,
            timestamp, expiresAt, confidence,
        };
    }
    /**
     * Returns the net directional score across active signals (-N to +N).
     * This is NOT real PnL — it is a synthetic confidence-weighted signal summary.
     * AutoVault should use PositionManager.getStats().totalUnrealizedPnL instead.
     */
    getNetPnL() {
        const active = this.getActiveSignals();
        return active.reduce((sum, s) => {
            const sign = s.direction === 'long' ? 1 : s.direction === 'short' ? -1 : 0;
            return sum + sign * s.strength * s.confidence * 100;
        }, 0);
    }
    /**
     * Returns the real PnL from the PositionManager if available.
     * Falls back to the synthetic signal score above.
     */
    getRealPnL(positionManager) {
        if (positionManager) {
            const stats = positionManager.getStats();
            return stats.totalRealizedPnL + stats.totalUnrealizedPnL;
        }
        return this.getNetPnL();
    }
    getActiveSignals(asset) {
        const now = Date.now();
        const active = this.signals.filter(s => s.expiresAt > now);
        if (asset)
            return active.filter(s => s.asset.toUpperCase() === asset.toUpperCase());
        return active;
    }
    getSummary() {
        const active = this.getActiveSignals();
        if (active.length === 0)
            return 'No active signals.';
        return active.map(s => `[${s.asset}] ${s.direction.toUpperCase()} — strength: ${(s.strength * 100).toFixed(0)}% — ${s.rationale}`).join('\n');
    }
    getStats() {
        const active = this.getActiveSignals();
        return {
            totalSignals: this.signals.length,
            activeSignals: active.length,
            longSignals: active.filter(s => s.direction === 'long').length,
            shortSignals: active.filter(s => s.direction === 'short').length,
            avgStrength: active.length > 0 ?
                (active.reduce((s, sig) => s + sig.strength, 0) / active.length).toFixed(2) : '0',
        };
    }
}
//# sourceMappingURL=SignalEngine.js.map