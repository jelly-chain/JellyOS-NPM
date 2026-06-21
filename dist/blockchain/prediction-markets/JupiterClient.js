import { Logger } from '../../core/utils/Logger.js';
export class JupiterClient {
    logger;
    baseUrl;
    constructor() {
        this.baseUrl = 'https://quote-api.jup.ag/v6';
        this.logger = new Logger('JupiterClient');
    }
    async api(endpoint, body) {
        const options = { headers: { 'Content-Type': 'application/json' } };
        if (body) {
            options.method = 'POST';
            options.body = JSON.stringify(body);
        }
        const response = await fetch(`${this.baseUrl}${endpoint}`, options);
        return await response.json();
    }
    async getQuote(inputMint, outputMint, amount, slippageBps = 50) {
        try {
            const data = await this.api(`/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`);
            if (!data)
                return null;
            return this.parseQuote(data);
        }
        catch {
            return null;
        }
    }
    parseQuote(data) {
        return {
            inAmount: data.inAmount || '0',
            outAmount: data.outAmount || '0',
            route: data.routePlan || [],
            slippage: data.slippageBps || 0,
            fee: data.fee || 0,
            priceImpact: data.priceImpactPct || 0,
        };
    }
    async getRoutes(inputMint, outputMint, amount) {
        try {
            const data = await this.api(`/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}`);
            if (!data)
                return [];
            return [{
                    id: `route-${Date.now()}`,
                    inAmount: data.inAmount || '0',
                    outAmount: data.outAmount || '0',
                    steps: (data.routePlan || []).map((step) => ({
                        protocol: step.pool || 'unknown',
                        fromToken: inputMint,
                        toToken: outputMint,
                        poolAddress: step.pool || '',
                        amount: data.inAmount || '0',
                    })),
                    swapCount: data.routePlan?.length || 0,
                }];
        }
        catch {
            return [];
        }
    }
    async getTokenList() {
        try {
            const data = await this.api('/tokens');
            return data || [];
        }
        catch {
            return [];
        }
    }
    async getPrice(tokenAddress) {
        try {
            const quotes = await this.getQuote(tokenAddress, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', '1000000');
            if (!quotes)
                return null;
            return 1 / (parseFloat(quotes.outAmount) / 1000000);
        }
        catch {
            return null;
        }
    }
    async getIndexedRoutes(inputMint, outputMint, amount) {
        try {
            return await this.api(`/indexed-route?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}`) || [];
        }
        catch {
            return [];
        }
    }
}
//# sourceMappingURL=JupiterClient.js.map