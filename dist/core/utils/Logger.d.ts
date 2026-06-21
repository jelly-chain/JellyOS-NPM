export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    FATAL = 4
}
export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    levelName: string;
    message: string;
    context?: string;
    meta?: any;
    error?: Error;
    duration?: number;
}
export interface LoggerConfig {
    level: LogLevel;
    fileOutput: boolean;
    consoleOutput: boolean;
    logDirectory: string;
    maxFileSize: number;
    maxFiles: number;
    includeTimestamp: boolean;
    colorize: boolean;
    jsonOutput: boolean;
}
export declare class Logger {
    private config;
    private contextName;
    private logStream;
    private currentFileSize;
    private fileHandle;
    private logBuffer;
    private bufferFlushInterval;
    constructor(contextName: string, config?: Partial<LoggerConfig>);
    private initialize;
    private ensureLogDirectory;
    private getLogFilePath;
    private rotateLogFileIfNeeded;
    private formatMessage;
    private writeToConsole;
    private getLevelColor;
    private addToBuffer;
    private flushBuffer;
    private log;
    debug(message: string, meta?: any): void;
    info(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    error(message: string, errorOrMeta?: Error | any): void;
    fatal(message: string, errorOrMeta?: Error | any): void;
    child(context: string): Logger;
    startTimer(operation: string): () => number;
    time(message: string, duration: number): void;
    close(): Promise<void>;
    getConfig(): LoggerConfig;
    setLevel(level: LogLevel): void;
}
//# sourceMappingURL=Logger.d.ts.map