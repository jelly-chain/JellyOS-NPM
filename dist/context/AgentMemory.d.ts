export interface MemoryEntry {
    id: string;
    agentId: string;
    type: MemoryType;
    content: any;
    importance: number;
    createdAt: number;
    lastAccessed: number;
    accessCount: number;
    decay: number;
    ttl?: number;
}
export declare enum MemoryType {
    OBSERVATION = "observation",
    ACTION = "action",
    RESULT = "result",
    PREDICTION = "prediction",
    ERROR = "error",
    PREFERENCE = "preference",
    SKILL = "skill"
}
export interface AgentMemoryConfig {
    maxSize: number;
    defaultTTL: number;
    decayRate: number;
    persistencePath: string;
}
export declare class AgentMemory {
    private config;
    private logger;
    private memories;
    private agentMemories;
    private typeIndex;
    private decayTimer;
    constructor(agentId: string, config?: Partial<AgentMemoryConfig>);
    private ensurePersistencePath;
    private startDecayTimer;
    private decayMemories;
    remember(agentId: string, type: MemoryType, content: any, importance?: number, ttl?: number): string;
    recall(id: string): MemoryEntry | null;
    recallByAgent(agentId: string, limit?: number): MemoryEntry[];
    recallByType(type: MemoryType, limit?: number): MemoryEntry[];
    search(query: any, agentId?: string, limit?: number): MemoryEntry[];
    private matchesQuery;
    forget(id: string): boolean;
    forgetByAgent(agentId: string): number;
    forgetByDecay(threshold?: number): number;
    consolidate(): number;
    getStats(): {
        totalMemories: number;
        avgImportance: number;
        avgDecay: number;
        agentCount: number;
        typeCount: number;
    };
    close(): void;
}
export declare const createAgentMemory: (agentId: string) => AgentMemory;
//# sourceMappingURL=AgentMemory.d.ts.map