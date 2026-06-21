export { Logger, LogLevel } from './Logger.js';
export { Metrics } from './Metrics.js';
export type { LogEntry, LoggerConfig } from './Logger.js';
export type { MetricValue, HistogramBucket, HistogramData, MetricSnapshot, MetricConfig } from './Metrics.js';
export declare const createLogger: (context: string) => Logger;
export declare const createMetrics: (logger: Logger) => Metrics;
import { Logger } from './Logger.js';
import { Metrics } from './Metrics.js';
export declare class LoggerFactory {
    private static loggerCache;
    private static metricsCache;
    static getLogger(context: string, config?: any): Logger;
    static getMetrics(context: string): Metrics;
    static reset(): void;
}
declare const _default: {
    LoggerFactory: typeof LoggerFactory;
};
export default _default;
//# sourceMappingURL=Index.d.ts.map