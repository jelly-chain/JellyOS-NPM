export interface EnvConfig {
    [key: string]: string | undefined;
    ALCHEMY_KEY?: string;
    INFURA_KEY?: string;
    SOLANA_RPC_URL?: string;
    ETHEREUM_RPC_URL?: string;
    BSC_RPC_URL?: string;
    POLYGON_RPC_URL?: string;
    ARBITRUM_RPC_URL?: string;
    BASE_RPC_URL?: string;
    REDIS_URL?: string;
    DATABASE_URL?: string;
    JWT_SECRET?: string;
    API_KEY?: string;
    PRIVATE_KEY?: string;
    WALLET_PRIVATE_KEY?: string;
    TRADING_ENABLED?: string;
    PREDICTION_ENABLED?: string;
    LOG_LEVEL?: string;
}
export declare class EnvLoader {
    private envConfig;
    protected envPath: string;
    /**
     * @param envPath  Absolute path, or path relative to ~/.jellyos/.
     *                 Values starting with '/' or '~' are treated as absolute.
     */
    constructor(envPath?: string);
    /**
     * Create an EnvLoader at an absolute path (for testing, alternate configs).
     */
    static atAbsolutePath(absolutePath: string): EnvLoader;
    protected load(): void;
    private parseEnvFile;
    private loadFromProcessEnv;
    private validate;
    get(key: string, defaultValue?: string): string | undefined;
    getRequired(key: string): string;
    getNumber(key: string, defaultValue: number): number;
    getBoolean(key: string, defaultValue: boolean): boolean;
    getAll(): EnvConfig;
    reload(): void;
}
export declare const env: EnvLoader;
//# sourceMappingURL=EnvLoader.d.ts.map