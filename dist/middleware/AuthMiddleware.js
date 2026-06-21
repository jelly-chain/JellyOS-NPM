import { Logger } from '../core/utils/Logger.js';
export class AuthMiddleware {
    logger;
    tokens = new Map();
    apiKeys = new Set();
    constructor() {
        this.logger = new Logger('AuthMiddleware');
    }
    authenticate(token) {
        const payload = this.tokens.get(token);
        if (!payload)
            return null;
        if (payload.expiresAt < Date.now()) {
            this.tokens.delete(token);
            return null;
        }
        return payload;
    }
    createToken(userId, role, permissions, ttl = 3600) {
        const token = `jelly_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
        const payload = { userId, role, permissions, token, expiresAt: Date.now() + ttl * 1000 };
        this.tokens.set(token, payload);
        return token;
    }
    revokeToken(token) {
        return this.tokens.delete(token);
    }
    validateApiKey(apiKey) {
        return this.apiKeys.has(apiKey) || apiKey.startsWith('jelly_');
    }
    registerApiKey(apiKey) {
        this.apiKeys.add(apiKey);
    }
    hasPermission(token, permission) {
        const payload = this.authenticate(token);
        return payload ? payload.permissions.includes(permission) || payload.permissions.includes('*') : false;
    }
    isAdmin(token) {
        const payload = this.authenticate(token);
        return payload ? payload.role === 'admin' : false;
    }
    getActiveTokens() { return this.tokens.size; }
    cleanup() {
        const now = Date.now();
        for (const [token, payload] of this.tokens) {
            if (payload.expiresAt < now)
                this.tokens.delete(token);
        }
    }
}
//# sourceMappingURL=AuthMiddleware.js.map