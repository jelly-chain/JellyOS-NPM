export { ContextStore, context } from './ContextStore.js';
export { AgentMemory, MemoryType, createAgentMemory } from './AgentMemory.js';
export { MarketMemory } from './MarketMemory.js';
import { createAgentMemory } from './AgentMemory.js';
export class ContextOrchestrator {
    store;
    agentMemories = new Map();
    constructor(contextStore) {
        this.store = contextStore;
    }
    getStore() { return this.store; }
    createAgentMemory(agentId) {
        if (!this.agentMemories.has(agentId)) {
            this.agentMemories.set(agentId, createAgentMemory(agentId));
        }
        return this.agentMemories.get(agentId);
    }
    getAgentMemory(agentId) {
        return this.agentMemories.get(agentId);
    }
}
export const contextOrchestrator = new ContextOrchestrator({});
//# sourceMappingURL=Index.js.map