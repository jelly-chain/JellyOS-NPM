/**
 * SessionManager — manages conversation history, compaction, and persistence.
 *
 * History is kept in memory. If it exceeds MAX_TOKENS worth of rough char count,
 * it compacts by summarizing the oldest messages (keeps system + last N turns).
 */
import type { Message } from "../runner/ModelClient.js";
export declare class SessionManager {
    private history;
    private systemPrompt;
    setSystemPrompt(prompt: string): void;
    getSystemPrompt(): string;
    addMessage(msg: Message): void;
    addMessages(msgs: Message[]): void;
    /** Returns messages ready to send to the model — system prompt prepended */
    getMessages(): Message[];
    /** Full raw history (no system) */
    getHistory(): Message[];
    clear(): void;
    private buildSystemContent;
    private maybeCompact;
}
//# sourceMappingURL=SessionManager.d.ts.map