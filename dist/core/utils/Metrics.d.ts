import { Logger } from './Logger.js';
export interface MetricValue {
    value: number;
    timestamp: number;
    labels?: Record<string, string>;
}
export interface HistogramBucket {
    upperBound: number;
    count: number;
}
export interface HistogramData {
    buckets: HistogramBucket[];
    sum: number;
    count: number;
}
export interface MetricSnapshot {
    counter: Record<string, number>;
    gauge: Record<string, number>;
    histogram: Record<string, HistogramData>;
    summary: Record<string, {
        count: number;
        sum: number;
        avg: number;
    }>;
}
export interface MetricConfig {
    enabled: boolean;
    collectInterval: number;
    maxAge: number;
    enableExport: boolean;
    exportEndpoint?: string;
}
export declare class Metrics {
    private config;
    private logger;
    private counters;
    private gauges;
    private histograms;
    private summaries;
    private values;
    private labelSets;
    private collectTimer;
    constructor(logger: Logger, config?: Partial<MetricConfig>);
    private startCollection;
    private collect;
    increment(counter: string, value?: number, labels?: Record<string, string>): void;
    decrement(counter: string, value?: number, labels?: Record<string, string>): void;
    getCounter(name: string, labels?: Record<string, string>): number;
    setGauge(gauge: string, value: number, labels?: Record<string, string>): void;
    getGauge(name: string, labels?: Record<string, string>): number;
    observe(histogram: string, value: number, labels?: Record<string, string>): void;
    getHistogram(name: string, labels?: Record<string, string>): HistogramData;
    record(name: string, value: number, labels?: Record<string, string>): void;
    getSummary(name: string, labels?: Record<string, string>): {
        count: number;
        sum: number;
        avg: number;
    };
    private makeKey;
    private recordValue;
    getSnapshot(): MetricSnapshot;
    reset(): void;
    getValues(metricName: string): MetricValue[];
    getRecentValues(metricName: string, seconds: number): MetricValue[];
    close(): void;
}
//# sourceMappingURL=Metrics.d.ts.map