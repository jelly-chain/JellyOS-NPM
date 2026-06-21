/**
 * VaultManager — AES-256-GCM encrypted profit vault.
 *
 * KDF: Argon2id (argon2 npm package) for new vaults.
 *      Existing vaults created with scrypt are still readable (backward compat).
 *      The kdf field in the vault file determines which path unlock() uses.
 *
 * Storage: vault/ at the repo/project root (gitignored via vault/ rule in .gitignore).
 *
 * Encryption: AES-256-GCM with a random 12-byte IV per write. The same salt that was used
 * to derive the key is persisted in the vault file, ensuring unlock() always recovers the
 * same key from the same passphrase.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
const VAULT_VERSION = 4;
const KEY_LENGTH = 32;
// Argon2id parameters (OWASP recommended minimum)
const ARGON2_TIME_COST = 3;
const ARGON2_MEMORY_COST = 65536; // 64 MiB
const ARGON2_PARALLELISM = 4;
// scrypt params kept for reading legacy vaults
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
export class VaultManager {
    vaultPath;
    vaultDir;
    data = null;
    locked = true;
    key = null;
    salt = null;
    constructor(repoRoot) {
        this.vaultDir = resolve(repoRoot, 'vault');
        this.vaultPath = resolve(this.vaultDir, 'profits.vault');
        if (!existsSync(this.vaultDir))
            mkdirSync(this.vaultDir, { recursive: true });
    }
    exists() { return existsSync(this.vaultPath); }
    isLocked() { return this.locked; }
    // ── Lifecycle ────────────────────────────────────────────────────────────
    async create(passphrase) {
        if (this.exists())
            throw new Error('Vault already exists. Use unlock() to open it.');
        this.salt = crypto.randomBytes(32);
        this.key = await this.deriveArgon2id(passphrase, this.salt);
        this.data = {
            balance: 0, currency: 'USD', entries: [],
            createdAt: Date.now(), updatedAt: Date.now(),
        };
        this.locked = false;
        await this.persist();
    }
    /**
     * Reads the kdf field from the vault file, then derives the key with the
     * correct algorithm (argon2id for v4+ vaults, scrypt for legacy vaults).
     * Throws on wrong passphrase (GCM auth failure).
     */
    async unlock(passphrase) {
        if (!this.exists())
            throw new Error('Vault does not exist. Run `jellyos setup` first.');
        try {
            const raw = JSON.parse(readFileSync(this.vaultPath, 'utf-8'));
            const fileSalt = Buffer.from(raw.salt, 'hex');
            let candidateKey;
            if (raw.kdf === 'argon2id') {
                candidateKey = await this.deriveArgon2id(passphrase, fileSalt, raw.timeCost ?? ARGON2_TIME_COST, raw.memoryCost ?? ARGON2_MEMORY_COST, raw.parallelism ?? ARGON2_PARALLELISM);
            }
            else {
                // Legacy scrypt vault — keep reading, prompt migration on next save
                candidateKey = await this.deriveScrypt(passphrase, fileSalt, raw.N ?? SCRYPT_N, raw.r ?? SCRYPT_R, raw.p ?? SCRYPT_P);
            }
            const data = this.decryptWith(candidateKey, raw); // throws on GCM auth fail
            this.salt = fileSalt;
            this.key = candidateKey;
            this.data = data;
            this.locked = false;
            return true;
        }
        catch {
            this.key = null;
            this.salt = null;
            this.locked = true;
            return false;
        }
    }
    lock() {
        this.key = null;
        this.salt = null;
        this.data = null;
        this.locked = true;
    }
    // ── Operations ───────────────────────────────────────────────────────────
    async sweep(amount, note = 'auto-sweep', txHash) {
        this.requireUnlocked();
        this.data.balance += amount;
        this.data.entries.push({ amount, note, timestamp: Date.now(), txHash });
        this.data.updatedAt = Date.now();
        await this.persist();
    }
    async withdraw(amount, note = 'withdrawal') {
        this.requireUnlocked();
        if (amount > this.data.balance)
            throw new Error('Insufficient vault balance');
        this.data.balance -= amount;
        this.data.entries.push({ amount: -amount, note, timestamp: Date.now() });
        this.data.updatedAt = Date.now();
        await this.persist();
    }
    getBalance() { this.requireUnlocked(); return this.data.balance; }
    getStats() {
        if (this.locked)
            return { locked: true, balance: '****', entries: 0 };
        return {
            locked: false,
            balance: this.data.balance,
            currency: this.data.currency,
            entries: this.data.entries.length,
            createdAt: this.data.createdAt,
            updatedAt: this.data.updatedAt,
        };
    }
    getHistory() {
        this.requireUnlocked();
        return [...this.data.entries].reverse().slice(0, 50);
    }
    // ── Private helpers ───────────────────────────────────────────────────────
    requireUnlocked() {
        if (this.locked || !this.data || !this.key) {
            throw new Error('Vault is locked. Use /unlock <passphrase>.');
        }
    }
    /** Argon2id KDF — used for all new vaults (v4+) */
    async deriveArgon2id(passphrase, salt, timeCost = ARGON2_TIME_COST, memoryCost = ARGON2_MEMORY_COST, parallelism = ARGON2_PARALLELISM) {
        const hash = await argon2.hash(passphrase, {
            type: argon2.argon2id,
            salt,
            timeCost,
            memoryCost,
            parallelism,
            hashLength: KEY_LENGTH,
            raw: true,
        });
        return hash;
    }
    /** scrypt KDF — kept only to read legacy vaults (v1–v3) */
    deriveScrypt(passphrase, salt, N = SCRYPT_N, r = SCRYPT_R, p = SCRYPT_P) {
        return new Promise((resolve, reject) => {
            crypto.scrypt(passphrase, salt, KEY_LENGTH, { N, r, p }, (err, key) => {
                if (err)
                    reject(err);
                else
                    resolve(key);
            });
        });
    }
    /** Encrypt this.data with Argon2id-derived key, write vault file. */
    async persist() {
        if (!this.key || !this.salt)
            throw new Error('Vault not initialised — call create() or unlock() first.');
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
        const plaintext = JSON.stringify(this.data);
        const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        const file = {
            version: VAULT_VERSION,
            kdf: 'argon2id',
            timeCost: ARGON2_TIME_COST,
            memoryCost: ARGON2_MEMORY_COST,
            parallelism: ARGON2_PARALLELISM,
            salt: this.salt.toString('hex'),
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            ciphertext: ciphertext.toString('hex'),
        };
        writeFileSync(this.vaultPath, JSON.stringify(file, null, 2), 'utf-8');
    }
    /** Decrypt with given key; throws on GCM authentication failure. */
    decryptWith(key, raw) {
        const iv = Buffer.from(raw.iv, 'hex');
        const authTag = Buffer.from(raw.authTag, 'hex');
        const ciphertext = Buffer.from(raw.ciphertext, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return JSON.parse(plaintext.toString('utf-8'));
    }
}
//# sourceMappingURL=VaultManager.js.map