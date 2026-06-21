/**
 * MCPServer — Model Context Protocol server over stdio. (#28)
 *
 * Exposes all JellyOS registered tools as MCP tools so they can be used
 * by Claude Desktop, Cursor, Continue, and any MCP-compatible client.
 *
 * Protocol: JSON-RPC 2.0 over stdin/stdout (MCP stdio transport).
 *
 * Usage:
 *   jellyos-mcp                        # exposes built-in tools
 *   jellyos-mcp --extension ./my.ts    # includes extension tools
 *
 * Claude Desktop config (~/Library/Application Support/Claude/claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "jellyos": {
 *         "command": "jellyos-mcp",
 *         "env": { "OPENROUTER_API_KEY": "sk-or-..." }
 *       }
 *     }
 *   }
 */
import type { Registry } from "../api/Registry.js";
export declare class MCPServer {
    private registry;
    constructor(registry: Registry);
    run(): Promise<void>;
    private respond;
    private handle;
}
//# sourceMappingURL=server.d.ts.map