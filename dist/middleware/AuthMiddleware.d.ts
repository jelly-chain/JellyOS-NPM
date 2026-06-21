export interface AuthPayload {
    userId: string;
    role: string;
    permissions: string[];
    token: string;
    expiresAt: number;
}
export declare class AuthMiddleware {
    private logger;
    private tokens;
    private apiKeys;
    constructor();
    authenticate(token: string): AuthPayload | null;
    createToken(userId: string, role: string, permissions: string[], ttl?: number): string;
    revokeToken(token: string): boolean;
    validateApiKey(apiKey: string): boolean;
    registerApiKey(apiKey: string): void;
    hasPermission(token: string, permission: string): boolean;
    isAdmin(token: string): boolean;
    getActiveTokens(): number;
    cleanup(): void;
}
//# sourceMappingURL=AuthMiddleware.d.ts.map