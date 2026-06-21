export { Logger, LogLevel } from './Logger.js';
export { Metrics } from './Metrics.js';
export const createLogger = (context) => new Logger(context);
export const createMetrics = (logger) => new Metrics(logger);
import { Logger } from './Logger.js';
import { Metrics } from './Metrics.js';
export class LoggerFactory {
    static loggerCache = new Map();
    static metricsCache = new Map();
    static getLogger(context, config) {
        if (!this.loggerCache.has(context)) {
            this.loggerCache.set(context, new Logger(context, config));
        }
        return this.loggerCache.get(context);
    }
    static getMetrics(context) {
        if (!this.metricsCache.has(context)) {
            const logger = this.getLogger(`Metrics:${context}`);
            this.metricsCache.set(context, new Metrics(logger));
        }
        return this.metricsCache.get(context);
    }
    static reset() {
        for (const logger of this.loggerCache.values()) {
            logger.close();
        }
        this.loggerCache.clear();
        this.metricsCache.clear();
    }
}
export default { LoggerFactory };
//# sourceMappingURL=Index.js.map