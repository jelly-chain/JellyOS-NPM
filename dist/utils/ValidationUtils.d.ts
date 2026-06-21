interface SchemaRule {
    required?: boolean;
    type?: string;
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: string[];
}
export declare class ValidationUtils {
    static isValidEmail(email: string): boolean;
    static isValidUrl(url: string): boolean;
    static isValidNumber(value: any): boolean;
    static isValidInteger(value: any, min?: number, max?: number): boolean;
    static isValidPort(value: any): boolean;
    static isValidPercentage(value: number): boolean;
    static isValidTransactionHash(hash: string): boolean;
    static isValidSolanaAddress(address: string): boolean;
    static isValidEthereumAddress(address: string): boolean;
    static validateConfig(config: any, schema: Record<string, SchemaRule>): string[];
    static sanitize(input: string): string;
    static truncate(str: string, maxLength: number): string;
    static toSafeNumber(value: any, fallback?: number): number;
    static isJsonString(str: string): boolean;
    static isNonEmptyString(value: any): boolean;
    static isValidDate(value: any): boolean;
    static isFutureDate(value: any): boolean;
    static validateOrder(order: any): string[];
}
export {};
//# sourceMappingURL=ValidationUtils.d.ts.map