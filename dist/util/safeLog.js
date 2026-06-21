import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
const JELLY_HOME = process.env.JELLYOS_HOME ?? join(homedir(), ".jelly");
const DEBUG_LOG = join(JELLY_HOME, "debug.log");
let _notifyFn = null;
export function wireNotify(fn) { _notifyFn = fn; }
export function safeLog(...args) {
    const msg = args.map(a => (typeof a === "string" ? a : String(a))).join(" ");
    if (_notifyFn) {
        _notifyFn(msg);
    }
    else {
        try {
            mkdirSync(JELLY_HOME, { recursive: true });
            appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] ${msg}\n`);
        }
        catch { /* non-fatal */ }
    }
}
//# sourceMappingURL=safeLog.js.map