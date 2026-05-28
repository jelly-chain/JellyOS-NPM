/**
 * ModelClient — sends messages to any OpenAI-compatible model API.
 *
 * Provider priority (auto-detected from env):
 *   OpenRouter > Anthropic compat > OpenAI > local (ollama/lm-studio)
 *
 * Model rotation: resolveModelChain() returns up to 5 configs — the AgentRunner
 * walks the chain on 429 (rate limit) or 5xx errors, with exponential backoff
 * (up to 2 retries per model) before falling through.
 *
 * When a ModelRegistry is available, chains are dynamically built from the
 * tiered pool, with per-model performance tracking and cost estimation.
 *
 * All outbound, all local — no inbound ports, no server.
 */

import type { ModelRegistry } from "../models/ModelRegistry.js";

export interface Message {
  role:          "system" | "user" | "assistant" | "tool";
  content:       string | null;
  name?:         string;
  tool_calls?:   ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id:       string;
  type:     "function";
  function: { name: string; arguments: string };
}

export interface ChatChunk {
  type:           "delta" | "tool_call" | "done" | "error";
  text?:          string;
  tool_calls?:    ToolCall[];
  error?:         string;
  finish_reason?: string;
  /** HTTP status code — used by AgentRunner for rate-limit detection */
  status?:        number;
  /** Token usage reported by provider on final chunk */
  usage?:         { prompt_tokens: number; completion_tokens: number };
}

export interface ModelConfig {
  baseUrl:          string;
  apiKey:           string;
  model:            string;
  maxTokens:        number;
  temperature:      number;
  siteUrl?:         string;
  siteName?:        string;
  /** Enable extended thinking for Claude Opus 4.x / o3 / Qwen3 thinking models (#13) */
  thinkingEnabled?: boolean;
  /** Thinking token budget — only applies when thinkingEnabled=true (#13) */
  thinkingBudget?:  number;
}

// ── Model rotation chain ──────────────────────────────────────────────────────

/**
 * Build the ordered model fallback chain.
 *
 * If a ModelRegistry is provided, builds from the tiered pool dynamically.
 * Falls back to static env-var parsing otherwise.
 *
 * User-configurable pool: JELLY_MODEL_1 … JELLY_MODEL_5
 * If any JELLY_MODEL_N vars are set they take priority; up to 5 are used in
 * order. Unset slots are filled with provider-appropriate defaults.
 *
 * JELLY_MODEL_N format: just the model ID string, e.g.
 *   JELLY_MODEL_1=anthropic/claude-opus-4-5
 *   JELLY_MODEL_2=openai/gpt-4o
 *   JELLY_MODEL_3=google/gemini-2.5-pro
 */
export function resolveModelChain(modelReg?: ModelRegistry): ModelConfig[] {
  const env     = process.env;
  const tokens  = parseInt(env.MAX_TOKENS   ?? "8192");
  const temp    = parseFloat(env.TEMPERATURE ?? "0.7");

  // ── Collect user-configured model IDs (JELLY_MODEL_1..5) ────────────────
  const userModels: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const m = env[`JELLY_MODEL_${i}`];
    if (m?.trim()) userModels.push(m.trim());
  }

  // ── Use ModelRegistry dynamic pool if available ──────────────────────────
  if (modelReg) {
    return modelReg.buildModelChain(userModels);
  }

  // ── Static fallback (used when ModelRegistry cannot be initialised) ───────

  // ── OpenRouter — supports all providers via a single key ─────────────────
  if (env.OPENROUTER_API_KEY) {
    const base     = "https://openrouter.ai/api/v1";
    const key      = env.OPENROUTER_API_KEY;
    const siteUrl  = env.OPENROUTER_SITE_URL  ?? "https://jellychain.fun";
    const siteName = env.OPENROUTER_SITE_NAME ?? "JellyOS";
    const mk = (model: string): ModelConfig => ({
      baseUrl: base, apiKey: key, model, maxTokens: tokens, temperature: temp,
      siteUrl, siteName,
    });
    const defaults = [
      env.DEFAULT_MODEL ?? "anthropic/claude-sonnet-4-5",
      "anthropic/claude-3-haiku",
      "openai/gpt-4o-mini",
      "google/gemini-flash-1.5",
      "meta-llama/llama-3-8b-instruct:free",
    ];
    // Merge: user-configured models first, then fill remaining slots with defaults
    const merged = [...userModels, ...defaults.filter(d => !userModels.includes(d))].slice(0, 5);
    return merged.map(mk);
  }

  // ── Anthropic direct (OpenAI-compat endpoint) ────────────────────────────
  if (env.ANTHROPIC_API_KEY) {
    const base = "https://api.anthropic.com/v1";
    const key  = env.ANTHROPIC_API_KEY;
    const mk = (model: string): ModelConfig => ({
      baseUrl: base, apiKey: key, model, maxTokens: tokens, temperature: temp,
    });
    const defaults = [
      env.DEFAULT_MODEL ?? "claude-sonnet-4-5-20251101",
      "claude-3-haiku-20240307",
      "claude-3-5-haiku-20241022",
    ];
    const merged = [...userModels, ...defaults.filter(d => !userModels.includes(d))].slice(0, 5);
    return merged.map(mk);
  }

  // ── OpenAI direct ────────────────────────────────────────────────────────
  if (env.OPENAI_API_KEY) {
    const base = env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    const key  = env.OPENAI_API_KEY;
    const mk = (model: string): ModelConfig => ({
      baseUrl: base, apiKey: key, model, maxTokens: tokens, temperature: temp,
    });
    const defaults = [
      env.DEFAULT_MODEL ?? "gpt-4o",
      "gpt-4o-mini",
      "gpt-3.5-turbo",
    ];
    const merged = [...userModels, ...defaults.filter(d => !userModels.includes(d))].slice(0, 5);
    return merged.map(mk);
  }

  // ── Local model (ollama, lm-studio, etc.) — single entry, no rotation ───
  if (env.OPENAI_BASE_URL) {
    return [{
      baseUrl:     env.OPENAI_BASE_URL,
      apiKey:      env.OPENAI_API_KEY ?? "local",
      model:       userModels[0] ?? env.DEFAULT_MODEL ?? "llama3",
      maxTokens:   tokens,
      temperature: temp,
    }];
  }

  throw new Error(
    "No API key found. Set OPENROUTER_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY in ~/.jelly/.env"
  );
}

/** Convenience: returns just the primary (first) model config */
export function resolveModelConfig(modelReg?: ModelRegistry): ModelConfig {
  return resolveModelChain(modelReg)[0]!;
}

// ── ModelClient ───────────────────────────────────────────────────────────────

export class ModelClient {
  private modelRegistry?: ModelRegistry;

  constructor(
    private cfg: ModelConfig,
    modelReg?: ModelRegistry,
  ) {
    this.modelRegistry = modelReg;
  }

  /**
   * Stream a chat completion. Yields ChatChunk objects.
   * Retries up to 2 times on 429 / 5xx with exponential backoff (1s, 2s).
   * On persistent HTTP error the generator yields a single { type: "error", status, error }
   * chunk and returns — the caller (AgentRunner) decides whether to rotate.
   * Also reports success/failure to the ModelRegistry for tiering and cooldown.
   */
  async *stream(
    messages: Message[],
    tools?: Array<{ type: "function"; function: { name: string; description: string; parameters: unknown } }>,
    abortSignal?: AbortSignal,
  ): AsyncGenerator<ChatChunk> {
    const t0      = Date.now();
    let   hadError = false;

    const headers: Record<string, string> = {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${this.cfg.apiKey}`,
      "User-Agent":    "JellyOS/1.0",
    };
    if (this.cfg.siteUrl)  headers["HTTP-Referer"] = this.cfg.siteUrl;
    if (this.cfg.siteName) headers["X-Title"]      = this.cfg.siteName;

    // #13: Detect thinking-capable models
    const THINKING_MODELS = new Set([
      "anthropic/claude-opus-4.7", "anthropic/claude-opus-4.7-fast",
      "anthropic/claude-opus-4.6", "anthropic/claude-opus-4.6-fast",
      "anthropic/claude-opus-4.5", "anthropic/claude-opus-4",
      "openai/o3", "openai/o3-pro", "openai/o3-mini",
      "openai/o4", "openai/o4-mini",
    ]);
    const isThinkingModel  = THINKING_MODELS.has(this.cfg.model) || /thinking/i.test(this.cfg.model);
    const useThinking      = this.cfg.thinkingEnabled && isThinkingModel;
    const isOSeries        = /openai\/o[34]/i.test(this.cfg.model);
    const isAnthropicModel = this.cfg.model.startsWith("anthropic/") ||
                             this.cfg.baseUrl.includes("anthropic.com");

    // Build request body
    const body: Record<string, unknown> = {
      model:      this.cfg.model,
      max_tokens: this.cfg.maxTokens,
      stream:     true,
    };

    // #13: Temperature handling — o-series does not support temperature
    if (!isOSeries) {
      body.temperature = useThinking ? 1.0 : this.cfg.temperature; // thinking requires 1.0
    }

    // #15: Prompt caching for Anthropic — extract system message, add cache_control
    if (isAnthropicModel) {
      const sysMsg = messages.find(m => m.role === "system");
      const rest   = messages.filter(m => m.role !== "system");
      if (sysMsg && typeof sysMsg.content === "string" && sysMsg.content.length > 512) {
        // Cache the system prompt (saves up to 90% on repeated calls)
        body.system = [{
          type:          "text",
          text:          sysMsg.content,
          cache_control: { type: "ephemeral" },
        }];
        body.messages = rest;
      } else {
        body.messages = messages;
      }
      // #13: Extended thinking for Claude Opus 4.x
      if (useThinking) {
        body.thinking = { type: "enabled", budget_tokens: this.cfg.thinkingBudget ?? 8000 };
        headers["anthropic-beta"] = "thinking-v1";
      }
    } else {
      body.messages = messages;
    }

    // #13: o-series reasoning effort
    if (isOSeries && useThinking) {
      body.reasoning_effort = "high";
    }

    if (tools && tools.length > 0) {
      // strict: true enforces valid JSON on GPT-4o+ and GPT-5.x
      // Skip strict mode for o-series (not supported) and thinking models
      body.tools = tools.map(t => ({
        ...t,
        function: isOSeries ? t.function : { ...t.function, strict: true },
      }));
      body.tool_choice         = "auto";
      // Disable parallel tool calls — prevents race conditions in tool_call_id map
      body.parallel_tool_calls = false;
    }

    const MAX_RETRIES    = 2;
    const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
    let   res!:    Response;
    let   lastError = "";

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // #25: Combine user abort signal with 120s timeout
        const timeoutSignal = AbortSignal.timeout(120_000);
        const combinedSignal = abortSignal
          ? AbortSignal.any([abortSignal, timeoutSignal])
          : timeoutSignal;
        res = await fetch(`${this.cfg.baseUrl}/chat/completions`, {
          method:  "POST",
          headers,
          body:    JSON.stringify(body),
          signal:  combinedSignal,
        });
      } catch (e: any) {
        if (e?.name === "AbortError") { yield { type: "done", finish_reason: "aborted" }; return; }
        hadError   = true;
        lastError = `Network error: ${e.message}`;
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        this.modelRegistry?.recordFailure(this.cfg.model);
        yield { type: "error", error: lastError, status: 0 };
        return;
      }

      if (!res.ok && RETRY_STATUSES.has(res.status) && attempt < MAX_RETRIES) {
        hadError   = true;
        lastError = await res.text().catch(() => res.statusText);
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }

      if (!res.ok) {
        hadError = true;
        const err = await res.text().catch(() => res.statusText);
        // 404 → model removed, mark permanently deprecated
        if (res.status === 404) this.modelRegistry?.markDeprecated(this.cfg.model);
        else this.modelRegistry?.recordFailure(this.cfg.model);
        yield { type: "error", error: `Model API ${res.status}: ${err}`, status: res.status };
        return;
      }

      break; // success — got an ok response
    }

    // Accumulate tool calls across chunks (they arrive fragmented)
    const toolCallMap = new Map<number, { id: string; name: string; args: string }>();
    const reader  = res.body!.getReader();
    const decoder = new TextDecoder();
    let   buf     = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const lines = buf.split("\n");
      buf = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;

        let chunk: any;
        try { chunk = JSON.parse(trimmed.slice(6)); } catch { continue; }

        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          yield { type: "delta", text: delta.content };
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx      = tc.index ?? 0;
            const existing = toolCallMap.get(idx) ?? { id: "", name: "", args: "" };
            if (tc.id)                  existing.id   += tc.id;
            if (tc.function?.name)      existing.name += tc.function.name;
            if (tc.function?.arguments) existing.args += tc.function.arguments;
            toolCallMap.set(idx, existing);
          }
        }

        const finish = chunk.choices?.[0]?.finish_reason;
        // Capture usage from final chunk (OpenAI/OpenRouter send this on finish)
        if (chunk.usage) {
          yield {
            type:  "done",
            finish_reason: finish ?? "usage",
            usage: {
              prompt_tokens:     chunk.usage.prompt_tokens     ?? 0,
              completion_tokens: chunk.usage.completion_tokens ?? 0,
            },
          };
        }
        if (finish === "tool_calls" || finish === "stop") {
          if (toolCallMap.size > 0) {
            const tool_calls: ToolCall[] = [...toolCallMap.values()].map(tc => ({
              id:       tc.id   || `call_${Date.now()}`,
              type:     "function" as const,
              function: { name: tc.name, arguments: tc.args },
            }));
            yield { type: "tool_call", tool_calls };
            toolCallMap.clear();
          }
          if (!chunk.usage) yield { type: "done", finish_reason: finish };
        }
      }
    }

    // Flush any remaining tool calls if stream ended without finish_reason
    if (toolCallMap.size > 0) {
      const tool_calls: ToolCall[] = [...toolCallMap.values()].map(tc => ({
        id:       tc.id   || `call_${Date.now()}`,
        type:     "function" as const,
        function: { name: tc.name, arguments: tc.args },
      }));
      yield { type: "tool_call", tool_calls };
    }
    yield { type: "done", finish_reason: "end" };

    // Report success to model registry
    if (!hadError) this.modelRegistry?.recordSuccess(this.cfg.model, Date.now() - t0);
  }
}
