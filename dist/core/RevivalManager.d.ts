import { CheckpointManager } from './CheckpointManager.js';
export interface RevivalConfig {
    enabled: boolean;
    autoRevive: boolean;
    maxRevivalAttempts: number;
    revivalInterval: number;
    healthCheckInterval: number;
    persistencePath: string;
}
export interface RevivalRecord {
    id: string;
    timestamp: number;
    reason: string;
    checkpointId: string;
    success: boolean;
    duration: number;
    error?: string;
}
export declare class RevivalManager {
    private logger;
    private config;
    private checkpoints;
    private revivalHistory;
    private revivalAttempts;
    private healthTimer;
    constructor(checkpoints: CheckpointManager, config?: Partial<RevivalConfig>);
    private ensurePersistencePath;
    private loadRevivalHistory;
    private saveRevivalHistory;
    private healthCheck;
    revive(checkpointId: string, reason: string): Promise<boolean>;
    private reconstructState;
    performFullRecovery(): Promise<boolean>;
    getHistory(): RevivalRecord[];
    getLastSuccessTime(): number | null;
    getRevivalRate(): number;
    close(): void;
}
//# sourceMappingURL=RevivalManager.d.ts.map