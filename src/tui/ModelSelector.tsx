/**
 * ModelSelector — interactive model picker overlay.
 * Renders a searchable, scrollable list of models with keyboard navigation.
 *
 * Up/Down: move selection
 * Enter:   select model
 * Escape:  cancel
 * Type:    filter models by name/provider
 */

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { JELLY_COLORS, T } from "./theme.js";

export interface ModelItem {
  id:   string;
  tier: string;
}

export interface ModelSelectorProps {
  models:         ModelItem[];
  currentModelId: string;
  onSelect(modelId: string): void;
  onCancel():                void;
  initialQuery?:            string;
}

const VISIBLE_COUNT = 10;

function fuzzyFilter(items: ModelItem[], query: string): ModelItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return items;
  return items.filter((item) => {
    const hay = `${item.id} ${item.tier}`.toLowerCase();
    if (hay.includes(q)) return true;
    let hi = 0;
    for (let qi = 0; qi < q.length && hi < hay.length; hi++) {
      if (hay[hi] === q[qi]) qi++;
    }
    return hi <= hay.length;
  });
}

export function ModelSelector({
  models,
  currentModelId,
  onSelect,
  onCancel,
  initialQuery = "",
}: ModelSelectorProps) {
  const [query, setQuery]                   = useState(initialQuery);
  const [selectedIndex, setSelectedIndex]   = useState(0);

  const filtered = useMemo(() => fuzzyFilter(models, query), [models, query]);

  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  useEffect(() => {
    const idx = models.findIndex((m) => m.id === currentModelId);
    if (idx >= 0) setSelectedIndex(idx);
  }, [models, currentModelId]);

  const handleSubmit = useCallback(() => {
    const selected = filtered[selectedIndex];
    if (selected) onSelect(selected.id);
  }, [filtered, selectedIndex, onSelect]);

  useInput((input, key) => {
    if (key.escape) { onCancel(); return; }
    if (key.return) { handleSubmit(); return; }
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

  const startIdx = Math.max(0, Math.min(
    selectedIndex - Math.floor(VISIBLE_COUNT / 2),
    filtered.length - VISIBLE_COUNT,
  ));
  const endIdx  = Math.min(startIdx + VISIBLE_COUNT, filtered.length);
  const visible = filtered.slice(startIdx, endIdx);

  return (
    <Box flexDirection="column" width="100%">
      <Box borderStyle="round" borderColor={JELLY_COLORS.accent} marginY={1} paddingX={1}>
        <Text color={JELLY_COLORS.accent} bold>🪼 Select Model</Text>
      </Box>

      <Box paddingX={2}>
        <Text color={JELLY_COLORS.muted}>  Search: </Text>
        <TextInput
          value={query}
          onChange={setQuery}
          onSubmit={handleSubmit}
          placeholder="type to filter..."
        />
      </Box>

      <Box paddingX={1}>
        <Text color={JELLY_COLORS.dim}>  ↑↓ navigate · Enter select · Esc cancel</Text>
        {filtered.length !== models.length && (
          <Text color={JELLY_COLORS.muted}> · {filtered.length}/{models.length} shown</Text>
        )}
      </Box>

      <Box flexDirection="column" paddingX={2} marginTop={1}>
        {filtered.length === 0 ? (
          <Text color={JELLY_COLORS.warn}>  No models match "{query}"</Text>
        ) : (
          visible.map((item, visIdx) => {
            const realIdx    = startIdx + visIdx;
            const isSelected = realIdx === selectedIndex;
            const isCurrent  = item.id === currentModelId;
            const checkMark  = isCurrent ? T.success(" ✓") : "";

            return (
              <Text key={item.id} color={isSelected ? JELLY_COLORS.accent : undefined}>
                <Text color={JELLY_COLORS.accent}>{isSelected ? "→" : " "}</Text>{" "}
                <Text color={isSelected ? JELLY_COLORS.accent : JELLY_COLORS.header} bold={isSelected}>
                  {item.id}
                </Text>
                <Text color={JELLY_COLORS.muted}> [{item.tier}]</Text>
                {checkMark}
              </Text>
            );
          })
        )}
      </Box>

      {endIdx < filtered.length && (
        <Box paddingX={2}>
          <Text color={JELLY_COLORS.dim}>
            ··· {filtered.length - endIdx} more (scroll down or refine search)
          </Text>
        </Box>
      )}

      <Box paddingX={2} marginTop={1}>
        <Text color={JELLY_COLORS.muted}>  ({selectedIndex + 1}/{filtered.length})</Text>
      </Box>
    </Box>
  );
}
