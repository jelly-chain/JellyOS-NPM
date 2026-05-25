/**
 * cli.ts — JellyOS entry point.
 * Completely standalone — all outbound, no inbound ports exposed.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join }            from "node:path";
import { homedir }                  from "node:os";
import { render }                   from "ink";
import React                        from "react";
import { config as loadDotenv }     from "dotenv";
import { Registry }                 from "./api/Registry.js";
import { loadExtension }            from "./loader.js";
import { App }                      from "./tui/App.js";
import { T }                        from "./tui/theme.js";

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
      const masked = m[2].length > 8 ? m[2].slice(0, 4) + "****" + m[2].slice(-4) : "****";
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
    return { effectLevel: ctx.effect_level ?? "normal", chain: ctx.active_chain ?? "ethereum" };
  } catch { return { effectLevel: "normal", chain: "ethereum" }; }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
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

  // These callbacks are forwarded into the extension API so ui.setStatus
  // and ui.notify work even during the session_start hook (before Ink mounts).
  let _notifyFn:   ((msg: string)           => void) | null = null;
  let _setStatusFn:((k: string, v: string) => void) | null = null;

  if (extensionPath) {
    try {
      console.log(T.muted(`  Loading: ${extensionPath}`));
      await loadExtension(extensionPath, registry, {
        onNotify:      (msg) => { _notifyFn?.(msg); },
        onStatusUpdate:(k, v) => { _setStatusFn?.(k, v); },
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

  await new Promise(r => setTimeout(r, 500));
  console.clear();

  render(
    React.createElement(App, {
      registry,
      systemPrompt,
      effectLevel,
      chain,
      onNotifyReady:  (fn) => { _notifyFn    = fn; },
      onStatusReady:  (fn) => { _setStatusFn = fn; },
    }),
    { exitOnCtrlC: false },
  );
})();
