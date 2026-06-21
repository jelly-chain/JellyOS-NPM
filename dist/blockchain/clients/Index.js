import { AlchemyClient } from './AlchemyClient.js';
import { SolanaClient } from './SolanaClient.js';
import { CosmosClient } from './CosmosClient.js';
export { AlchemyClient } from './AlchemyClient.js';
export { SolanaClient } from './SolanaClient.js';
export { CosmosClient } from './CosmosClient.js';
export class ChainClientFactory {
    static createChainClient(chain, config) {
        switch (chain.toLowerCase()) {
            case 'ethereum':
            case 'arbitrum':
            case 'base':
            case 'optimism':
            case 'polygon':
            case 'avalanche':
            case 'fantom':
            case 'cronos':
            case 'celo':
            case 'gnosis':
            case 'scroll':
            case 'linea':
            case 'zksync':
            case 'mantle':
            case 'blast':
            case 'berachain':
            case 'opbnb':
            case 'polygonzkevm':
            case 'metis':
            case 'rootstock':
            case 'sei':
            case 'sonic':
                return new AlchemyClient({ network: `${chain}-mainnet`, ...config });
            case 'solana':
                return new SolanaClient(config?.rpcUrl);
            case 'cosmos':
                return new CosmosClient(config?.rpcUrl);
            default:
                throw new Error(`Unsupported chain: ${chain}`);
        }
    }
}
export const createClient = (chain, config) => ChainClientFactory.createChainClient(chain, config);
//# sourceMappingURL=Index.js.map