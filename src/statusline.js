#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const VN_DIR = join(homedir(), ".vibenotifications");
const NOTIFICATIONS_FILE = join(VN_DIR, "notifications.json");
const SESSION_FILE = join(VN_DIR, "carbon-session.json");

const CO2_RATES = {
  "claude-sonnet-4-6": 0.85, "claude-opus-4-7": 0.55,
  "claude-haiku-4-5-20251001": 0.10, "gpt-5.4": 0.50,
  "gpt-5.4-mini": 0.12, "o3": 5.00, "o4-mini": 1.50, "mistral-large": 2.85,
};

const COMPARISONS = [
  { maxG: 0.01,  text: "fresh session",           emoji: "🌱" },
  { maxG: 0.07,  text: "1 Slack message",          emoji: "💬" },
  { maxG: 2,     text: "{n} Slack messages",       emoji: "💬", unit: 0.035 },
  { maxG: 6,     text: "{n} Google searches",      emoji: "🔍", unit: 0.2 },
  { maxG: 15,    text: "{n}% phone charge",        emoji: "📱", unit: 0.09 },
  { maxG: 50,    text: "{n} min of Zoom",          emoji: "📹", unit: 17 },
  { maxG: 110,   text: "boiling a kettle",         emoji: "☕" },
  { maxG: 300,   text: "{n}km drive",              emoji: "🚗", unit: 170 },
  { maxG: 10000, text: "{n} kettles",              emoji: "☕", unit: 70 },
];

function getComparison(g) {
  for (const c of COMPARISONS) {
    if (g <= c.maxG) {
      if (!c.unit) return `${c.emoji} ${c.text}`;
      return `${c.emoji} ${c.text.replace("{n}", Math.max(1, Math.round(g / c.unit)))}`;
    }
  }
  return `🌍 ${(g / 1000).toFixed(2)}kg CO₂`;
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
    const icon = topNonCarbon.source.toUpperCase();
    console.log(`\x1b[33m[${icon}]\x1b[0m ${topNonCarbon.title}`);
    if (topNonCarbon.url)
      console.log(`\x1b[90m  \x1b]8;;${topNonCarbon.url}\x07${topNonCarbon.url}\x1b]8;;\x07\x1b[0m`);
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
