import { Logger } from '../../core/utils/Logger.js';
export class ManifoldClient {
    logger;
    baseUrl = 'https://api.manifold.xyz/v0';
    apiKey;
    constructor() {
        this.logger = new Logger('ManifoldClient');
        this.apiKey = process.env.MANIFOLD_API_KEY;
    }
    async getMarkets(limit = 20) {
        try {
            const res = await fetch(`${this.baseUrl}/markets?limit=${limit}`);
            const data = await res.json();
            return (data || []).map((m) => ({
                id: m.id, question: m.question, probability: m.probability || 0.5,
                volume: m.volume || 0, closeTime: m.closeTime, resolution: m.resolution,
                outcomes: ['YES', 'NO'],
            }));
        }
        catch (e) {
            this.logger.error('Failed to fetch Manifold markets', e);
            return [];
        }
    }
    async searchMarkets(query) {
        try {
            const res = await fetch(`${this.baseUrl}/search-markets?query=${encodeURIComponent(query)}&limit=20`);
            const data = await res.json();
            return (data || []).map((m) => ({
                id: m.id, question: m.question, probability: m.probability || 0.5,
                volume: m.volume || 0, closeTime: m.closeTime, resolution: m.resolution,
                outcomes: ['YES', 'NO'],
            }));
        }
        catch {
            return [];
        }
    }
    async bet(marketId, outcome, amount) {
        if (!this.apiKey) {
            this.logger.warn('MANIFOLD_API_KEY not set');
            return null;
        }
        try {
            const res = await fetch(`${this.baseUrl}/bet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${this.apiKey}` },
                body: JSON.stringify({ contractId: marketId, outcome, amount }),
            });
            return await res.json();
        }
        catch (e) {
            this.logger.error('Failed to place Manifold bet', e);
            return null;
        }
    }
    async search(query) {
        return this.searchMarkets(query);
    }
}
export const manifoldClient = new ManifoldClient();
//# sourceMappingURL=ManifoldClient.js.map