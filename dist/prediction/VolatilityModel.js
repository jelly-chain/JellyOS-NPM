import { Logger } from '../core/utils/Logger.js';
export class VolatilityModel {
    logger;
    metrics;
    forecasts = new Map();
    garchParams = new Map();
    constructor(metrics) {
        this.logger = new Logger('VolatilityModel');
        this.metrics = metrics;
    }
    async forecast(symbol, prices, horizon = 24) {
        this.logger.info(`Forecasting volatility for ${symbol}`);
        const returns = this.calculateReturns(prices);
        const historicalVol = this.calculateHistoricalVolatility(returns);
        const garchVol = this.estimateGARCH(returns);
        const regimeFactor = this.detectRegime(returns);
        const seasonalFactor = this.calculateSeasonalFactor(symbol);
        const currentVol = historicalVol;
        const forecastedVol = garchVol * 0.5 + historicalVol * 0.3 + regimeFactor * 0.1 + seasonalFactor * 0.1;
        const trend = forecastedVol > currentVol * 1.1 ? 'increasing' : forecastedVol < currentVol * 0.9 ? 'decreasing' : 'stable';
        const confidence = returns.length > 100 ? 0.8 : returns.length > 50 ? 0.6 : 0.4;
        const forecast = {
            symbol, currentVol, forecastedVol, trend, confidence, horizon,
            components: { historical: historicalVol, garch: garchVol, regime: regimeFactor, seasonal: seasonalFactor },
            timestamp: Date.now(),
        };
        this.forecasts.set(symbol, forecast);
        this.metrics.record('volatility.forecast', forecastedVol, { symbol });
        return forecast;
    }
    calculateReturns(prices) {
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            if (prices[i - 1] > 0) {
                returns.push(Math.log(prices[i] / prices[i - 1]));
            }
        }
        return returns;
    }
    calculateHistoricalVolatility(returns) {
        if (returns.length < 2)
            return 0.3;
        const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
        const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / (returns.length - 1);
        const dailyVol = Math.sqrt(variance);
        return dailyVol * Math.sqrt(365);
    }
    estimateGARCH(returns) {
        if (returns.length < 20)
            return 0.3;
        const omega = 0.0001;
        const alpha = 0.1;
        const beta = 0.85;
        const longTermVar = returns.reduce((s, r) => s + r * r, 0) / returns.length;
        let variance = longTermVar;
        for (let i = 1; i < returns.length && i < 100; i++) {
            variance = omega + alpha * returns[returns.length - i] * returns[returns.length - i] + beta * variance;
        }
        return Math.sqrt(variance * 365);
    }
    detectRegime(returns) {
        if (returns.length < 50)
            return 0;
        const recent = returns.slice(-20);
        const recentVol = this.calculateHistoricalVolatility(recent);
        const fullVol = this.calculateHistoricalVolatility(returns);
        const ratio = fullVol > 0 ? recentVol / fullVol : 1;
        if (ratio > 2)
            return 1.5;
        if (ratio > 1.3)
            return 1.2;
        if (ratio < 0.5)
            return 0.7;
        return 1;
    }
    calculateSeasonalFactor(symbol) {
        const month = new Date().getMonth();
        const seasonalPatterns = {
            0: 1.1, 1: 1.0, 2: 0.9, 3: 0.95,
            4: 1.0, 5: 1.05, 6: 1.1, 7: 1.0,
            8: 0.9, 9: 0.95, 10: 1.0, 11: 1.1,
        };
        return seasonalPatterns[month] || 1.0;
    }
    async getVolatilityRegime(symbol, prices) {
        const forecast = await this.forecast(symbol, prices);
        let regime;
        let probability;
        if (forecast.currentVol < 0.2) {
            regime = 'low';
            probability = 0.7;
        }
        else if (forecast.currentVol < 0.5) {
            regime = 'normal';
            probability = 0.6;
        }
        else if (forecast.currentVol < 1.0) {
            regime = 'high';
            probability = 0.65;
        }
        else {
            regime = 'extreme';
            probability = 0.75;
        }
        return { regime, probability, duration: this.estimateRegimeDuration(regime) };
    }
    estimateRegimeDuration(regime) {
        switch (regime) {
            case 'low': return 30;
            case 'normal': return 20;
            case 'high': return 10;
            case 'extreme': return 5;
            default: return 15;
        }
    }
    async calculateRiskMetrics(prices) {
        const returns = this.calculateReturns(prices);
        const vol = this.calculateHistoricalVolatility(returns);
        const var95 = returns.length > 0 ? returns.sort((a, b) => a - b)[Math.floor(returns.length * 0.05)] : -0.02;
        return {
            volatility: vol,
            dailyVaR: var95,
            monthlyVaR: var95 * Math.sqrt(30),
            sharpeRatio: 0,
            sortinoRatio: 0,
            maxDrawdown: 0,
        };
    }
    getForecast(symbol) {
        return this.forecasts.get(symbol);
    }
    clearCache() {
        this.forecasts.clear();
    }
}
//# sourceMappingURL=VolatilityModel.js.map