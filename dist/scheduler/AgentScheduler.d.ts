/**
 * AgentScheduler — autonomous task scheduling. (#11)
 *
 * Enables the agent to act without user input:
 *   - Cron-style recurring tasks ("every 15 minutes, check BTC funding rates")
 *   - Price triggers ("when ETH drops below $2000, alert me")
 *   - One-shot future tasks ("in 30 minutes, summarize market conditions")
 *
 * Tasks are persisted to ~/.jelly/schedule.json and survive restarts.
 * The scheduler polls every 60s and fires tasks via the provided callback.
 *
 * Usage:
 *   scheduler.addTask({ name: "BTC check", prompt: "check BTC price and RSI", cron: "@every_15m" });
 *   scheduler.start((task) => runner.run(task.prompt));
 */
import { type Static } from "@sinclair/typebox";
export interface PriceTrigger {
    symbol: string;
    above?: number;
    below?: number;
    /** Percent change threshold (e.g. 5 = 5% move either direction) */
    changePct?: number;
}
export interface ScheduledTask {
    id: string;
    name: string;
    prompt: string;
    /** Cron expression e.g. "@every_15m" or "0 * * * *" (hourly).
     * Shorthand: @every_5m @every_15m @every_30m @every_1h @every_6h @hourly @daily
     */
    cron?: string;
    /** Price-based trigger */
    trigger?: PriceTrigger;
    /** One-shot run time (epoch ms) */
    runAt?: number;
    /** If true, disable after first run */
    runOnce: boolean;
    enabled: boolean;
    createdAt: number;
    lastRun?: number;
    runCount: number;
}
export declare class AgentScheduler {
    private tasks;
    private timer?;
    private lastTickMinute;
    constructor();
    private load;
    private save;
    start(onTrigger: (task: ScheduledTask) => void): void;
    stop(): void;
    private tick;
    private checkPriceTrigger;
    addTask(task: Omit<ScheduledTask, "id" | "createdAt" | "runCount">): ScheduledTask;
    removeTask(id: string): boolean;
    enableTask(id: string, enabled: boolean): boolean;
    listTasks(): ScheduledTask[];
    getTask(id: string): ScheduledTask | undefined;
    readonly addTaskParams: import("@sinclair/typebox").TObject<{
        name: import("@sinclair/typebox").TString;
        prompt: import("@sinclair/typebox").TString;
        cron: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        trigger_symbol: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        trigger_above: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
        trigger_below: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
        trigger_change_pct: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
        run_in_minutes: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
        run_once: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TBoolean>;
    }>;
    addTaskTool(_id: string, params: Static<typeof this.addTaskParams>): Promise<{
        content: {
            type: "text";
            text: string;
        }[];
        details: {
            taskId: string;
            task: ScheduledTask;
        };
    }>;
    readonly listTasksParams: import("@sinclair/typebox").TObject<{
        enabled_only: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TBoolean>;
    }>;
    listTasksTool(_id: string, params: Static<typeof this.listTasksParams>): Promise<{
        content: {
            type: "text";
            text: string;
        }[];
        details: {
            count?: undefined;
            tasks?: undefined;
        };
    } | {
        content: {
            type: "text";
            text: string;
        }[];
        details: {
            count: number;
            tasks: ScheduledTask[];
        };
    }>;
    readonly removeTaskParams: import("@sinclair/typebox").TObject<{
        id: import("@sinclair/typebox").TString;
    }>;
    removeTaskTool(_id: string, params: Static<typeof this.removeTaskParams>): Promise<{
        content: {
            type: "text";
            text: string;
        }[];
        details: {
            taskId: string;
            success: boolean;
        };
    }>;
}
/** Singleton */
export declare const agentScheduler: AgentScheduler;
//# sourceMappingURL=AgentScheduler.d.ts.map