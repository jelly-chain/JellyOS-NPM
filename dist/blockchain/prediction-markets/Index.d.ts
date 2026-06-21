import { KalshiClient } from './KalshiClient.js';
import { PolymarketClient } from './PolymarketClient.js';
import { JupiterClient } from './JupiterClient.js';
import { ManifoldClient } from './ManifoldClient.js';
export { KalshiClient, KalshiEvent, KalshiMarket } from './KalshiClient.js';
export { PolymarketClient, PolymarketMarket } from './PolymarketClient.js';
export { JupiterClient, JupiterQuote, JupiterRoute, JupiterStep } from './JupiterClient.js';
export { ManifoldClient, ManifoldMarket } from './ManifoldClient.js';
export declare class PredictionMarketAggregator {
    private polymarket;
    private kalshi;
    private jupiter;
    private manifold;
    constructor();
    getPolymarket(): PolymarketClient;
    getKalshi(): KalshiClient;
    getJupiter(): JupiterClient;
    getManifold(): ManifoldClient;
    getAllMarkets(): Promise<any[]>;
    getTopVolume(limit?: number): Promise<any[]>;
}
export declare const createAggregator: () => PredictionMarketAggregator;
//# sourceMappingURL=Index.d.ts.map