/**
 * Chain Configuration - Externalizable chain definitions
 * Author: BSC Team
 * Version: 1.0.0
 */
export interface ChainConfig {
    name?: string;
    networkId?: string;
    symbol: string;
    rpcPattern?: string;
    explorerUrl?: string;
    disabled?: boolean;
}
/**
 * Supported blockchain networks with metadata.
 * Loadable from config for runtime extensibility.
 */
export declare const CHAINS: Record<string, ChainConfig>;
export declare const EVM_CHAINS: Set<string>;
export declare function getNetworkId(chain: string): string | undefined;
export declare function getSymbol(chain: string): string;
export declare function getExplorerUrl(chain: string, txHash?: string): string;
//# sourceMappingURL=chains.d.ts.map