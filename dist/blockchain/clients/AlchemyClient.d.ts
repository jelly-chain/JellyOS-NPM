export interface AlchemyConfig {
    apiKey: string;
    network: string;
    maxRetries: number;
    batchSize: number;
}
export declare class AlchemyClient {
    private logger;
    private config;
    private baseUrl;
    constructor(config?: Partial<AlchemyConfig>);
    private getUrl;
    private rpc;
    getBlockNumber(): Promise<number>;
    getBalance(address: string): Promise<string>;
    getTransactionReceipt(txHash: string): Promise<any>;
    getTransaction(txHash: string): Promise<any>;
    getTokenBalances(address: string, contractAddresses: string[]): Promise<any>;
    getTokenMetadata(contractAddress: string): Promise<any>;
    getLogs(params: any): Promise<any[]>;
    getAssetTransfers(params: any): Promise<any>;
    getTokenAllowance(params: any): Promise<string>;
    simulateAssetChanges(params: any): Promise<any>;
    estimateGas(tx: any): Promise<string>;
    getGasPrice(): Promise<string>;
    getFeeHistory(blockCount: number, newestBlock: string, rewardPercentiles: number[]): Promise<any>;
    getBlockByNumber(blockNumber: number, fullTx?: boolean): Promise<any>;
    traceTransaction(txHash: string): Promise<any>;
    getContractLogs(address: string, fromBlock: number, toBlock: number): Promise<any[]>;
    getNftMetadata(contractAddress: string, tokenId: string): Promise<any>;
    getOwnedNfts(address: string): Promise<any>;
    setApiKey(apiKey: string): void;
    supportsChain(networkName: string): boolean;
}
//# sourceMappingURL=AlchemyClient.d.ts.map