#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// Copied standalone to ~/.vibenotifications/statusline.js by core/hooks.js
// installHooks — core/co2-rates.js is copied alongside it into
// ~/.vibenotifications/core/ so this relative import resolves in both the
// dev tree and the installed copy.
import { CO2_RATES, getComparison } from "./core/co2-rates.js";

const VN_DIR = join(homedir(), ".vibenotifications");
const NOTIFICATIONS_FILE = join(VN_DIR, "notifications.json");
const SESSION_FILE = join(VN_DIR, "carbon-session.json");

// Strip control chars and ANSI/OSC escape sequences from externally-sourced
// notification text before it's ever concatenated with our own ANSI codes —
// otherwise a malicious notification title/url can inject terminal escapes
// into the status line (e.g. hide/rewrite output, OSC 8 hyperlink spoofing).
function sanitize(str, maxLen = 200) {
  if (typeof str !== "string") return "";
  return str
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")   // CSI sequences
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "") // OSC sequences
    .replace(/[\x00-\x1f\x7f]/g, "")          // remaining control chars
    .slice(0, maxLen);
}

const SAFE_URL_RE = /^https?:\/\/[\x21-\x7e]{1,200}$/;

function sanitizeUrl(url) {
  if (typeof url !== "string" || !SAFE_URL_RE.test(url)) return "";
  return url;
}

// Compute carbon live from session file — bypasses the 60s daemon cache.
// This runs every time Claude Code refreshes the status line (~every few seconds).
function liveCarbonTitle() {
  if (!existsSync(SESSION_FILE)) return null;
  try {
    const s = JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
    if (Date.now() - s.startTime > 8 * 60 * 60 * 1000) return null;
    const rate = CO2_RATES[s.model] ?? 0.85;
    const toolTokens = (s.toolCallCount || 0) * 2000;
    const timeTokens = Math.round((Date.now() - s.startTime) / 60000 * 500);
    const tokens = Math.max(toolTokens, timeTokens, s.estimatedTokens || 0);
    const co2 = (tokens / 1000) * rate;
    return `🌱 ${co2.toFixed(1)}g CO₂ · ${getComparison(co2)}`;
  } catch { return null; }
}

let input = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try { render(); } catch { /* silent */ }
});

function render() {
  // High-priority non-carbon notification (eco alert, GitHub PR) takes precedence
  let topNonCarbon = null;
  if (existsSync(NOTIFICATIONS_FILE)) {
    try {
      const ns = JSON.parse(readFileSync(NOTIFICATIONS_FILE, "utf-8"));
      topNonCarbon = ns.find(n => n.source !== "carbon" && n.priority === "high") ?? null;
    } catch { /* silent */ }
  }

  if (topNonCarbon) {
    const icon = sanitize(topNonCarbon.source, 40).toUpperCase();
    const title = sanitize(topNonCarbon.title);
    console.log(`\x1b[33m[${icon}]\x1b[0m ${title}`);
    const url = sanitizeUrl(topNonCarbon.url);
    if (url)
      console.log(`\x1b[90m  \x1b]8;;${url}\x07${url}\x1b]8;;\x07\x1b[0m`);
    return;
  }

  const carbonTitle = liveCarbonTitle();
  if (carbonTitle) {
    console.log(`\x1b[33m[CARBON]\x1b[0m ${carbonTitle}`);
    console.log(`\x1b[90m  \x1b]8;;https://carbon-llm.com\x07https://carbon-llm.com\x1b]8;;\x07\x1b[0m`);
    return;
  }

  console.log("\x1b[90mvibenotifications | no notifications\x1b[0m");
}
