import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ModelSelector — interactive model picker overlay.
 * Renders a searchable, scrollable list of models with keyboard navigation.
 *
 * Up/Down: move selection
 * Enter:   select model
 * Escape:  cancel
 * Type:    filter models by name/provider
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { JELLY_COLORS, T } from "./theme.js";
const VISIBLE_COUNT = 10;
function fuzzyFilter(items, query) {
    const q = query.toLowerCase().trim();
    if (!q)
        return items;
    return items.filter((item) => {
        const hay = `${item.id} ${item.tier}`.toLowerCase();
        if (hay.includes(q))
            return true;
        let hi = 0;
        for (let qi = 0; qi < q.length && hi < hay.length; hi++) {
            if (hay[hi] === q[qi])
                qi++;
        }
        return hi <= hay.length;
    });
}
export function ModelSelector({ models, currentModelId, onSelect, onCancel, initialQuery = "", }) {
    const [query, setQuery] = useState(initialQuery);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const filtered = useMemo(() => fuzzyFilter(models, query), [models, query]);
    useEffect(() => {
        setSelectedIndex((prev) => Math.min(prev, Math.max(0, filtered.length - 1)));
    }, [filtered.length]);
    useEffect(() => {
        const idx = models.findIndex((m) => m.id === currentModelId);
        if (idx >= 0)
            setSelectedIndex(idx);
    }, [models, currentModelId]);
    const handleSubmit = useCallback(() => {
        const selected = filtered[selectedIndex];
        if (selected)
            onSelect(selected.id);
    }, [filtered, selectedIndex, onSelect]);
    useInput((input, key) => {
        if (key.escape) {
            onCancel();
            return;
        }
        if (key.return) {
            handleSubmit();
            return;
        }
        if (key.upArrow) {
            setSelectedIndex((prev) => (prev <= 0 ? filtered.length - 1 : prev - 1));
            return;
        }
        if (key.downArrow) {
            setSelectedIndex((prev) => (prev >= filtered.length - 1 ? 0 : prev + 1));
            return;
        }
        if (key.backspace || key.delete) {
            setQuery((prev) => prev.slice(0, -1));
            return;
        }
        if (!key.ctrl && !key.meta && input) {
            setQuery((prev) => prev + input);
            return;
        }
    });
    const startIdx = Math.max(0, Math.min(selectedIndex - Math.floor(VISIBLE_COUNT / 2), filtered.length - VISIBLE_COUNT));
    const endIdx = Math.min(startIdx + VISIBLE_COUNT, filtered.length);
    const visible = filtered.slice(startIdx, endIdx);
    return (_jsxs(Box, { flexDirection: "column", width: "100%", children: [_jsx(Box, { borderStyle: "round", borderColor: JELLY_COLORS.accent, marginY: 1, paddingX: 1, children: _jsx(Text, { color: JELLY_COLORS.accent, bold: true, children: "\uD83E\uDEBC Select Model" }) }), _jsxs(Box, { paddingX: 2, children: [_jsx(Text, { color: JELLY_COLORS.muted, children: "  Search: " }), _jsx(TextInput, { value: query, onChange: setQuery, onSubmit: handleSubmit, placeholder: "type to filter..." })] }), _jsxs(Box, { paddingX: 1, children: [_jsx(Text, { color: JELLY_COLORS.dim, children: "  \u2191\u2193 navigate \u00B7 Enter select \u00B7 Esc cancel" }), filtered.length !== models.length && (_jsxs(Text, { color: JELLY_COLORS.muted, children: [" \u00B7 ", filtered.length, "/", models.length, " shown"] }))] }), _jsx(Box, { flexDirection: "column", paddingX: 2, marginTop: 1, children: filtered.length === 0 ? (_jsxs(Text, { color: JELLY_COLORS.warn, children: ["  No models match \"", query, "\""] })) : (visible.map((item, visIdx) => {
                    const realIdx = startIdx + visIdx;
                    const isSelected = realIdx === selectedIndex;
                    const isCurrent = item.id === currentModelId;
                    const checkMark = isCurrent ? T.success(" ✓") : "";
                    return (_jsxs(Text, { color: isSelected ? JELLY_COLORS.accent : undefined, children: [_jsx(Text, { color: JELLY_COLORS.accent, children: isSelected ? "→" : " " }), " ", _jsx(Text, { color: isSelected ? JELLY_COLORS.accent : JELLY_COLORS.header, bold: isSelected, children: item.id }), _jsxs(Text, { color: JELLY_COLORS.muted, children: [" [", item.tier, "]"] }), checkMark] }, item.id));
                })) }), endIdx < filtered.length && (_jsx(Box, { paddingX: 2, children: _jsxs(Text, { color: JELLY_COLORS.dim, children: ["\u00B7\u00B7\u00B7 ", filtered.length - endIdx, " more (scroll down or refine search)"] }) })), _jsx(Box, { paddingX: 2, marginTop: 1, children: _jsxs(Text, { color: JELLY_COLORS.muted, children: ["  (", selectedIndex + 1, "/", filtered.length, ")"] }) })] }));
}
//# sourceMappingURL=ModelSelector.js.map