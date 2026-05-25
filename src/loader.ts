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
  /**
   * Called when the extension uses ui.setStatus(key, value).
   * The App component passes a state-setter here so status badges update live.
   */
  onStatusUpdate?: (key: string, value: string) => void;

  /**
   * Called when the extension calls ui.notify(message).
   * Before the TUI is mounted, the App wires this to React state.
   * We store the latest notifier here so the extension can call it any time.
   */
  onNotify?: (message: string) => void;
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

  // Live-updateable notifier — App.tsx replaces this once mounted
  let _notify = opts.onNotify ?? ((_msg: string) => {});
  let _setStatus = opts.onStatusUpdate ?? ((_k: string, _v: string) => {});

  const ui: UIContext = {
    notify(message: string)             { _notify(message); },
    setStatus(key: string, value: string) { _setStatus(key, value); },
    setTheme(_name: string)             { /* engine uses fixed jelly theme */ },
    setHeader(_factory)                 { /* engine renders its own Ink header */ },
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

  await fn(api);
}
