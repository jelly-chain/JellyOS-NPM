# @jellyos/agent

<div align="center">

<pre>
   ██╗███████╗██╗     ██╗  ██╗   ██╗  ██████╗ ███████╗
   ██║██╔════╝██║     ██║  ╚██╗ ██╔╝ ██╔═══██╗██╔════╝
   ██║█████╗  ██║     ██║   ╚████╔╝  ██║   ██║███████╗
██ ██║██╔══╝  ██║     ██║    ╚██╔╝   ██║   ██║╚════██║
╚█████╔╝███████╗███████╗██║   ██║    ╚██████╔╝███████║
 ╚════╝ ╚══════╝╚══════╝╚═╝   ╚═╝     ╚═════╝ ╚══════╝
</pre>

**Autonomous AI trading agent. Runs 100% locally. No server. No inbound ports.**

[![npm](https://img.shields.io/npm/v/@jellyos/agent?color=14b8a6&style=flat-square)](https://www.npmjs.com/package/@jellyos/agent)
[![npm](https://img.shields.io/npm/dw/@jellyos/agent?color=14b8a6&style=flat-square)](https://www.npmjs.com/package/@jellyos/agent)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow?style=flat-square)](LICENSE)

</div>

---

## What's in this package

JellyOS is a full-stack AI trading agent engine — multi-chain wallet management, trading execution, encrypted vault, prediction markets, live data feeds, and 70+ tests.

| Component | Description |
|-----------|-------------|
| `AgentRunner` | Multi-model agentic loop with tool dispatch, swarm routing, reflection |
| `ModelClient` | Streaming OpenAI-compatible client with fallback rotation + thinking mode |
| `ModelRegistry` | Dynamic model discovery, tier classification, cost tracking (356 models) |
| `SwarmRouter` | LLM-based task decomposition + parallel sub-agent execution |
| `SessionManager` | Conversation history with 3-tier smart compaction + turbo headroom tracking |
| `MemoryStore` | SQLite long-term memory (cross-session, persistent) |
| `GoalManager` | Persistent cross-session goals injected into every turn |
| `ContextStore` | Ephemeral task context folders (auto-deleted on completion) |
| `AgentScheduler` | Cron + price-trigger autonomous task scheduling |
| `MCPServer` | Model Context Protocol server (Claude Desktop / Cursor compatible) |
| `BlockchainManager` | Multi-chain support: Ethereum, BSC, Arbitrum, Base, Polygon, Solana, Cosmos + 10 more via Alchemy |
| `PolymarketClient` / `KalshiClient` / `JupiterClient` / `ManifoldClient` | Prediction market trading + aggregation |
| `TradeExecutor` / `PositionManager` / `PortfolioManager` / `RiskManager` | Full trading engine with position tracking and risk controls |
| `VaultManager` / `AutoVault` | AES-256-GCM encrypted profit vault with auto-sweep |
| `WalletManager` | EVM + Solana + Cosmos keypair generation, signing, encrypted storage |
| `PredictionModel` / `VolatilityModel` / `LiquidityModel` | AI-powered price prediction, volatility forecasting, liquidity analysis |
| `FeedManager` / `SignalEngine` | 21 live data feeds with cross-feed trading signal generation |
| `ConfigLoader` / `EnvLoader` | Layered configuration from files, env vars, and CLI |
| `CheckpointManager` / `TaskQueue` / `TaskDispatcher` | Agent checkpointing and parallel task execution |
| `AuthMiddleware` / `RateLimitMiddleware` | Express middleware for dashboard/API security |
| `CryptoUtils` / `ValidationUtils` / `Utils` | Cryptographic helpers, input validation, formatting utilities |
| `SetupWizard` | Interactive first-run setup wizard |
| **18 built-in tools** | Prices, candles+TA, news, Fear&Greed, funding rates, BTC mempool, DeFi TVL, Solana TPS, model management, goals, tasks, scheduling |
| Ink TUI | Terminal UI with live ticker, context pressure monitor, approval gates |
| Telegram Bot | Full Telegram bot with Irys permanent storage, points/rank system |

---

## Install

```bash
npm install -g @jellyos/agent
```

## Quick Start

```bash
mkdir -p ~/.jelly
echo "OPENROUTER_API_KEY=sk-or-..." > ~/.jelly/.env
jellyos
```

## Headless Mode

```bash
# Single turn, print to stdout, exit
jellyos --headless "what is the current ETH price and RSI on the 1h chart?"

# Use in scripts
RESULT=$(jellyos --headless "summarize BTC market conditions")
echo "$RESULT"
```

## MCP Server (Claude Desktop / Cursor)

```bash
# Start MCP server — exposes all 18 tools to any MCP client
jellyos-mcp
```

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "jellyos": {
      "command": "jellyos-mcp"
    }
  }
}
```

---

## Configuration (`~/.jelly/.env`)

```env
# AI Provider (pick one)
OPENROUTER_API_KEY=sk-or-...    # recommended — 356 models
ANTHROPIC_API_KEY=sk-ant-...    # direct Anthropic
OPENAI_API_KEY=sk-...           # direct OpenAI
OPENAI_BASE_URL=http://localhost:11434/v1  # Ollama / local

# Optional model pool (up to 5, rotated on rate-limit)
JELLY_MODEL_1=anthropic/claude-opus-4.7
JELLY_MODEL_2=openai/gpt-5.5
JELLY_MODEL_3=google/gemini-3.5-flash

# Blockchain
ALCHEMY_KEY=...                 # On-chain data across 16 EVM chains
POLYMARKET_API_KEY=...          # Prediction market trading
KALSHI_API_KEY=...              # US regulated prediction markets

# Agent behaviour
JELLY_EFFECT_LEVEL=normal       # eco | normal | turbo | max
AUTO_VAULT_THRESHOLD=500        # Auto-sweep P&L to vault above this USD amount
JELLY_MAX_AGENTS=5              # Max parallel sub-agents in swarm mode

# Telegram (optional)
TELEGRAM_BOT_TOKEN=...          # From @BotFather
BOT_ADMIN_IDS=...               # Comma-separated Telegram UIDs
IRYS_PRIVATE_KEY=...            # For permanent Telegram storage
```

---

## Built-in Tools

| Tool | Description | Source |
|------|-------------|--------|
| `get_prices` | Live prices + 24h change | Binance + CoinGecko |
| `get_candles` | OHLCV data + RSI/MACD/Bollinger analysis | Binance |
| `get_top_movers` | Largest 24h movers | Binance |
| `get_market_overview` | Aggregated market summary | Multi-source |
| `get_news` | Headlines + sentiment scoring | CoinDesk/CoinTelegraph/TheBlock |
| `get_fear_greed` | Fear & Greed Index (7-day history) | alternative.me |
| `get_funding_rates` | Perp funding rates (long/short bias) | Binance |
| `get_btc_mempool` | BTC pending txs + fee rates | mempool.space |
| `get_defi_tvl` | DeFi TVL by chain | DeFiLlama |
| `get_solana_stats` | Solana TPS + network health | Solana RPC |
| `analyze_ta` | RSI, MACD, Bollinger, EMA, ATR on price arrays | Local |
| `list_models` | Search 356 available AI models | OpenRouter |
| `pick_model` | Find cheapest model for requirements | OpenRouter |
| `set_goal` / `list_goals` / `complete_goal` | Persistent cross-session goals | Local |
| `schedule_task` / `list_schedule` | Cron + price-trigger scheduling | Local |
| `read_task_context` / `list_tasks` | Ephemeral task context folders | Local |
| `cost_report` | Session + lifetime token usage | Local |
| `get_balance` | Wallet balance on any supported chain | Local + Alchemy |
| `sign_transaction` | Sign a tx hex in-memory | Local |
| `execute_trade` | Submit a swap (requires confirmation) | Local |
| `get_positions` / `get_portfolio` | Open positions + portfolio P&L | Local |
| `calculate_risk` | Risk/reward + position sizing | Local |
| `vault_status` / `vault_sweep` | Vault balance + auto-sweep | Local |
| `predict_market` | AI price prediction for an asset | Local |
| `get_signals` | Active trading signals from signal engine | Local |

All data tools are free — no API keys required.

---

## Effect Levels

```
/effect eco      # minimal tool calls, cheapest models
/effect normal   # balanced (default)
/effect turbo    # 2 parallel sub-agents for complex tasks
/effect max      # 5 agents + thinking models for deep research
```

---

## Extension API

```typescript
import { Type } from "@jellyos/agent";
import type { ExtensionAPI } from "@jellyos/agent";

export default function (agent: ExtensionAPI) {
  agent.setSystemPrompt("You are a DeFi yield optimizer.");

  agent.registerTool({
    name:             "get_apy",
    label:            "Get APY",
    description:      "Fetch current APY for a DeFi protocol",
    requiresApproval: false,  // set true for money-moving tools
    parameters: Type.Object({
      protocol: Type.String({ description: "Protocol name e.g. aave" }),
    }),
    async execute(_id, { protocol }) {
      const res  = await fetch(`https://api.llama.fi/protocol/${protocol}`);
      const data = await res.json() as Record<string, unknown>;
      return {
        content: [{ type: "text", text: `${protocol}: ${JSON.stringify(data)}` }],
        details: {},
      };
    },
  });

  agent.on("session_start", async (ctx) => {
    ctx.ui.setStatus("yields", "ready");
  });
}
```

```bash
jellyos --extension ./my-extension.ts
```

---

## REPL Commands

```
/help                  List commands
/effect [level]        eco | normal | turbo | max
/prices [symbols]      Quick price check
/news                  Latest headlines + sentiment
/goals                 List active goals
/goal add <text>       Add a persistent goal
/goal done <id>        Mark goal complete
/schedule              List scheduled tasks
/tasks                 List active context folders
/traces                Show last 5 agent traces with timing
/memory <query>        Search long-term memory
/models [query]        Search available AI models
/cost                  Session + lifetime cost report
/vault                 Show encrypted vault balance
/wallets               Show all wallet addresses
/signals               Request current trading signals
/status                Full system health check
/approve | /deny       Respond to tool approval gates
/palette               Full command + tool list
/clear                 Clear conversation history
/panic                 Emergency stop — close positions, sweep vault, lock
/exit                  Quit JellyOS
Escape                 Abort in-flight model stream
Ctrl-C                 Exit
```

---

## Supported Chains

Ethereum, BSC, Arbitrum, Base, Polygon, Avalanche, Optimism, Scroll, Linea, zkSync Era, Mantle, Blast, Solana, Cosmos, and more via Alchemy and public RPCs.

---

## Telegram Bot

JellyOS can run as a Telegram bot with permanent storage on Irys:

```bash
jellyos telegram
```

| Command | Description |
|---------|-------------|
| `/start` | Welcome + language detection |
| `/contribute` | Submit contributions for points |
| `/status` | View points, rank, daily quota |
| `/memory` | List your contributions |
| `/rank` | View top 10 leaderboard |
| `/verify` | Link EVM wallet via nonce challenge |

---

## Public API

```typescript
import {
  // Core agent
  AgentRunner, ModelClient, ToolDispatcher, SwarmRouter,
  ModelRegistry, CostTracker, SessionManager, MemoryStore,
  GoalManager, ContextStore, AgentScheduler, MCPServer,
  Tracer, loadExtension,

  // Blockchain
  BlockchainManager, AlchemyClient, SolanaClient, CosmosClient,
  ChainClientFactory, BlockchainOrchestrator,

  // Prediction markets
  PolymarketClient, KalshiClient, JupiterClient, ManifoldClient,
  PredictionMarketAggregator,

  // Trading
  TradeExecutor, PositionManager, PortfolioManager, RiskManager,
  TradingEngine, createTradingEngine,

  // Vault & Wallet
  VaultManager, AutoVault, WalletManager,

  // Prediction
  PredictionModel, VolatilityModel, LiquidityModel,
  PredictionEngine, createPredictionEngine,

  // Feeds & signals
  FeedManager, SignalEngine,

  // Core utilities
  ConfigLoader, EnvLoader, CheckpointManager, TaskQueue,
  TaskDispatcher, JellyBrain, Logger, Metrics, LoggerFactory,

  // Context
  AgentMemory, createAgentMemory, MarketMemory, ContextOrchestrator,

  // Middleware
  AuthMiddleware, RateLimitMiddleware, MiddlewareStack,

  // Utils
  CryptoUtils, ValidationUtils, Utils,

  // Setup
  SetupWizard,

  // Types
  Type,
} from "@jellyos/agent";
```

---

## Changelog

### v0.2.2

- **Full CLI restore**: replaced stripped-down `cli.ts` with complete version — headless mode (`--headless`), extension loading (`--extension`), interactive TUI boot, model registry initialization
- **Blockchain layer**: added `BlockchainManager`, `AlchemyClient`, `SolanaClient`, `CosmosClient`, `ChainClientFactory`
- **Prediction markets**: added `PolymarketClient`, `KalshiClient`, `JupiterClient`, `ManifoldClient`, `PredictionMarketAggregator`
- **Trading engine**: added `TradeExecutor`, `PositionManager`, `PortfolioManager`, `RiskManager`, `TradingEngine`
- **Vault**: added `VaultManager`, `AutoVault`
- **Wallet**: added `WalletManager` (EVM + Solana + Cosmos keypair management)
- **Core**: added `ConfigLoader`, `EnvLoader`, `CheckpointManager`, `TaskQueue`, `TaskDispatcher`, `JellyBrain`
- **Prediction models**: added `PredictionModel`, `VolatilityModel`, `LiquidityModel`, `PredictionEngine`
- **Feeds**: added `FeedManager`, `SignalEngine`
- **Middleware**: added `AuthMiddleware`, `RateLimitMiddleware`
- **Context**: added `AgentMemory`, `MarketMemory`, `ContextOrchestrator`
- **Utils**: added `CryptoUtils`, `ValidationUtils`, `Utils` (sleep, retry, debounce, throttle, format helpers)
- **Setup**: added `SetupWizard`
- **Vector store**: added vector store export
- **Barrel exports**: added `Index.ts` / `index.ts` barrel files for all modules
- **Public API**: expanded `src/index.ts` exports to cover all new modules
- **Dependencies**: added `argon2` (vault encryption), `ethers` (EVM wallet), `tsx` (extension loader), updated `express`, `telegraf`, `vitest`
- **Config**: added `src/config/chains.ts`, `config.json`, `secrets.example.json`
- **Tests**: added `ModelClient.test.ts`, `VaultManager.test.ts`, `WalletManager.test.ts` (70 total tests)
- **Bin**: added `jellyos`, `jelly-config`, `irys-uploader-server.js`
- **Fixed**: `bin/telegram.js` import path (was broken — pointed to `src/cli.js` instead of `dist/cli.js`)

### v0.2.1

- Initial public release: core agent engine, 18 built-in tools, Ink TUI, Telegram bot skill, MCP server, scheduler, session management, memory store, goal manager

---

## License

MIT
