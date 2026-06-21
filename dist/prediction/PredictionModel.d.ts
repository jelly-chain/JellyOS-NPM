import { ContextStore } from '../context/ContextStore.js';
import { Metrics } from '../core/utils/Metrics.js';
export interface PredictionInput {
    symbol: string;
    prices: number[];
    volume: number[];
    indicators: Record<string, any>;
    timeframe: string;
}
export interface PredictionOutput {
    symbol: string;
    direction: 'up' | 'down' | 'sideways';
    probability: number;
    targetPrice: number;
    confidence: number;
    timeframe: string;
    factors: Array<{
        name: string;
        impact: number;
        direction: string;
    }>;
    timestamp: number;
}
export interface ModelConfig {
    horizon: number;
    confidenceThreshold: number;
    useEnsemble: boolean;
    weights: Record<string, number>;
}
export declare class PredictionModel {
    private logger;
    private context;
    private metrics;
    private config;
    private predictionCache;
    private modelPerformance;
    private ensembleWeights;
    constructor(context: ContextStore, metrics: Metrics, config?: Partial<ModelConfig>);
    private initializeWeights;
    predict(input: PredictionInput): Promise<PredictionOutput>;
    private createDefaultPrediction;
    private predictTrend;
    private calculateMomentum;
    private calculateVolatilityImpact;
    private analyzeVolume;
    private analyzeSentiment;
    private determineDirection;
    private calculateProbability;
    private calculateTargetPrice;
    private calculateConfidence;
    predictEnsemble(input: PredictionInput): Promise<PredictionOutput[]>;
    private predictWithMethod;
    backtest(symbol: string, prices: number[][], horizon: number): Promise<any>;
    private calculateSMA;
    private calculateMACD;
    private calculateEMA;
    getConfig(): ModelConfig;
    setWeights(weights: Record<string, number>): void;
    resetCache(): void;
}
//# sourceMappingURL=PredictionModel.d.ts.map