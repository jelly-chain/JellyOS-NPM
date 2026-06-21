import { Logger } from '../core/utils/Logger.js';
export class RateLimitMiddleware {
    logger;
    config;
    requests = new Map();
    concurrent = new Map();
    constructor(config) {
        this.config = {
            windowMs: 60000, maxRequests: 100, maxConcurrent: 10, burstLimit: 200,
            ...config,
        };
        this.logger = new Logger('RateLimitMiddleware');
        this.startCleanup();
    }
    startCleanup() {
        setInterval(() => this.cleanup(), this.config.windowMs);
    }
    cleanup() {
        const now = Date.now();
        for (const [key, timestamps] of this.requests) {
            const valid = timestamps.filter(t => now - t < this.config.windowMs);
            if (valid.length === 0)
                this.requests.delete(key);
            else
                this.requests.set(key, valid);
        }
    }
    check(key) {
        const now = Date.now();
        if (!this.requests.has(key))
            this.requests.set(key, []);
        const timestamps = this.requests.get(key);
        const recent = timestamps.filter(t => now - t < this.config.windowMs);
        this.requests.set(key, recent);
        const isAllowed = recent.length < this.config.maxRequests;
        const retryAfter = isAllowed ? 0 : this.config.windowMs - (now - recent[0]);
        return { allowed: isAllowed, retryAfter, current: recent.length };
    }
    acquire(key) {
        const check = this.check(key);
        if (!check.allowed)
            return false;
        this.requests.get(key).push(Date.now());
        return true;
    }
    incrementConcurrent(key) {
        const current = this.concurrent.get(key) || 0;
        if (current >= this.config.maxConcurrent)
            return false;
        this.concurrent.set(key, current + 1);
        return true;
    }
    decrementConcurrent(key) {
        const current = this.concurrent.get(key) || 0;
        if (current <= 0)
            this.concurrent.delete(key);
        else
            this.concurrent.set(key, current - 1);
    }
}
//# sourceMappingURL=RateLimitMiddleware.js.map