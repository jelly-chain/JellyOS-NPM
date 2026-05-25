/**
 * REPL — scrolling message history + bottom input box.
 * Renders assistant text, tool calls, tool results, and user messages.
 */
export type MessageRole = "user" | "assistant" | "tool" | "system" | "notify";
export interface ChatMessage {
    id: string;
    role: MessageRole;
    content: string;
    toolName?: string;
    isError?: boolean;
    ts: number;
}
export interface REPLProps {
    messages: ChatMessage[];
    streamingText: string;
    toolRunning: string | null;
    onSubmit(input: string): void;
    disabled: boolean;
}
export declare function REPL({ messages, streamingText, toolRunning, onSubmit, disabled }: REPLProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=REPL.d.ts.map