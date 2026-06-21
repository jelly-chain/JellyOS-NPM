// IrysService - Permanent storage on Arweave via Irys
import { spawn } from "node:child_process";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, "..", "..");
export class IrysService {
    uploaderPath;
    port;
    process = null;
    constructor(port = 8083) {
        this.port = port;
        this.uploaderPath = join(PKG_ROOT, "bin", "irys-uploader-server.js");
    }
    async start() {
        if (this.process || !existsSync(this.uploaderPath))
            return;
        this.process = spawn(process.execPath, [this.uploaderPath], {
            stdio: "ignore",
            env: { ...process.env, PORT: String(this.port) },
        });
    }
    async stop() {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
    }
    async upload(data, tags = []) {
        const base = process.env.IRYS_UPLOADER_URL || `http://localhost:${this.port}`;
        const resp = await fetch(`${base}/upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: Buffer.from(data).toString("base64"), tags }),
        });
        if (!resp.ok)
            throw new Error(`Upload failed: ${resp.status}`);
        const json = (await resp.json());
        return json;
    }
    async fetch(txId) {
        const gateway = process.env.IRYS_GATEWAY_URL || `https://gateway.irys.xyz`;
        const resp = await fetch(`${gateway}/${txId}`);
        if (!resp.ok)
            throw new Error(`Fetch failed`);
        return Buffer.from(await resp.arrayBuffer());
    }
}
export const irys = new IrysService();
//# sourceMappingURL=irys.js.map