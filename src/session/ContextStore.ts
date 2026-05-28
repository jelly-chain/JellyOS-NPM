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

import {
  mkdirSync, writeFileSync, rmSync,
  existsSync, readFileSync, readdirSync,
} from "node:fs";
import { join }        from "node:path";
import { homedir }     from "node:os";
import { randomUUID }  from "node:crypto";

const JELLY_HOME = process.env.JELLYOS_HOME ?? join(homedir(), ".jelly");
const TASKS_DIR  = join(JELLY_HOME, "tasks");

export interface TaskContext {
  taskId:    string;
  taskDir:   string;
  contextMd: string;  // path to context.md
  createdAt: number;
  title:     string;
  keep:      boolean; // if true, folder is not deleted on closeTask()
  findings:  number;  // count of appended findings
}

export class ContextStore {
  private activeTasks = new Map<string, TaskContext>();

  constructor() {
    mkdirSync(TASKS_DIR, { recursive: true });
  }

  // ── Task lifecycle ─────────────────────────────────────────────────────────

  /** Open a new ephemeral task folder. Returns the TaskContext. */
  openTask(title: string, keep = false): TaskContext {
    const taskId    = randomUUID().slice(0, 8);
    const taskDir   = join(TASKS_DIR, `${Date.now()}-${taskId}`);
    const contextMd = join(taskDir, "context.md");

    mkdirSync(taskDir, { recursive: true });

    writeFileSync(contextMd, [
      `# Task: ${title.slice(0, 120)}`,
      `**ID:** ${taskId}`,
      `**Started:** ${new Date().toISOString()}`,
      `**Status:** in_progress`,
      ``,
      `## Findings`,
      ``,
    ].join("\n"), "utf-8");

    const ctx: TaskContext = {
      taskId, taskDir, contextMd,
      createdAt: Date.now(), title, keep, findings: 0,
    };
    this.activeTasks.set(taskId, ctx);
    return ctx;
  }

  /** Append a finding / tool result to the task's context.md */
  appendFinding(taskId: string, section: string, content: string): void {
    const ctx = this.activeTasks.get(taskId);
    if (!ctx || !existsSync(ctx.contextMd)) return;

    // Cap individual entries at 3KB to prevent runaway growth
    const cappedContent = content.length > 3000
      ? content.slice(0, 3000) + `\n\n…[truncated ${content.length - 3000} chars]`
      : content;

    const entry = [
      `### ${section}`,
      `_${new Date().toLocaleTimeString()}_`,
      ``,
      cappedContent,
      ``,
      `---`,
      ``,
    ].join("\n");

    const existing = readFileSync(ctx.contextMd, "utf-8");
    writeFileSync(ctx.contextMd, existing + entry, "utf-8");
    ctx.findings++;
  }

  /**
   * Get a compact reference string for injection into the model context.
   * Returns something like:
   * "[Task ctx: ~/.jelly/tasks/.../context.md — 4 findings, 3.2KB. Use read_task_context("abc123")]"
   */
  getReference(taskId: string): string {
    const ctx = this.activeTasks.get(taskId);
    if (!ctx || !existsSync(ctx.contextMd)) return "";

    const content = readFileSync(ctx.contextMd, "utf-8");
    const sizeKB  = (content.length / 1024).toFixed(1);

    return `[Task context saved: ${ctx.contextMd} — ${ctx.findings} findings, ${sizeKB}KB. ` +
           `To read back: use tool read_task_context with taskId="${taskId}"]`;
  }

  /**
   * Mark a task complete and optionally delete its folder.
   * Deletion is deferred 5 seconds to allow model to read final state.
   */
  closeTask(taskId: string): void {
    const ctx = this.activeTasks.get(taskId);
    if (!ctx) return;

    // Update status in the file
    if (existsSync(ctx.contextMd)) {
      try {
        const content = readFileSync(ctx.contextMd, "utf-8");
        writeFileSync(
          ctx.contextMd,
          content
            .replace("**Status:** in_progress",
              `**Status:** completed\n**Completed:** ${new Date().toISOString()}`),
          "utf-8",
        );
      } catch { /* best effort */ }
    }

    if (!ctx.keep) {
      // Deferred delete — give agent 5s to read final context if needed
      setTimeout(() => {
        try { rmSync(ctx.taskDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }, 5_000);
    }

    this.activeTasks.delete(taskId);
  }

  /** Permanently keep a task folder (user called /keep <taskId>) */
  keepTask(taskId: string): boolean {
    const ctx = this.activeTasks.get(taskId);
    if (!ctx) return false;
    ctx.keep = true;
    return true;
  }

  getActiveTasks(): TaskContext[] {
    return [...this.activeTasks.values()];
  }

  getTask(taskId: string): TaskContext | undefined {
    return this.activeTasks.get(taskId);
  }

  // ── Tool: read_task_context ────────────────────────────────────────────────

  async readContextTool(_id: string, { taskId }: { taskId: string }) {
    const ctx = this.activeTasks.get(taskId);
    if (!ctx) {
      // Try to find a completed task folder on disk by taskId suffix
      const dirs = existsSync(TASKS_DIR) ? readdirSync(TASKS_DIR) : [];
      const dir  = dirs.find(d => d.endsWith(`-${taskId}`));
      if (dir) {
        const mdPath = join(TASKS_DIR, dir, "context.md");
        if (existsSync(mdPath)) {
          const content = readFileSync(mdPath, "utf-8");
          return {
            content: [{ type: "text" as const, text: content }],
            details: { taskId, path: mdPath, sizeBytes: content.length, status: "archived" },
          };
        }
      }
      return {
        content: [{ type: "text" as const, text: `Task "${taskId}" not found. It may have been deleted after completion.` }],
        details: {},
      };
    }

    if (!existsSync(ctx.contextMd)) {
      return {
        content: [{ type: "text" as const, text: `Context file missing for task "${taskId}".` }],
        details: {},
      };
    }

    const content = readFileSync(ctx.contextMd, "utf-8");
    return {
      content: [{ type: "text" as const, text: content }],
      details: {
        taskId,
        path:      ctx.contextMd,
        sizeBytes: content.length,
        findings:  ctx.findings,
        status:    "active",
      },
    };
  }

  // ── Tool: list_tasks ───────────────────────────────────────────────────────

  async listTasksTool() {
    const active = this.getActiveTasks();

    // Also scan disk for recent completed tasks
    const onDisk: { dir: string; id: string; sizeKB: string }[] = [];
    if (existsSync(TASKS_DIR)) {
      const dirs = readdirSync(TASKS_DIR).slice(-10); // last 10
      for (const d of dirs) {
        const mdPath = join(TASKS_DIR, d, "context.md");
        if (existsSync(mdPath)) {
          const size = (readFileSync(mdPath, "utf-8").length / 1024).toFixed(1);
          const id   = d.split("-").pop() ?? d;
          if (!this.activeTasks.has(id)) onDisk.push({ dir: d, id, sizeKB: size });
        }
      }
    }

    const lines: string[] = [];
    if (active.length > 0) {
      lines.push(`Active tasks (${active.length}):`);
      for (const t of active) {
        const mdContent = existsSync(t.contextMd) ? readFileSync(t.contextMd, "utf-8") : "";
        const sizeKB    = (mdContent.length / 1024).toFixed(1);
        lines.push(`  📁 [${t.taskId}] ${t.title.slice(0, 50)} — ${t.findings} findings, ${sizeKB}KB`);
      }
    }
    if (onDisk.length > 0) {
      lines.push(`\nRecent completed tasks:`);
      for (const t of onDisk) {
        lines.push(`  📄 [${t.id}] ${t.dir.slice(14, 64)} — ${t.sizeKB}KB`);
      }
    }
    if (lines.length === 0) lines.push("No active or recent task contexts.");

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
      details: { activeTasks: active.length, completedOnDisk: onDisk.length },
    };
  }
}

/** Singleton — one store per process */
export const contextStore = new ContextStore();
