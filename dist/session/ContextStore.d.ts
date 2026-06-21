/**
 * ContextStore — Ephemeral task context folders. (#31, #39)
 *
 * When an agent task takes >2 tool rounds, a ~/.jelly/tasks/<id>/context.md
 * file is created. Intermediate tool results are appended there instead of
 * bloating the message history. The model gets a compact file reference
 * instead of 10KB of raw JSON. The folder auto-deletes on task completion
 * unless the user marked it /keep.
 *
 * This is the primary mechanism that allows turbo/max mode to stay within
 * context budget even on complex multi-step research tasks.
 */
export interface TaskContext {
    taskId: string;
    taskDir: string;
    contextMd: string;
    createdAt: number;
    title: string;
    keep: boolean;
    findings: number;
}
export declare class ContextStore {
    private activeTasks;
    constructor();
    /** Open a new ephemeral task folder. Returns the TaskContext. */
    openTask(title: string, keep?: boolean): TaskContext;
    /** Append a finding / tool result to the task's context.md */
    appendFinding(taskId: string, section: string, content: string): void;
    /**
     * Get a compact reference string for injection into the model context.
     * Returns something like:
     * "[Task ctx: ~/.jelly/tasks/.../context.md — 4 findings, 3.2KB. Use read_task_context("abc123")]"
     */
    getReference(taskId: string): string;
    /**
     * Mark a task complete and optionally delete its folder.
     * Deletion is deferred 5 seconds to allow model to read final state.
     */
    closeTask(taskId: string): void;
    /** Permanently keep a task folder (user called /keep <taskId>) */
    keepTask(taskId: string): boolean;
    getActiveTasks(): TaskContext[];
    getTask(taskId: string): TaskContext | undefined;
    readContextTool(_id: string, { taskId }: {
        taskId: string;
    }): Promise<{
        content: {
            type: "text";
            text: string;
        }[];
        details: {
            taskId: string;
            path: string;
            sizeBytes: number;
            status: string;
            findings?: undefined;
        };
    } | {
        content: {
            type: "text";
            text: string;
        }[];
        details: {
            taskId?: undefined;
            path?: undefined;
            sizeBytes?: undefined;
            status?: undefined;
            findings?: undefined;
        };
    } | {
        content: {
            type: "text";
            text: string;
        }[];
        details: {
            taskId: string;
            path: string;
            sizeBytes: number;
            findings: number;
            status: string;
        };
    }>;
    listTasksTool(): Promise<{
        content: {
            type: "text";
            text: string;
        }[];
        details: {
            activeTasks: number;
            completedOnDisk: number;
        };
    }>;
}
/** Singleton — one store per process */
export declare const contextStore: ContextStore;
//# sourceMappingURL=ContextStore.d.ts.map