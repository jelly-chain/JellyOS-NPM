export interface PolymarketMarket {
    id: string;
    question: string;
    outcomes: string[];
    outcomePrices: string[];
    volume: number;
    liquidity: number;
    closeTime: string;
    status: string;
}
export declare class PolymarketClient {
    private logger;
    private clobUrl;
    private gammaUrl;
    private apiKey?;
    private secret?;
    constructor();
    getMarkets(limit?: number, offset?: number, closed?: boolean): Promise<PolymarketMarket[]>;
    searchMarkets(query: string): Promise<PolymarketMarket[]>;
    getOrderbook(tokenId: string): Promise<{
        bids: any[];
        asks: any[];
    }>;
    getPrice(marketId: string): Promise<{
        yes: number;
        no: number;
    }>;
}
export declare const polymarketClient: PolymarketClient;
//# sourceMappingURL=PolymarketClient.d.ts.map