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
import { createInterface } from "node:readline";
export class MCPServer {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    async run() {
        const rl = createInterface({ input: process.stdin, terminal: false });
        // MCP uses newline-delimited JSON-RPC 2.0
        rl.on("line", async (line) => {
            const trimmed = line.trim();
            if (!trimmed)
                return;
            let req;
            try {
                req = JSON.parse(trimmed);
            }
            catch {
                this.respond({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
                return;
            }
            const response = await this.handle(req);
            this.respond(response);
        });
        rl.on("close", () => process.exit(0));
        // MCP servers send an initialization notification on stderr
        process.stderr.write("[JellyOS MCP] Server ready\n");
    }
    respond(res) {
        process.stdout.write(JSON.stringify(res) + "\n");
    }
    async handle(req) {
        try {
            switch (req.method) {
                case "initialize":
                    return {
                        jsonrpc: "2.0", id: req.id,
                        result: {
                            protocolVersion: "2024-11-05",
                            capabilities: { tools: {} },
                            serverInfo: { name: "jellyos", version: "0.1.5" },
                        },
                    };
                case "notifications/initialized":
                    // No response needed for notifications
                    return { jsonrpc: "2.0", id: req.id, result: null };
                case "tools/list":
                    return {
                        jsonrpc: "2.0", id: req.id,
                        result: {
                            tools: this.registry.listTools().map(t => ({
                                name: t.name,
                                description: t.description,
                                inputSchema: {
                                    ...t.parameters,
                                    type: "object", // MCP requires explicit type
                                },
                            })),
                        },
                    };
                case "tools/call": {
                    const { name, arguments: args } = (req.params ?? {});
                    if (!name) {
                        return { jsonrpc: "2.0", id: req.id, error: { code: -32602, message: "Missing tool name" } };
                    }
                    const tool = this.registry.getTool(name);
                    if (!tool) {
                        return { jsonrpc: "2.0", id: req.id, error: { code: -32601, message: `Tool not found: ${name}` } };
                    }
                    try {
                        const result = await tool.execute("mcp", (args ?? {}));
                        return {
                            jsonrpc: "2.0", id: req.id,
                            result: {
                                content: result.content.map(c => ({ type: "text", text: c.text })),
                                isError: false,
                            },
                        };
                    }
                    catch (e) {
                        const msg = e instanceof Error ? e.message : String(e);
                        return {
                            jsonrpc: "2.0", id: req.id,
                            result: {
                                content: [{ type: "text", text: `Tool error: ${msg}` }],
                                isError: true,
                            },
                        };
                    }
                }
                case "ping":
                    return { jsonrpc: "2.0", id: req.id, result: {} };
                default:
                    return {
                        jsonrpc: "2.0", id: req.id,
                        error: { code: -32601, message: `Method not found: ${req.method}` },
                    };
            }
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { jsonrpc: "2.0", id: req.id, error: { code: -32603, message: `Internal error: ${msg}` } };
        }
    }
}
//# sourceMappingURL=server.js.map