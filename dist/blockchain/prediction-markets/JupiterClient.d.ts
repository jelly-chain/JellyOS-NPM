export interface JupiterQuote {
    inAmount: string;
    outAmount: string;
    route: any;
    slippage: number;
    fee: number;
    priceImpact: number;
}
export interface JupiterRoute {
    id: string;
    inAmount: string;
    outAmount: string;
    steps: JupiterStep[];
    swapCount: number;
}
export interface JupiterStep {
    protocol: string;
    fromToken: string;
    toToken: string;
    poolAddress: string;
    amount: string;
}
export declare class JupiterClient {
    private logger;
    private baseUrl;
    constructor();
    private api;
    getQuote(inputMint: string, outputMint: string, amount: string, slippageBps?: number): Promise<JupiterQuote | null>;
    private parseQuote;
    getRoutes(inputMint: string, outputMint: string, amount: string): Promise<JupiterRoute[]>;
    getTokenList(): Promise<any[]>;
    getPrice(tokenAddress: string): Promise<number | null>;
    getIndexedRoutes(inputMint: string, outputMint: string, amount: string): Promise<any[]>;
}
//# sourceMappingURL=JupiterClient.d.ts.map