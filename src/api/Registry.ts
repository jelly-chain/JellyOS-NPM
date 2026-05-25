/**
 * Registry — stores all commands, tools, and skills registered by extension files.
 *
 * Pi calling convention for lifecycle hooks:
 *   session_start / session_end / session_shutdown: handler(event, ctx)
 *   before_agent_start:                             handler(event, ctx)
 *
 * We always call hooks as handler(undefined, ctx) — handlers that expect only
 * one argument (ctx) will receive it as the first positional parameter only if
 * they follow Pi's two-arg (event, ctx) convention; handlers with no args are
 * also safe. This matches Pi's actual calling convention exactly.
 */

import type {
  CommandDef, ToolDef, SkillDef,
  SessionEvent, SessionContext,
} from "./ExtensionAPI.js";
import type { TSchema } from "@sinclair/typebox";

// Variable-arity hook — supports () | (ctx) | (event, ctx) handler conventions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHook = (...args: any[]) => Promise<void>;

export class Registry {
  private commands = new Map<string, CommandDef>();
  private tools    = new Map<string, ToolDef<TSchema>>();
  private skills:  SkillDef[] = [];

  private hooks = new Map<string, AnyHook[]>();

  private _systemPrompt = "";

  // ── Registration ────────────────────────────────────────────────────────

  addCommand(name: string, def: CommandDef): void {
    this.commands.set(name.toLowerCase(), def);
  }

  addTool<P extends TSchema>(def: ToolDef<P>): void {
    this.tools.set(def.name, def as unknown as ToolDef<TSchema>);
  }

  addSkill(def: SkillDef): void {
    this.skills.push(def);
  }

  addHook(event: SessionEvent, handler: (...args: any[]) => Promise<void>): void {
    // Normalize aliases: session_shutdown → session_end
    const key = event === "session_shutdown" ? "session_end" : event;
    const list = this.hooks.get(key) ?? [];
    list.push(handler as AnyHook);
    this.hooks.set(key, list);
  }

  setSystemPrompt(prompt: string): void {
    this._systemPrompt = prompt;
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  getCommand(name: string): CommandDef | undefined {
    return this.commands.get(name.toLowerCase());
  }

  listCommands(): Array<[string, CommandDef]> {
    return [...this.commands.entries()];
  }

  listTools(): Array<ToolDef<TSchema>> {
    return [...this.tools.values()];
  }

  getTool(name: string): ToolDef<TSchema> | undefined {
    return this.tools.get(name);
  }

  listSkills(): SkillDef[] {
    return this.skills;
  }

  getSystemPrompt(): string {
    return this._systemPrompt;
  }

  // ── Hook dispatch ────────────────────────────────────────────────────────

  /**
   * Fire hooks for a lifecycle event.
   *
   * Supports all handler arities so Pi-compat and simplified extensions both work:
   *   h.length === 0 : async () => { ... }          → called with no args
   *   h.length === 1 : async (ctx) => { ... }        → called with ctx as first arg
   *   h.length >= 2  : async (event, ctx) => { ... } → Pi convention: (undefined, ctx)
   *
   * Using Function.length (declared parameter count) lets us detect intent without
   * runtime type checks, avoiding the bug where h(undefined, ctx) puts `undefined`
   * into the `ctx` parameter of a single-argument handler.
   */
  async fireHook(event: string, ctx: SessionContext): Promise<void> {
    const key      = event === "session_shutdown" ? "session_end" : event;
    const handlers = this.hooks.get(key) ?? [];
    for (const h of handlers) {
      try {
        if (h.length === 0) {
          await h();                // () => {...}
        } else if (h.length === 1) {
          await h(ctx as any);      // (ctx) => {...}
        } else {
          await h(undefined, ctx);  // (_event, ctx) => {...}  — Pi convention
        }
      } catch { /* hooks must not crash the session */ }
    }
  }

  // ── OpenAI tool schema ───────────────────────────────────────────────────

  toOpenAITools(): Array<{
    type: "function";
    function: { name: string; description: string; parameters: unknown };
  }> {
    return [...this.tools.values()].map(t => ({
      type: "function" as const,
      function: {
        name:        t.name,
        description: t.description,
        parameters:  t.parameters,
      },
    }));
  }
}
