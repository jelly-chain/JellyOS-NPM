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
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
const JELLY_HOME = process.env.JELLYOS_HOME ?? join(homedir(), ".jelly");
import { createRequire } from "module";
const cjsRequire = createRequire(import.meta.url);
export class MemoryStore {
    db = null;
    available = false;
    constructor() {
        this.init();
    }
    init() {
        try {
            // node:sqlite is available in Node 22+ (experimental) and Node 24 (stable)
            // We import it dynamically to avoid a hard crash on older Node versions
            const sqlite = cjsRequire("node:sqlite");
            mkdirSync(JELLY_HOME, { recursive: true });
            this.db = new sqlite.DatabaseSync(join(JELLY_HOME, "memory.db"));
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id        INTEGER PRIMARY KEY AUTOINCREMENT,
          sessionId TEXT    NOT NULL,
          role      TEXT    NOT NULL,
          content   TEXT    NOT NULL,
          tokens    INTEGER DEFAULT 0,
        ts        INTEGER NOT NULL,
          tags      TEXT    DEFAULT '[]'
        );
        CREATE INDEX IF NOT EXISTS idx_session ON messages(sessionId);
        CREATE INDEX IF NOT EXISTS idx_ts      ON messages(ts);
        -- Prune old entries automatically (keep last 10k messages)
        CREATE TRIGGER IF NOT EXISTS prune_old_messages
          AFTER INSERT ON messages
          WHEN (SELECT COUNT(*) FROM messages) > 10000
          BEGIN
            DELETE FROM messages WHERE id IN (
              SELECT id FROM messages ORDER BY ts ASC LIMIT 500
            );
          END;
      `);
            this.available = true;
        }
        catch {
            // SQLite not available (Node <22) — memory store degrades gracefully
            this.available = false;
        }
    }
    get isAvailable() { return this.available; }
    // ── Write ──────────────────────────────────────────────────────────────────
    save(sessionId, role, content, tags = []) {
        if (!this.available)
            return;
        try {
            const tokens = Math.ceil(content.length / 4);
            // Cap content at 2KB per entry to keep DB lean
            const capped = content.length > 2000 ? content.slice(0, 2000) + "…" : content;
            this.db.prepare(`INSERT INTO messages (sessionId, role, content, tokens, ts, tags)
         VALUES (?, ?, ?, ?, ?, ?)`).run(sessionId, role, capped, tokens, Date.now(), JSON.stringify(tags));
        }
        catch { /* best effort */ }
    }
    // ── Read ───────────────────────────────────────────────────────────────────
    /** Keyword search across all sessions */
    search(query, limit = 8) {
        if (!this.available)
            return [];
        try {
            const rows = this.db.prepare(`SELECT * FROM messages WHERE content LIKE ? ORDER BY ts DESC LIMIT ?`).all(`%${query}%`, limit);
            return rows.map((r) => ({
                ...r,
                tags: JSON.parse(r["tags"] ?? "[]"),
            }));
        }
        catch {
            return [];
        }
    }
    /** Get summaries of recent sessions (for system prompt injection) */
    getRecentSessions(limit = 5) {
        if (!this.available)
            return [];
        try {
            const rows = this.db.prepare(`
        SELECT
          sessionId,
          COUNT(*) as msgCount,
          MAX(ts)  as ts,
          GROUP_CONCAT(
            CASE WHEN role = 'user'      THEN SUBSTR(content, 1, 120)
                 WHEN role = 'assistant' THEN SUBSTR(content, 1, 120)
                 END,
            ' | '
          ) as summary
        FROM messages
        GROUP BY sessionId
        ORDER BY ts DESC
        LIMIT ?
      `).all(limit);
            return rows.map((r) => ({
                sessionId: r["sessionId"],
                summary: (r["summary"] ?? "").slice(0, 400),
                msgCount: r["msgCount"],
                ts: r["ts"],
            }));
        }
        catch {
            return [];
        }
    }
    /** Get all messages for a specific session */
    getSession(sessionId) {
        if (!this.available)
            return [];
        try {
            const rows = this.db.prepare(`SELECT * FROM messages WHERE sessionId = ? ORDER BY ts ASC`).all(sessionId);
            return rows.map((r) => ({
                ...r,
                tags: JSON.parse(r["tags"] ?? "[]"),
            }));
        }
        catch {
            return [];
        }
    }
    /** Build a short memory context block for system prompt injection */
    buildContextBlock(currentSessionId) {
        if (!this.available)
            return "";
        const recent = this.getRecentSessions(3).filter(s => s.sessionId !== currentSessionId);
        if (recent.length === 0)
            return "";
        const lines = ["\n## Memory from Past Sessions"];
        for (const s of recent) {
            const ago = Math.round((Date.now() - s.ts) / 60_000);
            const agoStr = ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.round(ago / 60)}h ago` : `${Math.round(ago / 1440)}d ago`;
            lines.push(`- [${agoStr}] ${s.summary.slice(0, 200)}`);
        }
        lines.push("");
        return lines.join("\n");
    }
    getStats() {
        if (!this.available)
            return { totalMessages: 0, totalSessions: 0 };
        try {
            const { count } = this.db.prepare(`SELECT COUNT(*) as count FROM messages`).get();
            const { sessions } = this.db.prepare(`SELECT COUNT(DISTINCT sessionId) as sessions FROM messages`).get();
            return { totalMessages: count, totalSessions: sessions };
        }
        catch {
            return { totalMessages: 0, totalSessions: 0 };
        }
    }
}
/** Singleton */
export const memoryStore = new MemoryStore();
//# sourceMappingURL=MemoryStore.js.map