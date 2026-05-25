import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { JELLY_COLORS } from "./theme.js";
export function StatusBar({ model, chain, vaultLocked, effectLevel, toolRunning, connected, statusLine, }) {
    const vaultIcon = vaultLocked ? "🔒" : "🔓";
    const chainShort = chain.slice(0, 8);
    const modelShort = model.split("/").pop()?.slice(0, 18) ?? model.slice(0, 18);
    const effectIcon = { eco: "🌿", normal: "⚡", turbo: "🚀", max: "🌊" }[effectLevel] ?? "⚡";
    return (_jsxs(Box, { borderStyle: "single", borderColor: JELLY_COLORS.dim, paddingX: 1, flexDirection: "row", justifyContent: "space-between", children: [_jsxs(Box, { gap: 2, children: [_jsx(Text, { color: JELLY_COLORS.accent, bold: true, children: "\uD83E\uDEBC JellyOS" }), _jsx(Text, { color: JELLY_COLORS.muted, children: modelShort })] }), _jsx(Box, { children: toolRunning
                    ? _jsxs(Text, { color: JELLY_COLORS.warn, children: ["\u2699 ", toolRunning] })
                    : statusLine
                        ? _jsx(Text, { color: JELLY_COLORS.success, children: statusLine })
                        : _jsx(Text, { color: JELLY_COLORS.muted, children: connected ? "ready" : "connecting…" }) }), _jsxs(Box, { gap: 2, children: [_jsx(Text, { color: JELLY_COLORS.muted, children: chainShort }), _jsx(Text, { children: vaultIcon }), _jsxs(Text, { color: JELLY_COLORS.header, children: [effectIcon, " ", effectLevel] })] })] }));
}
//# sourceMappingURL=StatusBar.js.map