import { Metrics } from '../core/utils/Metrics.js';
export interface ChainConfig {
    name: string;
    rpcUrl: string;
    explorerUrl: string;
    chainId: number;
    nativeCurrency: string;
    decimals: number;
    enabled: boolean;
}
export declare class BlockchainManager {
    private logger;
    private metrics;
    private chains;
    private clients;
    constructor(metrics: Metrics);
    private registerDefaultChains;
    getChain(name: string): ChainConfig | undefined;
    getEnabledChains(): ChainConfig[];
    getAllChains(): ChainConfig[];
    enableChain(name: string): void;
    disableChain(name: string): void;
    setRpcUrl(name: string, url: string): void;
    getBalances(addresses: string[], chain?: string): Promise<Record<string, any>>;
    getTokenBalances(addresses: string[], chain: string): Promise<Record<string, any>>;
    getGasPrices(networks: string[]): Promise<Record<string, any>>;
    getNetworkStatus(networks: string[]): Promise<Record<string, any>>;
    detectLargeTransactions(networks: string[], threshold: number): Promise<any[]>;
    detectWhaleTrades(networks: string[], minValue: number): Promise<any[]>;
    detectUnusualWalletActivity(networks: string[]): Promise<any[]>;
    getTopTokenTransfers(networks: string[], limit: number): Promise<any[]>;
    analyzeWhaleWallets(networks: string[], limit: number): Promise<any[]>;
    getActivePredictionMarkets(marketplaces: string[]): Promise<any[]>;
    getPredictionMarketVolume(marketplaces: string[]): Promise<Record<string, number>>;
    getRecentOddsChanges(marketplaces: string[], limit: number): Promise<any[]>;
    getPredictionMarketLiquidity(marketplaces: string[]): Promise<Record<string, number>>;
    getContractEvents(contracts: any[], fromBlock?: number): Promise<any[]>;
    getCurrentBlock(chain?: string): Promise<number>;
    getNetworkCongestion(networks: string[]): Promise<Record<string, any>>;
    getGasEstimates(networks: string[]): Promise<Record<string, any>>;
    getHistoricalGasTrends(networks: string[]): Promise<Record<string, any>>;
}
//# sourceMappingURL=BlockchainManager.d.ts.map