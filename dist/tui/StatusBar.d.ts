/**
 * StatusBar — single line at the top of the TUI showing live agent state.
 * Also displays status badges set by the extension via ui.setStatus().
 */
export interface StatusBarProps {
    model: string;
    chain: string;
    vaultLocked: boolean;
    effectLevel: string;
    toolRunning: string | null;
    connected: boolean;
    /** Extension-set status badges (joined with spaces) */
    statusLine?: string | null;
}
export declare function StatusBar({ model, chain, vaultLocked, effectLevel, toolRunning, connected, statusLine, }: StatusBarProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=StatusBar.d.ts.map