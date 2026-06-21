export interface Checkpoint {
    id: string;
    timestamp: number;
    version: string;
    state: any;
    metadata: CheckpointMetadata;
    hash: string;
}
export interface CheckpointMetadata {
    agentId: string;
    taskType: string;
    executionId?: string;
    parentId?: string;
    tags: string[];
    description?: string;
}
export interface CheckpointConfig {
    enabled: boolean;
    autoCreate: boolean;
    autoRestore: boolean;
    maxCheckpoints: number;
    compression: boolean;
    encryption: boolean;
}
export declare class CheckpointManager {
    private config;
    private logger;
    private storagePath;
    private checkpoints;
    private checkpointList;
    constructor(storagePath?: string, config?: Partial<CheckpointConfig>);
    private ensureStoragePath;
    private loadExistingCheckpoints;
    private getCheckpointFiles;
    private extractIdFromFilename;
    createCheckpoint(id: string, state: any, metadata: CheckpointMetadata): Checkpoint;
    restoreCheckpoint(id: string): Checkpoint | null;
    getCheckpoint(id: string): Checkpoint | null;
    deleteCheckpoint(id: string): boolean;
    listCheckpoints(): string[];
    getLatestCheckpoint(agentId?: string): Checkpoint | null;
    private saveCheckpointToFile;
    private calculateHash;
    private cleanupOldCheckpoints;
    getConfig(): CheckpointConfig;
    setConfig(config: Partial<CheckpointConfig>): void;
    close(): void;
}
export declare const checkpoints: CheckpointManager;
//# sourceMappingURL=CheckpointManager.d.ts.map