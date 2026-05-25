/**
 * App — root Ink component.
 * Wires StatusBar + REPL + AgentRunner. Passes live setStatus/notify callbacks
 * to the extension API so Pi compat calls (ui.setStatus, ui.notify) update the TUI.
 */
import { Registry } from "../api/Registry.js";
export interface AppProps {
    registry: Registry;
    systemPrompt?: string;
    effectLevel?: string;
    chain?: string;
    /** Notifier callback injected before mount so it's ready when session_start fires */
    onNotifyReady?: (fn: (msg: string) => void) => void;
    /** Status updater callback injected before mount */
    onStatusReady?: (fn: (key: string, val: string) => void) => void;
}
export declare function App({ registry, systemPrompt, effectLevel: initialEffect, chain: initialChain, onNotifyReady, onStatusReady, }: AppProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=App.d.ts.map