/**
 * JellyOS colour theme — maps semantic names to chalk/ANSI colours.
 * Exported as a ThemeContext-compatible object so it can be passed into
 * extension command handlers via ctx.ui.theme.
 */
import chalk from "chalk";
export const JELLY_COLORS = {
    accent: "#00e5ff", // cyan-aqua — jelly signature
    success: "#69ff94", // soft green
    error: "#ff5370", // coral red
    warn: "#ffcb6b", // amber
    muted: "#546e7a", // slate grey
    header: "#c792ea", // soft purple
    dim: "#37474f", // dark slate
};
export function makeTheme() {
    return {
        fg(color, text) {
            const hex = JELLY_COLORS[color] ?? color;
            try {
                return chalk.hex(hex)(text);
            }
            catch {
                return text;
            }
        },
    };
}
/** Convenience — themed prefix for agent output lines */
export const theme = makeTheme();
export const T = {
    accent: (s) => chalk.hex(JELLY_COLORS.accent)(s),
    success: (s) => chalk.hex(JELLY_COLORS.success)(s),
    error: (s) => chalk.hex(JELLY_COLORS.error)(s),
    warn: (s) => chalk.hex(JELLY_COLORS.warn)(s),
    muted: (s) => chalk.hex(JELLY_COLORS.muted)(s),
    header: (s) => chalk.hex(JELLY_COLORS.header)(s),
    dim: (s) => chalk.hex(JELLY_COLORS.dim)(s),
    bold: (s) => chalk.bold(s),
};
//# sourceMappingURL=theme.js.map