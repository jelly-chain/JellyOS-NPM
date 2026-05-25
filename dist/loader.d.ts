/**
 * loader.ts — loads an extension file and wires it to a Registry.
 *
 * Implements the full ExtensionAPI including Pi compat methods:
 *   ui.setStatus, ui.setTheme, ui.setHeader, ctx.hasUI,
 *   session_shutdown, before_agent_start
 */
import { Registry } from "./api/Registry.js";
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
export declare function loadExtension(extensionPath: string, registry: Registry, opts?: LoaderOptions): Promise<void>;
//# sourceMappingURL=loader.d.ts.map