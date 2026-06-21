export interface KalshiEvent {
    id: string;
    title: string;
    subtitle: string;
    status: string;
    openTime: string;
    closeTime: string;
    markets: KalshiMarket[];
}
export interface KalshiMarket {
    id: string;
    title: string;
    subtitle: string;
    yesAsk: number;
    yesBid: number;
    noAsk: number;
    noBid: number;
    volume: number;
    openInterest: number;
}
export declare class KalshiClient {
    private logger;
    private baseUrl;
    constructor();
    private api;
    getEvents(status?: string): Promise<KalshiEvent[]>;
    getMarket(marketId: string): Promise<KalshiMarket | null>;
    getMarketHistory(marketId: string): Promise<any[]>;
    getPrice(marketId: string): Promise<{
        yes: number;
        no: number;
    }>;
    searchEvents(query: string): Promise<KalshiEvent[]>;
    private signRequest;
    private getAuthHeaders;
    placeOrder(ticker: string, side: 'yes' | 'no', count: number, price: number): Promise<any>;
    getBalance(): Promise<{
        balance: number;
        available: number;
    }>;
    getPositions(): Promise<any[]>;
}
//# sourceMappingURL=KalshiClient.d.ts.map