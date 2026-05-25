/**
 * REPL — scrolling message history + bottom input box.
 * Renders assistant text, tool calls, tool results, and user messages.
 */

import React, { useState, useCallback } from "react";
import { Box, Text, useStdout, useInput } from "ink";
import TextInput from "ink-text-input";
import { JELLY_COLORS } from "./theme.js";

export type MessageRole = "user" | "assistant" | "tool" | "system" | "notify";

export interface ChatMessage {
  id:      string;
  role:    MessageRole;
  content: string;
  toolName?: string;
  isError?:  boolean;
  ts:      number;
}

export interface REPLProps {
  messages:    ChatMessage[];
  streamingText: string;       // partial assistant text being streamed
  toolRunning:   string | null;
  onSubmit(input: string): void;
  disabled:    boolean;
}

const MAX_VISIBLE = 40;

function MessageLine({ msg }: { msg: ChatMessage }) {
  const time = new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (msg.role === "user") {
    return (
      <Box flexDirection="row" gap={1} marginTop={1}>
        <Text color={JELLY_COLORS.muted}>{time}</Text>
        <Text color={JELLY_COLORS.accent} bold>you  </Text>
        <Text wrap="wrap">{msg.content}</Text>
      </Box>
    );
  }

  if (msg.role === "assistant") {
    return (
      <Box flexDirection="row" gap={1} marginTop={1}>
        <Text color={JELLY_COLORS.muted}>{time}</Text>
        <Text color={JELLY_COLORS.header} bold>🪼   </Text>
        <Text wrap="wrap">{msg.content}</Text>
      </Box>
    );
  }

  if (msg.role === "tool") {
    const icon = msg.isError ? "✗" : "✓";
    const col  = msg.isError ? JELLY_COLORS.error : JELLY_COLORS.success;
    return (
      <Box flexDirection="row" gap={1} marginY={0}>
        <Text color={JELLY_COLORS.muted}>{time}</Text>
        <Text color={col}>{icon} {msg.toolName ?? "tool"}</Text>
        {msg.content.length < 120
          ? <Text color={JELLY_COLORS.muted} wrap="wrap"> {msg.content}</Text>
          : <Text color={JELLY_COLORS.muted}> ({msg.content.length} chars)</Text>
        }
      </Box>
    );
  }

  if (msg.role === "notify") {
    return (
      <Box
        borderStyle="round"
        borderColor={JELLY_COLORS.accent}
        marginY={1}
        paddingX={1}
      >
        <Text wrap="wrap">{msg.content}</Text>
      </Box>
    );
  }

  // system messages — dimmed
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={JELLY_COLORS.dim} wrap="wrap">{msg.content}</Text>
    </Box>
  );
}

export function REPL({ messages, streamingText, toolRunning, onSubmit, disabled }: REPLProps) {
  const [input, setInput]   = useState("");
  const { stdout }          = useStdout();
  const termWidth           = stdout?.columns ?? 80;

  const handleSubmit = useCallback((val: string) => {
    const trimmed = val.trim();
    if (!trimmed || disabled) return;
    setInput("");
    onSubmit(trimmed);
  }, [onSubmit, disabled]);

  const visible = messages.slice(-MAX_VISIBLE);

  return (
    <Box flexDirection="column" width={termWidth}>
      {/* Message history */}
      <Box flexDirection="column" flexGrow={1}>
        {visible.map(m => <MessageLine key={m.id} msg={m} />)}

        {/* Streaming assistant text */}
        {streamingText && (
          <Box flexDirection="row" gap={1} marginTop={1}>
            <Text color={JELLY_COLORS.muted}>   </Text>
            <Text color={JELLY_COLORS.header} bold>🪼   </Text>
            <Text wrap="wrap">{streamingText}</Text>
          </Box>
        )}

        {/* Tool spinner */}
        {toolRunning && (
          <Box flexDirection="row" gap={1} marginTop={1}>
            <Text color={JELLY_COLORS.warn}>⚙  running {toolRunning}…</Text>
          </Box>
        )}
      </Box>

      {/* Input bar */}
      <Box
        borderStyle="round"
        borderColor={disabled ? JELLY_COLORS.dim : JELLY_COLORS.accent}
        paddingX={1}
        marginTop={1}
      >
        <Text color={JELLY_COLORS.accent}>› </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder={disabled ? "thinking…" : "message or /command"}
        />
      </Box>

      <Box paddingX={2}>
        <Text color={JELLY_COLORS.dim}>
          /help · /status · /vault · /wallets · /panic · Tab to complete · Ctrl-C to exit
        </Text>
      </Box>
    </Box>
  );
}
