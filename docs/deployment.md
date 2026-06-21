# Deploying JellyOS

JellyOS runs anywhere Node.js 20+ is available. This guide covers deploying to popular cloud providers.

## Prerequisites

1. **API Keys** - Create `~/.jelly/.env` with your keys:
   ```bash
   OPENROUTER_API_KEY=sk-or-...
   TELEGRAM_BOT_TOKEN=                # If using Telegram features
   IRYS_PRIVATE_KEY=                  # For permanent storage
   ALCHEMY_API_KEY=                   # For blockchain data
   ```

2. **Telegram Bot (optional)** - Create via [@BotFather](https://t.me/BotFather)

---

## Railway

Railway offers simple Docker deployments with automatic HTTPS.

1. Fork/clone your repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project
3. Select your repo
4. Add environment variables in Railway dashboard
5. Railway auto-detects Node.js - set:
   ```
   NODE_ENV=production
   ```
6. Deploy - Railway provides a public URL

**Cost**: Free tier includes $5 credit monthly

---

## Render

Render provides reliable web services with persistent disks.

1. Create `render.yaml` in project root:
   ```yaml
   services:
     - type: web
       name: jellyos
       env: node
       buildCommand: npm install && npm run build
       startCommand: node dist/cli.js
       envVars:
         - key: NODE_ENV
           value: production
         - key: JELLYOS_HOME
           value: /var/task/.jelly
       disk:
         name: jellyos-data
         path: /var/task/.jelly
   ```
2. Push to GitHub
3. Create New Web Service on [render.com](https://render.com)
4. Select your repo, check "Use render.yaml"
5. Add secrets in Environment tab

**Cost**: Free tier available, $7/mo for always-on

---

## Fly.io

Fly.io runs containers globally with great performance.

1. Install Fly CLI:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. Create `fly.toml`:
   ```toml
   app = "jellyos"
   
   [build]
     builder = "paketobuildpacks/builder:base"
   
   [env]
     NODE_ENV = "production"
     JELLYOS_HOME = "/data/.jelly"
   
   [[mounts]]
     source = "jellyos_data"
     destination = "/data"
   ```

3. Deploy:
   ```bash
   fly launch
   fly secrets set OPENROUTER_API_KEY=sk-or-...
   fly deploy
   ```

**Cost**: Free tier includes 3GB RAM, 160GB storage

---

## DigitalOcean App Platform

Full control with optional custom domains.

1. Push to GitHub
2. Go to [DigitalOcean Apps](https://cloud.digitalocean.com/apps)
3. Create App → Link your repo
4. Select Node.js environment
5. Set build command: `npm install && npm run build`
6. Set run command: `node dist/cli.js --headless "start agent session"`
7. Add environment variables under Settings → Environment Variables

**Note**: For TUI mode, use SSH to your droplet instead:
```bash
ssh root@your-droplet
npm install -g @jellyos/agent
jellyos
```

**Cost**: $5/mo basic droplet, $7/mo App Platform

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | ✅ | LLM API key |
| `TELEGRAM_BOT_TOKEN` | ❌ | Telegram bot token |
| `IRYS_PRIVATE_KEY` | ❌ | For permanent storage |
| `ALCHEMY_API_KEY` | ❌ | Blockchain data |
| `JELLYOS_HOME` | ❌ | Data directory (default: `~/.jelly`) |

---

## Running Headless Mode in Cloud

For cloud deployments, use headless mode:

```bash
# Scheduled task example
jellyos --headless "analyze BTC market and report key signals"

# In GitHub Actions (cron)
jellyos --headless "generate daily portfolio summary" > output.txt
```

---

## Notes

- All cloud providers support background processes
- For Telegram bot, ensure port is accessible if using webhooks
- JWT sessions work across restarts when using persistent volumes
- The `irys-uploader` microservice starts automatically on first use