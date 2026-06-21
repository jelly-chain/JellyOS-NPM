export interface VaultAddresses {
    evm: string;
    solana: string;
    cosmos: string;
    generatedAt: number;
}
/**
 * Run the vault key ceremony.
 * - If vault-addresses.json already exists, skips ceremony and returns stored addresses.
 * - Otherwise generates keypairs, shows them until user confirms saved, then saves public addresses only.
 */
export declare function runVaultCeremony(jellyHome: string): Promise<VaultAddresses>;
//# sourceMappingURL=vault-ceremony.d.ts.map