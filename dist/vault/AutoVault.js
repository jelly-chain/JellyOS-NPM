import { Logger } from '../core/utils/Logger.js';
export class AutoVault {
    vault;
    logger;
    threshold;
    checkInterval = null;
    onSweep = null;
    constructor(vault) {
        this.vault = vault;
        this.logger = new Logger('AutoVault');
        // Read threshold from context.json first (set via /schedule command), then env, then $500
        this.threshold = this.readThreshold();
    }
    readThreshold() {
        try {
            const { existsSync, readFileSync } = require('fs');
            const ctxPath = require('path').resolve(require('os').homedir(), '.jelly', 'context.json');
            if (existsSync(ctxPath)) {
                const ctx = JSON.parse(readFileSync(ctxPath, 'utf-8'));
                if (ctx.auto_vault_threshold != null)
                    return Number(ctx.auto_vault_threshold);
            }
        }
        catch { /* fall through */ }
        return parseFloat(process.env.AUTO_VAULT_THRESHOLD || '500');
    }
    start(getPnL, onSweep) {
        this.onSweep = onSweep || null;
        this.checkInterval = setInterval(() => this.check(getPnL), 60_000);
        this.logger.info(`AutoVault started — threshold: $${this.threshold}`);
    }
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
    async check(getPnL) {
        const pnl = getPnL();
        if (pnl >= this.threshold && !this.vault.isLocked()) {
            const sweepAmount = Math.round(pnl * 100) / 100;
            try {
                await this.vault.sweep(sweepAmount, `auto-sweep P&L $${sweepAmount.toFixed(2)} (threshold: $${this.threshold})`);
                this.logger.info(`Auto-swept $${sweepAmount.toFixed(2)} to vault`);
                if (this.onSweep)
                    this.onSweep(sweepAmount);
            }
            catch (err) {
                this.logger.error('Auto-sweep failed', err);
            }
        }
    }
    updateThreshold(amount) {
        this.threshold = amount;
        this.logger.info(`AutoVault threshold updated to $${amount}`);
    }
}
//# sourceMappingURL=AutoVault.js.map