import { Logger } from './utils/Logger.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
export class RevivalManager {
    logger;
    config;
    checkpoints;
    revivalHistory = [];
    revivalAttempts = 0;
    healthTimer = null;
    constructor(checkpoints, config) {
        this.checkpoints = checkpoints;
        this.config = {
            enabled: true, autoRevive: true, maxRevivalAttempts: 5,
            revivalInterval: 60000, healthCheckInterval: 30000,
            persistencePath: resolve(homedir(), '.jellyos', 'agents'),
            ...config,
        };
        this.logger = new Logger('RevivalManager');
        this.ensurePersistencePath();
        this.loadRevivalHistory();
        this.healthTimer = setInterval(() => this.healthCheck(), this.config.healthCheckInterval);
    }
    ensurePersistencePath() {
        if (!existsSync(this.config.persistencePath)) {
            mkdirSync(this.config.persistencePath, { recursive: true });
        }
    }
    loadRevivalHistory() {
        const path = resolve(this.config.persistencePath, 'revival-history.json');
        if (existsSync(path)) {
            try {
                const data = JSON.parse(readFileSync(path, 'utf-8'));
                this.revivalHistory = Array.isArray(data) ? data.slice(-100) : [];
            }
            catch {
                this.revivalHistory = [];
            }
        }
    }
    saveRevivalHistory() {
        const path = resolve(this.config.persistencePath, 'revival-history.json');
        writeFileSync(path, JSON.stringify(this.revivalHistory.slice(-100)), 'utf-8');
    }
    healthCheck() {
        const recent = this.revivalHistory.slice(-5);
        const recentFailures = recent.filter(r => !r.success).length;
        if (recentFailures >= 3) {
            this.logger.warn('Multiple recent revival failures detected');
        }
    }
    async revive(checkpointId, reason) {
        if (this.revivalAttempts >= this.config.maxRevivalAttempts) {
            this.logger.error('Max revival attempts reached');
            return false;
        }
        this.revivalAttempts++;
        const startTime = Date.now();
        this.logger.info(`Attempting revival #${this.revivalAttempts} from checkpoint ${checkpointId} (reason: ${reason})`);
        try {
            const checkpoint = this.checkpoints.restoreCheckpoint(checkpointId);
            if (!checkpoint) {
                throw new Error(`Checkpoint ${checkpointId} not found`);
            }
            const { state } = checkpoint;
            const result = await this.reconstructState(state);
            const record = {
                id: `revival:${Date.now()}`,
                timestamp: Date.now(),
                reason,
                checkpointId,
                success: true,
                duration: Date.now() - startTime,
            };
            this.revivalHistory.push(record);
            this.saveRevivalHistory();
            this.revivalAttempts = 0;
            this.logger.info(`Revival successful in ${record.duration}ms`);
            return true;
        }
        catch (error) {
            const record = {
                id: `revival:${Date.now()}`,
                timestamp: Date.now(),
                reason,
                checkpointId,
                success: false,
                duration: Date.now() - startTime,
                error: error.message,
            };
            this.revivalHistory.push(record);
            this.saveRevivalHistory();
            this.logger.error('Revival failed:', error);
            return false;
        }
    }
    async reconstructState(state) {
        return state;
    }
    async performFullRecovery() {
        this.logger.info('Attempting full recovery...');
        const latestCheckpoint = this.checkpoints.getLatestCheckpoint();
        if (latestCheckpoint) {
            return await this.revive(latestCheckpoint.id, 'full-recovery');
        }
        return false;
    }
    getHistory() { return [...this.revivalHistory]; }
    getLastSuccessTime() {
        const successes = this.revivalHistory.filter(r => r.success);
        return successes.length > 0 ? successes[successes.length - 1].timestamp : null;
    }
    getRevivalRate() {
        const total = this.revivalHistory.length;
        return total > 0 ? this.revivalHistory.filter(r => r.success).length / total : 0;
    }
    close() {
        if (this.healthTimer) {
            clearInterval(this.healthTimer);
            this.healthTimer = null;
        }
    }
}
//# sourceMappingURL=RevivalManager.js.map