import { VaultManager } from './VaultManager.js';
export declare class AutoVault {
    private vault;
    private logger;
    private threshold;
    private checkInterval;
    private onSweep;
    constructor(vault: VaultManager);
    private readThreshold;
    start(getPnL: () => number, onSweep?: (amount: number) => void): void;
    stop(): void;
    private check;
    updateThreshold(amount: number): void;
}
//# sourceMappingURL=AutoVault.d.ts.map