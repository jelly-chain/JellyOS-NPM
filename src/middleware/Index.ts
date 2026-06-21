import { AuthMiddleware } from './AuthMiddleware.js';
import { RateLimitMiddleware } from './RateLimitMiddleware.js';

export { AuthMiddleware } from './AuthMiddleware.js';
export { RateLimitMiddleware, RateLimitConfig } from './RateLimitMiddleware.js';

export class MiddlewareStack {
  private auth: AuthMiddleware;
  private rateLimit: RateLimitMiddleware;

  constructor() {
    this.auth = new AuthMiddleware();
    this.rateLimit = new RateLimitMiddleware();
  }

  getAuth(): AuthMiddleware { return this.auth; }
  getRateLimit(): RateLimitMiddleware { return this.rateLimit; }
}

export const middleware = new MiddlewareStack();