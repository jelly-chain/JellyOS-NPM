/**
 * StatusBar — single line at the top of the TUI showing live agent state.
 * Also displays status badges set by the extension via ui.setStatus().
 */

import React from "react";
import { Box, Text } from "ink";
import { JELLY_COLORS } from "./theme.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface StatusBarProps {
  model:        string;
  chain:        string;
  vaultLocked:  boolean;
  effectLevel:  string;
  toolRunning:  string | null;
  connected:    boolean;
  /** Extension-set status badges (joined with spaces) */
  statusLine?:  string | null;
}

export function StatusBar({
  model, chain, vaultLocked, effectLevel, toolRunning, connected, statusLine,
}: StatusBarProps) {
  const vaultIcon  = vaultLocked ? "🔒" : "🔓";
  const chainShort = chain.slice(0, 8);
  const modelShort = model.split("/").pop()?.slice(0, 18) ?? model.slice(0, 18);
  const effectIcon = ({ eco: "🌿", normal: "⚡", turbo: "🚀", max: "🌊" } as Record<string, string>)[effectLevel] ?? "⚡";

  // Read rotation slot count for display
  let rotationCount = 0;
  try {
    const JELLY_HOME = process.env.JELLYOS_HOME ?? join(homedir(), ".jelly");
    const ctxPath = join(JELLY_HOME, "context.json");
    if (existsSync(ctxPath)) {
      const store = JSON.parse(readFileSync(ctxPath, "utf-8"));
      const slots = store.rotationSlots ?? [];
      rotationCount = slots.filter((s: {id?: string}) => s && s.id).length;
    }
  } catch { /* non-fatal */ }
  const rotationBadge = rotationCount > 0 ? `↻${rotationCount}` : null;

  return (
    <Box
      borderStyle="single"
      borderColor={JELLY_COLORS.dim}
      paddingX={1}
      flexDirection="row"
      justifyContent="space-between"
    >
      {/* Left: brand + model + rotation badge */}
      <Box gap={2}>
        <Text color={JELLY_COLORS.accent} bold>🪼 JellyOS</Text>
        <Text color={JELLY_COLORS.muted}>{modelShort}</Text>
        {rotationBadge ? <Text color="#6b7280">{rotationBadge}</Text> : null}
      </Box>

      {/* Centre: ticker | tool spinner | extension badges */}
      <Box>
        {toolRunning
          ? <Text color={JELLY_COLORS.warn}>⚙ {toolRunning}</Text>
          : statusLine
            ? <Text color={JELLY_COLORS.muted}>{statusLine.slice(0, 80)}</Text>
            : <Text color={JELLY_COLORS.muted}>{connected ? "ready" : "connecting…"}</Text>
        }
      </Box>

      {/* Right: chain | vault | effect */}
      <Box gap={2}>
        <Text color={JELLY_COLORS.muted}>{chainShort}</Text>
        <Text>{vaultIcon}</Text>
        <Text color={JELLY_COLORS.header}>{effectIcon} {effectLevel}</Text>
      </Box>
    </Box>
  );
}
