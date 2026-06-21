import { randomBytes, createHash } from 'crypto';
export class CryptoUtils {
    static generateKey(length = 32) {
        return randomBytes(length).toString('hex');
    }
    static generateId() {
        const timestamp = Date.now().toString(36);
        const random = randomBytes(8).toString('hex');
        return `${timestamp}-${random}`;
    }
    static hash(data, algorithm = 'sha256') {
        const input = typeof data === 'string' ? data : JSON.stringify(data);
        return createHash(algorithm).update(input).digest('hex');
    }
    static hashWithSalt(data, salt) {
        return this.hash(data + salt);
    }
    static generateApiKey() {
        return `jelly_${randomBytes(24).toString('hex')}`;
    }
    static generateSecret() {
        return randomBytes(48).toString('hex');
    }
    static maskString(input, visibleChars = 4) {
        if (input.length <= visibleChars)
            return input;
        const visible = input.slice(0, visibleChars);
        const masked = '*'.repeat(input.length - visibleChars);
        return `${visible}${masked}`;
    }
    static encrypt(text, key) {
        const combined = key + text;
        return Buffer.from(combined).toString('base64');
    }
    static decrypt(encoded, key) {
        const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
        return decoded.startsWith(key) ? decoded.slice(key.length) : '';
    }
    static randomBetween(min, max) {
        const range = max - min;
        const randomValue = randomBytes(4).readUInt32LE(0) / 0xFFFFFFFF;
        return min + randomValue * range;
    }
    static generateNonce() {
        return randomBytes(16).toString('hex');
    }
    static isValidHex(str) {
        return /^[0-9a-fA-F]+$/.test(str);
    }
    static isPrivateKey(str) {
        return str.length === 64 && this.isValidHex(str);
    }
    static isAddress(str) {
        return str.startsWith('0x') && str.length === 42 && this.isValidHex(str.slice(2));
    }
    static checksum(data) {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }
}
export const crypto = new CryptoUtils();
//# sourceMappingURL=CryptoUtils.js.map