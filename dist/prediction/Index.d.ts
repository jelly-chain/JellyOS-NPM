export { PredictionModel } from './PredictionModel.js';
export { VolatilityModel } from './VolatilityModel.js';
export { LiquidityModel } from './LiquidityModel.js';
export type { PredictionInput, PredictionOutput, ModelConfig } from './PredictionModel.js';
export type { VolatilityForecast, VolatilityRegime } from './VolatilityModel.js';
export type { LiquidityAnalysis, SlippageEstimate } from './LiquidityModel.js';
import { ContextStore } from '../context/ContextStore.js';
import { Metrics } from '../core/utils/Metrics.js';
import { PredictionModel } from './PredictionModel.js';
import { VolatilityModel } from './VolatilityModel.js';
import { LiquidityModel } from './LiquidityModel.js';
export declare class PredictionEngine {
    private predictionModel;
    private volatilityModel;
    private liquidityModel;
    private logger;
    constructor(context: ContextStore, metrics: Metrics);
    getPredictionModel(): PredictionModel;
    getVolatilityModel(): VolatilityModel;
    getLiquidityModel(): LiquidityModel;
}
export declare const createPredictionEngine: (context: ContextStore, metrics: Metrics) => PredictionEngine;
//# sourceMappingURL=Index.d.ts.map