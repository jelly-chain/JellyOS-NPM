export { ContextStore, context } from './ContextStore.js';
export { AgentMemory, AgentMemoryConfig, MemoryType, createAgentMemory } from './AgentMemory.js';
export { MarketMemory } from './MarketMemory.js';

export type { ContextEntry, ContextConfig } from './ContextStore.js';
export type { MemoryEntry } from './AgentMemory.js';

import { createAgentMemory } from './AgentMemory.js';

export class ContextOrchestrator {
  private store: any;
  private agentMemories: Map<string, any> = new Map();

  constructor(contextStore: any) {
    this.store = contextStore;
  }

  getStore() { return this.store; }

  createAgentMemory(agentId: string) {
    if (!this.agentMemories.has(agentId)) {
      this.agentMemories.set(agentId, createAgentMemory(agentId));
    }
    return this.agentMemories.get(agentId);
  }

  getAgentMemory(agentId: string) {
    return this.agentMemories.get(agentId);
  }
}

export const contextOrchestrator = new ContextOrchestrator({});