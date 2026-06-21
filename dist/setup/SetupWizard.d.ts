import { ContextStore } from '../context/ContextStore.js';
export interface SetupState {
    step: number;
    completed: boolean;
    config: Record<string, any>;
    environment: Record<string, string>;
}
export declare class SetupWizard {
    private logger;
    private context;
    private state;
    constructor(context: ContextStore);
    run(): Promise<SetupState>;
    private printBanner;
    private ask;
    private stepWelcome;
    private stepEnvironment;
    private stepBlockchain;
    private stepAgents;
    private stepTrading;
    private stepSummary;
    private stepSave;
}
//# sourceMappingURL=SetupWizard.d.ts.map