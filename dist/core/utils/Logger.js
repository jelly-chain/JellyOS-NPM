import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["FATAL"] = 4] = "FATAL";
})(LogLevel || (LogLevel = {}));
const DEFAULT_CONFIG = {
    level: LogLevel.INFO,
    fileOutput: true,
    consoleOutput: false,
    logDirectory: './logs',
    maxFileSize: 10 * 1024 * 1024,
    maxFiles: 10,
    includeTimestamp: true,
    colorize: true,
    jsonOutput: false,
};
const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
};
export class Logger {
    config;
    contextName;
    logStream = null;
    currentFileSize = 0;
    fileHandle = null;
    logBuffer = [];
    bufferFlushInterval = null;
    constructor(contextName, config) {
        this.contextName = contextName;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.initialize();
    }
    initialize() {
        if (this.config.fileOutput) {
            this.ensureLogDirectory();
            this.rotateLogFileIfNeeded();
            this.bufferFlushInterval = setInterval(() => this.flushBuffer(), 5000);
        }
    }
    ensureLogDirectory() {
        if (!fs.existsSync(this.config.logDirectory)) {
            fs.mkdirSync(this.config.logDirectory, { recursive: true });
        }
    }
    getLogFilePath() {
        const date = new Date().toISOString().split('T')[0];
        return path.join(this.config.logDirectory, `jellyos-${date}.log`);
    }
    rotateLogFileIfNeeded() {
        const logPath = this.getLogFilePath();
        try {
            if (fs.existsSync(logPath)) {
                const stats = fs.statSync(logPath);
                this.currentFileSize = stats.size;
            }
        }
        catch (error) {
            this.currentFileSize = 0;
        }
    }
    formatMessage(entry) {
        const timestamp = entry.timestamp;
        const levelName = entry.levelName.padEnd(5, ' ');
        const context = entry.context ? `[${entry.context}] ` : '';
        if (this.config.jsonOutput) {
            return JSON.stringify({
                timestamp: entry.timestamp,
                level: entry.levelName,
                context: entry.context,
                message: entry.message,
                meta: entry.meta,
            });
        }
        let line = `${timestamp} ${levelName} ${context}${entry.message}`;
        if (entry.meta && Object.keys(entry.meta).length > 0) {
            line += ` ${util.inspect(entry.meta, { depth: null, colors: false })}`;
        }
        if (entry.error) {
            line += `\n  Error: ${entry.error.message}`;
            if (entry.error.stack) {
                line += `\n  Stack: ${entry.error.stack}`;
            }
        }
        return line;
    }
    writeToConsole(entry) {
        if (!this.config.consoleOutput)
            return;
        const message = this.formatMessage(entry);
        const color = this.config.colorize ? this.getLevelColor(entry.level) : '';
        const colorReset = this.config.colorize ? COLORS.reset : '';
        switch (entry.level) {
            case LogLevel.DEBUG:
                console.debug(`${color}${message}${colorReset}`);
                break;
            case LogLevel.INFO:
                console.info(`${color}${message}${colorReset}`);
                break;
            case LogLevel.WARN:
                console.warn(`${color}${message}${colorReset}`);
                break;
            case LogLevel.ERROR:
                console.error(`${color}${message}${colorReset}`);
                break;
            case LogLevel.FATAL:
                console.error(`${color}${message}${colorReset}`);
                break;
        }
    }
    getLevelColor(level) {
        switch (level) {
            case LogLevel.DEBUG: return COLORS.gray;
            case LogLevel.INFO: return COLORS.green;
            case LogLevel.WARN: return COLORS.yellow;
            case LogLevel.ERROR: return COLORS.red;
            case LogLevel.FATAL: return COLORS.magenta;
            default: return COLORS.white;
        }
    }
    addToBuffer(entry) {
        this.logBuffer.push(entry);
        if (this.logBuffer.length >= 100) {
            this.flushBuffer();
        }
    }
    flushBuffer() {
        if (this.logBuffer.length === 0)
            return;
        const logPath = this.getLogFilePath();
        const batchSize = Math.min(this.logBuffer.length, 50);
        const batch = this.logBuffer.splice(0, batchSize);
        for (const entry of batch) {
            const line = this.formatMessage(entry) + '\n';
            this.currentFileSize += Buffer.byteLength(line);
            fs.appendFileSync(logPath, line, 'utf8');
        }
    }
    log(level, message, meta, error) {
        if (level < this.config.level)
            return;
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            levelName: LogLevel[level],
            context: this.contextName,
            message,
            meta,
            error,
        };
        this.writeToConsole(entry);
        if (this.config.fileOutput) {
            this.addToBuffer(entry);
        }
    }
    debug(message, meta) {
        this.log(LogLevel.DEBUG, message, meta);
    }
    info(message, meta) {
        this.log(LogLevel.INFO, message, meta);
    }
    warn(message, meta) {
        this.log(LogLevel.WARN, message, meta);
    }
    error(message, errorOrMeta) {
        if (errorOrMeta instanceof Error) {
            this.log(LogLevel.ERROR, message, undefined, errorOrMeta);
        }
        else {
            this.log(LogLevel.ERROR, message, errorOrMeta);
        }
    }
    fatal(message, errorOrMeta) {
        if (errorOrMeta instanceof Error) {
            this.log(LogLevel.FATAL, message, undefined, errorOrMeta);
        }
        else {
            this.log(LogLevel.FATAL, message, errorOrMeta);
        }
    }
    child(context) {
        return new Logger(`${this.contextName}:${context}`, this.config);
    }
    startTimer(operation) {
        const start = process.hrtime.bigint();
        return () => {
            const end = process.hrtime.bigint();
            const duration = Number(end - start) / 1e6;
            this.info(`${operation} completed`, { durationMs: duration.toFixed(2) });
            return duration;
        };
    }
    time(message, duration) {
        this.info(message, { durationMs: duration.toFixed(2) });
    }
    async close() {
        if (this.bufferFlushInterval) {
            clearInterval(this.bufferFlushInterval);
            this.bufferFlushInterval = null;
        }
        this.flushBuffer();
    }
    getConfig() {
        return { ...this.config };
    }
    setLevel(level) {
        this.config.level = level;
    }
}
//# sourceMappingURL=Logger.js.map