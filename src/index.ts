/**
 * @jellychain/agent — public API
 *
 * Extension files import from here:
 *   import { Type } from "@jellychain/agent"
 *   import type { ExtensionAPI } from "@jellychain/agent"
 */

// Re-export TypeBox Type builder — drop-in for Pi's @earendil-works/pi-ai
export { Type, type Static } from "@sinclair/typebox";

// Extension API types
export type {
  ExtensionAPI,
  ExtensionModule,
  CommandDef,
  CommandContext,
  UIContext,
  ThemeContext,
  ToolDef,
  ToolContent,
  SkillDef,
  SessionEvent,
  SessionContext,
} from "./api/ExtensionAPI.js";

// text() helper — same as what Pi provides
export { text } from "./api/ExtensionAPI.js";

// Registry (for advanced use / testing)
export { Registry } from "./api/Registry.js";

// Runner components
export { AgentRunner }    from "./runner/AgentRunner.js";
export { ModelClient, resolveModelConfig } from "./runner/ModelClient.js";
export { ToolDispatcher } from "./runner/ToolDispatcher.js";

// Session
export { SessionManager } from "./session/SessionManager.js";

// Loader (for embedding the agent in other tools)
export { loadExtension } from "./loader.js";

// Theme
export { makeTheme, T, JELLY_COLORS } from "./tui/theme.js";
