import { TaskQueue, TaskStatus } from './TaskQueue.js';
import { Logger } from './utils/Logger.js';
import { EventEmitter } from 'events';
const DEFAULT_CONFIG = {
    maxWorkers: 10,
    defaultWorkerType: 'default',
    enableWorkStealing: true,
    workTimeout: 60000,
};
export class TaskDispatcher extends EventEmitter {
    config;
    logger;
    taskQueue;
    workers = new Map();
    workerTypes = new Map();
    dispatchTimer = null;
    active = false;
    constructor(taskQueue, config) {
        super();
        this.taskQueue = taskQueue;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.logger = new Logger('TaskDispatcher');
    }
    registerWorker(worker) {
        this.workers.set(worker.id, worker);
        if (!this.workerTypes.has(worker.type)) {
            this.workerTypes.set(worker.type, []);
        }
        this.workerTypes.get(worker.type).push(worker);
        this.logger.info(`Registered worker: ${worker.id} (type: ${worker.type})`);
        this.emit('worker_registered', worker);
    }
    unregisterWorker(workerId) {
        const worker = this.workers.get(workerId);
        if (!worker)
            return;
        const workersOfType = this.workerTypes.get(worker.type) || [];
        const updated = workersOfType.filter(w => w.id !== workerId);
        this.workerTypes.set(worker.type, updated);
        this.workers.delete(workerId);
        this.logger.info(`Unregistered worker: ${workerId}`);
        this.emit('worker_unregistered', workerId);
    }
    start() {
        if (this.active)
            return;
        this.active = true;
        this.dispatchTimer = setInterval(() => this.dispatch(), 100);
        this.logger.info('TaskDispatcher started');
        this.emit('started');
    }
    stop() {
        this.active = false;
        if (this.dispatchTimer) {
            clearInterval(this.dispatchTimer);
            this.dispatchTimer = null;
        }
        this.logger.info('TaskDispatcher stopped');
        this.emit('stopped');
    }
    dispatch() {
        const pendingTasks = this.taskQueue.getTasks(TaskStatus.PENDING);
        for (const task of pendingTasks) {
            const worker = this.findAvailableWorker(task);
            if (!worker)
                continue;
            this.assignTask(worker, task);
        }
    }
    findAvailableWorker(task) {
        const preferredType = task.payload?.preferredWorker || this.config.defaultWorkerType;
        const availableWorkers = this.workerTypes.get(preferredType) || [];
        for (const worker of availableWorkers) {
            if (!worker.busy && worker.currentTasks < worker.maxConcurrent) {
                return worker;
            }
        }
        if (this.config.enableWorkStealing) {
            for (const [, workers] of this.workerTypes) {
                for (const worker of workers) {
                    if (!worker.busy && worker.currentTasks < worker.maxConcurrent) {
                        return worker;
                    }
                }
            }
        }
        return null;
    }
    assignTask(worker, task) {
        worker.busy = true;
        worker.currentTasks++;
        task.assignedTo = worker.id;
        this.logger.debug(`Assigning task ${task.id} to worker ${worker.id}`);
        this.emit('task_assigned', task, worker);
        const timeout = setTimeout(() => {
            if (task.status === TaskStatus.RUNNING) {
                this.handleTimeout(task, worker);
            }
        }, task.timeout || this.config.workTimeout);
        worker.process(task)
            .then(result => {
            clearTimeout(timeout);
            this.taskQueue.complete(task.id, result);
            this.releaseWorker(worker);
            this.emit('task_finished', task, result);
        })
            .catch(error => {
            clearTimeout(timeout);
            this.taskQueue.fail(task.id, error);
            this.releaseWorker(worker);
            this.emit('task_error', task, error);
        });
    }
    handleTimeout(task, worker) {
        this.logger.warn(`Task ${task.id} timed out`);
        this.taskQueue.fail(task.id, new Error('Task timeout'));
        this.releaseWorker(worker);
    }
    releaseWorker(worker) {
        worker.busy = false;
        worker.currentTasks = Math.max(0, worker.currentTasks - 1);
    }
    getWorker(workerId) {
        return this.workers.get(workerId);
    }
    getWorkers() {
        return [...this.workers.values()];
    }
    getWorkersByType(type) {
        return this.workerTypes.get(type) || [];
    }
    getStats() {
        const workers = [...this.workers.values()];
        return {
            totalWorkers: workers.length,
            busyWorkers: workers.filter(w => w.busy).length,
            totalCurrentTasks: workers.reduce((sum, w) => sum + w.currentTasks, 0),
        };
    }
}
export const dispatcher = new TaskDispatcher(new TaskQueue());
//# sourceMappingURL=TaskDispatcher.js.map