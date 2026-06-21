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
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { priceFeed } from "../tools/PriceFeed.js";
import { Type } from "@sinclair/typebox";
const JELLY_HOME = process.env.JELLYOS_HOME ?? join(homedir(), ".jelly");
const SCHEDULE_FILE = join(JELLY_HOME, "schedule.json");
// ── Cron parser (minimal subset) ──────────────────────────────────────────────
const SHORTHAND_MAP = {
    "@hourly": "0 * * * *",
    "@daily": "0 0 * * *",
    "@every_5m": "*/5 * * * *",
    "@every_15m": "*/15 * * * *",
    "@every_30m": "*/30 * * * *",
    "@every_1h": "0 * * * *",
    "@every_6h": "0 */6 * * *",
    "@every_12h": "0 */12 * * *",
};
function parseCron(expr) {
    const resolved = SHORTHAND_MAP[expr] ?? expr;
    const parts = resolved.trim().split(/\s+/);
    if (parts.length < 5)
        return () => false;
    const [minuteExpr, hourExpr] = parts;
    function matchField(expr, value) {
        if (expr === "*")
            return true;
        if (expr.startsWith("*/")) {
            const step = parseInt(expr.slice(2));
            return !isNaN(step) && value % step === 0;
        }
        const num = parseInt(expr);
        return !isNaN(num) && num === value;
    }
    return (now) => matchField(minuteExpr, now.getMinutes()) &&
        matchField(hourExpr, now.getHours());
}
// ── AgentScheduler ─────────────────────────────────────────────────────────────
export class AgentScheduler {
    tasks = [];
    timer;
    lastTickMinute = -1;
    constructor() {
        this.load();
    }
    // ── Persistence ────────────────────────────────────────────────────────────
    load() {
        try {
            if (!existsSync(SCHEDULE_FILE))
                return;
            const raw = JSON.parse(readFileSync(SCHEDULE_FILE, "utf-8"));
            if (Array.isArray(raw))
                this.tasks = raw;
        }
        catch { /* start fresh */ }
    }
    save() {
        try {
            mkdirSync(JELLY_HOME, { recursive: true });
            writeFileSync(SCHEDULE_FILE, JSON.stringify(this.tasks, null, 2), "utf-8");
        }
        catch { /* best effort */ }
    }
    // ── Lifecycle ──────────────────────────────────────────────────────────────
    start(onTrigger) {
        if (this.timer)
            return;
        // Poll every 60 seconds — aligned to minute boundaries
        this.timer = setInterval(() => this.tick(onTrigger), 60_000);
        // Run once immediately on start to catch any missed tasks
        this.tick(onTrigger);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }
    tick(onTrigger) {
        const now = new Date();
        const minute = now.getMinutes();
        // Prevent double-firing within the same minute
        if (minute === this.lastTickMinute)
            return;
        this.lastTickMinute = minute;
        for (const task of this.tasks) {
            if (!task.enabled)
                continue;
            let shouldRun = false;
            // One-shot: run at specific time
            if (task.runAt && !task.lastRun) {
                shouldRun = Date.now() >= task.runAt;
            }
            // Cron schedule
            if (task.cron && !shouldRun) {
                const matches = parseCron(task.cron);
                shouldRun = matches(now);
                // Prevent re-firing within same minute
                if (shouldRun && task.lastRun && Date.now() - task.lastRun < 58_000) {
                    shouldRun = false;
                }
            }
            // Price trigger
            if (task.trigger && !shouldRun) {
                shouldRun = this.checkPriceTrigger(task.trigger);
            }
            if (shouldRun) {
                task.lastRun = Date.now();
                task.runCount = (task.runCount ?? 0) + 1;
                if (task.runOnce)
                    task.enabled = false;
                this.save();
                onTrigger(task);
            }
        }
    }
    checkPriceTrigger(trigger) {
        const tick = priceFeed.get(trigger.symbol.toLowerCase());
        if (!tick)
            return false;
        if (trigger.above !== undefined && tick.price >= trigger.above)
            return true;
        if (trigger.below !== undefined && tick.price <= trigger.below)
            return true;
        if (trigger.changePct !== undefined && Math.abs(tick.change24h) >= trigger.changePct)
            return true;
        return false;
    }
    // ── Task CRUD ──────────────────────────────────────────────────────────────
    addTask(task) {
        const full = {
            ...task,
            id: randomUUID().slice(0, 8),
            createdAt: Date.now(),
            runCount: 0,
        };
        this.tasks.push(full);
        this.save();
        return full;
    }
    removeTask(id) {
        const before = this.tasks.length;
        this.tasks = this.tasks.filter(t => t.id !== id);
        if (this.tasks.length < before) {
            this.save();
            return true;
        }
        return false;
    }
    enableTask(id, enabled) {
        const t = this.tasks.find(t => t.id === id);
        if (!t)
            return false;
        t.enabled = enabled;
        this.save();
        return true;
    }
    listTasks() { return [...this.tasks]; }
    getTask(id) {
        return this.tasks.find(t => t.id === id);
    }
    // ── Tools ──────────────────────────────────────────────────────────────────
    addTaskParams = Type.Object({
        name: Type.String({ description: "Task name" }),
        prompt: Type.String({ description: "The message the agent will run" }),
        cron: Type.Optional(Type.String({
            description: "Cron schedule: '*/15 * * * *' or shorthand @every_15m @hourly @daily",
        })),
        trigger_symbol: Type.Optional(Type.String({ description: "Symbol for price trigger e.g. BTC" })),
        trigger_above: Type.Optional(Type.Number({ description: "Fire when price goes above this" })),
        trigger_below: Type.Optional(Type.Number({ description: "Fire when price goes below this" })),
        trigger_change_pct: Type.Optional(Type.Number({ description: "Fire when 24h change exceeds this %" })),
        run_in_minutes: Type.Optional(Type.Number({ description: "One-shot: run after N minutes" })),
        run_once: Type.Optional(Type.Boolean({ description: "Disable after first run (default: false)" })),
    });
    async addTaskTool(_id, params) {
        let trigger;
        if (params.trigger_symbol) {
            trigger = {
                symbol: params.trigger_symbol,
                above: params.trigger_above,
                below: params.trigger_below,
                changePct: params.trigger_change_pct,
            };
        }
        const task = this.addTask({
            name: params.name,
            prompt: params.prompt,
            cron: params.cron,
            trigger,
            runAt: params.run_in_minutes ? Date.now() + params.run_in_minutes * 60_000 : undefined,
            runOnce: params.run_once ?? false,
            enabled: true,
        });
        const desc = [
            params.cron ? `cron: ${params.cron}` : "",
            trigger ? `trigger: ${params.trigger_symbol} ${trigger.above ? `>$${trigger.above}` : ""} ${trigger.below ? `<$${trigger.below}` : ""}` : "",
            params.run_in_minutes ? `runs in ${params.run_in_minutes}m` : "",
        ].filter(Boolean).join(", ");
        return {
            content: [{ type: "text", text: `Scheduled: [${task.id}] ${task.name}${desc ? ` (${desc})` : ""}` }],
            details: { taskId: task.id, task },
        };
    }
    listTasksParams = Type.Object({
        enabled_only: Type.Optional(Type.Boolean({ description: "Only show enabled tasks (default: false)" })),
    });
    async listTasksTool(_id, params) {
        const tasks = params.enabled_only ? this.tasks.filter(t => t.enabled) : this.tasks;
        if (tasks.length === 0) {
            return { content: [{ type: "text", text: "No scheduled tasks." }], details: {} };
        }
        const lines = tasks.map(t => {
            const icon = t.enabled ? "🟢" : "⚪";
            const schedule = t.cron ?? (t.trigger ? `price trigger ${t.trigger.symbol}` : t.runAt ? `at ${new Date(t.runAt).toLocaleTimeString()}` : "manual");
            const runs = t.runCount > 0 ? ` (${t.runCount} runs)` : "";
            return `${icon} [${t.id}] ${t.name} — ${schedule}${runs}`;
        });
        return {
            content: [{ type: "text", text: `Scheduled tasks (${tasks.length}):\n${lines.join("\n")}` }],
            details: { count: tasks.length, tasks },
        };
    }
    removeTaskParams = Type.Object({
        id: Type.String({ description: "Task ID to remove" }),
    });
    async removeTaskTool(_id, params) {
        const ok = this.removeTask(params.id);
        return {
            content: [{ type: "text", text: ok ? `Task ${params.id} removed.` : `Task ${params.id} not found.` }],
            details: { taskId: params.id, success: ok },
        };
    }
}
/** Singleton */
export const agentScheduler = new AgentScheduler();
//# sourceMappingURL=AgentScheduler.js.map