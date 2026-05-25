/**
 * loader.ts — loads an extension file and wires it to a Registry.
 *
 * Implements the full ExtensionAPI including Pi compat methods:
 *   ui.setStatus, ui.setTheme, ui.setHeader, ctx.hasUI,
 *   session_shutdown, before_agent_start
 */
import { pathToFileURL } from "node:url";
import { resolve, extname } from "node:path";
import { existsSync } from "node:fs";
import { makeTheme } from "./tui/theme.js";
export async function loadExtension(extensionPath, registry, opts = {}) {
    const abs = resolve(extensionPath);
    if (!existsSync(abs)) {
        throw new Error(`Extension file not found: ${abs}`);
    }
    const theme = makeTheme();
    // Live-updateable notifier — App.tsx replaces this once mounted
    let _notify = opts.onNotify ?? ((_msg) => { });
    let _setStatus = opts.onStatusUpdate ?? ((_k, _v) => { });
    const ui = {
        notify(message) { _notify(message); },
        setStatus(key, value) { _setStatus(key, value); },
        setTheme(_name) { },
        setHeader(_factory) { },
        theme,
    };
    const api = {
        registerCommand(name, def) {
            registry.addCommand(name, def);
        },
        registerTool(def) {
            registry.addTool(def);
        },
        registerSkill(def) {
            registry.addSkill(def);
        },
        on(event, handler) {
            registry.addHook(event, handler);
        },
        setSystemPrompt(prompt) {
            registry.setSystemPrompt(prompt);
        },
        ui,
    };
    const ext = extname(abs).toLowerCase();
    let mod;
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
        }
        else {
            // Attempt tsx runtime import (tsx must be installed)
            try {
                const tsxMod = await import("tsx/esm/api");
                mod = await tsxMod.tsImport(pathToFileURL(abs).href, import.meta.url);
            }
            catch {
                throw new Error(`Cannot import TypeScript extension "${abs}" in packaged mode.\n` +
                    `Fix options:\n` +
                    `  1. Compile the extension first: npx tsx --transpile-only ${abs}\n` +
                    `     (produces ${jsPath})\n` +
                    `  2. Install tsx globally: npm install -g tsx\n` +
                    `     Then run: tsx bin/jellyagent --extension ${abs}`);
            }
        }
    }
    else {
        mod = await import(pathToFileURL(abs).href);
    }
    const fn = mod.default ?? mod;
    if (typeof fn !== "function") {
        throw new Error(`Extension must export a default function. Got: ${typeof fn} from ${abs}`);
    }
    await fn(api);
}
//# sourceMappingURL=loader.js.map