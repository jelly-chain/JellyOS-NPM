/**
 * ToolDispatcher — executes tool calls from the model response.
 * Looks up tool by name in the Registry, validates params, runs execute().
 */
import { Value } from "@sinclair/typebox/value";
export class ToolDispatcher {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    async dispatch(calls) {
        return Promise.all(calls.map(tc => this.execute(tc)));
    }
    async execute(tc) {
        const tool = this.registry.getTool(tc.function.name);
        if (!tool) {
            return {
                tool_call_id: tc.id,
                name: tc.function.name,
                content: `Unknown tool: ${tc.function.name}`,
                isError: true,
            };
        }
        let params;
        try {
            params = JSON.parse(tc.function.arguments || "{}");
        }
        catch {
            return {
                tool_call_id: tc.id,
                name: tc.function.name,
                content: `Invalid JSON arguments: ${tc.function.arguments}`,
                isError: true,
            };
        }
        // Validate params against the tool's TypeBox schema
        if (!Value.Check(tool.parameters, params)) {
            const errors = [...Value.Errors(tool.parameters, params)]
                .slice(0, 3)
                .map(e => `${e.path}: ${e.message}`)
                .join("; ");
            return {
                tool_call_id: tc.id,
                name: tc.function.name,
                content: `Parameter validation failed: ${errors}`,
                isError: true,
            };
        }
        try {
            const result = await tool.execute(tc.id, params);
            const content = result.content.map(c => c.text).join("\n");
            return { tool_call_id: tc.id, name: tc.function.name, content, isError: false };
        }
        catch (e) {
            return {
                tool_call_id: tc.id,
                name: tc.function.name,
                content: `Tool error: ${e?.message ?? String(e)}`,
                isError: true,
            };
        }
    }
}
//# sourceMappingURL=ToolDispatcher.js.map