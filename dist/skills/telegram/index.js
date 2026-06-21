// Telegram Skill - Main entry point
import { Telegraf } from "telegraf";
import { irys } from "../../services/irys.js";
import { getRankFromPoints, calculatePoints } from "./rank.js";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
const JELLY_HOME = process.env.JELLYOS_HOME || join(homedir(), ".jelly");
const envPath = join(JELLY_HOME, ".env");
// Hash Telegram UID for privacy
function hashUid(uid) {
    return createHash("sha256").update(`JellyOS_${uid}`).digest("hex").slice(0, 12);
}
// Load env file
function loadEnv() {
    const env = {};
    if (existsSync(envPath)) {
        for (const line of readFileSync(envPath, "utf-8").split("\n")) {
            const m = line.match(/^([A-Z_]+)=(.*)$/);
            if (m)
                env[m[1]] = m[2];
        }
    }
    return env;
}
// Default system config
const DEFAULT_CONFIG = {
    qualityThreshold: 5.0,
    eliteThreshold: 9.0,
    legendaryThreshold: 9.5,
    minContributionLength: 20,
};
export class TelegramSkill {
    bot;
    env;
    adminIds;
    jurors;
    thinkers;
    constructor(opts = {}) {
        this.env = loadEnv();
        const token = opts.botToken || this.env.TELEGRAM_BOT_TOKEN || "";
        this.bot = new Telegraf(token);
        this.adminIds = new Set((this.env.BOT_ADMIN_IDS || "").split(",").map(n => parseInt(n.trim())).filter(n => !isNaN(n)));
        this.jurors = opts.jurors || [this.env.JELLY_JUDGE_MODEL || "openai/gpt-4o-mini"];
        this.thinkers = opts.thinkers || [this.env.JELLY_THINKER_MODEL || "anthropic/claude-sonnet-4-20250514"];
    }
    async start() {
        const token = this.env.TELEGRAM_BOT_TOKEN || "";
        if (!token) {
            console.error("TELEGRAM_BOT_TOKEN not configured");
            return;
        }
        await irys.start();
        this.registerHandlers();
        this.bot.launch();
        console.log("Telegram bot started");
    }
    async stop() {
        this.bot.stop();
        await irys.stop();
    }
    registerHandlers() {
        // /start - Welcome + detect language
        this.bot.start(async (ctx) => {
            const uidHash = hashUid(ctx.from.id);
            const lang = ctx.from.language_code || "en";
            await ctx.reply(` Welcome to JellyOS! Language detected: ${lang}. Send /help for commands.`);
        });
        // /help
        this.bot.help(async (ctx) => {
            await ctx.reply(`
JellyOS Commands:
/contribute - Submit a contribution
/status   - View your points + rank
/memory   - List your contributions
/rank     - View leaderboard
/language - Change language
/verify   - Verify EVM wallet
      `.trim());
        });
        // /contribute
        this.bot.command("contribute", async (ctx) => {
            await ctx.reply("Send your contribution (min 20 chars):");
        });
        // Text handler for contributions
        this.bot.on("text", async (ctx) => {
            const text = ctx.message.text;
            if (text.length >= 20 && !text.startsWith("/")) {
                await this.handleContribution(ctx, text);
            }
        });
        // /status
        this.bot.command("status", async (ctx) => {
            const uidHash = hashUid(ctx.from.id);
            const profile = await this.getUserProfile(uidHash);
            const rank = getRankFromPoints(profile.points);
            await ctx.reply(`
Points: ${profile.points}
Rank: ${rank.emoji} ${rank.name}
Daily Quota: ${profile.dailyAportesCount}/${rank.dailyLimit}
Trust Score: ${profile.trustScore}/10
      `.trim());
        });
    }
    async handleContribution(ctx, text) {
        const uidHash = hashUid(ctx.from.id);
        const profile = await this.getUserProfile(uidHash);
        // Check daily quota
        const rank = getRankFromPoints(profile.points);
        if (profile.dailyAportesCount >= rank.dailyLimit) {
            await ctx.reply("Daily quota exhausted. Come back tomorrow.");
            return;
        }
        // Judge via LLM (simplified - would call actual model)
        const score = Math.random() * 10;
        const points = calculatePoints(score);
        // Upload to Irys
        const tags = [
            { name: "App-Name", value: "JellyOS" },
            { name: "data-type", value: "contribution" },
            { name: "uid-hash", value: uidHash },
            { name: "quality-score", value: score.toFixed(2) },
            { name: "points", value: String(points) },
        ];
        try {
            const result = await irys.upload(Buffer.from(text), tags);
            await ctx.reply(`Contribution saved! CID: ${result.id}`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await ctx.reply(`Failed to save: ${msg}`);
        }
    }
    async getUserProfile(uidHash) {
        // Would query Irys for user-profile-pointer then profile
        return {
            points: 0,
            rank: "Seedling",
            language: "en",
            trustScore: 5.0,
            dailyAportesCount: 0,
            contributionCount: 0,
            totalUsesCount: 0,
            lastSeenTs: Date.now(),
        };
    }
}
// Skill factory for JellyOS extension API
export function createTelegramSkill(opts) {
    return new TelegramSkill(opts);
}
//# sourceMappingURL=index.js.map