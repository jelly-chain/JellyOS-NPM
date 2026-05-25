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
    role: "system" | "user" | "assistant" | "tool";
    content: string | null;
    name?: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}
export interface ToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}
export interface ChatChunk {
    type: "delta" | "tool_call" | "done" | "error";
    text?: string;
    tool_calls?: ToolCall[];
    error?: string;
    finish_reason?: string;
    /** HTTP status code — used by AgentRunner for rate-limit detection */
    status?: number;
}
export interface ModelConfig {
    baseUrl: string;
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
    siteUrl?: string;
    siteName?: string;
}
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
export declare function resolveModelChain(): ModelConfig[];
/** Convenience: returns just the primary (first) model config */
export declare function resolveModelConfig(): ModelConfig;
export declare class ModelClient {
    private cfg;
    constructor(cfg: ModelConfig);
    /**
     * Stream a chat completion. Yields ChatChunk objects.
     * On HTTP error the generator yields a single { type: "error", status, error }
     * chunk and returns — the caller (AgentRunner) decides whether to rotate.
     */
    stream(messages: Message[], tools?: Array<{
        type: "function";
        function: {
            name: string;
            description: string;
            parameters: unknown;
        };
    }>): AsyncGenerator<ChatChunk>;
}
//# sourceMappingURL=ModelClient.d.ts.map