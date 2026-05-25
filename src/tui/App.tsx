/**
 * App — root Ink component.
 * Wires StatusBar + REPL + AgentRunner. Passes live setStatus/notify callbacks
 * to the extension API so Pi compat calls (ui.setStatus, ui.notify) update the TUI.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { StatusBar }    from "./StatusBar.js";
import { REPL }         from "./REPL.js";
import type { ChatMessage } from "./REPL.js";
import { makeTheme, T } from "./theme.js";
import { Registry }     from "../api/Registry.js";
import { AgentRunner }  from "../runner/AgentRunner.js";
import { SessionManager } from "../session/SessionManager.js";
import type { SessionContext, UIContext } from "../api/ExtensionAPI.js";
import { resolveModelConfig } from "../runner/ModelClient.js";

export interface AppProps {
  registry:    Registry;
  systemPrompt?: string;
  effectLevel?: string;
  chain?:       string;
  /** Notifier callback injected before mount so it's ready when session_start fires */
  onNotifyReady?: (fn: (msg: string) => void) => void;
  /** Status updater callback injected before mount */
  onStatusReady?: (fn: (key: string, val: string) => void) => void;
}

let _msgIdCounter = 0;
function nextId() { return String(++_msgIdCounter); }

export function App({
  registry,
  systemPrompt,
  effectLevel: initialEffect = "normal",
  chain:       initialChain  = "ethereum",
  onNotifyReady,
  onStatusReady,
}: AppProps) {
  const { exit }                      = useApp();
  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [streaming, setStreaming]     = useState("");
  const [toolRunning, setToolRunning] = useState<string | null>(null);
  const [disabled, setDisabled]       = useState(false);
  const [vaultLocked, setVaultLocked] = useState(true);
  const [effectLevel, setEffectLevel] = useState(initialEffect);
  const [chain, setChain]             = useState(initialChain);
  const [statusBadges, setStatusBadges] = useState<Record<string, string>>({});
  const runnerRef                     = useRef<AgentRunner | null>(null);
  const sessionRef                    = useRef<SessionManager | null>(null);
  const sessionCtxRef                 = useRef<SessionContext | null>(null);
  const theme                         = makeTheme();

  let modelName = "no-model";
  try { modelName = resolveModelConfig().model; } catch { /* shown via banner */ }

  // ── Push helpers ─────────────────────────────────────────────────────────
  const push = useCallback((msg: Omit<ChatMessage, "id" | "ts">) => {
    setMessages(prev => [...prev, { ...msg, id: nextId(), ts: Date.now() }]);
  }, []);

  const notify = useCallback((content: string) => {
    push({ role: "notify", content });
  }, [push]);

  const setStatus = useCallback((key: string, value: string) => {
    setStatusBadges(prev => ({ ...prev, [key]: value }));
    // Mirror vault lock state when extension calls setStatus("vault", ...)
    if (key === "vault") {
      setVaultLocked(!value.includes("🔓") && !value.includes("unlocked"));
    }
    if (key === "chain" || key === "active_chain") setChain(value);
    if (key === "effect_level") setEffectLevel(value);
  }, []);

  // ── Build UIContext that extension commands can call ──────────────────────
  const uiCtx: UIContext = {
    notify,
    setStatus,
    setTheme(_name) { /* jelly theme is always active */ },
    setHeader(_factory) { /* Ink StatusBar is canonical */ },
    theme,
  };

  // ── Wire live callbacks BEFORE session_start fires ────────────────────────
  useEffect(() => {
    onNotifyReady?.(notify);
    onStatusReady?.(setStatus);
  }, [notify, setStatus, onNotifyReady, onStatusReady]);

  // ── Boot: fire session_start ──────────────────────────────────────────────
  useEffect(() => {
    const session = new SessionManager();
    session.setSystemPrompt(
      registry.getSystemPrompt() || systemPrompt ||
      "You are JellyOS, an autonomous AI trading agent.",
    );
    sessionRef.current = session;

    const sessionCtx: SessionContext = {
      ui:     uiCtx,
      hasUI:  true,
      config: {
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        ANTHROPIC_API_KEY:  process.env.ANTHROPIC_API_KEY,
        ALCHEMY_KEY:        process.env.ALCHEMY_KEY,
        DEFAULT_MODEL:      process.env.DEFAULT_MODEL,
      },
    };
    sessionCtxRef.current = sessionCtx;

    registry.fireHook("session_start", sessionCtx).then(() => {
      push({ role: "system", content: T.muted("Session started. Type a message or /help.") });
    });

    const runner = new AgentRunner(registry, session, (event) => {
      if (event.type === "text_delta") {
        setStreaming(prev => prev + event.text);
      } else if (event.type === "tool_start") {
        setToolRunning(event.name);
      } else if (event.type === "tool_done") {
        setToolRunning(null);
        push({
          role:     "tool",
          content:  event.result,
          toolName: event.name,
          isError:  event.isError,
        });
      } else if (event.type === "turn_done") {
        setDisabled(false);
        setToolRunning(null);
        setStreaming(prev => {
          if (prev.trim()) push({ role: "assistant", content: prev });
          return "";
        });
      } else if (event.type === "error") {
        setDisabled(false);
        setToolRunning(null);
        setStreaming("");
        notify(T.error(`Error: ${event.message}`));
      }
    }, sessionCtx);

    runnerRef.current = runner;

    return () => {
      if (sessionCtxRef.current) {
        registry.fireHook("session_end", sessionCtxRef.current).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Live /effect → runner reconfiguration ────────────────────────────────
  useEffect(() => {
    runnerRef.current?.setEffectLevel(effectLevel);
  }, [effectLevel]);

  // ── Ctrl-C ────────────────────────────────────────────────────────────────
  useInput((_input, key) => {
    if (key.ctrl && _input === "c") {
      push({ role: "system", content: T.muted("Goodbye 🪼") });
      setTimeout(exit, 200);
    }
  });

  // ── Input handler ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (raw: string) => {
    const input = raw.trim();
    if (!input) return;

    if (input.startsWith("/")) {
      const [cmd, ...rest] = input.slice(1).split(" ");
      const args           = rest.join(" ");

      if (cmd === "exit" || cmd === "quit") {
        push({ role: "system", content: T.muted("Goodbye 🪼") });
        setTimeout(exit, 200);
        return;
      }

      if (cmd === "help") {
        const lines = registry.listCommands().map(
          ([n, d]) => T.accent(`/${n}`.padEnd(16)) + " " + d.description,
        );
        notify("Available commands:\n\n" + lines.join("\n"));
        return;
      }

      const def = registry.getCommand(cmd);
      if (!def) {
        notify(T.error(`Unknown command: /${cmd}\nType /help to list all commands.`));
        return;
      }

      try { await def.handler(args, { ui: uiCtx }); } catch (e: any) {
        notify(T.error(`Command error: ${e.message}`));
      }
      return;
    }

    if (!runnerRef.current) { notify(T.error("Agent not ready")); return; }

    push({ role: "user", content: input });
    setDisabled(true);
    setStreaming("");

    try {
      await runnerRef.current.run(input);
    } catch (e: any) {
      setDisabled(false);
      notify(T.error(`Runner error: ${e.message}`));
    }
  }, [registry, exit, push, notify, uiCtx]);

  // Build status line from all active badges
  const statusLine = Object.values(statusBadges).join("  ") || null;

  return (
    <Box flexDirection="column" height="100%">
      <StatusBar
        model={modelName}
        chain={chain}
        vaultLocked={vaultLocked}
        effectLevel={effectLevel}
        toolRunning={toolRunning}
        connected={true}
        statusLine={statusLine}
      />
      <REPL
        messages={messages}
        streamingText={streaming}
        toolRunning={toolRunning}
        onSubmit={handleSubmit}
        disabled={disabled}
      />
    </Box>
  );
}
