export declare class SolanaClient {
    private logger;
    private rpcUrl;
    private commitment;
    constructor(rpcUrl?: string);
    setRpcUrl(url: string): void;
    private rpc;
    getBalance(address: string): Promise<number>;
    getTokenAccountBalance(tokenAccount: string): Promise<any>;
    getTokenAccountsByOwner(owner: string, mint?: string): Promise<any>;
    getRecentBlockhash(): Promise<string>;
    getBlock(blockNumber: number): Promise<any>;
    getTransaction(txSignature: string): Promise<any>;
    getSignaturesForAddress(address: string, limit?: number): Promise<any[]>;
    sendTransaction(tx: string): Promise<string>;
    simulateTransaction(tx: string): Promise<any>;
    getAccountInfo(address: string): Promise<any>;
    getProgramAccounts(programId: string): Promise<any[]>;
    getMultipleAccounts(addresses: string[]): Promise<any[]>;
    getSlot(): Promise<number>;
    getEpochInfo(): Promise<any>;
    getSupply(): Promise<any>;
    getInflationRate(): Promise<any>;
    requestAirdrop(address: string, lamports: number): Promise<string>;
    getMinimumBalanceForRentExemption(dataLength: number): Promise<number>;
    getLatestBlockhash(): Promise<any>;
}
//# sourceMappingURL=SolanaClient.d.ts.map