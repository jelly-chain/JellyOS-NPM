/**
 * irys-uploader-microservice — signs DataItems via @irys/upload-ethereum
 */
import express from "express";
import { Uploader } from "@irys/upload";
import { BNB, Ethereum } from "@irys/upload-ethereum";

const PRIVATE_KEY = process.env.IRYS_PRIVATE_KEY;
const IRYS_TOKEN = (process.env.IRYS_TOKEN || "bnb").toLowerCase();
const IRYS_NODE_URL = process.env.IRYS_NODE_URL || "https://uploader.irys.xyz";
const PORT = parseInt(process.env.PORT || "8083", 10);

if (!PRIVATE_KEY) {
  console.error("IRYS_PRIVATE_KEY not configured");
  process.exit(1);
}

const TOKEN_MAP = { bnb: BNB, ethereum: Ethereum, eth: Ethereum };
const tokenCls = TOKEN_MAP[IRYS_TOKEN as keyof typeof TOKEN_MAP];

let uploader: any = null;

async function getUploader() {
  if (uploader) return uploader;
  uploader = await Uploader(tokenCls).withWallet(PRIVATE_KEY);
  console.log(`Irys uploader initialized`);
  return uploader;
}

const app = express();
app.use(express.json({ limit: "50mb" }));

app.get("/health", async (_req, res) => {
  const u = await getUploader();
  res.json({ status: "ok", address: u.address, token: IRYS_TOKEN });
});

app.get("/balance", async (_req, res) => {
  const u = await getUploader();
  const balance = await u.getBalance();
  res.json({ balance: balance.toString(), address: u.address });
});

app.post("/upload", async (req, res) => {
  const { data, tags } = req.body || {};
  const buffer = Buffer.from(data, "base64");
  const u = await getUploader();
  const receipt = await u.upload(buffer, { tags });
  res.json({ id: receipt.id, timestamp: receipt.timestamp, size: buffer.length });
});

app.listen(PORT, () => {
  console.log(`irys-uploader on :${PORT}`);
  getUploader();
});
