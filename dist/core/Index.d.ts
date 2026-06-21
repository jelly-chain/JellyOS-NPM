export { ConfigLoader, config } from './ConfigLoader.js';
export { EnvLoader, env } from './EnvLoader.js';
export { CheckpointManager, checkpoints } from './CheckpointManager.js';
export { TaskQueue, TaskQueueConfig, Task, TaskStatus, taskQueue } from './TaskQueue.js';
export { TaskDispatcher, Worker, DispatcherConfig, dispatcher } from './TaskDispatcher.js';
export type { JellyOSConfig, SystemConfig, AgentConfig, BlockchainConfig, PredictionConfig, TradingConfig, ContextConfig, LoggingConfig, FeatureFlags } from './ConfigLoader.js';
import { EnvLoader } from './EnvLoader.js';
import { CheckpointManager } from './CheckpointManager.js';
import { TaskQueue } from './TaskQueue.js';
import { TaskDispatcher } from './TaskDispatcher.js';
export declare class JellyBrain {
    private config;
    private env;
    private checkpoints;
    private taskQueue;
    private dispatcher;
    private initialized;
    constructor(configPath?: string);
    initialize(): Promise<void>;
    getConfig(): import("./ConfigLoader.js").JellyOSConfig;
    getCheckpoints(): CheckpointManager;
    getTaskQueue(): TaskQueue;
    getDispatcher(): TaskDispatcher;
    getEnv(): EnvLoader;
    isInitialized(): boolean;
    shutdown(): Promise<void>;
}
export declare const jellyBrain: JellyBrain;
//# sourceMappingURL=Index.d.ts.map