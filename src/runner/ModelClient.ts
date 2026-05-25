/**
 * ModelClient — sends messages to any OpenAI-compatible model API.
 *
 * Provider priority (auto-detected from env):
 *   OpenRouter > Anthropic compat > OpenAI > local (ollama/lm-studio)
 *
 * Model rotation: resolveModelChain() returns up to 5 configs — the AgentRunner
 * walks the chain on 429 (rate limit) or 5xx errors, providing seamless fallback.
 *
 * All outbound, all local — no inbound ports, no server.
 */

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
}

export interface ModelConfig {
  baseUrl:     string;
  apiKey:      string;
  model:       string;
  maxTokens:   number;
  temperature: number;
  siteUrl?:    string;
  siteName?:   string;
}

// ── Model rotation chain ──────────────────────────────────────────────────────

/**
 * Build the ordered model fallback chain.
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
export function resolveModelChain(): ModelConfig[] {
  const env     = process.env;
  const tokens  = parseInt(env.MAX_TOKENS   ?? "8192");
  const temp    = parseFloat(env.TEMPERATURE ?? "0.7");

  // ── Collect user-configured model IDs (JELLY_MODEL_1..5) ────────────────
  const userModels: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const m = env[`JELLY_MODEL_${i}`];
    if (m?.trim()) userModels.push(m.trim());
  }

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
    "No API key found. Set OPENROUTER_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY in ~/.jellyos/.env"
  );
}

/** Convenience: returns just the primary (first) model config */
export function resolveModelConfig(): ModelConfig {
  return resolveModelChain()[0]!;
}

// ── ModelClient ───────────────────────────────────────────────────────────────

export class ModelClient {
  constructor(private cfg: ModelConfig) {}

  /**
   * Stream a chat completion. Yields ChatChunk objects.
   * On HTTP error the generator yields a single { type: "error", status, error }
   * chunk and returns — the caller (AgentRunner) decides whether to rotate.
   */
  async *stream(
    messages: Message[],
    tools?: Array<{ type: "function"; function: { name: string; description: string; parameters: unknown } }>,
  ): AsyncGenerator<ChatChunk> {
    const headers: Record<string, string> = {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${this.cfg.apiKey}`,
      "User-Agent":    "JellyOS/1.0",
    };
    if (this.cfg.siteUrl)  headers["HTTP-Referer"] = this.cfg.siteUrl;
    if (this.cfg.siteName) headers["X-Title"]      = this.cfg.siteName;

    const body: Record<string, unknown> = {
      model:       this.cfg.model,
      messages,
      max_tokens:  this.cfg.maxTokens,
      temperature: this.cfg.temperature,
      stream:      true,
    };
    if (tools && tools.length > 0) {
      body.tools       = tools;
      body.tool_choice = "auto";
    }

    let res: Response;
    try {
      res = await fetch(`${this.cfg.baseUrl}/chat/completions`, {
        method:  "POST",
        headers,
        body:    JSON.stringify(body),
        signal:  AbortSignal.timeout(120_000),
      });
    } catch (e: any) {
      yield { type: "error", error: `Network error: ${e.message}`, status: 0 };
      return;
    }

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      yield { type: "error", error: `Model API ${res.status}: ${err}`, status: res.status };
      return;
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
          yield { type: "done", finish_reason: finish };
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
  }
}
