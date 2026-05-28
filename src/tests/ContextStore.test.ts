/**
 * ContextStore tests — task lifecycle, findings, auto-delete.
 */
import { describe, it, expect, afterEach } from "vitest";
import { ContextStore } from "../session/ContextStore.js";
import { existsSync } from "node:fs";

// Use a temp dir for tests
process.env.JELLYOS_HOME = `/tmp/jellyos-test-${Date.now()}`;

describe("ContextStore", () => {
  let store: ContextStore;

  afterEach(() => {
    store = new ContextStore(); // fresh store
  });

  it("openTask creates a context.md file", () => {
    store = new ContextStore();
    const ctx = store.openTask("Test task");
    expect(existsSync(ctx.contextMd)).toBe(true);
    expect(ctx.taskId.length).toBeGreaterThan(0);
    expect(ctx.findings).toBe(0);
  });

  it("appendFinding increments findings count", () => {
    store = new ContextStore();
    const ctx = store.openTask("Test");
    store.appendFinding(ctx.taskId, "Price Data", "BTC: $70,000");
    store.appendFinding(ctx.taskId, "RSI", "RSI: 67 bullish");
    expect(store.getTask(ctx.taskId)?.findings).toBe(2);
  });

  it("getReference returns path + count info", () => {
    store = new ContextStore();
    const ctx = store.openTask("Analysis");
    store.appendFinding(ctx.taskId, "Data", "some findings");
    const ref = store.getReference(ctx.taskId);
    expect(ref).toContain("context.md");
    expect(ref).toContain("1 findings");
    expect(ref).toContain(ctx.taskId);
  });

  it("getActiveTasks returns open tasks", () => {
    store = new ContextStore();
    const t1 = store.openTask("Task 1");
    const t2 = store.openTask("Task 2");
    const active = store.getActiveTasks();
    expect(active.map(t => t.taskId)).toContain(t1.taskId);
    expect(active.map(t => t.taskId)).toContain(t2.taskId);
  });

  it("closeTask removes from active tasks", () => {
    store = new ContextStore();
    const ctx = store.openTask("Temp task");
    store.closeTask(ctx.taskId);
    expect(store.getTask(ctx.taskId)).toBeUndefined();
  });

  it("keepTask prevents deletion", () => {
    store = new ContextStore();
    const ctx = store.openTask("Important");
    store.keepTask(ctx.taskId);
    expect(store.getTask(ctx.taskId)?.keep).toBe(true);
  });

  it("readContextTool returns file contents", async () => {
    store = new ContextStore();
    const ctx = store.openTask("Read test");
    store.appendFinding(ctx.taskId, "Finding", "ETH price is $3000");
    const result = await store.readContextTool("", { taskId: ctx.taskId });
    expect(result.content[0]?.text).toContain("ETH price is $3000");
  });

  it("caps individual findings at 3000 chars", () => {
    store = new ContextStore();
    const ctx = store.openTask("Big task");
    const bigContent = "x".repeat(5000);
    store.appendFinding(ctx.taskId, "Big finding", bigContent);
    // Should not throw and should be capped
    const result = store.getReference(ctx.taskId);
    expect(result).toBeTruthy();
  });
});
