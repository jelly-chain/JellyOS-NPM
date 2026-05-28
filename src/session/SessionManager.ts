/**
 * SessionManager — manages conversation history, compaction, and persistence.
 *
 * Compaction is done in atomic turn pairs so tool_call_id references are
 * never orphaned (which causes 400 errors from every provider).
 *
 * Three compaction tiers:
 *   Tier 1 (>70%): trim long tool results to 1-line summaries
 *   Tier 2 (>85%): drop oldest complete turns (atomic pairs only)
 *   Tier 3 (>95%): hard reset keeping only last KEEP_TURNS turns
 */

import type { Message } from "../runner/ModelClient.js";

const MAX_HISTORY_CHARS  = 80_000;  // ~20k tokens rough estimate
const KEEP_TURNS         = 8;       // complete turns to keep on hard reset
const TOOL_RESULT_CAP    = 500;     // trim tool results longer than this

/** Context pressure levels for UI display and swarm gating */
export interface ContextPressure {
  chars:      number;
  pct:        number;
  level:      "green" | "yellow" | "red" | "critical";
  turboReady: boolean; // false when context >70% (swarm needs headroom)
}

export class SessionManager {
  private history:      Message[] = [];
  private systemPrompt            = "";

  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  addMessage(msg: Message): void {
    this.history.push(msg);
    this.maybeCompact();
  }

  addMessages(msgs: Message[]): void {
    for (const m of msgs) this.history.push(m);
    this.maybeCompact();
  }

  /** Returns messages ready to send to the model — system prompt prepended */
  getMessages(): Message[] {
    const sys: Message = { role: "system", content: this.buildSystemContent() };
    return [sys, ...this.history];
  }

  /** Full raw history (no system prompt) */
  getHistory(): Message[] {
    return [...this.history];
  }

  clear(): void {
    this.history = [];
  }

  charCount(): number {
    return this.history.reduce(
      (n, m) => n + (typeof m.content === "string" ? m.content.length : 0), 0,
    );
  }

  getContextPressure(): ContextPressure {
    const chars = this.charCount();
    const pct   = Math.min(100, Math.round(chars / MAX_HISTORY_CHARS * 100));
    return {
      chars,
      pct,
      level:      pct < 50 ? "green" : pct < 70 ? "yellow" : pct < 90 ? "red" : "critical",
      turboReady: pct < 70, // keep 30% free for swarm sub-agent outputs
    };
  }

  private buildSystemContent(): string {
    return this.systemPrompt || "You are JellyOS, an AI trading agent.";
  }

  /**
   * Split history into atomic turns.
   * A turn = [user_msg, assistant_msg, ...tool_result_msgs]
   * Keeping turns atomic prevents orphaned tool_call_id errors.
   */
  private splitIntoTurns(): Message[][] {
    const turns: Message[][] = [];
    let   current: Message[] = [];

    for (const msg of this.history) {
      // New user message starts a new turn (unless history starts with assistant)
      if (msg.role === "user" && current.length > 0) {
        turns.push(current);
        current = [];
      }
      current.push(msg);
    }
    if (current.length > 0) turns.push(current);
    return turns;
  }

  /**
   * Tier 1: Trim long tool results in-place. No messages dropped.
   * Replaces content >TOOL_RESULT_CAP chars with a 1-line summary.
   */
  private trimToolResults(): void {
    for (const msg of this.history) {
      if (msg.role === "tool" && typeof msg.content === "string" &&
          msg.content.length > TOOL_RESULT_CAP) {
        const firstLine = msg.content.split("\n")[0] ?? msg.content.slice(0, 120);
        msg.content = `${firstLine} … [trimmed, ${msg.content.length} chars]`;
      }
    }
  }

  /**
   * Tier 2: Drop oldest turns, but ANCHOR high-value messages (prices, signals,
   * decisions) so they survive compaction. (#36 semantic anchor compaction)
   */
  private dropOldTurns(): void {
    const turns = this.splitIntoTurns();
    if (turns.length <= KEEP_TURNS) return;

    const recentTurns = turns.slice(-KEEP_TURNS);
    const olderTurns  = turns.slice(0, -KEEP_TURNS);

    // #36: From older turns, extract high-weight messages as anchors
    const anchors: Message[] = [];
    for (const turn of olderTurns) {
      for (const msg of turn) {
        if (this.messageWeight(msg) >= 7) anchors.push(msg);
      }
    }

    // Prepend anchors (deduped) before the recent window
    const anchorIds = new Set(anchors.map(m => `${m.role}:${String(m.content).slice(0, 50)}`));
    const recentFlat = recentTurns.flat();
    // Remove any anchors already in recent window
    const recentIds  = new Set(recentFlat.map(m => `${m.role}:${String(m.content).slice(0, 50)}`));
    const dedupedAnchors = anchors.filter(m =>
      !recentIds.has(`${m.role}:${String(m.content).slice(0, 50)}`)
    );

    this.history = [...dedupedAnchors, ...recentFlat];
    void anchorIds; // suppress unused warning
  }

  /** #36: Score a message's semantic importance (0-10) */
  private messageWeight(msg: Message): number {
    if (msg.role === "system") return 10;
    const content = typeof msg.content === "string" ? msg.content.toLowerCase() : "";
    if (msg.role === "tool") {
      // High value: price data, signals, positions, goals
      if (/\$[\d,]+|\d+%|signal|buy|sell|position|goal|rsi|macd/.test(content)) return 8;
      if (/news|sentiment|bullish|bearish|tvl|funding/.test(content))              return 6;
      return 2; // generic tool result — expendable
    }
    if (msg.role === "user") return 3;
    if (msg.role === "assistant") {
      // Keep assistant messages with decisions/recommendations
      if (/recommend|suggest|should|will|plan|strategy|target|stop/.test(content)) return 7;
      return 4;
    }
    return 1;
  }

  maybeCompact(): void {
    const pct = this.getContextPressure().pct;
    if (pct < 70) return;
    if (pct < 85) { this.trimToolResults(); return; }    // Tier 1: trim verbose tool results
    if (pct < 95) { this.trimToolResults(); this.dropOldTurns(); return; } // Tier 2: drop turns
    // Tier 3: hard reset — emergency
    this.trimToolResults();
    this.dropOldTurns();
    if (this.getContextPressure().pct >= 95) {
      const turns = this.splitIntoTurns();
      this.history = turns.slice(-4).flat();
    }
  }

  /** Force compaction */
  forceCompact(): void {
    this.trimToolResults();
    this.dropOldTurns();
  }

  /**
   * #32: Tier-2 summarization via a cheap model.
   * Compresses the oldest 40% of turns into a single summary message.
   * Call this when pct is between 70-90 to reclaim space gracefully.
   * @param summarizeCallback — provided by AgentRunner which has model access
   */
  async summarizeOldTurns(
    summarizeCallback: (messages: Message[]) => Promise<string>,
  ): Promise<void> {
    const turns = this.splitIntoTurns();
    if (turns.length < 4) return; // not enough history to summarize

    const splitAt    = Math.floor(turns.length * 0.4);
    const toSummarize = turns.slice(0, splitAt).flat();
    const toKeep      = turns.slice(splitAt).flat();

    const summary = await summarizeCallback(toSummarize);

    this.history = [
      {
        role:    "system" as const,
        content: `[CONVERSATION SUMMARY — ${toSummarize.length} earlier messages compressed]\n${summary}`,
      },
      ...toKeep,
    ];
  }
}
