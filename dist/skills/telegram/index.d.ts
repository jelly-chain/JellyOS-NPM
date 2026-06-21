export interface TelegramSkillOptions {
    botToken?: string;
    adminIds?: number[];
    jurors?: string[];
    thinkers?: string[];
}
export declare class TelegramSkill {
    private bot;
    private env;
    private adminIds;
    private jurors;
    private thinkers;
    constructor(opts?: TelegramSkillOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    private registerHandlers;
    private handleContribution;
    private getUserProfile;
}
export declare function createTelegramSkill(opts?: TelegramSkillOptions): TelegramSkill;
//# sourceMappingURL=index.d.ts.map