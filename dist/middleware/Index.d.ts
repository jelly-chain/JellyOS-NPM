import { AuthMiddleware } from './AuthMiddleware.js';
import { RateLimitMiddleware } from './RateLimitMiddleware.js';
export { AuthMiddleware } from './AuthMiddleware.js';
export { RateLimitMiddleware, RateLimitConfig } from './RateLimitMiddleware.js';
export declare class MiddlewareStack {
    private auth;
    private rateLimit;
    constructor();
    getAuth(): AuthMiddleware;
    getRateLimit(): RateLimitMiddleware;
}
export declare const middleware: MiddlewareStack;
//# sourceMappingURL=Index.d.ts.map