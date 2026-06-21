#!/usr/bin/env bash
# JellyOS setup script — creates ~/.jelly/.env and configures all keys

set -e

GREEN='\033[0;32m'
GOLD='\033[0;33m'
RED='\033[0;31m'
GRAY='\033[0;37m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${GOLD}${BOLD}  🪼  JellyOS Setup${NC}"
echo ""

JELLY_HOME="${JELLYOS_HOME:-$HOME/.jelly}"
mkdir -p "$JELLY_HOME"

ENV_FILE="$JELLY_HOME/.env"

# Load existing values
load_value() {
  if [[ -f "$ENV_FILE" ]]; then
    grep "^${1}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || echo ""
  else
    echo ""
  fi
}

save_value() {
  local key="$1"
  local value="$2"
  if [[ -f "$ENV_FILE" ]]; then
    if grep -q "^${key}=" "$ENV_FILE"; then
      sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" 2>/dev/null || \
        sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    else
      echo "${key}=${value}" >> "$ENV_FILE"
    fi
  else
    echo "${key}=${value}" > "$ENV_FILE"
  fi
}

# Required
echo -e "${BOLD}  Required Configuration${NC}"
current=$(load_value "OPENROUTER_API_KEY")
read -p "  OpenRouter API key (https://openrouter.ai/keys)${current:+ [set]}: " val
[[ -n "$val" ]] && save_value "OPENROUTER_API_KEY" "$val"
[[ -z "$val" && -z "$current" ]] && { echo -e "${RED}  ✗ Required key not set${NC}"; exit 1; }

echo ""
echo -e "${BOLD}  Optional Configuration${NC}"

current=$(load_value "TELEGRAM_BOT_TOKEN")
read -p "  Telegram Bot Token${current:+ [set]}: " val
[[ -n "$val" ]] && save_value "TELEGRAM_BOT_TOKEN" "$val"

current=$(load_value "IRYS_PRIVATE_KEY")
read -p "  Irys Private Key${current:+ [set]}: " val
[[ -n "$val" ]] && save_value "IRYS_PRIVATE_KEY" "$val"

current=$(load_value "ALCHEMY_API_KEY")
read -p "  Alchemy API key${current:+ [set]}: " val
[[ -n "$val" ]] && save_value "ALCHEMY_API_KEY" "$val"

current=$(load_value "BOT_ADMIN_IDS")
read -p "  Bot Admin IDs (comma-separated)${current:+ [set]}: " val
[[ -n "$val" ]] && save_value "BOT_ADMIN_IDS" "$val"

echo ""
echo -e "${GREEN}  ✓ Config saved → ${ENV_FILE}${NC}"
echo -e "  Run: ${BOLD}jellyos${NC} to start"
echo ""