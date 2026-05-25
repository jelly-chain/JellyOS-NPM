/**
 * JellyOS colour theme — maps semantic names to chalk/ANSI colours.
 * Exported as a ThemeContext-compatible object so it can be passed into
 * extension command handlers via ctx.ui.theme.
 */
import type { ThemeContext } from "../api/ExtensionAPI.js";
export declare const JELLY_COLORS: {
    readonly accent: "#00e5ff";
    readonly success: "#69ff94";
    readonly error: "#ff5370";
    readonly warn: "#ffcb6b";
    readonly muted: "#546e7a";
    readonly header: "#c792ea";
    readonly dim: "#37474f";
};
export type JellyColor = keyof typeof JELLY_COLORS;
export declare function makeTheme(): ThemeContext;
/** Convenience — themed prefix for agent output lines */
export declare const theme: ThemeContext;
export declare const T: {
    accent: (s: string) => string;
    success: (s: string) => string;
    error: (s: string) => string;
    warn: (s: string) => string;
    muted: (s: string) => string;
    header: (s: string) => string;
    dim: (s: string) => string;
    bold: (s: string) => string;
};
//# sourceMappingURL=theme.d.ts.map