/**
 * ExtensionAPI — the interface exposed to extension files (e.g. extensions/jellyos.ts).
 *
 * Drop-in replacement for Pi's ExtensionAPI. Extension files that ran under Pi
 * work without changes — all Pi methods and calling conventions are preserved:
 *   - ui.setStatus, ui.setTheme, ui.setHeader
 *   - ctx.hasUI
 *   - pi.on("session_start",       async (_event, ctx) => { ... })  ← Pi convention
 *   - pi.on("session_shutdown",    async () => { ... })
 *   - pi.on("before_agent_start",  async (_event, ctx) => { ... })
 */
import { type Static, type TObject, type TSchema } from "@sinclair/typebox";
export type { Static, TObject, TSchema };
export interface ToolContent {
    content: Array<{
        type: "text";
        text: string;
    }>;
    details: Record<string, unknown>;
}
export declare function text(t: string): ToolContent;
export interface ToolDef<P extends TSchema = TSchema> {
    name: string;
    label: string;
    description: string;
    parameters: P;
    execute(id: string, params: Static<P>): Promise<ToolContent>;
}
export interface TuiHeader {
    render(width: number): string[];
    invalidate(): void;
}
export type HeaderFactory = (tui: unknown, theme: ThemeContext) => TuiHeader;
export interface ThemeContext {
    /** Apply a named colour to text. Colours: accent, error, warn, muted, success, border, dim */
    fg(color: string, text: string): string;
}
export interface UIContext {
    /** Show a bordered notification in the REPL panel */
    notify(message: string): void;
    /**
     * Set a named status badge in the status bar.
     * Pi compat — multiple badges can be shown simultaneously.
     * @param key   Badge slot name (e.g. "vault", "jelly", "chain")
     * @param value Themed text to display
     */
    setStatus(key: string, value: string): void;
    /**
     * Activate a named theme. Pi compat — engine uses jelly theme by default.
     */
    setTheme(name: string): void;
    /**
     * Replace the TUI header with a custom rendering factory.
     * Pi compat — accepted but engine renders its own Ink header.
     */
    setHeader(factory: HeaderFactory): void;
    theme: ThemeContext;
}
export interface CommandContext {
    ui: UIContext;
}
export interface CommandDef {
    description: string;
    handler(args: string, ctx: CommandContext): Promise<void>;
}
export interface SkillDef {
    name: string;
    content: string;
}
export type SessionEvent = "session_start" | "session_end" | "session_shutdown" | "before_agent_start";
export interface SessionContext {
    ui: UIContext;
    /** True when running inside an interactive TUI (always true for @jellychain/agent) */
    hasUI: boolean;
    config: Record<string, string | undefined>;
}
export interface ExtensionAPI {
    registerCommand(name: string, def: CommandDef): void;
    registerTool<P extends TSchema>(def: ToolDef<P>): void;
    registerSkill(def: SkillDef): void;
    /**
     * Subscribe to a lifecycle event.
     * Pi calling convention: handler receives (event, ctx).
     * Handlers may use any arity: (event, ctx) | (ctx) | () — all are safe.
     */
    on(event: SessionEvent, handler: (...args: any[]) => Promise<void>): void;
    setSystemPrompt(prompt: string): void;
    /** Direct UI access available at any time */
    ui: UIContext;
}
export type ExtensionModule = (api: ExtensionAPI) => void | Promise<void>;
//# sourceMappingURL=ExtensionAPI.d.ts.map