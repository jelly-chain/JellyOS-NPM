export { BlockchainManager } from './BlockchainManager.js';
export { AlchemyClient } from './clients/AlchemyClient.js';
export { SolanaClient } from './clients/SolanaClient.js';
export { CosmosClient } from './clients/CosmosClient.js';
export { ChainClientFactory } from './clients/Index.js';
export { PolymarketClient } from './prediction-markets/PolymarketClient.js';
export { KalshiClient } from './prediction-markets/KalshiClient.js';
export { JupiterClient } from './prediction-markets/JupiterClient.js';
export { PredictionMarketAggregator } from './prediction-markets/Index.js';
import { BlockchainManager } from './BlockchainManager.js';
import { PredictionMarketAggregator } from './prediction-markets/Index.js';
export class BlockchainOrchestrator {
    manager;
    markets;
    constructor(metrics) {
        this.manager = new BlockchainManager(metrics);
        this.markets = new PredictionMarketAggregator();
    }
    getManager() { return this.manager; }
    getMarkets() { return this.markets; }
    getSupportedChains() { return this.manager.getAllChains().map(c => c.name); }
}
export const createBlockchainOrchestrator = (metrics) => new BlockchainOrchestrator(metrics);
//# sourceMappingURL=Index.js.map