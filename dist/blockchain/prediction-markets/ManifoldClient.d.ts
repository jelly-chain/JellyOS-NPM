export interface ManifoldMarket {
    id: string;
    question: string;
    probability: number;
    volume: number;
    closeTime: string;
    resolution: string;
    outcomes: string[];
}
export declare class ManifoldClient {
    private logger;
    private baseUrl;
    private apiKey?;
    constructor();
    getMarkets(limit?: number): Promise<ManifoldMarket[]>;
    searchMarkets(query: string): Promise<ManifoldMarket[]>;
    bet(marketId: string, outcome: 'YES' | 'NO', amount: number): Promise<any>;
    search(query: string): Promise<any[]>;
}
export declare const manifoldClient: ManifoldClient;
//# sourceMappingURL=ManifoldClient.d.ts.map