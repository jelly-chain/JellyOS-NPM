/**
 * MemoryStore — persistent long-term memory using Node 22+ built-in SQLite.
 * (#7 — cross-session memory)
 *
 * Stores all conversation messages, searchable by keyword and session.
 * Injected into system prompt at session_start to give the agent awareness
 * of past decisions, prices seen, strategies discussed.
 *
 * Uses node:sqlite (experimental in Node 22, stable in Node 24) — zero deps.
 */
export interface MemoryEntry {
    id: number;
    sessionId: string;
    role: string;
    content: string;
    tokens: number;
    ts: number;
    tags: string[];
}
export interface RecentSession {
    sessionId: string;
    summary: string;
    msgCount: number;
    ts: number;
}
export declare class MemoryStore {
    private db;
    private available;
    constructor();
    private init;
    get isAvailable(): boolean;
    save(sessionId: string, role: string, content: string, tags?: string[]): void;
    /** Keyword search across all sessions */
    search(query: string, limit?: number): MemoryEntry[];
    /** Get summaries of recent sessions (for system prompt injection) */
    getRecentSessions(limit?: number): RecentSession[];
    /** Get all messages for a specific session */
    getSession(sessionId: string): MemoryEntry[];
    /** Build a short memory context block for system prompt injection */
    buildContextBlock(currentSessionId: string): string;
    getStats(): {
        totalMessages: number;
        totalSessions: number;
    };
}
/** Singleton */
export declare const memoryStore: MemoryStore;
//# sourceMappingURL=MemoryStore.d.ts.map