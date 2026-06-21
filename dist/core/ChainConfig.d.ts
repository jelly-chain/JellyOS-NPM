export interface ChainInfo {
    name: string;
    alchemyNetwork: string;
    symbol: string;
    chainId: number;
    enabled: boolean;
}
export declare const CHAINS: Record<string, ChainInfo>;
/**
 * Map of chain key → Alchemy network string.
 * Derived from CHAINS so it can never drift out of sync.
 */
export declare const ALCHEMY_NETWORKS: Record<string, string>;
/**
 * Check whether a chain key is supported by Alchemy.
 * Derives from CHAINS + known extras so it can never drift.
 */
export declare function isAlchemySupported(chain: string): boolean;
export declare const CHAIN_NETWORKS: Record<string, string>;
export declare const CHAIN_SYMBOLS: Record<string, string>;
export declare function getAlchemyNetwork(chain: string): string;
export declare function getChainSymbol(chain: string): string;
export declare function getSupportedChains(): string[];
//# sourceMappingURL=ChainConfig.d.ts.map