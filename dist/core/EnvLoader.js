import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { homedir } from 'os';
const REQUIRED_ENV_VARS = [
    'ALCHEMY_KEY',
];
const DEFAULT_VALUES = {
    LOG_LEVEL: 'info',
    TRADING_ENABLED: 'false',
    PREDICTION_ENABLED: 'true',
};
export class EnvLoader {
    envConfig = {};
    envPath;
    /**
     * @param envPath  Absolute path, or path relative to ~/.jellyos/.
     *                 Values starting with '/' or '~' are treated as absolute.
     */
    constructor(envPath = '.env.local') {
        if (envPath.startsWith('/') || envPath.startsWith('~')) {
            this.envPath = resolve(envPath.replace('~', homedir()));
        }
        else {
            this.envPath = resolve(homedir(), '.jellyos', envPath);
        }
        this.load();
    }
    /**
     * Create an EnvLoader at an absolute path (for testing, alternate configs).
     */
    static atAbsolutePath(absolutePath) {
        const loader = Object.create(EnvLoader.prototype);
        loader.envPath = resolve(absolutePath);
        loader.envConfig = {};
        loader.load();
        return loader;
    }
    load() {
        const envFiles = [
            this.envPath,
            resolve(dirname(this.envPath), '.env'),
            resolve(dirname(this.envPath), '.env.example'),
        ];
        for (const envFile of envFiles) {
            if (existsSync(envFile)) {
                this.parseEnvFile(envFile);
            }
        }
        this.loadFromProcessEnv();
        this.validate();
    }
    parseEnvFile(filePath) {
        try {
            const content = readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#'))
                    continue;
                const [key, ...valueParts] = trimmed.split('=');
                const value = valueParts.join('=').replace(/^["']|["']$/g, '');
                if (key) {
                    this.envConfig[key.trim()] = value;
                }
            }
        }
        catch (error) {
            // Silently continue if file can't be read
        }
    }
    loadFromProcessEnv() {
        for (const key of Object.keys(process.env)) {
            const value = process.env[key];
            if (value !== undefined) {
                this.envConfig[key] = value;
            }
        }
    }
    validate() {
        const missing = [];
        for (const varName of REQUIRED_ENV_VARS) {
            if (!this.envConfig[varName]) {
                missing.push(varName);
            }
        }
        if (missing.length > 0) {
            console.warn(`Missing required environment variables: ${missing.join(', ')}`);
        }
    }
    get(key, defaultValue) {
        return this.envConfig[key] ?? process.env[key] ?? defaultValue ?? DEFAULT_VALUES[key];
    }
    getRequired(key) {
        const value = this.get(key);
        if (!value) {
            throw new Error(`Required environment variable ${key} is not set`);
        }
        return value;
    }
    getNumber(key, defaultValue) {
        const value = this.get(key);
        if (value === undefined)
            return defaultValue;
        const parsed = Number(value);
        return isNaN(parsed) ? defaultValue : parsed;
    }
    getBoolean(key, defaultValue) {
        const value = this.get(key);
        if (value === undefined)
            return defaultValue;
        if (value.toLowerCase() === 'true')
            return true;
        if (value.toLowerCase() === 'false')
            return false;
        return defaultValue;
    }
    getAll() {
        return { ...this.envConfig };
    }
    reload() {
        this.envConfig = {};
        this.load();
    }
}
export const env = new EnvLoader();
//# sourceMappingURL=EnvLoader.js.map