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
export class Registry {
    commands = new Map();
    tools = new Map();
    skills = [];
    hooks = new Map();
    _systemPrompt = "";
    // ── Registration ────────────────────────────────────────────────────────
    addCommand(name, def) {
        this.commands.set(name.toLowerCase(), def);
    }
    addTool(def) {
        this.tools.set(def.name, def);
    }
    addSkill(def) {
        this.skills.push(def);
    }
    addHook(event, handler) {
        // Normalize aliases: session_shutdown → session_end
        const key = event === "session_shutdown" ? "session_end" : event;
        const list = this.hooks.get(key) ?? [];
        list.push(handler);
        this.hooks.set(key, list);
    }
    setSystemPrompt(prompt) {
        this._systemPrompt = prompt;
    }
    // ── Reads ────────────────────────────────────────────────────────────────
    getCommand(name) {
        return this.commands.get(name.toLowerCase());
    }
    listCommands() {
        return [...this.commands.entries()];
    }
    listTools() {
        return [...this.tools.values()];
    }
    getTool(name) {
        return this.tools.get(name);
    }
    listSkills() {
        return this.skills;
    }
    getSystemPrompt() {
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
    async fireHook(event, ctx) {
        const key = event === "session_shutdown" ? "session_end" : event;
        const handlers = this.hooks.get(key) ?? [];
        for (const h of handlers) {
            try {
                if (h.length === 0) {
                    await h(); // () => {...}
                }
                else if (h.length === 1) {
                    await h(ctx); // (ctx) => {...}
                }
                else {
                    await h(undefined, ctx); // (_event, ctx) => {...}  — Pi convention
                }
            }
            catch { /* hooks must not crash the session */ }
        }
    }
    // ── OpenAI tool schema ───────────────────────────────────────────────────
    toOpenAITools() {
        return [...this.tools.values()].map(t => ({
            type: "function",
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
            },
        }));
    }
}
//# sourceMappingURL=Registry.js.map