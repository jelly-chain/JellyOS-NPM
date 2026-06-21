/**
 * WalletManager — generates and stores keypairs for EVM, Solana, and Cosmos.
 *
 * EVM    : secp256k1 via Node.js ECDH; address derived with keccak256 (ethers.js) + EIP-55 checksum
 * Solana : @solana/web3.js Keypair — Ed25519 native; address = base58-encoded public key
 * Cosmos : Ed25519 via Node.js crypto; address = bech32("cosmos", sha256(ripemd160(pubKey)))
 *
 * Signing:
 *   EVM    : ECDSA personal_sign prefix + keccak256 (ethers.Wallet.signMessage)
 *   Solana : Ed25519 over raw bytes
 *   Cosmos : Ed25519 over SHA256(bytes)
 *
 * Storage:
 *   Private keys are encrypted at rest with AES-256-GCM + Argon2id KDF.
 *   Only public metadata (address, publicKey) is kept in memory after load.
 *   unlock() is required to decrypt the private key for signing.
 */
export interface WalletInfo {
    chain: string;
    address: string;
    privateKey: string;
    publicKey: string;
    keyType: 'secp256k1' | 'ed25519';
    createdAt: number;
}
export declare class WalletManager {
    private walletsDir;
    private wallets;
    private passphrase;
    constructor(jellyHome: string);
    setPassphrase(passphrase: string): void;
    private static deriveWalletKey;
    private static encryptData;
    private static decryptData;
    private generateEVMWallet;
    private generateSolanaWallet;
    private generateCosmosWallet;
    /**
     * Sign a message or payload. For encrypted wallets, unlock() must be called
     * first or the privateKey field will be '[encrypted]' and this will throw.
     */
    signMessage(chain: string, data: string): string | null;
    generateAll(): Promise<void>;
    create(chain: string, passphrase?: string): Promise<WalletInfo>;
    private saveEncrypted;
    /**
     * Unlock a wallet for signing. Decrypts the private key into memory
     * and returns the full WalletInfo. Returns null on wrong passphrase.
     */
    unlock(chain: string, passphrase: string): Promise<WalletInfo | null>;
    /**
     * Lock a wallet — zeroes the private key from memory.
     */
    lock(chain: string): void;
    getAddress(chain: string): string | null;
    getSummary(): Record<string, string>;
    getStats(): {
        chains: string[];
        count: number;
    };
    hasWallets(): boolean;
    isLocked(chain: string): boolean;
    private normalizeChain;
    private loadAll;
}
//# sourceMappingURL=WalletManager.d.ts.map