/**
 * NewsSentiment — fetches RSS feeds, runs headline sentiment scoring
 * with a cheap model, and surfaces trending narratives.
 */
import { type Static } from "@sinclair/typebox";
export interface NewsItem {
    title: string;
    source: string;
    url: string;
    published: number;
    sentiment?: number;
}
export interface SentimentReport {
    items: NewsItem[];
    avgSentiment: number;
    positive: number;
    negative: number;
    neutral: number;
    updatedAt: number;
    topKeywords: string[];
}
export declare function scoreSentiment(text: string): number;
export declare class NewsFeed {
    private lastReport;
    private pollInterval;
    private timer?;
    constructor(pollIntervalMs?: number);
    start(): void;
    stop(): void;
    fetch(): Promise<void>;
    getLatest(): SentimentReport | null;
    summary(): string;
    /** Compact sentiment badge for status bar. */
    statusBadge(): string;
}
export declare const newsFeed: NewsFeed;
export declare const getNewsParams: import("@sinclair/typebox").TObject<{
    limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
}>;
export declare function getNewsTool(_id: string, params: Static<typeof getNewsParams>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
    details: {
        avgSentiment?: undefined;
        positive?: undefined;
        negative?: undefined;
        neutral?: undefined;
        articleCount?: undefined;
        topKeywords?: undefined;
    };
} | {
    content: {
        type: "text";
        text: string;
    }[];
    details: {
        avgSentiment: number;
        positive: number;
        negative: number;
        neutral: number;
        articleCount: number;
        topKeywords: string[];
    };
}>;
//# sourceMappingURL=NewsSentiment.d.ts.map