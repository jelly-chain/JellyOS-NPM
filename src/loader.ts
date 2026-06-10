/**
 * loader.ts — loads an extension file and wires it to a Registry.
 *
 * Implements the full ExtensionAPI including Pi compat methods:
 *   ui.setStatus, ui.setTheme, ui.setHeader, ctx.hasUI,
 *   session_shutdown, before_agent_start
 */

import { pathToFileURL }      from "node:url";
import { resolve, extname }   from "node:path";
import { existsSync }         from "node:fs";
import { Registry }           from "./api/Registry.js";
import { makeTheme }          from "./tui/theme.js";
import type {
  ExtensionAPI,
  CommandDef,
  ToolDef,
  SkillDef,
  SessionEvent,
  UIContext,
} from "./api/ExtensionAPI.js";
import type { TSchema }       from "@sinclair/typebox";

export interface LoaderOptions {
  onStatusUpdate?: (key: string, value: string) => void;
  onNotify?: (message: string) => void;
  /** Called when the extension calls ui.showModelSelector(query). */
  onShowModelSelector?: (query?: string) => void;
}

export async function loadExtension(
  extensionPath: string,
  registry: Registry,
  opts: LoaderOptions = {},
): Promise<void> {
  const abs = resolve(extensionPath);
  if (!existsSync(abs)) {
    throw new Error(`Extension file not found: ${abs}`);
  }

  const theme = makeTheme();

  let _notify = opts.onNotify ?? ((_msg: string) => {});
  let _setStatus = opts.onStatusUpdate ?? ((_k: string, _v: string) => {});
  let _showModelSelector = opts.onShowModelSelector ?? ((_q?: string) => {});

  const ui: UIContext = {
    notify(message: string)             { _notify(message); },
    setStatus(key: string, value: string) { _setStatus(key, value); },
    setTheme(_name: string)             { /* engine uses fixed jelly theme */ },
    setHeader(_factory)                 { /* engine renders its own Ink header */ },
    showModelSelector(query?: string)   { _showModelSelector(query); },
    theme,
  };

  const api: ExtensionAPI = {
    registerCommand(name: string, def: CommandDef) {
      registry.addCommand(name, def);
    },
    registerTool<P extends TSchema>(def: ToolDef<P>) {
      registry.addTool(def);
    },
    registerSkill(def: SkillDef) {
      registry.addSkill(def);
    },
    on(event: SessionEvent, handler: (...args: any[]) => Promise<void>) {
      registry.addHook(event, handler);
    },
    setSystemPrompt(prompt: string) {
      registry.setSystemPrompt(prompt);
    },
    ui,
  };

  const ext = extname(abs).toLowerCase();
  let mod: any;

  if (ext === ".ts") {
    // In packaged (dist) mode Node.js cannot natively import TypeScript.
    // Resolution order:
    //   1. Try a compiled sibling: same dir, same basename but .js extension
    //   2. Try tsx/esm API (available when tsx is installed as dev-dep or globally)
    //   3. Throw a clear error telling the user how to fix it
    const jsPath = abs.replace(/\.ts$/, ".js");
    if (existsSync(jsPath)) {
      // Pre-compiled sibling exists — use it directly
      mod = await import(pathToFileURL(jsPath).href);
    } else {
      // Attempt tsx runtime import (tsx must be installed)
      try {
        const tsxMod = await import("tsx/esm/api");
        mod = await tsxMod.tsImport(pathToFileURL(abs).href, import.meta.url);
      } catch {
        throw new Error(
          `Cannot import TypeScript extension "${abs}" in packaged mode.\n` +
          `Fix options:\n` +
          `  1. Compile the extension first: npx tsx --transpile-only ${abs}\n` +
          `     (produces ${jsPath})\n` +
          `  2. Install tsx globally: npm install -g tsx\n` +
          `     Then run: tsx bin/jellyagent --extension ${abs}`,
        );
      }
    }
  } else {
    mod = await import(pathToFileURL(abs).href);
  }

  const fn = mod.default ?? mod;
  if (typeof fn !== "function") {
    throw new Error(
      `Extension must export a default function. Got: ${typeof fn} from ${abs}`,
    );
  }

  // Intercept console.log/error/warn during extension load so that any
  // stray prints in the extension (e.g. loadSkills logging) are routed
  // through ui.notify instead of raw stdout writes that corrupt the TUI.
  const _origLog = console.log;
  const _origError = console.error;
  const _origWarn = console.warn;
  const _extLog = (...args: unknown[]) => {
    const msg = args.map(a => (typeof a === "string" ? a : String(a))).join(" ");
    ui.notify(msg);
  };
  console.log = _extLog;
  console.error = _extLog;
  console.warn = _extLog;
  try {
    await fn(api);
  } finally {
    console.log = _origLog;
    console.error = _origError;
    console.warn = _origWarn;
  }
}
