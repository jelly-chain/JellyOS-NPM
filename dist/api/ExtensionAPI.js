/**
 * ExtensionAPI — the interface exposed to extension files (e.g. extensions/jellyos.ts).
 *
 * Drop-in replacement for Pi's ExtensionAPI. Extension files that ran under Pi
 * work without changes — all Pi methods and calling conventions are preserved:
 *   - ui.setStatus, ui.setTheme, ui.setHeader
 *   - ctx.hasUI
 *   - pi.on("session_start",       async (_event, ctx) => { ... })  ← Pi convention
 *   - pi.on("session_shutdown",    async () => { ... })
 *   - pi.on("before_agent_start",  async (_event, ctx) => { ... })
 */
export function text(t) {
    return { content: [{ type: "text", text: t }], details: {} };
}
//# sourceMappingURL=ExtensionAPI.js.map