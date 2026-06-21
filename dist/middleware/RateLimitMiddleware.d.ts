export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    maxConcurrent: number;
    burstLimit: number;
}
export declare class RateLimitMiddleware {
    private logger;
    private config;
    private requests;
    private concurrent;
    constructor(config?: Partial<RateLimitConfig>);
    private startCleanup;
    private cleanup;
    check(key: string): {
        allowed: boolean;
        retryAfter: number;
        current: number;
    };
    acquire(key: string): boolean;
    incrementConcurrent(key: string): boolean;
    decrementConcurrent(key: string): void;
}
//# sourceMappingURL=RateLimitMiddleware.d.ts.map