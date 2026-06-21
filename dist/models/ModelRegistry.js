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
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { Type } from "@sinclair/typebox";
// ── Tier classification ───────────────────────────────────────────────────────
/**
 * Tier classification rules (priority-ordered).
 * Models match the first rule whose pattern and context-length requirements
 * are met. Fallback is "worker".
 */
const TIER_RULES = [
    // ── Orchestrator: top-tier reasoning models (2024-2026) ──────────────────
    // Claude Opus 4.x, GPT-5.x flagship/pro, Gemini 3.x Pro, DeepSeek V4 Pro,
    // Grok 4.x, o3-pro/o4, Qwen3 Max variants, Kimi K2
    {
        tier: "orchestrator",
        pattern: /claude.*opus[-.]?4|gpt-5\.[3-9].*pro|gpt-5\.5(?!-nano|-mini)|o3-pro|o4[-.]|gemini-3\.[0-9]-pro|deepseek-v4-pro|grok[-.]?4\.[0-9]|qwen3.*max(?!-thinking)|qwen3\.6-max|kimi-k2(?!-thinking)/i,
        notFree: true,
    },
    // ── Analyst: strong reasoning, moderate cost (2024-2026) ─────────────────
    // Claude Sonnet 4.x, GPT-5.x mid-tier, Gemini 3.x Flash,
    // DeepSeek V4 (non-pro), Grok 3.x, Qwen3 235B, Mistral Medium 3
    {
        tier: "analyst",
        pattern: /claude.*sonnet[-.]?4|gpt-5\.[0-4](?!.*-pro)|gpt-5\.5-mini|gemini-3\.[0-9]-flash|deepseek-v4(?!-pro)|grok[-.]?3|qwen3-235b|qwen3\.6-(?!max)|mistral-medium-3|claude.*haiku[-.]?4/i,
        notFree: true,
    },
    // ── Free tier: zero-cost models ──────────────────────────────────────────
    { tier: "free", pattern: /:free$|openrouter\/free/i },
    // ── Worker: everything else (default) ────────────────────────────────────
    { tier: "worker", pattern: /.*/ },
];
export function classifyModel(model) {
    for (const rule of TIER_RULES) {
        if (!rule.pattern.test(model.id))
            continue;
        if (rule.notFree && parseFloat(model.pricing.prompt || "0") <= 0)
            continue;
        if (rule.minContext && (model.context_length || 0) < rule.minContext)
            continue;
        if (rule.minTokens && (model.top_provider.max_completion_tokens || 0) < rule.minTokens)
            continue;
        return rule.tier;
    }
    return "worker";
}
// ── ModelRegistry class ───────────────────────────────────────────────────────
const JELLY_HOME = process.env.JELLYOS_HOME ?? join(homedir(), ".jelly");
const CACHE_FILE = join(JELLY_HOME, "models.json");
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
export class ModelRegistry {
    allModels = [];
    tieredPool = { orchestrator: [], analyst: [], worker: [], free: [] };
    modelMap = new Map();
    loaded = false;
    lastFetch = 0;
    // ── Initialisation ────────────────────────────────────────────────────────
    /** Query OpenRouter /models and build the tiered pool. Called once at startup. */
    async initialise(apiKey) {
        const key = apiKey ?? process.env.OPENROUTER_API_KEY;
        if (!key) {
            this.loadFromCache();
            return;
        }
        // Try live fetch
        try {
            const res = await fetch("https://openrouter.ai/api/v1/models", {
                headers: { Authorization: `Bearer ${key}`, "User-Agent": "JellyOS/1.0" },
                signal: AbortSignal.timeout(15_000),
            });
            if (res.ok) {
                const body = await res.json();
                this.allModels = body.data ?? [];
                this.lastFetch = Date.now();
                this.saveCache();
            }
            else {
                this.loadFromCache();
            }
        }
        catch {
            this.loadFromCache();
        }
        this.rebuildTiers();
        this.loaded = true;
    }
    /** Rebuild tier classifications (call after cache load or fetch). */
    rebuildTiers() {
        this.tieredPool = { orchestrator: [], analyst: [], worker: [], free: [] };
        this.modelMap.clear();
        for (const m of this.allModels) {
            const tier = classifyModel(m);
            const cost = parseFloat(m.pricing.prompt || "0") * 1_000_000_000; // nano-dollars per 1K
            const tm = {
                tier, model: m, costPer1K: cost,
                available: true, failures: 0, lastFailure: 0,
                avgLatency: 0, uses: 0,
            };
            this.tieredPool[tier].push(tm);
            this.modelMap.set(m.id, tm);
        }
        // Sort each tier by cost (cheapest first within each tier)
        for (const tier of ["orchestrator", "analyst", "worker", "free"]) {
            this.tieredPool[tier].sort((a, b) => a.costPer1K - b.costPer1K);
        }
    }
    // ── Cache ─────────────────────────────────────────────────────────────────
    saveCache() {
        try {
            mkdirSync(JELLY_HOME, { recursive: true });
            writeFileSync(CACHE_FILE, JSON.stringify({
                models: this.allModels,
                fetchedAt: this.lastFetch,
                version: 1,
            }));
        }
        catch { /* cache write is best-effort */ }
    }
    loadFromCache() {
        try {
            if (!existsSync(CACHE_FILE))
                return;
            const raw = JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
            if (Array.isArray(raw.models)) {
                this.allModels = raw.models;
                this.lastFetch = raw.fetchedAt ?? 0;
            }
        }
        catch { /* cache read is best-effort */ }
    }
    /** True if cache is stale and we should re-fetch on next opportunity. */
    get cacheStale() {
        return Date.now() - this.lastFetch > CACHE_TTL;
    }
    // ── Model selection ────────────────────────────────────────────────────────
    /**
     * Pick the best available model for a given tier.
     * Favours lower cost among available models, excluding those with >= 3
     * consecutive failures (which get a 5-minute cooldown).
     */
    pick(tier) {
        const pool = this.tieredPool[tier] ?? this.tieredPool["worker"];
        const now = Date.now();
        for (const tm of pool) {
            // Cooldown: if 3+ consecutive failures, wait 5 minutes
            if (!tm.available || (tm.failures >= 3 && now - tm.lastFailure < 300_000))
                continue;
            return tm.model;
        }
        // Fallback: return any available model from any tier
        for (const t of ["worker", "analyst", "orchestrator", "free"]) {
            for (const tm of this.tieredPool[t]) {
                if (tm.available && tm.failures < 3)
                    return tm.model;
            }
        }
        return null;
    }
    /**
     * Per-model and per-tier temperature profiles.
     * Reasoning/thinking models REQUIRE temperature=1.0 (API enforces).
     * Code/structured tasks want low temp; creative analysis wants higher.
     */
    getTemperature(modelId, tier, envTemp) {
        // Exact model overrides (reasoning models MUST be 1.0)
        const MODEL_TEMPS = {
            // OpenAI o-series — no temperature param supported at all
            "openai/o3": 1.0,
            "openai/o3-pro": 1.0,
            "openai/o3-mini": 1.0,
            "openai/o4": 1.0,
            "openai/o4-mini": 1.0,
            // Thinking variants require 1.0
            "qwen/qwen3-max-thinking": 1.0,
            "qwen/qwen3.6-max-preview": 1.0,
            "qwen/qwen3-235b-a22b-thinking-2507": 1.0,
            "moonshotai/kimi-k2-thinking": 1.0,
            "arcee-ai/trinity-large-thinking": 1.0,
        };
        if (MODEL_TEMPS[modelId] !== undefined)
            return MODEL_TEMPS[modelId];
        // Any model with "thinking" in the ID needs 1.0
        if (/thinking/i.test(modelId))
            return 1.0;
        // Tier defaults
        const TIER_TEMPS = {
            orchestrator: 0.7, // balanced reasoning
            analyst: 0.5, // more deterministic for analysis
            worker: 0.3, // deterministic for structured tasks
            free: 0.5,
        };
        // User env var overrides tier defaults (but not model-specific overrides)
        if (process.env.TEMPERATURE)
            return envTemp;
        return TIER_TEMPS[tier] ?? 0.7;
    }
    /**
     * Per-tier max token budgets.
     * Orchestrators get generous budgets; free workers get minimal.
     */
    getTokenBudget(modelId, tier, envMax) {
        const TIER_BUDGETS = {
            orchestrator: 32_768,
            analyst: 16_384,
            worker: 4_096,
            free: 2_048,
        };
        // Thinking models need at least 16K for the thinking budget
        const isThinking = /thinking|o3|o4/i.test(modelId);
        const base = isThinking
            ? Math.max(16_384, TIER_BUDGETS[tier])
            : TIER_BUDGETS[tier];
        // User env var is a hard cap
        return Math.min(base, envMax);
    }
    /**
     * Build a full ModelConfig chain from the tiered pool.
     * Uses user-configured models from env first, then fills with tiered picks.
     */
    buildModelChain(userModels) {
        const env = process.env;
        const tokens = parseInt(env.MAX_TOKENS ?? "99999"); // now used as cap, not target
        const temp = parseFloat(env.TEMPERATURE ?? "0.7");
        const results = [];
        // User-specified models always come first
        for (const mid of userModels) {
            const cfg = this.buildConfig(mid, tokens, temp);
            if (cfg)
                results.push(cfg);
        }
        if (!this.loaded)
            return results;
        // Fill remaining slots with tiered picks (up to 5 total, max 2 free)
        const tiers = ["orchestrator", "analyst", "analyst", "worker", "free"];
        let freeUsed = 0;
        for (const tier of tiers) {
            if (results.length >= 5)
                break;
            if (tier === "free" && freeUsed >= 2)
                continue;
            const picked = this.pick(tier);
            if (!picked)
                continue;
            // Skip if already in the list
            if (results.some(r => r.model === picked.id))
                continue;
            const cfg = this.buildConfig(picked.id, tokens, temp);
            if (cfg) {
                results.push(cfg);
                if (tier === "free")
                    freeUsed++;
            }
        }
        return results.slice(0, 5);
    }
    /** Build a single ModelConfig, preferring direct provider when possible. */
    buildConfig(modelId, maxTokens, temperature, tier) {
        // Apply per-model/per-tier temperature and token budget
        const resolvedTier = tier ?? this.getTier(modelId);
        const env = process.env;
        const envMax = parseInt(env.MAX_TOKENS ?? "99999");
        const envTemp = parseFloat(env.TEMPERATURE ?? "0.7");
        temperature = this.getTemperature(modelId, resolvedTier, envTemp);
        maxTokens = this.getTokenBudget(modelId, resolvedTier, Math.min(maxTokens, envMax));
        // Direct Anthropic routing (cheaper — no OR markup)
        if (modelId.startsWith("anthropic/") && env.ANTHROPIC_API_KEY) {
            const stripped = modelId.replace("anthropic/", "");
            // OpenRouter model IDs differ from Anthropic API IDs — map them correctly
            const ANTHROPIC_API_ALIASES = {
                // Opus 4.x
                "claude-opus-4.7": "claude-opus-4-20260101",
                "claude-opus-4.7-fast": "claude-opus-4-20260101",
                "claude-opus-4.6": "claude-opus-4-20251120",
                "claude-opus-4.6-fast": "claude-opus-4-20251120",
                "claude-opus-4.5": "claude-opus-4-20251015",
                "claude-opus-4": "claude-opus-4-20250514",
                // Sonnet 4.x
                "claude-sonnet-4.6": "claude-sonnet-4-20251120",
                "claude-sonnet-4.5": "claude-sonnet-4-20251015",
                "claude-sonnet-4": "claude-sonnet-4-20250514",
                // Haiku 4.x
                "claude-haiku-4.5": "claude-haiku-4-20251015",
                "claude-haiku-4": "claude-haiku-4-20250514",
                // Legacy aliases (safe to keep)
                "claude-3-5-sonnet-20241022": "claude-3-5-sonnet-20241022",
                "claude-3-haiku-20240307": "claude-3-haiku-20240307",
            };
            const model = ANTHROPIC_API_ALIASES[stripped] ?? stripped;
            return {
                baseUrl: "https://api.anthropic.com/v1",
                apiKey: env.ANTHROPIC_API_KEY,
                model,
                maxTokens,
                temperature,
            };
        }
        // Direct OpenAI routing
        if (modelId.startsWith("openai/") && env.OPENAI_API_KEY) {
            const model = modelId.replace("openai/", "");
            return {
                baseUrl: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
                apiKey: env.OPENAI_API_KEY,
                model,
                maxTokens,
                temperature,
            };
        }
        // OpenRouter fallback
        if (env.OPENROUTER_API_KEY) {
            return {
                baseUrl: "https://openrouter.ai/api/v1",
                apiKey: env.OPENROUTER_API_KEY,
                model: modelId,
                maxTokens,
                temperature,
                siteUrl: env.OPENROUTER_SITE_URL ?? "https://jellychain.fun",
                siteName: env.OPENROUTER_SITE_NAME ?? "JellyOS",
            };
        }
        // Local model
        if (env.OPENAI_BASE_URL) {
            return {
                baseUrl: env.OPENAI_BASE_URL,
                apiKey: env.OPENAI_API_KEY ?? "local",
                model: modelId,
                maxTokens,
                temperature,
            };
        }
        return null;
    }
    // ── Failure tracking ─────────────────────────────────────────────────────
    recordFailure(modelId) {
        const tm = this.modelMap.get(modelId);
        if (!tm)
            return;
        tm.failures++;
        tm.lastFailure = Date.now();
        if (tm.failures >= 3)
            tm.available = false;
    }
    recordSuccess(modelId, latencyMs) {
        const tm = this.modelMap.get(modelId);
        if (!tm)
            return;
        tm.failures = 0;
        tm.available = true;
        tm.avgLatency = tm.uses === 0 ? latencyMs : (tm.avgLatency * tm.uses + latencyMs) / (tm.uses + 1);
        tm.uses++;
    }
    /** Mark a model as permanently deprecated (404, model removed). */
    markDeprecated(modelId) {
        const tm = this.modelMap.get(modelId);
        if (!tm)
            return;
        tm.available = false;
        tm.failures = 999; // never recover
    }
    getTier(modelId) {
        return this.modelMap.get(modelId)?.tier ?? "worker";
    }
    // ── Queries ───────────────────────────────────────────────────────────────
    get modelCount() {
        return this.allModels.length;
    }
    /** Search / filter models by keyword (case-insensitive). */
    search(query, maxResults = 30) {
        const q = query.toLowerCase();
        const results = [];
        for (const tm of this.modelMap.values()) {
            if (tm.model.id.toLowerCase().includes(q) || tm.model.name.toLowerCase().includes(q)) {
                results.push(tm);
            }
        }
        return results.slice(0, maxResults);
    }
    /** Get all models for a tier. */
    getPool(tier) {
        return [...this.tieredPool[tier]];
    }
    /** Human-readable summary of the current pool. */
    summary() {
        const lines = [];
        for (const tier of ["orchestrator", "analyst", "worker", "free"]) {
            const pool = this.tieredPool[tier];
            const avail = pool.filter(tm => tm.available && tm.failures < 3).length;
            lines.push(`${tier}: ${avail}/${pool.length} available`);
        }
        return `Model pool (${this.allModels.length} total):\n` + lines.join("\n");
    }
    /**
     * Find the cheapest model meeting minimum requirements.
     * @param tier       - Required tier (or "any")
     * @param minContext - Minimum context length
     * @param maxCost    - Maximum cost in nano-dollars per 1K prompt
     */
    findCheapest(tier, minContext = 0, maxCost = Infinity) {
        const allTiers = ["orchestrator", "analyst", "worker", "free"];
        const pool = tier === "any"
            ? allTiers.flatMap(t => this.tieredPool[t])
            : this.tieredPool[tier] ?? [];
        return pool
            .filter(tm => tm.available && tm.failures < 3)
            .filter(tm => (tm.model.context_length || 0) >= minContext)
            .filter(tm => tm.costPer1K <= maxCost)
            .sort((a, b) => a.costPer1K - b.costPer1K)[0] ?? null;
    }
    // ── Tool: list_models ─────────────────────────────────────────────────────
    listModelsParams = Type.Object({
        query: Type.Optional(Type.String({ description: "Search query (model name or provider)" })),
        tier: Type.Optional(Type.String({ description: "Filter by tier: orchestrator, analyst, worker, free" })),
        limit: Type.Optional(Type.Number({ description: "Max results", default: 20 })),
        available_only: Type.Optional(Type.Boolean({ description: "Only show available models", default: true })),
    });
    async listModelsTool(_id, params) {
        let results;
        if (params.query) {
            results = this.search(params.query, params.limit ?? 20);
        }
        else if (params.tier && this.tieredPool[params.tier]) {
            results = this.tieredPool[params.tier];
        }
        else {
            results = [...this.modelMap.values()];
        }
        if (params.available_only !== false) {
            results = results.filter(tm => tm.available && tm.failures < 3);
        }
        results = results.slice(0, params.limit ?? 20);
        const text = results.map(tm => {
            const costStr = tm.costPer1K <= 0 ? "FREE" : `$${(tm.costPer1K / 1_000_000_000).toFixed(6)}/1K`;
            const ctx = tm.model.context_length
                ? tm.model.context_length >= 1_000_000
                    ? `${(tm.model.context_length / 1_000_000).toFixed(1)}M ctx`
                    : `${(tm.model.context_length / 1000).toFixed(0)}K ctx`
                : "?K ctx";
            const status = tm.available ? "" : " [UNAVAILABLE]";
            return `[${tm.tier}] ${tm.model.id.padEnd(46)} ${costStr.padEnd(18)} ${ctx}${status}`;
        }).join("\n");
        return {
            content: [{ type: "text", text: text || "(no models match)" }],
            details: { count: results.length },
        };
    }
    // ── Tool: pick_model ──────────────────────────────────────────────────────
    pickModelParams = Type.Object({
        tier: Type.Optional(Type.String({ description: "Tier: orchestrator, analyst, worker, free, any" })),
        min_context: Type.Optional(Type.Number({ description: "Minimum context length in tokens" })),
        max_cost: Type.Optional(Type.Number({ description: "Maximum cost per 1K prompt in nano-dollars" })),
    });
    async pickModelTool(_id, params) {
        const tier = (params.tier ?? "any");
        const cheapest = this.findCheapest(tier, params.min_context ?? 0, params.max_cost ?? Infinity);
        if (!cheapest) {
            return { content: [{ type: "text", text: "No matching model found." }], details: {} };
        }
        const costDollars = cheapest.costPer1K / 1_000_000_000;
        return {
            content: [{
                    type: "text",
                    text: `Recommended: ${cheapest.model.id}\n  Tier: ${cheapest.tier}\n  Context: ${(cheapest.model.context_length ?? 0).toLocaleString()} tokens\n  Cost: $${costDollars.toFixed(6)}/1K prompt tokens\n  Provider: ${cheapest.model.id.split("/")[0]}`,
                }],
            details: { model_id: cheapest.model.id, tier: cheapest.tier, cost_per_1k: costDollars },
        };
    }
    // ── Tool: model_summary ───────────────────────────────────────────────────
    summaryParams = Type.Object({});
    async summaryTool() {
        return {
            content: [{ type: "text", text: this.summary() }],
            details: {
                total: this.allModels.length,
                tiers: {
                    orchestrator: this.tieredPool.orchestrator.filter(tm => tm.available).length,
                    analyst: this.tieredPool.analyst.filter(tm => tm.available).length,
                    worker: this.tieredPool.worker.filter(tm => tm.available).length,
                    free: this.tieredPool.free.filter(tm => tm.available).length,
                },
            },
        };
    }
}
/** Singleton — initialised once at startup, used everywhere */
export const modelRegistry = new ModelRegistry();
//# sourceMappingURL=ModelRegistry.js.map