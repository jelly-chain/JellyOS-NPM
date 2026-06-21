import { Logger } from '../core/utils/Logger.js';
import { homedir } from 'os';
import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
export var MemoryType;
(function (MemoryType) {
    MemoryType["OBSERVATION"] = "observation";
    MemoryType["ACTION"] = "action";
    MemoryType["RESULT"] = "result";
    MemoryType["PREDICTION"] = "prediction";
    MemoryType["ERROR"] = "error";
    MemoryType["PREFERENCE"] = "preference";
    MemoryType["SKILL"] = "skill";
})(MemoryType || (MemoryType = {}));
const DEFAULT_CONFIG = {
    maxSize: 10000,
    defaultTTL: 86400,
    decayRate: 0.99,
    persistencePath: resolve(homedir(), '.jellyos', 'memory', 'agents'),
};
export class AgentMemory {
    config;
    logger;
    memories = new Map();
    agentMemories = new Map();
    typeIndex = new Map();
    decayTimer = null;
    constructor(agentId, config) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.logger = new Logger(`AgentMemory:${agentId}`);
        this.ensurePersistencePath();
        this.startDecayTimer();
    }
    ensurePersistencePath() {
        if (!existsSync(this.config.persistencePath)) {
            mkdirSync(this.config.persistencePath, { recursive: true });
        }
    }
    startDecayTimer() {
        this.decayTimer = setInterval(() => this.decayMemories(), 60000);
    }
    decayMemories() {
        for (const [key, entry] of [...this.memories.entries()]) {
            entry.decay *= this.config.decayRate;
            entry.accessCount = Math.floor(entry.accessCount * this.config.decayRate);
            if (entry.decay < 0.1 && entry.importance < 0.5) {
                this.forget(key);
            }
        }
    }
    remember(agentId, type, content, importance = 0.5, ttl) {
        const id = `${agentId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
        const entry = {
            id,
            agentId,
            type,
            content,
            importance,
            createdAt: Date.now(),
            lastAccessed: Date.now(),
            accessCount: 1,
            decay: 1.0,
            ttl,
        };
        this.memories.set(id, entry);
        if (!this.agentMemories.has(agentId)) {
            this.agentMemories.set(agentId, new Set());
        }
        this.agentMemories.get(agentId).add(id);
        if (!this.typeIndex.has(type)) {
            this.typeIndex.set(type, new Set());
        }
        this.typeIndex.get(type).add(id);
        this.logger.debug(`Remembered ${type} for agent ${agentId}`);
        return id;
    }
    recall(id) {
        const entry = this.memories.get(id);
        if (!entry)
            return null;
        if (entry.ttl && Date.now() - entry.createdAt > entry.ttl * 1000) {
            this.forget(id);
            return null;
        }
        entry.lastAccessed = Date.now();
        entry.accessCount++;
        entry.decay = Math.min(1.0, entry.decay + 0.1);
        return entry;
    }
    recallByAgent(agentId, limit = 100) {
        const ids = this.agentMemories.get(agentId);
        if (!ids)
            return [];
        return [...ids]
            .map(id => this.memories.get(id))
            .filter(entry => entry && (!entry.ttl || Date.now() - entry.createdAt <= entry.ttl * 1000))
            .sort((a, b) => b.lastAccessed - a.lastAccessed)
            .slice(0, limit);
    }
    recallByType(type, limit = 100) {
        const ids = this.typeIndex.get(type);
        if (!ids)
            return [];
        return [...ids]
            .map(id => this.memories.get(id))
            .filter(entry => entry && (!entry.ttl || Date.now() - entry.createdAt <= entry.ttl * 1000))
            .sort((a, b) => b.lastAccessed - a.lastAccessed)
            .slice(0, limit);
    }
    search(query, agentId, limit = 50) {
        const results = [];
        for (const entry of this.memories.values()) {
            if (agentId && entry.agentId !== agentId)
                continue;
            if (entry.ttl && Date.now() - entry.createdAt > entry.ttl * 1000)
                continue;
            if (this.matchesQuery(entry.content, query)) {
                results.push(entry);
            }
        }
        return results
            .sort((a, b) => b.importance * b.decay - a.importance * a.decay)
            .slice(0, limit);
    }
    matchesQuery(content, query) {
        if (typeof query === 'string') {
            return JSON.stringify(content).toLowerCase().includes(query.toLowerCase());
        }
        if (typeof query === 'object') {
            return JSON.stringify(content).includes(JSON.stringify(query));
        }
        return false;
    }
    forget(id) {
        const entry = this.memories.get(id);
        if (!entry)
            return false;
        this.memories.delete(id);
        this.agentMemories.get(entry.agentId)?.delete(id);
        this.typeIndex.get(entry.type)?.delete(id);
        this.logger.debug(`Forgot memory ${id}`);
        return true;
    }
    forgetByAgent(agentId) {
        const ids = this.agentMemories.get(agentId);
        if (!ids)
            return 0;
        let count = 0;
        for (const id of [...ids]) {
            if (this.forget(id))
                count++;
        }
        this.logger.debug(`Forgot ${count} memories for agent ${agentId}`);
        return count;
    }
    forgetByDecay(threshold = 0.2) {
        let count = 0;
        for (const [id, entry] of [...this.memories.entries()]) {
            if (entry.decay < threshold && entry.importance < 0.5) {
                this.forget(id);
                count++;
            }
        }
        return count;
    }
    consolidate() {
        const consolidated = 0;
        // Consolidation logic would go here
        return consolidated;
    }
    getStats() {
        let totalImportance = 0;
        let totalDecay = 0;
        for (const entry of this.memories.values()) {
            totalImportance += entry.importance;
            totalDecay += entry.decay;
        }
        return {
            totalMemories: this.memories.size,
            avgImportance: totalImportance / this.memories.size,
            avgDecay: totalDecay / this.memories.size,
            agentCount: this.agentMemories.size,
            typeCount: this.typeIndex.size,
        };
    }
    close() {
        if (this.decayTimer) {
            clearInterval(this.decayTimer);
            this.decayTimer = null;
        }
        this.memories.clear();
        this.agentMemories.clear();
        this.typeIndex.clear();
        this.logger.info('AgentMemory closed');
    }
}
export const createAgentMemory = (agentId) => new AgentMemory(agentId);
//# sourceMappingURL=AgentMemory.js.map