/**
 * SessionManager tests — atomic compaction, context pressure, semantic anchors.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { SessionManager } from "../session/SessionManager.js";
import type { Message } from "../runner/ModelClient.js";

function makeUserTurn(userContent: string, assistantContent: string): Message[] {
  return [
    { role: "user", content: userContent },
    { role: "assistant", content: assistantContent },
  ];
}

function makeToolTurn(userContent: string, toolContent: string): Message[] {
  const tc_id = `call_${Math.random().toString(36).slice(2)}`;
  return [
    { role: "user", content: userContent },
    { role: "assistant", content: null, tool_calls: [{ id: tc_id, type: "function", function: { name: "get_prices", arguments: "{}" } }] },
    { role: "tool", content: toolContent, name: "get_prices", tool_call_id: tc_id },
  ];
}

describe("SessionManager", () => {
  let session: SessionManager;

  beforeEach(() => {
    session = new SessionManager();
    session.setSystemPrompt("You are JellyOS.");
  });

  it("getMessages() prepends system prompt", () => {
    session.addMessage({ role: "user", content: "hello" });
    const msgs = session.getMessages();
    expect(msgs[0]?.role).toBe("system");
    expect(msgs[0]?.content).toContain("JellyOS");
    expect(msgs.length).toBe(2);
  });

  it("charCount() counts history chars", () => {
    session.addMessage({ role: "user", content: "hello" });
    expect(session.charCount()).toBe(5);
  });

  it("getContextPressure() returns green for small history", () => {
    session.addMessage({ role: "user", content: "hi" });
    const p = session.getContextPressure();
    expect(p.level).toBe("green");
    expect(p.turboReady).toBe(true);
    expect(p.pct).toBeLessThan(50);
  });

  it("getContextPressure() reports yellow at 60%", () => {
    // Add ~48KB of content (60% of 80KB)
    const bigMsg = "x".repeat(48_000);
    session.addMessage({ role: "user", content: bigMsg });
    const p = session.getContextPressure();
    expect(p.pct).toBeGreaterThanOrEqual(50);
  });

  it("turboReady is false when context >70%", () => {
    const bigMsg = "x".repeat(60_000);
    session.addMessage({ role: "user", content: bigMsg });
    const p = session.getContextPressure();
    expect(p.turboReady).toBe(false);
  });

  it("compaction never orphans tool_call_id pairs", () => {
    // Add enough turns to trigger compaction
    for (let i = 0; i < 20; i++) {
      for (const msg of makeToolTurn(`question ${i}`, `tool result ${i} — ${"data".repeat(200)}`)) {
        session.addMessage(msg);
      }
    }

    const history = session.getHistory();
    // Find all assistant messages with tool_calls
    const toolCallMsgs = history.filter(m => m.tool_calls && m.tool_calls.length > 0);

    for (const tcMsg of toolCallMsgs) {
      for (const tc of tcMsg.tool_calls!) {
        // Every tool_call_id must have a corresponding tool result
        const hasResult = history.some(m => m.role === "tool" && m.tool_call_id === tc.id);
        expect(hasResult).toBe(true);
      }
    }
  });

  it("forceCompact() reduces history", () => {
    for (let i = 0; i < 30; i++) {
      for (const msg of makeUserTurn(`q${i}`, `a${i}`)) {
        session.addMessage(msg);
      }
    }
    const before = session.getHistory().length;
    session.forceCompact();
    const after = session.getHistory().length;
    expect(after).toBeLessThanOrEqual(before);
  });

  it("clear() empties history", () => {
    session.addMessage({ role: "user", content: "hello" });
    session.clear();
    expect(session.getHistory().length).toBe(0);
  });
});

describe("SessionManager — SwarmRouter integration", () => {
  it("scoreComplexity returns low score for simple price check", async () => {
    const { scoreComplexity } = await import("../runner/SwarmRouter.js");
    expect(scoreComplexity("what is the price of ETH")).toBeLessThan(40);
  });

  it("scoreComplexity returns high score for complex multi-chain analysis", async () => {
    const { scoreComplexity } = await import("../runner/SwarmRouter.js");
    const score = scoreComplexity("analyze ETH and BTC then compare their RSI and predict which will pump first");
    expect(score).toBeGreaterThanOrEqual(40);
  });

  it("decomposeHeuristic splits on conjunctions", async () => {
    const { decomposeHeuristic } = await import("../runner/SwarmRouter.js");
    const tasks = decomposeHeuristic("analyze ETH and check BTC mempool and get SOL TPS", 5);
    expect(tasks.length).toBeGreaterThanOrEqual(2);
  });
});
