import { Metrics } from '../core/utils/Metrics.js';
export interface VolatilityForecast {
    symbol: string;
    currentVol: number;
    forecastedVol: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    confidence: number;
    horizon: number;
    components: {
        historical: number;
        garch: number;
        regime: number;
        seasonal: number;
    };
    timestamp: number;
}
export interface VolatilityRegime {
    regime: 'low' | 'normal' | 'high' | 'extreme';
    probability: number;
    duration: number;
}
export declare class VolatilityModel {
    private logger;
    private metrics;
    private forecasts;
    private garchParams;
    constructor(metrics: Metrics);
    forecast(symbol: string, prices: number[], horizon?: number): Promise<VolatilityForecast>;
    private calculateReturns;
    private calculateHistoricalVolatility;
    private estimateGARCH;
    private detectRegime;
    private calculateSeasonalFactor;
    getVolatilityRegime(symbol: string, prices: number[]): Promise<VolatilityRegime>;
    private estimateRegimeDuration;
    calculateRiskMetrics(prices: number[]): Promise<any>;
    getForecast(symbol: string): VolatilityForecast | undefined;
    clearCache(): void;
}
//# sourceMappingURL=VolatilityModel.d.ts.map