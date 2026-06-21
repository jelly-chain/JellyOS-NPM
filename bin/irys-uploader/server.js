/**
 * irys-uploader — Microservice that signs DataItems using @irys/upload-ethereum SDK.
 * The main JellyOS process delegates uploads here for secure key handling.
 */

import express from "express";
import { Uploader } from "@irys/upload";
import { BNB, Ethereum } from "@irys/upload-ethereum";

const PRIVATE_KEY = process.env.IRYS_PRIVATE_KEY;
const IRYS_TOKEN = (process.env.IRYS_TOKEN || "bnb").toLowerCase();
const IRYS_NODE_URL = process.env.IRYS_NODE_URL || "https://uploader.irys.xyz";
const PORT = parseInt(process.env.PORT || "8083", 10);

if (!PRIVATE_KEY) {
  console.error("❌ IRYS_PRIVATE_KEY not configured");
  process.exit(1);
}

const TOKEN_MAP: Record<string, typeof BNB | typeof Ethereum> = {
  bnb: BNB,
  ethereum: Ethereum,
  eth: Ethereum,
};

const tokenCls = TOKEN_MAP[IRYS_TOKEN];
if (!tokenCls) {
  console.error(`❌ IRYS_TOKEN not supported: ${IRYS_TOKEN} (use bnb or ethereum)`);
  process.exit(1);
}

let uploader: ReturnType<typeof Uploader> | null = null;

async function getUploader() {
  if (uploader) return uploader;
  try {
    uploader = await Uploader(tokenCls).withWallet(PRIVATE_KEY);
    console.log(`✅ Irys uploader initialized — token=${IRYS_TOKEN} address=${uploader.address}`);
    return uploader;
  } catch (err: any) {
    console.error("❌ Failed initializing Irys uploader:", err.message);
    process.exit(1);
  }
}

const app = express();
app.use(express.json({ limit: "50mb" }));

app.get("/health", async (_req, res) => {
  try {
    const u = await getUploader();
    res.json({ status: "ok", address: u.address, token: IRYS_TOKEN });
  } catch (err: any) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

app.get("/balance", async (_req, res) => {
  try {
    const u = await getUploader();
    const balance = await u.getBalance();
    res.json({ balance: balance.toString(), address: u.address });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/upload", async (req, res) => {
  try {
    const { data, tags } = req.body || {};
    if (typeof data !== "string" || data.length === 0) {
      return res.status(400).json({ error: "Field 'data' (base64) required" });
    }
    const cleanTags = Array.isArray(tags)
      ? tags.filter((t: any) => t && typeof t.name === "string" && typeof t.value === "string")
      : [];
    const buffer = Buffer.from(data, "base64");
    const u = await getUploader();
    const receipt = await u.upload(buffer, { tags: cleanTags });
    res.json({ id: receipt.id, timestamp: receipt.timestamp, size: buffer.length });
  } catch (err: any) {
    const msg = err?.message || String(err);
    const status = /insufficient/i.test(msg) ? 402 : 500;
    res.status(status).json({ error: msg });
  }
});

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🚀 irys-uploader listening on :${PORT}`);
  await getUploader();
});