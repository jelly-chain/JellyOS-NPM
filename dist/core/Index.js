export { ConfigLoader, config } from './ConfigLoader.js';
export { EnvLoader, env } from './EnvLoader.js';
export { CheckpointManager, checkpoints } from './CheckpointManager.js';
export { TaskQueue, TaskStatus, taskQueue } from './TaskQueue.js';
export { TaskDispatcher, dispatcher } from './TaskDispatcher.js';
import { ConfigLoader } from './ConfigLoader.js';
import { EnvLoader } from './EnvLoader.js';
import { CheckpointManager } from './CheckpointManager.js';
import { TaskQueue } from './TaskQueue.js';
import { TaskDispatcher } from './TaskDispatcher.js';
export class JellyBrain {
    config;
    env;
    checkpoints;
    taskQueue;
    dispatcher;
    initialized = false;
    constructor(configPath) {
        this.config = new ConfigLoader(configPath);
        this.env = new EnvLoader();
        this.checkpoints = new CheckpointManager();
        this.taskQueue = new TaskQueue();
        this.dispatcher = new TaskDispatcher(this.taskQueue);
    }
    async initialize() {
        if (this.initialized)
            return;
        this.config.validate();
        this.dispatcher.start();
        this.initialized = true;
    }
    getConfig() { return this.config.getConfig(); }
    getCheckpoints() { return this.checkpoints; }
    getTaskQueue() { return this.taskQueue; }
    getDispatcher() { return this.dispatcher; }
    getEnv() { return this.env; }
    isInitialized() { return this.initialized; }
    async shutdown() {
        this.dispatcher.stop();
        this.checkpoints.close();
        this.initialized = false;
    }
}
export const jellyBrain = new JellyBrain();
//# sourceMappingURL=Index.js.map