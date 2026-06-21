import { AuthMiddleware } from './AuthMiddleware.js';
import { RateLimitMiddleware } from './RateLimitMiddleware.js';
export { AuthMiddleware } from './AuthMiddleware.js';
export { RateLimitMiddleware } from './RateLimitMiddleware.js';
export class MiddlewareStack {
    auth;
    rateLimit;
    constructor() {
        this.auth = new AuthMiddleware();
        this.rateLimit = new RateLimitMiddleware();
    }
    getAuth() { return this.auth; }
    getRateLimit() { return this.rateLimit; }
}
export const middleware = new MiddlewareStack();
//# sourceMappingURL=Index.js.map