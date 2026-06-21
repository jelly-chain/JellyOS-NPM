import type { RankTier } from "./types.js";
export declare function getRankFromPoints(points: number): RankTier;
export declare function calculatePoints(qualityScore: number, isElite?: boolean, isLegendary?: boolean, isChallenge?: boolean): number;
export declare function checkRankPromo(currentPoints: number, currentRank: string): {
    promoted: boolean;
    newRank: string;
};
//# sourceMappingURL=rank.d.ts.map