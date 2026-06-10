/**
 * cli.ts — JellyOS entry point.
 * Completely standalone — all outbound, no inbound ports exposed.
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, join }            from "node:path";
import { homedir }                  from "node:os";
import { render }                   from "ink";
import React                        from "react";
import { config as loadDotenv }     from "dotenv";
import { Registry }                 from "./api/Registry.js";
import { loadExtension }            from "./loader.js";
import { App }                      from "./tui/App.js";
import { T }                        from "./tui/theme.js";
import { wireNotify, safeLog }       from "./util/safeLog.js";
import { modelRegistry }            from "./models/ModelRegistry.js";
import { CostTracker }              from "./models/CostTracker.js";
import { AgentRunner }              from "./runner/AgentRunner.js";
import { SessionManager }           from "./session/SessionManager.js";
import type { SessionContext, UIContext } from "./api/ExtensionAPI.js";
import { makeTheme }                from "./tui/theme.js";

// ── Load env vars from ~/.jelly/.env ─────────────────────────────────────────
const JELLY_HOME = process.env.JELLYOS_HOME ?? join(homedir(), ".jelly");
const envPath    = join(JELLY_HOME, ".env");
if (existsSync(envPath)) loadDotenv({ path: envPath, override: false });

// ── Parse CLI args ────────────────────────────────────────────────────────────
const args   = process.argv.slice(2);
const subcmd = args[0];

if (subcmd === "setup") {
  console.log(T.accent("JellyOS setup — run setup.sh for full setup."));
  console.log(T.muted(`Home: ${JELLY_HOME}`));
  process.exit(0);
}

if (subcmd === "config") {
  console.log(T.accent("JellyOS Config"));
  console.log(T.muted(`Config file: ${envPath}`));
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf-8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (!m) continue;
      const masked = m[2].length > 12 ? m[2].slice(0, 6) + "********" : "********";
      console.log(`  ${m[1].padEnd(28)} ${masked}`);
    }
  } else {
    console.log(T.warn("No config found. Run jellyos setup first."));
  }
  process.exit(0);
}

// ── Resolve extension + prompt ────────────────────────────────────────────────
let extensionPath: string | null = null;
let promptPath:    string | null = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--extension" && args[i + 1]) extensionPath = args[i + 1]!;
  if (args[i] === "--prompt"    && args[i + 1]) promptPath    = args[i + 1]!;
}

if (!extensionPath) {
  for (const c of ["extensions/jellyos.ts", "extensions/jellyos.js", "extension.ts", "extension.js"]) {
    const abs = resolve(c);
    if (existsSync(abs)) { extensionPath = abs; break; }
  }
}

let systemPrompt = "";
if (promptPath && existsSync(promptPath)) {
  systemPrompt = readFileSync(promptPath, "utf-8");
} else {
  const dp = resolve("prompts/jellyos.md");
  if (existsSync(dp)) systemPrompt = readFileSync(dp, "utf-8");
}

function loadContext(): { effectLevel: string; chain: string } {
  const ctxPath = join(JELLY_HOME, "context.json");
  if (!existsSync(ctxPath)) return { effectLevel: "normal", chain: "ethereum" };
  try {
    const ctx = JSON.parse(readFileSync(ctxPath, "utf-8"));
    if (ctx.model && typeof ctx.model === "string") {
      process.env.DEFAULT_MODEL = ctx.model;
      try {
        const ef = join(JELLY_HOME, ".env");
        const c = existsSync(ef) ? readFileSync(ef, "utf-8") : "";
        const re = /^DEFAULT_MODEL=.*$/m;
        writeFileSync(ef, re.test(c) ? c.replace(re, `DEFAULT_MODEL=${ctx.model}`) : c + `\nDEFAULT_MODEL=${ctx.model}\n`, "utf-8");
      } catch { /* non-fatal */ }
    }
    return { effectLevel: ctx.effect_level ?? "normal", chain: ctx.active_chain ?? "ethereum" };
  } catch { return { effectLevel: "normal", chain: "ethereum" }; }
}

// ── Headless mode (#26) ─────────────────────────────────────────────────────
const headlessIdx = args.indexOf("--headless");
const headlessMsg = headlessIdx >= 0 ? args[headlessIdx + 1] : null;

if (headlessMsg) {
  (async () => {
    if (existsSync(envPath)) loadDotenv({ path: envPath, override: false });

    const registry = new Registry();
    if (extensionPath) {
      try {
        await loadExtension(extensionPath, registry);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        process.stderr.write(`Extension load failed: ${msg}\n`);
        process.exit(1);
      }
    }

    await modelRegistry.initialise();

    const session    = new SessionManager();
    const prompt     = systemPrompt || registry.getSystemPrompt() || "You are JellyOS, an autonomous AI trading agent.";
    session.setSystemPrompt(prompt);

    const theme  = makeTheme();
    const nullUi: UIContext = {
      notify:    () => {},
      setStatus: () => {},
      setTheme:  () => {},
      setHeader: () => {},
      showModelSelector: () => {},
      theme,
    };
    const sessionCtx: SessionContext = {
      ui:     nullUi,
      hasUI:  false,
      config: { OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY },
    };

    // Fire session_start hooks
    await registry.fireHook("session_start", sessionCtx);
    session.setSystemPrompt(registry.getSystemPrompt() || prompt);

    let exitCode = 0;
    const runner = new AgentRunner(
      registry, session,
      (event) => {
        if (event.type === "text_delta")  process.stdout.write(event.text);
        if (event.type === "turn_done")   process.stdout.write("\n");
        if (event.type === "error") {
          process.stderr.write(`\nError: ${event.message}\n`);
          exitCode = 1;
        }
      },
      sessionCtx, "normal", modelRegistry,
    );

    try {
      await runner.run(headlessMsg);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      process.stderr.write(`Runner error: ${msg}\n`);
      exitCode = 1;
    }

    await registry.fireHook("session_end", sessionCtx);
    process.exit(exitCode);
  })();
} else {

// ── Boot (interactive TUI) ────────────────────────────────────────────────────
(async () => {
  console.clear();
  console.log(T.accent(`
   ██╗███████╗██╗     ██╗  ██╗   ██╗  ██████╗ ███████╗
   ██║██╔════╝██║     ██║  ╚██╗ ██╔╝ ██╔═══██╗██╔════╝
   ██║█████╗  ██║     ██║   ╚████╔╝  ██║   ██║███████╗
██ ██║██╔══╝  ██║     ██║    ╚██╔╝   ██║   ██║╚════██║
╚█████╔╝███████╗███████╗██║   ██║    ╚██████╔╝███████║
 ╚════╝ ╚══════╝╚══════╝╚═╝   ╚═╝     ╚═════╝ ╚══════╝
  `));
  console.log(T.muted("  Standalone AI trading agent — all local, zero exposure\n"));

  const registry                   = new Registry();
  const { effectLevel, chain }     = loadContext();

  let _notifyFn:   ((msg: string)           => void) | null = null;
  let _setStatusFn:((k: string, v: string) => void) | null = null;
  let _showModelSelectorFn: ((q?: string)   => void) | null = null;

  if (extensionPath) {
    try {
      console.log(T.muted(`  Loading: ${extensionPath}`));
      await loadExtension(extensionPath, registry, {
        onNotify:      (msg) => { _notifyFn?.(msg); },
        onStatusUpdate:(k, v) => { _setStatusFn?.(k, v); },
        onShowModelSelector: (q) => { _showModelSelectorFn?.(q); },
      });
      console.log(T.success(`  ✓ ${registry.listTools().length} tools · ${registry.listCommands().length} commands`));
    } catch (e: any) {
      console.error(T.error(`  ✗ Extension load failed: ${e.message}`));
      process.exit(1);
    }
  } else {
    console.log(T.warn("  No extension found — base agent only."));
    console.log(T.muted("  Run from jellyos project root or pass --extension path\n"));
  }

  if (!process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    console.log(T.warn("  No API key found. Set OPENROUTER_API_KEY in ~/.jelly/.env\n"));
  }

  // ── Initialise model registry & cost tracker ─────────────────────────────
  const costTracker = new CostTracker(modelRegistry);
  console.log(T.muted("  Discovering available models via OpenRouter…"));
  await modelRegistry.initialise();
  console.log(T.success(`  ✓ ${modelRegistry.modelCount} models available \n`));

  await new Promise(r => setTimeout(r, 500));
  console.clear();

  render(
    React.createElement(App, {
      registry,
      systemPrompt,
      effectLevel,
      chain,
      modelReg:     modelRegistry,
      costTracker,
      onNotifyReady:  (fn) => { _notifyFn    = fn; wireNotify(fn); },
      onStatusReady:  (fn) => { _setStatusFn = fn; },
      onModelSelectorReady: (fn) => { _showModelSelectorFn = fn; },
    }),
    { exitOnCtrlC: false },
  );
  // Ink owns the terminal from this point on. Any console.log/error/warn
  // writes raw bytes to stdout, bypassing Ink's rendering buffer. Ink's
  // cursor-up calculation becomes wrong → stacked border lines.
  // NOTE: process.stdout.write is intentionally NOT patched — Ink uses it
  // for every render frame; intercepting it globally would break Ink output.
  process.prependListener("SIGWINCH", () => { process.stdout.write("\x1B[2J\x1B[H"); });
  console.log = safeLog;
  console.error = safeLog;
  console.warn = safeLog;
})();
} // end headless else
