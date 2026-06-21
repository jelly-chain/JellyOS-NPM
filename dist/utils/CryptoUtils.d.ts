export declare class CryptoUtils {
    static generateKey(length?: number): string;
    static generateId(): string;
    static hash(data: string | object, algorithm?: string): string;
    static hashWithSalt(data: string, salt: string): string;
    static generateApiKey(): string;
    static generateSecret(): string;
    static maskString(input: string, visibleChars?: number): string;
    static encrypt(text: string, key: string): string;
    static decrypt(encoded: string, key: string): string;
    static randomBetween(min: number, max: number): number;
    static generateNonce(): string;
    static isValidHex(str: string): boolean;
    static isPrivateKey(str: string): boolean;
    static isAddress(str: string): boolean;
    static checksum(data: string): string;
}
export declare const crypto: CryptoUtils;
//# sourceMappingURL=CryptoUtils.d.ts.map