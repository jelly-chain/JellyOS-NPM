export { AlchemyClient, AlchemyConfig } from './AlchemyClient.js';
export { SolanaClient } from './SolanaClient.js';
export { CosmosClient } from './CosmosClient.js';
export declare class ChainClientFactory {
    static createChainClient(chain: string, config?: any): any;
}
export declare const createClient: (chain: string, config?: any) => any;
//# sourceMappingURL=Index.d.ts.map