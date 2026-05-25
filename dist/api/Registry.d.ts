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
import type { CommandDef, ToolDef, SkillDef, SessionEvent, SessionContext } from "./ExtensionAPI.js";
import type { TSchema } from "@sinclair/typebox";
export declare class Registry {
    private commands;
    private tools;
    private skills;
    private hooks;
    private _systemPrompt;
    addCommand(name: string, def: CommandDef): void;
    addTool<P extends TSchema>(def: ToolDef<P>): void;
    addSkill(def: SkillDef): void;
    addHook(event: SessionEvent, handler: (...args: any[]) => Promise<void>): void;
    setSystemPrompt(prompt: string): void;
    getCommand(name: string): CommandDef | undefined;
    listCommands(): Array<[string, CommandDef]>;
    listTools(): Array<ToolDef<TSchema>>;
    getTool(name: string): ToolDef<TSchema> | undefined;
    listSkills(): SkillDef[];
    getSystemPrompt(): string;
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
    fireHook(event: string, ctx: SessionContext): Promise<void>;
    toOpenAITools(): Array<{
        type: "function";
        function: {
            name: string;
            description: string;
            parameters: unknown;
        };
    }>;
}
//# sourceMappingURL=Registry.d.ts.map