export interface TelegramUser {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
}
export interface UserContribution {
    txId: string;
    uidHash: string;
    content: string;
    category: string;
    qualityScore: number;
    timestamp: number;
    contentSummary?: string;
}
export interface UserProfile {
    points: number;
    rank: string;
    language: string;
    trustScore: number;
    dailyAportesCount: number;
    contributionCount: number;
    totalUsesCount: number;
    lastSeenTs: number;
    walletAddress?: string;
}
export interface RankTier {
    emoji: string;
    name: string;
    minPoints: number;
    dailyLimit: number;
    multiplier: number;
}
export declare const RANK_TIERS: RankTier[];
export declare const APP_NAME = "JellyOS";
//# sourceMappingURL=types.d.ts.map