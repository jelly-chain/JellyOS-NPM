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

export class BlockchainOrchestrator {
  private manager: BlockchainManager;
  private markets: PredictionMarketAggregator;

  constructor(metrics: Metrics) {
    this.manager = new BlockchainManager(metrics);
    this.markets = new PredictionMarketAggregator();
  }

  getManager(): BlockchainManager { return this.manager; }
  getMarkets(): PredictionMarketAggregator { return this.markets; }
  getSupportedChains(): string[] { return this.manager.getAllChains().map(c => c.name); }
}

export const createBlockchainOrchestrator = (metrics: Metrics) => new BlockchainOrchestrator(metrics);