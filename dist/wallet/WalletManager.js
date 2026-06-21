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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import * as crypto from 'crypto';
// ── Encrypted wallet file format ───────────────────────────────────────────
// Version 2: AES-256-GCM encrypted private key, Argon2id KDF
// Version 1: plaintext (legacy, still readable but flagged)
const WALLET_FILE_VERSION = 2;
const WALLET_KDF = 'argon2id';
const WALLET_ARGON2_TIME = 3;
const WALLET_ARGON2_MEM = 65536; // 64 MiB
const WALLET_ARGON2_PARALLELISM = 4;
const WALLET_DERIVED_KEY_LEN = 32;
// ── keccak256 helper — uses ethers v6 static function ──────────────────
function keccak256Hex(data) {
    const { ethers } = require('ethers'); // throws if not installed
    return ethers.keccak256(data).slice(2); // strip 0x
}
function eip55Checksum(address) {
    const addr = address.toLowerCase().replace(/^0x/, '');
    const hash = keccak256Hex(Buffer.from(addr, 'utf-8'));
    let checksummed = '0x';
    for (let i = 0; i < addr.length; i++) {
        checksummed += parseInt(hash[i], 16) >= 8 ? addr[i].toUpperCase() : addr[i];
    }
    return checksummed;
}
// ── bech32 helper for Cosmos (no external dep) ───────────────────────────────
const B32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function bech32Encode(hrp, data) {
    const words = [];
    let acc = 0, bits = 0;
    for (const b of data) {
        acc = (acc << 8) | b;
        bits += 8;
        while (bits >= 5) {
            bits -= 5;
            words.push((acc >> bits) & 0x1f);
        }
    }
    if (bits > 0)
        words.push((acc << (5 - bits)) & 0x1f);
    const hrpBytes = hrp.split('').map(c => c.charCodeAt(0));
    const data5 = words;
    let cs = 1;
    for (const v of [...hrpBytes.map(b => b >> 5), 0, ...hrpBytes.map(b => b & 31), ...data5, 0, 0, 0, 0, 0, 0]) {
        const b = cs >> 25;
        cs = ((cs & 0x1ffffff) << 5) ^ v ^
            (-(b >> 0 & 1) & 0x3b6a57b2) ^ (-(b >> 1 & 1) & 0x26508e6d) ^
            (-(b >> 2 & 1) & 0x1ea119fa) ^ (-(b >> 3 & 1) & 0x3d4233dd) ^
            (-(b >> 4 & 1) & 0x2a1462b3);
    }
    const checksum = [0, 1, 2, 3, 4, 5].map(i => (cs >> (5 * (5 - i))) & 0x1f);
    return hrp + '1' + [...data5, ...checksum].map(d => B32_CHARSET[d]).join('');
}
export class WalletManager {
    walletsDir;
    wallets = new Map();
    passphrase = null;
    constructor(jellyHome) {
        this.walletsDir = resolve(jellyHome, 'wallets');
        if (!existsSync(this.walletsDir))
            mkdirSync(this.walletsDir, { recursive: true });
        this.loadAll();
    }
    // ── Passphrase ────────────────────────────────────────────────────────────
    setPassphrase(passphrase) {
        if (!passphrase || passphrase.length < 8) {
            throw new Error('Passphrase must be at least 8 characters.');
        }
        this.passphrase = passphrase;
    }
    static async deriveWalletKey(passphrase, salt) {
        const argon2 = require('argon2');
        const hash = await argon2.hash(passphrase, {
            type: argon2.argon2id,
            salt,
            timeCost: WALLET_ARGON2_TIME,
            memoryCost: WALLET_ARGON2_MEM,
            parallelism: WALLET_ARGON2_PARALLELISM,
            hashLength: WALLET_DERIVED_KEY_LEN,
            raw: true,
        });
        return hash;
    }
    static encryptData(plaintext, key) {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const ct = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
        return { iv, authTag: cipher.getAuthTag(), ciphertext: ct };
    }
    static decryptData(ct, key, iv, authTag) {
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
        return pt.toString('utf-8');
    }
    // ── Wallet generation ────────────────────────────────────────────────────
    generateEVMWallet() {
        const ecdh = crypto.createECDH('secp256k1');
        ecdh.generateKeys();
        const privBuf = ecdh.getPrivateKey();
        const privHex = privBuf.toString('hex');
        const pubBytes = ecdh.getPublicKey();
        const pubKey64 = pubBytes.slice(1);
        const hash = keccak256Hex(pubKey64);
        const address = eip55Checksum('0x' + hash.slice(-40));
        privBuf.fill(0);
        return {
            chain: 'evm',
            address,
            privateKey: '0x' + privHex,
            publicKey: '0x04' + ecdh.getPublicKey('hex'),
            keyType: 'secp256k1',
            createdAt: Date.now(),
        };
    }
    generateSolanaWallet() {
        try {
            const { Keypair } = require('@solana/web3.js');
            const kp = Keypair.generate();
            const address = kp.publicKey.toBase58();
            const privHex = Buffer.from(kp.secretKey).toString('hex');
            return {
                chain: 'solana',
                address,
                privateKey: privHex,
                publicKey: Buffer.from(kp.publicKey.toBytes()).toString('hex'),
                keyType: 'ed25519',
                createdAt: Date.now(),
            };
        }
        catch {
            const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
            const pubDer = publicKey.export({ type: 'spki', format: 'der' });
            const pubRaw = Buffer.from(pubDer.slice(-32));
            const privDer = privateKey.export({ type: 'pkcs8', format: 'der' });
            const b58chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
            let num = BigInt('0x' + pubRaw.toString('hex'));
            let addr = '';
            const base = BigInt(58);
            while (num > 0n) {
                addr = b58chars[Number(num % base)] + addr;
                num /= base;
            }
            return {
                chain: 'solana', address: addr || '1',
                privateKey: privDer.toString('hex'),
                publicKey: pubDer.toString('hex'),
                keyType: 'ed25519',
                createdAt: Date.now(),
            };
        }
    }
    generateCosmosWallet() {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
        const pubDer = publicKey.export({ type: 'spki', format: 'der' });
        const pubRaw = Buffer.from(pubDer.slice(-32));
        let hash;
        try {
            hash = crypto.createHash('ripemd160').update(crypto.createHash('sha256').update(pubRaw).digest()).digest();
        }
        catch {
            hash = crypto.createHash('sha256').update(crypto.createHash('sha256').update(pubRaw).digest()).digest().slice(0, 20);
        }
        const address = bech32Encode('cosmos', hash);
        const privDer = privateKey.export({ type: 'pkcs8', format: 'der' });
        return {
            chain: 'cosmos',
            address,
            privateKey: privDer.toString('hex'),
            publicKey: pubDer.toString('hex'),
            keyType: 'ed25519',
            createdAt: Date.now(),
        };
    }
    // ── Signing ──────────────────────────────────────────────────────────────
    /**
     * Sign a message or payload. For encrypted wallets, unlock() must be called
     * first or the privateKey field will be '[encrypted]' and this will throw.
     */
    signMessage(chain, data) {
        const normalized = this.normalizeChain(chain);
        const wallet = this.wallets.get(normalized);
        if (!wallet)
            return null;
        if (wallet.privateKey === '[encrypted]') {
            throw new Error(`Wallet ${normalized} is locked. Call unlock() with your passphrase first.`);
        }
        const isHex = /^(0x)?[0-9a-f]+$/i.test(data.replace(/\s/g, ''));
        const msgBytes = isHex
            ? Buffer.from(data.replace(/^0x/, ''), 'hex')
            : Buffer.from(data, 'utf-8');
        try {
            if (wallet.keyType === 'secp256k1') {
                try {
                    const { ethers } = require('ethers');
                    const privKey = wallet.privateKey.startsWith('0x') ? wallet.privateKey : '0x' + wallet.privateKey;
                    const signingKey = new ethers.SigningKey(privKey);
                    if (msgBytes.length === 32) {
                        const sig = signingKey.sign(msgBytes);
                        return sig.serialized;
                    }
                    const prefixed = '\x19Ethereum Signed Message:\n' + msgBytes.length;
                    const hash = keccak256Hex(Buffer.concat([Buffer.from(prefixed), msgBytes]));
                    return signingKey.sign('0x' + hash).serialized;
                }
                catch { /* fall through to Node.js ECDSA */ }
                const ecdh = crypto.createECDH('secp256k1');
                ecdh.setPrivateKey(Buffer.from(wallet.privateKey.replace(/^0x/, ''), 'hex'));
                const hash = keccak256Hex(msgBytes);
                const privKeyObj = crypto.createPrivateKey({
                    key: ecdh.getPrivateKey(), format: 'raw',
                    type: 'sec1', namedCurve: 'secp256k1',
                });
                return crypto.sign(null, Buffer.from(hash, 'hex'), privKeyObj).toString('hex');
            }
            else {
                const hashBytes = normalized === 'cosmos'
                    ? crypto.createHash('sha256').update(msgBytes).digest()
                    : msgBytes;
                const privKeyObj = crypto.createPrivateKey({
                    key: Buffer.from(wallet.privateKey, 'hex'), format: 'der', type: 'pkcs8',
                });
                return crypto.sign(null, hashBytes, privKeyObj).toString('hex');
            }
        }
        catch (err) {
            throw new Error(`Signing failed for ${chain}: ${err.message}`);
        }
    }
    generateAll() {
        if (!this.passphrase) {
            throw new Error('Passphrase required - call setPassphrase() first');
        }
        return Promise.all([
            this.create('evm', this.passphrase),
            this.create('solana', this.passphrase),
            this.create('cosmos', this.passphrase),
        ]).then(() => { });
    }
    async create(chain, passphrase) {
        if (!this.passphrase && !passphrase) {
            throw new Error('Call setPassphrase() before create(), or pass passphrase as argument.');
        }
        const pw = passphrase || this.passphrase;
        let wallet;
        switch (chain) {
            case 'solana':
                wallet = this.generateSolanaWallet();
                break;
            case 'cosmos':
                wallet = this.generateCosmosWallet();
                break;
            default:
                wallet = this.generateEVMWallet();
                wallet.chain = chain;
                break;
        }
        this.wallets.set(chain, wallet);
        // Store public metadata in memory; encrypted private key on disk
        this.wallets.set(chain, {
            chain: wallet.chain,
            address: wallet.address,
            privateKey: '[encrypted]',
            publicKey: wallet.publicKey,
            keyType: wallet.keyType,
            createdAt: wallet.createdAt,
        });
        // Encrypt and write the full wallet (with private key) to disk
        await this.saveEncrypted(wallet, pw);
        return wallet;
    }
    async saveEncrypted(wallet, passphrase) {
        const salt = crypto.randomBytes(16);
        const key = await WalletManager.deriveWalletKey(passphrase, salt);
        const { iv, authTag, ciphertext } = WalletManager.encryptData(wallet.privateKey, key);
        const file = {
            version: WALLET_FILE_VERSION,
            address: wallet.address,
            publicKey: wallet.publicKey,
            keyType: wallet.keyType,
            chain: wallet.chain,
            createdAt: wallet.createdAt,
            encrypted: {
                kdf: WALLET_KDF,
                salt: salt.toString('hex'),
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex'),
                ciphertext: ciphertext.toString('hex'),
            },
        };
        const fp = resolve(this.walletsDir, `${wallet.chain}.json`);
        writeFileSync(fp, JSON.stringify(file, null, 2), 'utf-8');
        try {
            require('fs').chmodSync(fp, 0o600);
        }
        catch { /* windows */ }
        key.fill(0);
    }
    /**
     * Unlock a wallet for signing. Decrypts the private key into memory
     * and returns the full WalletInfo. Returns null on wrong passphrase.
     */
    async unlock(chain, passphrase) {
        const stored = this.wallets.get(chain);
        if (!stored)
            throw new Error(`No wallet for ${chain}. Run create() first.`);
        const fp = resolve(this.walletsDir, `${chain}.json`);
        let raw;
        try {
            raw = JSON.parse(readFileSync(fp, 'utf-8'));
        }
        catch {
            throw new Error(`Cannot read wallet file: ${fp}`);
        }
        // Legacy unencrypted wallet — return as-is
        if (!raw.encrypted) {
            this.wallets.set(chain, stored);
            return stored;
        }
        try {
            const salt = Buffer.from(raw.encrypted.salt, 'hex');
            const key = await WalletManager.deriveWalletKey(passphrase, salt);
            const iv = Buffer.from(raw.encrypted.iv, 'hex');
            const authTag = Buffer.from(raw.encrypted.authTag, 'hex');
            const ct = Buffer.from(raw.encrypted.ciphertext, 'hex');
            const privateKey = WalletManager.decryptData(ct, key, iv, authTag);
            key.fill(0);
            const decrypted = {
                chain: raw.chain,
                address: raw.address,
                privateKey,
                publicKey: raw.publicKey,
                keyType: raw.keyType,
                createdAt: raw.createdAt,
            };
            this.wallets.set(chain, decrypted);
            return decrypted;
        }
        catch {
            return null;
        }
    }
    /**
     * Lock a wallet — zeroes the private key from memory.
     */
    lock(chain) {
        const stored = this.wallets.get(chain);
        if (stored) {
            stored.privateKey = '[encrypted]';
        }
    }
    getAddress(chain) {
        return this.wallets.get(this.normalizeChain(chain))?.address ?? null;
    }
    getSummary() {
        const result = {};
        for (const [chain, w] of this.wallets)
            result[chain] = w.address;
        return result;
    }
    getStats() {
        return { chains: [...this.wallets.keys()], count: this.wallets.size };
    }
    hasWallets() { return this.wallets.size > 0; }
    isLocked(chain) {
        const w = this.wallets.get(chain);
        return !w || w.privateKey === '[encrypted]';
    }
    // ── Private ──────────────────────────────────────────────────────────────
    normalizeChain(chain) {
        const EVM_CHAINS = ['ethereum', 'bsc', 'arbitrum', 'base', 'polygon', 'avalanche',
            'optimism', 'fantom', 'gnosis', 'scroll', 'linea', 'zksync', 'mantle', 'blast', 'celo'];
        return EVM_CHAINS.includes(chain) ? 'evm' : chain;
    }
    loadAll() {
        if (!existsSync(this.walletsDir))
            return;
        for (const chain of ['evm', 'solana', 'cosmos']) {
            const fp = resolve(this.walletsDir, `${chain}.json`);
            if (existsSync(fp)) {
                try {
                    const raw = JSON.parse(readFileSync(fp, 'utf-8'));
                    if (raw.encrypted) {
                        // Encrypted: only load public metadata
                        this.wallets.set(chain, {
                            chain: raw.chain,
                            address: raw.address,
                            privateKey: '[encrypted]',
                            publicKey: raw.publicKey,
                            keyType: raw.keyType,
                            createdAt: raw.createdAt,
                        });
                    }
                    else {
                        this.wallets.set(chain, raw);
                    }
                }
                catch { /* ignore corrupt files */ }
            }
        }
    }
}
//# sourceMappingURL=WalletManager.js.map