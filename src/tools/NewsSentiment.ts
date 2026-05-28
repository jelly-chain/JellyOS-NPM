/**
 * NewsSentiment — fetches RSS feeds, runs headline sentiment scoring
 * with a cheap model, and surfaces trending narratives.
 */

import { Type, type Static } from "@sinclair/typebox";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NewsItem {
  title:     string;
  source:    string;
  url:       string;
  published: number;
  sentiment?: number; // -1 to 1
}

export interface SentimentReport {
  items:      NewsItem[];
  avgSentiment: number;
  positive:   number;
  negative:   number;
  neutral:    number;
  updatedAt:  number;
  topKeywords: string[];
}

// ── RSS sources ───────────────────────────────────────────────────────────────

const FEEDS = [
  { name: "CoinDesk",     url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { name: "CoinTelegraph", url: "https://cointelegraph.com/rss" },
  { name: "The Block",    url: "https://www.theblock.co/rss" },
];

// ── Simple keyword-based sentiment (no model required) ────────────────────────

const BULLISH_WORDS = [
  "surge", "soar", "rally", "bull", "breakout", "moon", "pump", "record high",
  "all-time high", "ath", "accumulate", "institutional", "adoption", "approval",
  "etf approved", "launch", "partnership", "upgrade", "mainnet", "listing",
  "airdrop", "halving", "buyback", "burn", "yield", "staking",
];

const BEARISH_WORDS = [
  "crash", "plunge", "dump", "bear", "downturn", "correction", "liquidate",
  "hack", "exploit", "rug", "scam", "sec", "lawsuit", "regulation", "ban",
  "crackdown", "fine", "penalty", "delist", "suspend", "halt", "freeze",
  "insolvent", "bankrupt", "depeg", "exploit",
];

export function scoreSentiment(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  let hits  = 0;

  for (const w of BULLISH_WORDS) {
    if (lower.includes(w)) { score++; hits++; }
  }
  for (const w of BEARISH_WORDS) {
    if (lower.includes(w)) { score--; hits++; }
  }

  return hits === 0 ? 0 : Math.max(-1, Math.min(1, score / hits));
}

// ── Fetch & parse ────────────────────────────────────────────────────────────

/**
 * Proper RSS item extractor — handles CDATA, encoded entities, attributes.
 * No regex on the whole document; scans block by block.
 */
function extractTag(block: string, tag: string): string {
  // Try CDATA form first: <tag><![CDATA[...]]></tag>
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, "i");
  const cdataM  = block.match(cdataRe);
  if (cdataM?.[1]) return cdataM[1].trim();

  // Plain text form: <tag ...>content</tag>
  const plainRe = new RegExp(`<${tag}[^>]*>([^<]*)`, "i");
  const plainM  = block.match(plainRe);
  if (plainM?.[1]) {
    return plainM[1]
      .replace(/&amp;/g,  "&")
      .replace(/&lt;/g,   "<")
      .replace(/&gt;/g,   ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g,  "'")
      .trim();
  }
  return "";
}

async function fetchRSS(url: string, source: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, {
      signal:  AbortSignal.timeout(10_000),
      headers: { "User-Agent": "JellyOS/1.0", "Accept": "application/rss+xml, application/xml, text/xml, */*" },
    });
    if (!res.ok) return [];
    const xml = await res.text();

    // Find all <item>...</item> blocks (also handles <entry> for Atom feeds)
    const TAG_RE = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
    const items: NewsItem[] = [];
    let   match: RegExpExecArray | null;

    while ((match = TAG_RE.exec(xml)) !== null) {
      const block = match[1] ?? "";

      const title   = extractTag(block, "title");
      const link    = extractTag(block, "link") || extractTag(block, "guid");
      const pubDate = extractTag(block, "pubDate") || extractTag(block, "updated") || extractTag(block, "published");

      if (!title) continue;

      items.push({
        title,
        source,
        url:       link,
        published: pubDate ? (new Date(pubDate).getTime() || Date.now()) : Date.now(),
        sentiment: scoreSentiment(title),
      });

      if (items.length >= 25) break; // cap per feed
    }

    return items;
  } catch {
    return [];
  }
}

// ── Keyword extraction ────────────────────────────────────────────────────────

function extractKeywords(items: NewsItem[], topN = 10): string[] {
  const wordFreq = new Map<string, number>();
  const stopWords = new Set(["the", "a", "an", "in", "on", "at", "to", "for", "of", "and", "is", "are", "was", "were", "will", "has", "have", "it", "its", "with", "from", "by", "as", "be", "that", "this", "but", "or", "not", "can", "may"]);

  for (const item of items) {
    const words = item.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/);
    for (const w of words) {
      if (w.length < 3 || stopWords.has(w)) continue;
      wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
    }
  }

  return [...wordFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([w]) => w);
}

// ── NewsFeed class ────────────────────────────────────────────────────────────

export class NewsFeed {
  private lastReport: SentimentReport | null = null;
  private pollInterval: number;
  private timer?: ReturnType<typeof setInterval>;

  constructor(pollIntervalMs = 600_000) { // 10 min default
    this.pollInterval = pollIntervalMs;
  }

  start(): void {
    this.fetch();
    this.timer = setInterval(() => this.fetch(), this.pollInterval);
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = undefined; }
  }

  async fetch(): Promise<void> {
    const allItems: NewsItem[] = [];
    for (const feed of FEEDS) {
      const items = await fetchRSS(feed.url, feed.name);
      allItems.push(...items);
    }

    allItems.sort((a, b) => b.published - a.published);

    const scored     = allItems.filter(i => i.sentiment !== undefined && i.sentiment !== 0);
    const avgSent    = scored.length > 0 ? scored.reduce((s, i) => s + (i.sentiment ?? 0), 0) / scored.length : 0;
    const positive   = allItems.filter(i => (i.sentiment ?? 0) > 0.1).length;
    const negative   = allItems.filter(i => (i.sentiment ?? 0) < -0.1).length;
    const neutral    = allItems.length - positive - negative;
    const topKeywords = extractKeywords(allItems);

    this.lastReport = {
      items:      allItems,
      avgSentiment: Math.round(avgSent * 1000) / 1000,
      positive,
      negative,
      neutral,
      updatedAt:  Date.now(),
      topKeywords,
    };
  }

  getLatest(): SentimentReport | null {
    return this.lastReport;
  }

  summary(): string {
    if (!this.lastReport) return "No news data available.";
    const r = this.lastReport;
    const score = r.avgSentiment;
    const mood  = score > 0.2 ? "🟢 Bullish" : score < -0.2 ? "🔴 Bearish" : "🟡 Neutral";

    return [
      `News Sentiment: ${mood} (score: ${score >= 0 ? "+" : ""}${score.toFixed(3)})`,
      `  ${r.positive} positive · ${r.negative} negative · ${r.neutral} neutral (${r.items.length} articles)`,
      `  Trending: ${r.topKeywords.slice(0, 8).join(", ")}`,
      `  Latest:`,
      ...r.items.slice(0, 5).map(i => {
        const s = (i.sentiment ?? 0) >= 0.1 ? "🟢" : (i.sentiment ?? 0) <= -0.1 ? "🔴" : "  ";
        return `    ${s} [${i.source}] ${i.title.slice(0, 80)}`;
      }),
    ].join("\n");
  }

  /** Compact sentiment badge for status bar. */
  statusBadge(): string {
    if (!this.lastReport) return "📰 ?";
    const s = this.lastReport.avgSentiment;
    const emoji = s > 0.3 ? "🟢" : s > 0 ? "🟡" : "🔴";
    return `📰 ${emoji} ${(s * 100).toFixed(0)}%`;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const newsFeed = new NewsFeed();

// ── Tool: get_news ────────────────────────────────────────────────────────────

export const getNewsParams = Type.Object({
  limit: Type.Optional(Type.Number({ default: 10, description: "Number of articles to show" })),
});

export async function getNewsTool(_id: string, params: Static<typeof getNewsParams>) {
  const report = newsFeed.getLatest();
  if (!report) {
    return {
      content: [{ type: "text" as const, text: "News data not yet available. Please wait for the first fetch." }],
      details: {},
    };
  }

  const items = report.items.slice(0, params.limit ?? 10)
    .map(i => {
      const s = (i.sentiment ?? 0) >= 0.1 ? "+" : (i.sentiment ?? 0) <= -0.1 ? "-" : " ";
      return `${s} [${i.source}] ${i.title}`;
    })
    .join("\n");

  return {
    content: [{
      type: "text" as const,
      text: `News Sentiment: ${report.avgSentiment >= 0 ? "+" : ""}${(report.avgSentiment * 100).toFixed(0)}% sentiment · ${report.positive}p/${report.negative}n/${report.neutral}·\nTrending: ${report.topKeywords.join(", ")}\n\n${items}`,
    }],
    details: {
      avgSentiment:   report.avgSentiment,
      positive:       report.positive,
      negative:       report.negative,
      neutral:        report.neutral,
      articleCount:   report.items.length,
      topKeywords:    report.topKeywords,
    },
  };
}