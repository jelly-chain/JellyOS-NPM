import { LogLevel } from './utils/Logger.js';
export interface JellyOSConfig {
    system: SystemConfig;
    agents: AgentConfig;
    blockchain: BlockchainConfig;
    prediction: PredictionConfig;
    trading: TradingConfig;
    context: ContextConfig;
    logging: LoggingConfig;
    features: FeatureFlags;
}
export interface SystemConfig {
    mode: 'production' | 'development' | 'test';
    apiPort: number;
    maxConcurrency: number;
    timeout: number;
    retryAttempts: number;
    backoffDelay: number;
}
export interface AgentConfig {
    maxAgents: number;
    heartbeatInterval: number;
    taskTimeout: number;
    memoryLimit: number;
    defaultAgent: string;
}
export interface BlockchainConfig {
    chains: string[];
    alchemyKey?: string;
    rpcEndpoints: Record<string, string>;
    confirmations: number;
    gasMultiplier: number;
}
export interface PredictionConfig {
    models: string[];
    updateInterval: number;
    confidenceThreshold: number;
    historyWindow: number;
}
export interface TradingConfig {
    enabled: boolean;
    maxSlippage: number;
    positionSize: number;
    stopLoss: number;
    takeProfit: number;
    maxPositions: number;
}
export interface ContextConfig {
    ttl: number;
    maxSize: number;
    redisUrl?: string;
    persistencePath: string;
}
export interface LoggingConfig {
    level: LogLevel;
    fileOutput: boolean;
    consoleOutput: boolean;
    logDirectory: string;
}
export interface FeatureFlags {
    prediction: boolean;
    trading: boolean;
    alerts: boolean;
    learning: boolean;
    cache: boolean;
}
export declare class ConfigLoader {
    private config;
    private logger;
    private configPath;
    private basePath;
    private watchers;
    constructor(configPath?: string, basePath?: string);
    static withBasePath(basePath: string, configPath?: string): ConfigLoader;
    private loadConfig;
    private applyEnvironmentVariables;
    private parseValue;
    private mergeConfig;
    private setNestedValue;
    getConfig(): JellyOSConfig;
    get<K extends keyof JellyOSConfig>(key: K): JellyOSConfig[K];
    getValue<T>(path: string, defaultValue?: T): T;
    set<K extends keyof JellyOSConfig>(key: K, value: JellyOSConfig[K]): void;
    setValue(path: string, value: any): void;
    watch<K extends keyof JellyOSConfig>(key: K, callback: (value: JellyOSConfig[K]) => void): void;
    unwatch(key: string): void;
    private notifyWatchers;
    save(): void;
    reload(): void;
    validate(): boolean;
    getBasePath(): string;
}
export declare const config: ConfigLoader;
//# sourceMappingURL=ConfigLoader.d.ts.map