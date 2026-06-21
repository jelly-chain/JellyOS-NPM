export interface FeedItem {
    id: string;
    source: string;
    title: string;
    content: string;
    url?: string;
    timestamp: number;
    category: 'news' | 'signal' | 'whale' | 'price' | 'social' | 'onchain' | 'prediction';
    metadata?: Record<string, any>;
    sentiment?: 'bullish' | 'bearish' | 'neutral';
    priority?: 'high' | 'medium' | 'low';
}
export interface FeedSource {
    name: string;
    interval: number;
    enabled: boolean;
    fetch: () => Promise<FeedItem[]>;
}
export declare class FeedManager {
    private logger;
    private items;
    private sources;
    private timers;
    private listeners;
    private maxItems;
    private running;
    constructor();
    private registerBuiltinSources;
    register(source: FeedSource): void;
    start(): void;
    private runSource;
    stop(): void;
    subscribe(listener: (item: FeedItem) => void): () => void;
    getRecent(options?: {
        category?: string;
        limit?: number;
        source?: string;
    }): FeedItem[];
    getStats(): any;
    getSources(): string[];
}
//# sourceMappingURL=FeedManager.d.ts.map