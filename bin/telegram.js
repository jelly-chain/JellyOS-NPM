#!/usr/bin/env node
/**
 * telegram.js — Start JellyOS Telegram bot
 */
import('../dist/cli.js').catch(() => {
  // CLI handles telegram subcommand
});
