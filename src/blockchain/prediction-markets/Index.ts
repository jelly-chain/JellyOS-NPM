import { Logger } from '../../core/utils/Logger.js';

import { KalshiClient, KalshiEvent, KalshiMarket } from './KalshiClient.js';
import { PolymarketClient, PolymarketMarket } from './PolymarketClient.js';
import { JupiterClient, JupiterQuote, JupiterRoute, JupiterStep } from './JupiterClient.js';
import { ManifoldClient, ManifoldMarket } from './ManifoldClient.js';
export { KalshiClient, KalshiEvent, KalshiMarket } from './KalshiClient.js';
export { PolymarketClient, PolymarketMarket } from './PolymarketClient.js';
export { JupiterClient, JupiterQuote, JupiterRoute, JupiterStep } from './JupiterClient.js';
export { ManifoldClient, ManifoldMarket } from './ManifoldClient.js';

export class PredictionMarketAggregator {
  private polymarket: PolymarketClient;
  private kalshi: KalshiClient;
  private jupiter: JupiterClient;
  private manifold: ManifoldClient;

  constructor() {
    this.polymarket = new PolymarketClient();
    this.kalshi = new KalshiClient();
    this.jupiter = new JupiterClient();
    this.manifold = new ManifoldClient();
  }

  getPolymarket(): PolymarketClient { return this.polymarket; }
  getKalshi(): KalshiClient { return this.kalshi; }
  getJupiter(): JupiterClient { return this.jupiter; }
  getManifold(): ManifoldClient { return this.manifold; }

  async getAllMarkets(): Promise<any[]> {
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

  async getTopVolume(limit: number = 20): Promise<any[]> {
    const markets = await this.getAllMarkets();
    return markets.sort((a, b) => {
      const aVol = parseFloat(a.volume || a.volume || '0');
      const bVol = parseFloat(b.volume || b.volume || '0');
      return bVol - aVol;
    }).slice(0, limit);
  }
}

export const createAggregator = () => new PredictionMarketAggregator();