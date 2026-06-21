export { BlockchainManager, ChainConfig } from './BlockchainManager.js';
export { AlchemyClient } from './clients/AlchemyClient.js';
export { SolanaClient } from './clients/SolanaClient.js';
export { CosmosClient } from './clients/CosmosClient.js';
export { ChainClientFactory } from './clients/Index.js';
export { PolymarketClient } from './prediction-markets/PolymarketClient.js';
export { KalshiClient } from './prediction-markets/KalshiClient.js';
export { JupiterClient } from './prediction-markets/JupiterClient.js';
export { PredictionMarketAggregator } from './prediction-markets/Index.js';
import { Metrics } from '../core/utils/Metrics.js';
import { BlockchainManager } from './BlockchainManager.js';
import { PredictionMarketAggregator } from './prediction-markets/Index.js';
export declare class BlockchainOrchestrator {
    private manager;
    private markets;
    constructor(metrics: Metrics);
    getManager(): BlockchainManager;
    getMarkets(): PredictionMarketAggregator;
    getSupportedChains(): string[];
}
export declare const createBlockchainOrchestrator: (metrics: Metrics) => BlockchainOrchestrator;
//# sourceMappingURL=Index.d.ts.map