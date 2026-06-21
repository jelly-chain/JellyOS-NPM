import { EventEmitter } from 'events';
export interface Task {
    id: string;
    type: string;
    priority: number;
    payload: any;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    assignedTo?: string;
    status: TaskStatus;
    retries: number;
    maxRetries: number;
    timeout: number;
    parentId?: string;
    dependencies: string[];
    result?: any;
    error?: Error;
}
export declare enum TaskStatus {
    PENDING = "pending",
    RUNNING = "running",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled",
    TIMEOUT = "timeout"
}
export interface TaskQueueConfig {
    maxSize: number;
    defaultPriority: number;
    defaultTimeout: number;
    defaultMaxRetries: number;
    enablePersistence: boolean;
    persistencePath: string;
}
export declare class TaskQueue extends EventEmitter {
    private config;
    private logger;
    private queue;
    private taskMap;
    private processing;
    private paused;
    private stats;
    constructor(config?: Partial<TaskQueueConfig>);
    enqueue(task: Task): void;
    private findInsertPosition;
    dequeue(): Task | null;
    complete(taskId: string, result?: any): void;
    fail(taskId: string, error: Error): void;
    cancel(taskId: string): boolean;
    getTask(taskId: string): Task | undefined;
    getTasks(status?: TaskStatus): Task[];
    getPendingCount(): number;
    getRunningCount(): number;
    pause(): void;
    resume(): void;
    clear(): void;
    private updateStats;
    getStats(): {
        totalEnqueued: number;
        totalCompleted: number;
        totalFailed: number;
        totalCancelled: number;
        avgProcessingTime: number;
    };
    getConfig(): TaskQueueConfig;
}
export declare const taskQueue: TaskQueue;
//# sourceMappingURL=TaskQueue.d.ts.map