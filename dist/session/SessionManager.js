/**
 * SessionManager — manages conversation history, compaction, and persistence.
 *
 * History is kept in memory. If it exceeds MAX_TOKENS worth of rough char count,
 * it compacts by summarizing the oldest messages (keeps system + last N turns).
 */
const MAX_HISTORY_CHARS = 80_000; // ~20k tokens rough estimate
const KEEP_RECENT = 20; // always keep last N messages after compaction
export class SessionManager {
    history = [];
    systemPrompt = "";
    setSystemPrompt(prompt) {
        this.systemPrompt = prompt;
    }
    getSystemPrompt() {
        return this.systemPrompt;
    }
    addMessage(msg) {
        this.history.push(msg);
        this.maybeCompact();
    }
    addMessages(msgs) {
        for (const m of msgs)
            this.history.push(m);
        this.maybeCompact();
    }
    /** Returns messages ready to send to the model — system prompt prepended */
    getMessages() {
        const sys = { role: "system", content: this.buildSystemContent() };
        return [sys, ...this.history];
    }
    /** Full raw history (no system) */
    getHistory() {
        return [...this.history];
    }
    clear() {
        this.history = [];
    }
    buildSystemContent() {
        return this.systemPrompt || "You are JellyOS, an AI trading agent.";
    }
    maybeCompact() {
        const totalChars = this.history.reduce((n, m) => n + (typeof m.content === "string" ? m.content.length : 0), 0);
        if (totalChars <= MAX_HISTORY_CHARS)
            return;
        // Keep the last KEEP_RECENT messages, drop the rest
        this.history = this.history.slice(-KEEP_RECENT);
    }
}
//# sourceMappingURL=SessionManager.js.map