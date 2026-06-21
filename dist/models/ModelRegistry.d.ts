/**
 * ModelRegistry — dynamic model discovery, tiering, and routing.
 *
 * Queries OpenRouter's /models endpoint at startup to build a local registry
 * of all available models. Classifies them into tiers (orchestrator / analyst /
 * worker / free), tracks performance, handles deprecation, and exposes
 * model selection as both a tool and a REPL command.
 *
 * Also supports direct provider routing (Anthropic/OpenAI/Google keys) for
 * models that can be reached cheaper outside OpenRouter.
 */
import type { ModelConfig } from "../runner/ModelClient.js";
import { type Static } from "@sinclair/typebox";
export interface OpenRouterModel {
    id: string;
    name: string;
    created: number;
    description: string;
    context_length: number;
    architecture: {
        modality: string;
        tokenizer: string;
        instruct_type: string | null;
    };
    pricing: {
        prompt: string;
        completion: string;
        image?: string;
        request?: string;
        input_cache_read?: string;
        input_cache_write?: string;
    };
    top_provider: {
        context_length: number;
        max_completion_tokens: number | null;
        is_moderated: boolean;
    };
    per_request_limits?: Record<string, string>;
}
export type ModelTier = "orchestrator" | "analyst" | "worker" | "free";
export interface TieredModel {
    tier: ModelTier;
    model: OpenRouterModel;
    /** Nano-dollars per 1K prompt tokens (for cost comparison) */
    costPer1K: number;
    /** Whether this model is currently available (not deprecated / rate-limited) */
    available: boolean;
    /** Consecutive failures — if >= 3, mark unavailable temporarily */
    failures: number;
    /** Timestamp of last failure (ms) */
    lastFailure: number;
    /** Average stream latency in ms */
    avgLatency: number;
    /** Number of times used */
    uses: number;
}
export interface TieredPool {
    orchestrator: TieredModel[];
    analyst: TieredModel[];
    worker: TieredModel[];
    free: TieredModel[];
}
export declare function classifyModel(model: OpenRouterModel): ModelTier;
export declare class ModelRegistry {
    private allModels;
    private tieredPool;
    private modelMap;
    private loaded;
    private lastFetch;
    /** Query OpenRouter /models and build the tiered pool. Called once at startup. */
    initialise(apiKey?: string): Promise<void>;
    /** Rebuild tier classifications (call after cache load or fetch). */
    private rebuildTiers;
    private saveCache;
    private loadFromCache;
    /** True if cache is stale and we should re-fetch on next opportunity. */
    get cacheStale(): boolean;
    /**
     * Pick the best available model for a given tier.
     * Favours lower cost among available models, excluding those with >= 3
     * consecutive failures (which get a 5-minute cooldown).
     */
    pick(tier: ModelTier): OpenRouterModel | null;
    /**
     * Per-model and per-tier temperature profiles.
     * Reasoning/thinking models REQUIRE temperature=1.0 (API enforces).
     * Code/structured tasks want low temp; creative analysis wants higher.
     */
    private getTemperature;
    /**
     * Per-tier max token budgets.
     * Orchestrators get generous budgets; free workers get minimal.
     */
    private getTokenBudget;
    /**
     * Build a full ModelConfig chain from the tiered pool.
     * Uses user-configured models from env first, then fills with tiered picks.
     */
    buildModelChain(userModels: string[]): ModelConfig[];
    /** Build a single ModelConfig, preferring direct provider when possible. */
    buildConfig(modelId: string, maxTokens: number, temperature: number, tier?: ModelTier): ModelConfig | null;
    recordFailure(modelId: string): void;
    recordSuccess(modelId: string, latencyMs: number): void;
    /** Mark a model as permanently deprecated (404, model removed). */
    markDeprecated(modelId: string): void;
    getTier(modelId: string): ModelTier;
    get modelCount(): number;
    /** Search / filter models by keyword (case-insensitive). */
    search(query: string, maxResults?: number): TieredModel[];
    /** Get all models for a tier. */
    getPool(tier: ModelTier): TieredModel[];
    /** Human-readable summary of the current pool. */
    summary(): string;
    /**
     * Find the cheapest model meeting minimum requirements.
     * @param tier       - Required tier (or "any")
     * @param minContext - Minimum context length
     * @param maxCost    - Maximum cost in nano-dollars per 1K prompt
     */
    findCheapest(tier: ModelTier | "any", minContext?: number, maxCost?: number): TieredModel | null;
    readonly listModelsParams: import("@sinclair/typebox").TObject<{
        query: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        tier: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
        available_only: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TBoolean>;
    }>;
    listModelsTool(_id: string, params: Static<typeof this.listModelsParams>): Promise<{
        content: Array<{
            type: "text";
            text: string;
        }>;
        details: Record<string, unknown>;
    }>;
    readonly pickModelParams: import("@sinclair/typebox").TObject<{
        tier: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        min_context: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
        max_cost: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
    }>;
    pickModelTool(_id: string, params: Static<typeof this.pickModelParams>): Promise<{
        content: Array<{
            type: "text";
            text: string;
        }>;
        details: Record<string, unknown>;
    }>;
    readonly summaryParams: import("@sinclair/typebox").TObject<{}>;
    summaryTool(): Promise<{
        content: Array<{
            type: "text";
            text: string;
        }>;
        details: Record<string, unknown>;
    }>;
}
/** Singleton — initialised once at startup, used everywhere */
export declare const modelRegistry: ModelRegistry;
//# sourceMappingURL=ModelRegistry.d.ts.map