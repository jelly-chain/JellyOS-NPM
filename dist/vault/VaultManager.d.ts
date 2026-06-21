export interface VaultData {
    balance: number;
    currency: string;
    entries: VaultEntry[];
    createdAt: number;
    updatedAt: number;
}
export interface VaultEntry {
    amount: number;
    note: string;
    timestamp: number;
    txHash?: string;
}
export declare class VaultManager {
    private vaultPath;
    private vaultDir;
    private data;
    private locked;
    private key;
    private salt;
    constructor(repoRoot: string);
    exists(): boolean;
    isLocked(): boolean;
    create(passphrase: string): Promise<void>;
    /**
     * Reads the kdf field from the vault file, then derives the key with the
     * correct algorithm (argon2id for v4+ vaults, scrypt for legacy vaults).
     * Throws on wrong passphrase (GCM auth failure).
     */
    unlock(passphrase: string): Promise<boolean>;
    lock(): void;
    sweep(amount: number, note?: string, txHash?: string): Promise<void>;
    withdraw(amount: number, note?: string): Promise<void>;
    getBalance(): number;
    getStats(): any;
    getHistory(): VaultEntry[];
    private requireUnlocked;
    /** Argon2id KDF — used for all new vaults (v4+) */
    private deriveArgon2id;
    /** scrypt KDF — kept only to read legacy vaults (v1–v3) */
    private deriveScrypt;
    /** Encrypt this.data with Argon2id-derived key, write vault file. */
    private persist;
    /** Decrypt with given key; throws on GCM authentication failure. */
    private decryptWith;
}
//# sourceMappingURL=VaultManager.d.ts.map