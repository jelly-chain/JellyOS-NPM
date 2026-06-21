export declare class CosmosClient {
    private logger;
    private rpcUrl;
    constructor(rpcUrl?: string);
    private rest;
    getBalance(address: string, denom?: string): Promise<any>;
    getAllBalances(address: string): Promise<any>;
    getAccount(address: string): Promise<any>;
    getLatestBlock(): Promise<any>;
    getBlockByHeight(height: number): Promise<any>;
    getValidators(): Promise<any>;
    getDelegations(delegator: string): Promise<any>;
    getUnbondingDelegations(delegator: string): Promise<any>;
    getProposals(): Promise<any>;
    getProposal(id: number): Promise<any>;
    getVotes(proposalId: number): Promise<any>;
    getInflation(): Promise<any>;
    getSupply(): Promise<any>;
    getStakingPool(): Promise<any>;
    getNodeInfo(): Promise<any>;
    getTx(hash: string): Promise<any>;
    getTxsByEvent(event: string, limit?: number): Promise<any>;
    getIbcDenoms(): Promise<any>;
    getValidatorsDelegations(): Promise<any>;
}
//# sourceMappingURL=CosmosClient.d.ts.map