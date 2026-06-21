import { Logger } from './utils/Logger.js';
import { homedir } from 'os';
import { resolve } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'fs';
const DEFAULT_CONFIG = {
    enabled: true,
    autoCreate: true,
    autoRestore: true,
    maxCheckpoints: 100,
    compression: true,
    encryption: false,
};
export class CheckpointManager {
    config;
    logger;
    storagePath;
    checkpoints = new Map();
    checkpointList = [];
    constructor(storagePath = resolve(homedir(), '.jellyos', 'checkpoints'), config) {
        this.storagePath = storagePath;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.logger = new Logger('CheckpointManager');
        this.ensureStoragePath();
        this.loadExistingCheckpoints();
        if (this.config.autoCreate) {
            // Maybe initialize something
        }
    }
    ensureStoragePath() {
        if (!existsSync(this.storagePath)) {
            mkdirSync(this.storagePath, { recursive: true });
            this.logger.info(`Created checkpoint storage directory: ${this.storagePath}`);
        }
    }
    loadExistingCheckpoints() {
        try {
            const files = this.getCheckpointFiles();
            for (const file of files) {
                const id = this.extractIdFromFilename(file);
                if (id) {
                    this.checkpointList.push(id);
                }
            }
            this.logger.info(`Loaded ${this.checkpointList.length} existing checkpoints`);
        }
        catch (error) {
            this.logger.warn('Failed to load existing checkpoints', error);
        }
    }
    getCheckpointFiles() {
        const files = [];
        try {
            const entries = readdirSync(this.storagePath);
            for (const entry of entries) {
                if (entry.startsWith('checkpoint-') && entry.endsWith('.json')) {
                    files.push(entry);
                }
            }
        }
        catch {
            // Directory doesn't exist or can't be read
        }
        return files;
    }
    extractIdFromFilename(filename) {
        const match = filename.match(/^checkpoint-(.+)\.json$/);
        return match ? match[1] : null;
    }
    createCheckpoint(id, state, metadata) {
        if (!this.config.enabled) {
            return null;
        }
        const checkpoint = {
            id,
            timestamp: Date.now(),
            version: '1.0.0',
            state,
            metadata,
            hash: this.calculateHash(state),
        };
        try {
            this.saveCheckpointToFile(checkpoint);
            this.checkpoints.set(id, checkpoint);
            if (!this.checkpointList.includes(id)) {
                this.checkpointList.push(id);
            }
            this.cleanupOldCheckpoints();
            this.logger.info(`Created checkpoint: ${id}`);
            return checkpoint;
        }
        catch (error) {
            this.logger.error(`Failed to create checkpoint ${id}`, error);
            throw error;
        }
    }
    restoreCheckpoint(id) {
        try {
            const checkpoint = this.checkpoints.get(id);
            if (!checkpoint) {
                const checkpointPath = resolve(this.storagePath, `checkpoint-${id}.json`);
                if (existsSync(checkpointPath)) {
                    const data = readFileSync(checkpointPath, 'utf-8');
                    const loaded = JSON.parse(data);
                    this.checkpoints.set(id, loaded);
                    return loaded;
                }
                return null;
            }
            this.logger.info(`Restored checkpoint: ${id}`);
            return checkpoint;
        }
        catch (error) {
            this.logger.error(`Failed to restore checkpoint ${id}`, error);
            return null;
        }
    }
    getCheckpoint(id) {
        return this.checkpoints.get(id) || this.restoreCheckpoint(id);
    }
    deleteCheckpoint(id) {
        try {
            const path = resolve(this.storagePath, `checkpoint-${id}.json`);
            if (existsSync(path)) {
                unlinkSync(path);
            }
            this.checkpoints.delete(id);
            this.checkpointList = this.checkpointList.filter(i => i !== id);
            this.logger.info(`Deleted checkpoint: ${id}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to delete checkpoint ${id}`, error);
            return false;
        }
    }
    listCheckpoints() {
        return [...this.checkpointList];
    }
    getLatestCheckpoint(agentId) {
        let candidates = [...this.checkpointList];
        if (agentId) {
            candidates = candidates.filter(id => {
                const cp = this.checkpoints.get(id);
                return cp && cp.metadata.agentId === agentId;
            });
        }
        if (candidates.length === 0)
            return null;
        candidates.sort((a, b) => {
            const aCp = this.checkpoints.get(a);
            const bCp = this.checkpoints.get(b);
            return (bCp?.timestamp || 0) - (aCp?.timestamp || 0);
        });
        return this.checkpoints.get(candidates[0]) || null;
    }
    saveCheckpointToFile(checkpoint) {
        const path = resolve(this.storagePath, `checkpoint-${checkpoint.id}.json`);
        writeFileSync(path, JSON.stringify(checkpoint, null, 2), 'utf-8');
    }
    calculateHash(data) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    }
    cleanupOldCheckpoints() {
        if (this.checkpointList.length <= this.config.maxCheckpoints)
            return;
        this.checkpointList.sort((a, b) => {
            const aCp = this.checkpoints.get(a);
            const bCp = this.checkpoints.get(b);
            return (aCp?.timestamp || 0) - (bCp?.timestamp || 0);
        });
        const toRemove = this.checkpointList.length - this.config.maxCheckpoints;
        for (let i = 0; i < toRemove; i++) {
            this.deleteCheckpoint(this.checkpointList[i]);
        }
    }
    getConfig() {
        return { ...this.config };
    }
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
    close() {
        this.checkpoints.clear();
        this.checkpointList = [];
        this.logger.info('CheckpointManager closed');
    }
}
export const checkpoints = new CheckpointManager();
//# sourceMappingURL=CheckpointManager.js.map