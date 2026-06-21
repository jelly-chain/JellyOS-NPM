export { PredictionModel } from './PredictionModel.js';
export { VolatilityModel } from './VolatilityModel.js';
export { LiquidityModel } from './LiquidityModel.js';
import { PredictionModel } from './PredictionModel.js';
import { VolatilityModel } from './VolatilityModel.js';
import { LiquidityModel } from './LiquidityModel.js';
export class PredictionEngine {
    predictionModel;
    volatilityModel;
    liquidityModel;
    logger;
    constructor(context, metrics) {
        this.predictionModel = new PredictionModel(context, metrics);
        this.volatilityModel = new VolatilityModel(metrics);
        this.liquidityModel = new LiquidityModel(metrics);
        this.logger = { info: (msg) => console.log(`[PredictionEngine] ${msg}`) };
    }
    getPredictionModel() { return this.predictionModel; }
    getVolatilityModel() { return this.volatilityModel; }
    getLiquidityModel() { return this.liquidityModel; }
}
export const createPredictionEngine = (context, metrics) => new PredictionEngine(context, metrics);
//# sourceMappingURL=Index.js.map