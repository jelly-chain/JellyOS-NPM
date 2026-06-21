import { Logger } from '../../core/utils/Logger.js';
export class PolymarketClient {
    logger;
    clobUrl = 'https://clob.polymarket.com';
    gammaUrl = 'https://gamma-api.polymarket.com';
    apiKey;
    secret;
    constructor() {
        this.logger = new Logger('PolymarketClient');
        this.apiKey = process.env.POLYMARKET_API_KEY;
        this.secret = process.env.POLYMARKET_SECRET;
    }
    async getMarkets(limit = 20, offset = 0, closed = false) {
        try {
            const res = await fetch(`${this.gammaUrl}/markets?limit=${limit}&offset=${offset}&closed=${closed}`);
            const data = await res.json();
            return (data || []).map((m) => ({
                id: m.id, question: m.question,
                outcomes: m.outcomes?.map((o) => o.outcome) || [],
                outcomePrices: m.outcomePrices || [],
                volume: parseFloat(m.volume || '0'),
                liquidity: parseFloat(m.liquidity || '0'),
                closeTime: m.closeTime, status: m.status,
            }));
        }
        catch (e) {
            this.logger.error('Failed to fetch Polymarket markets', e);
            return [];
        }
    }
    async searchMarkets(query) {
        try {
            const res = await fetch(`${this.gammaUrl}/markets?tag=${encodeURIComponent(query)}&limit=20`);
            const data = await res.json();
            return (data || []).map((m) => ({
                id: m.id, question: m.question, outcomes: m.outcomes?.map((o) => o.outcome) || [],
                outcomePrices: m.outcomePrices || [], volume: parseFloat(m.volume || '0'),
                liquidity: parseFloat(m.liquidity || '0'), closeTime: m.closeTime, status: m.status,
            }));
        }
        catch {
            return [];
        }
    }
    async getOrderbook(tokenId) {
        try {
            const res = await fetch(`${this.clobUrl}/books?token_id=${tokenId}`);
            const data = await res.json();
            return { bids: data?.bids || [], asks: data?.asks || [] };
        }
        catch {
            return { bids: [], asks: [] };
        }
    }
    async getPrice(marketId) {
        try {
            const res = await fetch(`${this.gammaUrl}/markets/${marketId}`);
            const m = await res.json();
            const prices = m.outcomePrices || ['0.5', '0.5'];
            return { yes: parseFloat(prices[0]), no: parseFloat(prices[1] || '0.5') };
        }
        catch {
            return { yes: 0.5, no: 0.5 };
        }
    }
}
export const polymarketClient = new PolymarketClient();
//# sourceMappingURL=PolymarketClient.js.map