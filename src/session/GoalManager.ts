/**
 * GoalManager — cross-session persistent goal tracking. (#12)
 *
 * Goals set in one session survive restarts and are injected into the
 * system prompt on every subsequent session. This gives the agent
 * continuity — it knows what it was asked to watch or do.
 *
 * Stored in ~/.jelly/goals.json
 * Tools: set_goal, complete_goal, list_goals, update_goal_notes
 * Commands: /goals, /goal add <text>, /goal done <id>
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join }         from "node:path";
import { homedir }      from "node:os";
import { randomUUID }   from "node:crypto";
import { Type, type Static } from "@sinclair/typebox";

const JELLY_HOME  = process.env.JELLYOS_HOME ?? join(homedir(), ".jelly");
const GOALS_FILE  = join(JELLY_HOME, "goals.json");

export interface Goal {
  id:        string;
  text:      string;
  createdAt: number;
  updatedAt: number;
  status:    "active" | "completed" | "paused";
  notes:     string[]; // agent-written progress notes
}

export class GoalManager {
  private goals: Goal[] = [];

  constructor() {
    this.load();
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private load(): void {
    try {
      if (!existsSync(GOALS_FILE)) return;
      const raw = JSON.parse(readFileSync(GOALS_FILE, "utf-8"));
      if (Array.isArray(raw)) this.goals = raw as Goal[];
    } catch { /* start fresh */ }
  }

  private save(): void {
    try {
      mkdirSync(JELLY_HOME, { recursive: true });
      writeFileSync(GOALS_FILE, JSON.stringify(this.goals, null, 2), "utf-8");
    } catch { /* best effort */ }
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  add(text: string): Goal {
    const goal: Goal = {
      id:        randomUUID().slice(0, 8),
      text:      text.trim().slice(0, 500),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status:    "active",
      notes:     [],
    };
    this.goals.push(goal);
    this.save();
    return goal;
  }

  complete(id: string): boolean {
    const goal = this.goals.find(g => g.id === id);
    if (!goal) return false;
    goal.status    = "completed";
    goal.updatedAt = Date.now();
    this.save();
    return true;
  }

  pause(id: string): boolean {
    const goal = this.goals.find(g => g.id === id);
    if (!goal) return false;
    goal.status    = "paused";
    goal.updatedAt = Date.now();
    this.save();
    return true;
  }

  addNote(id: string, note: string): boolean {
    const goal = this.goals.find(g => g.id === id);
    if (!goal) return false;
    goal.notes.push(`[${new Date().toLocaleDateString()}] ${note.slice(0, 300)}`);
    goal.updatedAt = Date.now();
    if (goal.notes.length > 20) goal.notes = goal.notes.slice(-20); // keep last 20
    this.save();
    return true;
  }

  getActive(): Goal[] {
    return this.goals.filter(g => g.status === "active");
  }

  getAll(): Goal[] {
    return [...this.goals];
  }

  get(id: string): Goal | undefined {
    return this.goals.find(g => g.id === id);
  }

  // ── System Prompt Block ────────────────────────────────────────────────────

  /** Build an active goals block for injection into the system prompt */
  buildContextBlock(): string {
    const active = this.getActive();
    if (active.length === 0) return "";

    const lines = ["\n## Active Goals (set by user — monitor and act on these)"];
    for (const g of active) {
      lines.push(`- [${g.id}] ${g.text}`);
      if (g.notes.length > 0) {
        lines.push(`  Last note: ${g.notes[g.notes.length - 1]}`);
      }
    }
    lines.push("");
    return lines.join("\n");
  }

  // ── Tools ──────────────────────────────────────────────────────────────────

  readonly setGoalParams = Type.Object({
    text: Type.String({ description: "Goal text e.g. 'Watch ETH for breakout above $4000'" }),
  });

  async setGoalTool(_id: string, params: Static<typeof this.setGoalParams>) {
    const goal = this.add(params.text);
    return {
      content: [{ type: "text" as const, text: `Goal set: [${goal.id}] ${goal.text}` }],
      details: { goalId: goal.id, text: goal.text },
    };
  }

  readonly completeGoalParams = Type.Object({
    id:   Type.String({ description: "Goal ID to mark complete" }),
    note: Type.Optional(Type.String({ description: "Completion note" })),
  });

  async completeGoalTool(_id: string, params: Static<typeof this.completeGoalParams>) {
    if (params.note) this.addNote(params.id, params.note);
    const ok = this.complete(params.id);
    return {
      content: [{ type: "text" as const, text: ok ? `Goal ${params.id} marked complete.` : `Goal ${params.id} not found.` }],
      details: { goalId: params.id, success: ok },
    };
  }

  readonly listGoalsParams = Type.Object({
    status: Type.Optional(Type.String({ description: "Filter: active | completed | paused | all (default: active)" })),
  });

  async listGoalsTool(_id: string, params: Static<typeof this.listGoalsParams>) {
    const filter = params.status ?? "active";
    const goals  = filter === "all" ? this.getAll() : this.goals.filter(g => g.status === filter);

    if (goals.length === 0) {
      return { content: [{ type: "text" as const, text: `No ${filter} goals.` }], details: {} };
    }

    const lines = goals.map(g => {
      const icon  = g.status === "active" ? "🎯" : g.status === "completed" ? "✅" : "⏸";
      const notes = g.notes.length > 0 ? `\n  Notes: ${g.notes[g.notes.length - 1]}` : "";
      return `${icon} [${g.id}] ${g.text}${notes}`;
    });

    return {
      content: [{ type: "text" as const, text: `Goals (${filter}):\n${lines.join("\n")}` }],
      details: { count: goals.length, goals },
    };
  }

  readonly addGoalNoteParams = Type.Object({
    id:   Type.String({ description: "Goal ID" }),
    note: Type.String({ description: "Progress note to add" }),
  });

  async addGoalNoteTool(_id: string, params: Static<typeof this.addGoalNoteParams>) {
    const ok = this.addNote(params.id, params.note);
    return {
      content: [{ type: "text" as const, text: ok ? `Note added to goal ${params.id}.` : `Goal ${params.id} not found.` }],
      details: { goalId: params.id, success: ok },
    };
  }
}

/** Singleton */
export const goalManager = new GoalManager();
