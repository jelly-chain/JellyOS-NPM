import { TaskQueue, Task } from './TaskQueue.js';
import { EventEmitter } from 'events';
export interface Worker {
    id: string;
    type: string;
    process: (task: Task) => Promise<any>;
    busy: boolean;
    maxConcurrent: number;
    currentTasks: number;
}
export interface DispatcherConfig {
    maxWorkers: number;
    defaultWorkerType: string;
    enableWorkStealing: boolean;
    workTimeout: number;
}
export declare class TaskDispatcher extends EventEmitter {
    private config;
    private logger;
    private taskQueue;
    private workers;
    private workerTypes;
    private dispatchTimer;
    private active;
    constructor(taskQueue: TaskQueue, config?: Partial<DispatcherConfig>);
    registerWorker(worker: Worker): void;
    unregisterWorker(workerId: string): void;
    start(): void;
    stop(): void;
    private dispatch;
    private findAvailableWorker;
    private assignTask;
    private handleTimeout;
    private releaseWorker;
    getWorker(workerId: string): Worker | undefined;
    getWorkers(): Worker[];
    getWorkersByType(type: string): Worker[];
    getStats(): {
        totalWorkers: number;
        busyWorkers: number;
        totalCurrentTasks: number;
    };
}
export declare const dispatcher: TaskDispatcher;
//# sourceMappingURL=TaskDispatcher.d.ts.map