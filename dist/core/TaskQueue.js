import { Logger } from './utils/Logger.js';
import { EventEmitter } from 'events';
import { homedir } from 'os';
import { resolve } from 'path';
export var TaskStatus;
(function (TaskStatus) {
    TaskStatus["PENDING"] = "pending";
    TaskStatus["RUNNING"] = "running";
    TaskStatus["COMPLETED"] = "completed";
    TaskStatus["FAILED"] = "failed";
    TaskStatus["CANCELLED"] = "cancelled";
    TaskStatus["TIMEOUT"] = "timeout";
})(TaskStatus || (TaskStatus = {}));
const DEFAULT_CONFIG = {
    maxSize: 10000,
    defaultPriority: 100,
    defaultTimeout: 30000,
    defaultMaxRetries: 3,
    enablePersistence: false,
    persistencePath: resolve(homedir(), '.jellyos', 'tasks'),
};
export class TaskQueue extends EventEmitter {
    config;
    logger;
    queue = [];
    taskMap = new Map();
    processing = new Map();
    paused = false;
    stats = {
        totalEnqueued: 0,
        totalCompleted: 0,
        totalFailed: 0,
        totalCancelled: 0,
        avgProcessingTime: 0,
    };
    constructor(config) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.logger = new Logger('TaskQueue');
    }
    enqueue(task) {
        if (this.queue.length >= this.config.maxSize) {
            this.logger.warn('Task queue is full, dropping task');
            this.emit('queue_full', task);
            return;
        }
        task.createdAt = Date.now();
        task.status = TaskStatus.PENDING;
        if (!task.dependencies)
            task.dependencies = [];
        if (task.maxRetries === undefined)
            task.maxRetries = this.config.defaultMaxRetries;
        if (task.timeout === undefined)
            task.timeout = this.config.defaultTimeout;
        const insertIndex = this.findInsertPosition(task);
        this.queue.splice(insertIndex, 0, task);
        this.taskMap.set(task.id, task);
        this.stats.totalEnqueued++;
        this.emit('task_enqueued', task);
        this.logger.debug(`Enqueued task: ${task.id} (type: ${task.type}, priority: ${task.priority})`);
    }
    findInsertPosition(task) {
        for (let i = 0; i < this.queue.length; i++) {
            if (task.priority > this.queue[i].priority) {
                return i;
            }
        }
        return this.queue.length;
    }
    dequeue() {
        if (this.paused || this.queue.length === 0) {
            return null;
        }
        const task = this.queue.shift();
        if (!task)
            return null;
        if (task.dependencies && task.dependencies.length > 0) {
            const depsIncomplete = task.dependencies.some(depId => {
                const dep = this.taskMap.get(depId);
                return !dep || dep.status !== TaskStatus.COMPLETED;
            });
            if (depsIncomplete) {
                this.queue.unshift(task);
                return null;
            }
        }
        task.status = TaskStatus.RUNNING;
        task.startedAt = Date.now();
        this.taskMap.set(task.id, task);
        this.processing.set(task.id, task);
        this.emit('task_dequeued', task);
        return task;
    }
    complete(taskId, result) {
        const task = this.taskMap.get(taskId);
        if (!task)
            return;
        task.status = TaskStatus.COMPLETED;
        task.completedAt = Date.now();
        task.result = result;
        this.processing.delete(taskId);
        this.updateStats(task);
        this.emit('task_completed', task);
        this.logger.debug(`Completed task: ${taskId}`);
    }
    fail(taskId, error) {
        const task = this.taskMap.get(taskId);
        if (!task)
            return;
        task.retries++;
        if (task.retries < task.maxRetries) {
            task.status = TaskStatus.PENDING;
            const retryDelay = Math.pow(2, task.retries) * 1000;
            setTimeout(() => this.enqueue(task), retryDelay);
            this.emit('task_retry', task, error);
        }
        else {
            task.status = TaskStatus.FAILED;
            task.error = error;
            task.completedAt = Date.now();
            this.processing.delete(taskId);
            this.stats.totalFailed++;
            this.emit('task_failed', task, error);
            this.logger.warn(`Task failed after ${task.retries} retries: ${taskId}`, error);
        }
    }
    cancel(taskId) {
        const task = this.taskMap.get(taskId);
        if (!task)
            return false;
        task.status = TaskStatus.CANCELLED;
        task.completedAt = Date.now();
        this.queue = this.queue.filter(t => t.id !== taskId);
        this.processing.delete(taskId);
        this.stats.totalCancelled++;
        this.emit('task_cancelled', task);
        return true;
    }
    getTask(taskId) {
        return this.taskMap.get(taskId);
    }
    getTasks(status) {
        if (status) {
            return this.queue.filter(t => t.status === status);
        }
        return [...this.queue];
    }
    getPendingCount() {
        return this.queue.filter(t => t.status === TaskStatus.PENDING).length;
    }
    getRunningCount() {
        return this.processing.size;
    }
    pause() {
        this.paused = true;
        this.logger.info('Task queue paused');
    }
    resume() {
        this.paused = false;
        this.logger.info('Task queue resumed');
    }
    clear() {
        this.queue = [];
        this.taskMap.clear();
        this.processing.clear();
        this.logger.info('Task queue cleared');
    }
    updateStats(task) {
        this.stats.totalCompleted++;
        if (task.startedAt && task.completedAt) {
            const duration = task.completedAt - task.startedAt;
            const totalTime = this.stats.avgProcessingTime * (this.stats.totalCompleted - 1) + duration;
            this.stats.avgProcessingTime = totalTime / this.stats.totalCompleted;
        }
    }
    getStats() {
        return { ...this.stats };
    }
    getConfig() {
        return { ...this.config };
    }
}
export const taskQueue = new TaskQueue();
//# sourceMappingURL=TaskQueue.js.map