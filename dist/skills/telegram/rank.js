import { RANK_TIERS } from "./types.js";
export function getRankFromPoints(points) {
    for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
        if (points >= RANK_TIERS[i].minPoints)
            return RANK_TIERS[i];
    }
    return RANK_TIERS[0];
}
export function calculatePoints(qualityScore, isElite = false, isLegendary = false, isChallenge = false) {
    let points = Math.floor(qualityScore * 2);
    if (isLegendary)
        points += 15;
    else if (isElite)
        points += 8;
    if (isChallenge)
        points += 5;
    return points;
}
export function checkRankPromo(currentPoints, currentRank) {
    const currentTier = RANK_TIERS.find(t => t.name === currentRank);
    const newTier = getRankFromPoints(currentPoints);
    const promoted = !currentTier || newTier.minPoints > currentTier.minPoints;
    return { promoted, newRank: newTier.name };
}
//# sourceMappingURL=rank.js.map