export interface ContextEntry {
    key: string;
    value: any;
    createdAt: number;
    updatedAt: number;
    expiresAt?: number;
    accessCount: number;
    lastAccessed: number;
    ttl?: number;
    relevance: number;
    tags: string[];
}
export interface ContextConfig {
    maxSize: number;
    defaultTTL: number;
    cleanupInterval: number;
    persistencePath: string;
    enablePersistence: boolean;
    relevanceDecay: number;
}
export declare class ContextStore {
    private config;
    private logger;
    private store;
    private cleanupTimer;
    private tagIndex;
    constructor(config?: Partial<ContextConfig>);
    private ensurePersistencePath;
    private startCleanup;
    private cleanup;
    set(key: string, value: any, ttl?: number): void;
    get(key: string): any;
    getEntry(key: string): ContextEntry | null;
    delete(key: string): boolean;
    has(key: string): boolean;
    search(query: string, limit?: number): ContextEntry[];
    getByTag(tag: string, limit?: number): ContextEntry[];
    keys(): string[];
    clear(): void;
    size(): number;
    getStats(): {
        totalEntries: number;
        totalAccesses: number;
        expiredEntries: number;
        tagCount: number;
    };
    private emitChangeEvent;
    close(): void;
}
export declare const context: ContextStore;
//# sourceMappingURL=ContextStore.d.ts.map