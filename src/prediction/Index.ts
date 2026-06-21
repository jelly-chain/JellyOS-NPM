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

export class PredictionEngine {
  private predictionModel: PredictionModel;
  private volatilityModel: VolatilityModel;
  private liquidityModel: LiquidityModel;
  private logger: any;

  constructor(context: ContextStore, metrics: Metrics) {
    this.predictionModel = new PredictionModel(context, metrics);
    this.volatilityModel = new VolatilityModel(metrics);
    this.liquidityModel = new LiquidityModel(metrics);
    this.logger = { info: (msg: string) => console.log(`[PredictionEngine] ${msg}`) };
  }

  getPredictionModel(): PredictionModel { return this.predictionModel; }
  getVolatilityModel(): VolatilityModel { return this.volatilityModel; }
  getLiquidityModel(): LiquidityModel { return this.liquidityModel; }
}

export const createPredictionEngine = (context: ContextStore, metrics: Metrics) => new PredictionEngine(context, metrics);