/**
 * ModelRegistry tests — tier classification + temperature profiles.
 */
import { describe, it, expect } from "vitest";
import { classifyModel } from "../models/ModelRegistry.js";
import type { OpenRouterModel } from "../models/ModelRegistry.js";

function makeModel(id: string, promptPrice = "0.000005"): OpenRouterModel {
  return {
    id,
    name:           id,
    created:        Date.now(),
    description:    "",
    context_length: 128_000,
    architecture:   { modality: "text", tokenizer: "cl100k", instruct_type: null },
    pricing:        { prompt: promptPrice, completion: "0.000015" },
    top_provider:   { context_length: 128_000, max_completion_tokens: 4096, is_moderated: false },
  };
}

describe("classifyModel() — 2025 models", () => {
  // Orchestrator tier
  it("classifies claude-opus-4.7 as orchestrator", () => {
    expect(classifyModel(makeModel("anthropic/claude-opus-4.7"))).toBe("orchestrator");
  });
  it("classifies claude-opus-4.6 as orchestrator", () => {
    expect(classifyModel(makeModel("anthropic/claude-opus-4.6"))).toBe("orchestrator");
  });
  it("classifies gpt-5.5 as orchestrator", () => {
    expect(classifyModel(makeModel("openai/gpt-5.5"))).toBe("orchestrator");
  });
  it("classifies gpt-5.5-pro as orchestrator", () => {
    expect(classifyModel(makeModel("openai/gpt-5.5-pro"))).toBe("orchestrator");
  });
  it("classifies gemini-3.1-pro as orchestrator", () => {
    expect(classifyModel(makeModel("google/gemini-3.1-pro-preview"))).toBe("orchestrator");
  });
  it("classifies deepseek-v4-pro as orchestrator", () => {
    expect(classifyModel(makeModel("deepseek/deepseek-v4-pro"))).toBe("orchestrator");
  });
  it("classifies grok-4.0 as orchestrator", () => {
    expect(classifyModel(makeModel("x-ai/grok-4.0"))).toBe("orchestrator");
  });

  // Analyst tier
  it("classifies claude-sonnet-4.6 as analyst", () => {
    expect(classifyModel(makeModel("anthropic/claude-sonnet-4.6"))).toBe("analyst");
  });
  it("classifies claude-sonnet-4.5 as analyst", () => {
    expect(classifyModel(makeModel("anthropic/claude-sonnet-4.5"))).toBe("analyst");
  });
  it("classifies gemini-3.5-flash as analyst", () => {
    expect(classifyModel(makeModel("google/gemini-3.5-flash"))).toBe("analyst");
  });
  it("classifies deepseek-v4 (non-pro) as analyst", () => {
    expect(classifyModel(makeModel("deepseek/deepseek-v4-flash"))).toBe("analyst");
  });

  // Free tier
  it("classifies :free models as free", () => {
    expect(classifyModel(makeModel("deepseek/deepseek-v4-flash:free", "0"))).toBe("free");
  });
  it("classifies free-priced models as free", () => {
    expect(classifyModel(makeModel("meta-llama/llama-3.1-8b-instruct:free", "0"))).toBe("free");
  });

  // Worker fallback
  it("classifies unknown model as worker", () => {
    expect(classifyModel(makeModel("some-unknown/model-v1"))).toBe("worker");
  });
  it("classifies small llama as worker", () => {
    expect(classifyModel(makeModel("meta-llama/llama-3.1-8b-instruct", "0.0002"))).toBe("worker");
  });
});
