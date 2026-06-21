/**
 * Chain Configuration - Externalizable chain definitions
 * Author: BSC Team
 * Version: 1.0.0
 */
/**
 * Supported blockchain networks with metadata.
 * Loadable from config for runtime extensibility.
 */
export const CHAINS = {
    // EVM Networks
    ethereum: {
        networkId: 'eth-mainnet',
        symbol: 'ETH',
        explorerUrl: 'https://etherscan.io',
    },
    bsc: {
        networkId: 'bnb-mainnet',
        symbol: 'BNB',
        explorerUrl: 'https://bscscan.com',
    },
    arbitrum: {
        networkId: 'arb-mainnet',
        symbol: 'ETH',
        explorerUrl: 'https://arbiscan.io',
    },
    base: {
        networkId: 'base-mainnet',
        symbol: 'ETH',
        explorerUrl: 'https://basescan.org',
    },
    polygon: {
        networkId: 'polygon-mainnet',
        symbol: 'MATIC',
        explorerUrl: 'https://polygonscan.com',
    },
    avalanche: {
        networkId: 'avax-mainnet',
        symbol: 'AVAX',
        explorerUrl: 'https://snowtrace.io',
    },
    optimism: {
        networkId: 'opt-mainnet',
        symbol: 'ETH',
        explorerUrl: 'https://optimistic.etherscan.io',
    },
    fantom: {
        networkId: 'fantom-mainnet',
        symbol: 'FTM',
        explorerUrl: 'https://ftmscan.com',
    },
    gnosis: {
        networkId: 'gnosis-mainnet',
        symbol: 'xDAI',
        explorerUrl: 'https://gnosisscan.io',
    },
    scroll: {
        networkId: 'scroll-mainnet',
        symbol: 'ETH',
        explorerUrl: 'https://scrollscan.com',
    },
    linea: {
        networkId: 'linea-mainnet',
        symbol: 'ETH',
        explorerUrl: 'https://lineascan.build',
    },
    zksync: {
        networkId: 'zksync-mainnet',
        symbol: 'ETH',
        explorerUrl: 'https://explorer.zksync.io',
    },
    mantle: {
        networkId: 'mantle-mainnet',
        symbol: 'MNT',
        explorerUrl: 'https://mantlescan.xyz',
    },
    blast: {
        networkId: 'blast-mainnet',
        symbol: 'ETH',
        explorerUrl: 'https://blastscan.io',
    },
    celo: {
        networkId: 'celo-mainnet',
        symbol: 'CELO',
        explorerUrl: 'https://celoscan.io',
    },
    // Non-EVM
    solana: {
        symbol: 'SOL',
        explorerUrl: 'https://solscan.io',
    },
    cosmos: {
        symbol: 'ATOM',
        explorerUrl: 'https://mintscan.net',
    },
};
export const EVM_CHAINS = new Set(['ethereum', 'bsc', 'arbitrum', 'base', 'polygon', 'avalanche', 'optimism', 'fantom', 'gnosis', 'scroll', 'linea', 'zksync', 'mantle', 'blast', 'celo']);
export function getNetworkId(chain) {
    const c = CHAINS[chain];
    return c?.networkId ?? (EVM_CHAINS.has(chain) ? `${chain}-mainnet` : undefined);
}
export function getSymbol(chain) {
    return CHAINS[chain]?.symbol ?? 'ETH';
}
export function getExplorerUrl(chain, txHash) {
    const base = CHAINS[chain]?.explorerUrl ?? 'https://etherscan.io';
    return txHash ? `${base}/tx/${txHash}` : base;
}
//# sourceMappingURL=chains.js.map