export { CryptoUtils, crypto } from './CryptoUtils.js';
export { ValidationUtils } from './ValidationUtils.js';
export declare class Utils {
    static sleep(ms: number): Promise<void>;
    static retry<T>(fn: () => Promise<T>, options?: {
        maxAttempts?: number;
        delay?: number;
    }): Promise<T>;
    static debounce(fn: Function, delay: number): (...args: any[]) => void;
    static throttle<T extends (...args: any[]) => any>(fn: T, limit: number): T;
    static deepClone<T>(obj: T): T;
    static deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T;
    static formatBytes(bytes: number): string;
    static formatDuration(ms: number): string;
    static formatCurrency(value: number, decimals?: number): string;
    static formatPercent(value: number, decimals?: number): string;
    static groupBy<T>(items: T[], key: keyof T): Map<any, T[]>;
    static chunkArray<T>(arr: T[], size: number): T[][];
    static uniqueBy<T>(arr: T[], key: keyof T): T[];
    static batchProcess<T, R>(items: T[], processor: (item: T) => Promise<R>, batchSize?: number): Promise<R[]>;
    static weightedAverage(values: number[], weights: number[]): number;
}
export default Utils;
//# sourceMappingURL=Index.d.ts.map