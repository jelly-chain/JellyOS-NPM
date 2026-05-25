/**
 * ToolDispatcher — executes tool calls from the model response.
 * Looks up tool by name in the Registry, validates params, runs execute().
 */
import type { Registry } from "../api/Registry.js";
import type { ToolCall } from "./ModelClient.js";
export interface ToolResult {
    tool_call_id: string;
    name: string;
    content: string;
    isError: boolean;
}
export declare class ToolDispatcher {
    private registry;
    constructor(registry: Registry);
    dispatch(calls: ToolCall[]): Promise<ToolResult[]>;
    private execute;
}
//# sourceMappingURL=ToolDispatcher.d.ts.map