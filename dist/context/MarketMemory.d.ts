export interface MarketSnapshot {
    symbol: string;
    price: number;
    volume: number;
    high: number;
    low: number;
    open: number;
    close: number;
    timestamp: number;
    source: string;
}
export interface MarketPattern {
    id: string;
    symbol: string;
    type: string;
    confidence: number;
    frequency: number;
    lastObserved: number;
    avgReturn: number;
    winRate: number;
}
export declare class MarketMemory {
    private logger;
    private snapshots;
    private patterns;
    private correlationMatrix;
    private persistencePath;
    private maxSnapshots;
    constructor(persistencePath?: string, maxSnapshots?: number);
    private ensurePersistencePath;
    private loadFromDisk;
    private saveToDisk;
    recordSnapshot(snapshot: MarketSnapshot): void;
    recordSnapshots(snapshots: MarketSnapshot[]): void;
    getSnapshots(symbol: string, limit?: number): MarketSnapshot[];
    getSnapshotsInRange(symbol: string, startTime: number, endTime: number): MarketSnapshot[];
    getLatestSnapshot(symbol: string): MarketSnapshot | null;
    getSymbols(): string[];
    calculateCorrelation(symbolA: string, symbolB: string): number;
    learnPattern(symbol: string, pattern: Omit<MarketPattern, 'id'>): MarketPattern;
    getPatterns(symbol: string): MarketPattern[];
    getHighConfidencePatterns(symbol: string, minConfidence?: number): MarketPattern[];
    getStats(): any;
    persist(): void;
    close(): void;
}
export declare const marketMemory: MarketMemory;
//# sourceMappingURL=MarketMemory.d.ts.map