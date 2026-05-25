import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * REPL — scrolling message history + bottom input box.
 * Renders assistant text, tool calls, tool results, and user messages.
 */
import { useState, useCallback } from "react";
import { Box, Text, useStdout } from "ink";
import TextInput from "ink-text-input";
import { JELLY_COLORS } from "./theme.js";
const MAX_VISIBLE = 40;
function MessageLine({ msg }) {
    const time = new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (msg.role === "user") {
        return (_jsxs(Box, { flexDirection: "row", gap: 1, marginTop: 1, children: [_jsx(Text, { color: JELLY_COLORS.muted, children: time }), _jsx(Text, { color: JELLY_COLORS.accent, bold: true, children: "you  " }), _jsx(Text, { wrap: "wrap", children: msg.content })] }));
    }
    if (msg.role === "assistant") {
        return (_jsxs(Box, { flexDirection: "row", gap: 1, marginTop: 1, children: [_jsx(Text, { color: JELLY_COLORS.muted, children: time }), _jsx(Text, { color: JELLY_COLORS.header, bold: true, children: "\uD83E\uDEBC   " }), _jsx(Text, { wrap: "wrap", children: msg.content })] }));
    }
    if (msg.role === "tool") {
        const icon = msg.isError ? "✗" : "✓";
        const col = msg.isError ? JELLY_COLORS.error : JELLY_COLORS.success;
        return (_jsxs(Box, { flexDirection: "row", gap: 1, marginY: 0, children: [_jsx(Text, { color: JELLY_COLORS.muted, children: time }), _jsxs(Text, { color: col, children: [icon, " ", msg.toolName ?? "tool"] }), msg.content.length < 120
                    ? _jsxs(Text, { color: JELLY_COLORS.muted, wrap: "wrap", children: [" ", msg.content] })
                    : _jsxs(Text, { color: JELLY_COLORS.muted, children: [" (", msg.content.length, " chars)"] })] }));
    }
    if (msg.role === "notify") {
        return (_jsx(Box, { borderStyle: "round", borderColor: JELLY_COLORS.accent, marginY: 1, paddingX: 1, children: _jsx(Text, { wrap: "wrap", children: msg.content }) }));
    }
    // system messages — dimmed
    return (_jsx(Box, { flexDirection: "row", gap: 1, children: _jsx(Text, { color: JELLY_COLORS.dim, wrap: "wrap", children: msg.content }) }));
}
export function REPL({ messages, streamingText, toolRunning, onSubmit, disabled }) {
    const [input, setInput] = useState("");
    const { stdout } = useStdout();
    const termWidth = stdout?.columns ?? 80;
    const handleSubmit = useCallback((val) => {
        const trimmed = val.trim();
        if (!trimmed || disabled)
            return;
        setInput("");
        onSubmit(trimmed);
    }, [onSubmit, disabled]);
    const visible = messages.slice(-MAX_VISIBLE);
    return (_jsxs(Box, { flexDirection: "column", width: termWidth, children: [_jsxs(Box, { flexDirection: "column", flexGrow: 1, children: [visible.map(m => _jsx(MessageLine, { msg: m }, m.id)), streamingText && (_jsxs(Box, { flexDirection: "row", gap: 1, marginTop: 1, children: [_jsx(Text, { color: JELLY_COLORS.muted, children: "   " }), _jsx(Text, { color: JELLY_COLORS.header, bold: true, children: "\uD83E\uDEBC   " }), _jsx(Text, { wrap: "wrap", children: streamingText })] })), toolRunning && (_jsx(Box, { flexDirection: "row", gap: 1, marginTop: 1, children: _jsxs(Text, { color: JELLY_COLORS.warn, children: ["\u2699  running ", toolRunning, "\u2026"] }) }))] }), _jsxs(Box, { borderStyle: "round", borderColor: disabled ? JELLY_COLORS.dim : JELLY_COLORS.accent, paddingX: 1, marginTop: 1, children: [_jsx(Text, { color: JELLY_COLORS.accent, children: "\u203A " }), _jsx(TextInput, { value: input, onChange: setInput, onSubmit: handleSubmit, placeholder: disabled ? "thinking…" : "message or /command" })] }), _jsx(Box, { paddingX: 2, children: _jsx(Text, { color: JELLY_COLORS.dim, children: "/help \u00B7 /status \u00B7 /vault \u00B7 /wallets \u00B7 /panic \u00B7 Tab to complete \u00B7 Ctrl-C to exit" }) })] }));
}
//# sourceMappingURL=REPL.js.map