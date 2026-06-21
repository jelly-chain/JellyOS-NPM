// Telegram Skill Types
import type { IrysTag } from "../../services/irys.js";

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

export const RANK_TIERS: RankTier[] = [
  { emoji: "🌱", name: "Seedling", minPoints: 0, dailyLimit: 5, multiplier: 1.0 },
  { emoji: "📈", name: "Growing", minPoints: 100, dailyLimit: 12, multiplier: 1.2 },
  { emoji: "🧬", name: "Synced", minPoints: 500, dailyLimit: 25, multiplier: 1.5 },
  { emoji: "🧠", name: "Hive", minPoints: 1500, dailyLimit: 40, multiplier: 2.0 },
  { emoji: "🔮", name: "Oracle", minPoints: 5000, dailyLimit: Infinity, multiplier: 3.0 },
];

export const APP_NAME = "JellyOS";