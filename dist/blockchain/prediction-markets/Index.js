import { KalshiClient } from './KalshiClient.js';
import { PolymarketClient } from './PolymarketClient.js';
import { JupiterClient } from './JupiterClient.js';
import { ManifoldClient } from './ManifoldClient.js';
export { KalshiClient } from './KalshiClient.js';
export { PolymarketClient } from './PolymarketClient.js';
export { JupiterClient } from './JupiterClient.js';
export { ManifoldClient } from './ManifoldClient.js';
export class PredictionMarketAggregator {
    polymarket;
    kalshi;
    jupiter;
    manifold;
    constructor() {
        this.polymarket = new PolymarketClient();
        this.kalshi = new KalshiClient();
        this.jupiter = new JupiterClient();
        this.manifold = new ManifoldClient();
    }
    getPolymarket() { return this.polymarket; }
    getKalshi() { return this.kalshi; }
    getJupiter() { return this.jupiter; }
    getManifold() { return this.manifold; }
    async getAllMarkets() {
        const [polymarkets, kalshiEvents, manifoldMarkets] = await Promise.all([
            this.polymarket.getMarkets().catch(() => []),
            this.kalshi.getEvents().catch(() => []),
            this.manifold.getMarkets().catch(() => []),
        ]);
        return [
            ...polymarkets,
            ...kalshiEvents.flatMap(e => e.markets),
            ...manifoldMarkets
        ];
    }
    async getTopVolume(limit = 20) {
        const markets = await this.getAllMarkets();
        return markets.sort((a, b) => {
            const aVol = parseFloat(a.volume || a.volume || '0');
            const bVol = parseFloat(b.volume || b.volume || '0');
            return bVol - aVol;
        }).slice(0, limit);
    }
}
export const createAggregator = () => new PredictionMarketAggregator();
//# sourceMappingURL=Index.js.map