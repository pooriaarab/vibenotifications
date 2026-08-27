// Eco Mode — reduce token/CO₂ usage without compromising output quality.
//
// Inspired by caveman skill (github.com/juliusbrussee/caveman):
// "why use many token when few do trick" — ~75% output token reduction, 0% quality loss.
// Key insight: compress the MOUTH (output tokens), NOT the BRAIN (thinking/reasoning).
//
// Works via vibenotifications' context injection surface. Uses forceInject=true to
// bypass the 30% random gate, so the eco prompt is always injected into Claude's context.
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { CO2_RATES, DEFAULT_CO2_RATE } from "../core/co2-rates.js";

const SESSION_FILE = join(homedir(), ".vibenotifications", "carbon-session.json");

// Ratio used in the eco prompt copy below — derived from the shared rate
// table so it can't drift independently of carbon.js/statusline.js.
const HAIKU_SAVINGS_X = (CO2_RATES["claude-sonnet-4-6"] / CO2_RATES["claude-haiku-4-5-20251001"]).toFixed(1);

const ECO_PROMPTS = {
  lite: `ECO MODE (lite): Drop filler words, pleasantries, hedging. Keep all technical substance. No trailing summaries of what you just did.`,

  full: `ECO MODE (full):
- Compress output: drop filler, hedging, pleasantries. Fragments OK. 100% technical substance.
- Batch tool calls: read multiple files in one message, not sequentially.
- Avoid re-reading files you've already read this session.
- For simple lookups/grepping: claude-haiku-4-5 uses ${HAIKU_SAVINGS_X}x less CO2 than claude-sonnet-4-6 (${CO2_RATES["claude-haiku-4-5-20251001"]}g vs ${CO2_RATES["claude-sonnet-4-6"]}g per 1K tokens). Flag sub-tasks that could use a smaller model.
Pattern: [finding] [action] [reason]. No throat-clearing.`,

  ultra: `ECO MODE (ultra) — strict token discipline:
- Terse output only. Pattern: [thing] [action] [reason]. [next step]. Fragments. No filler.
- Batch ALL tool calls. Never read a file twice.
- Before each tool call: ask "is this necessary?" Skip git status unless asked.
- Flag model downgrade opportunities: Haiku=${CO2_RATES["claude-haiku-4-5-20251001"]}g/1Ktok, Sonnet=${CO2_RATES["claude-sonnet-4-6"]}g/1Ktok, Opus=${CO2_RATES["claude-opus-4-7"]}g/1Ktok.
- No summaries. No "I'll now...". No "Great, I've...". Just the output.
CAVEMAN RULE: why use many token when few do trick.`,
};

const SAVINGS = { lite: 30, full: 65, ultra: 80 };
const VALID_LEVELS = Object.keys(ECO_PROMPTS);

function resolveLevel(config) {
  const level = (config.level || "full").trim().toLowerCase();
  return { level, savings: SAVINGS[level] || 65, prompt: ECO_PROMPTS[level] || ECO_PROMPTS.full };
}

function buildEcoNotification(level, savings, prompt) {
  return {
    id: "eco-mode-active",
    source: "eco",
    title: `♻️ ECO ${level.toUpperCase()} · ~${savings}% token savings`,
    body: prompt,
    priority: "high",
    url: "https://github.com/pooriaarab/vibenotifications",
    timestamp: new Date().toISOString(),
    actionable: true,
    forceInject: true,
  };
}

function getThreshold(config) {
  const parsed = parseFloat(config.threshold);
  const value = Number.isFinite(parsed) ? parsed : 50;
  return value;
}

function buildThresholdNotification(co2, thresholdG) {
  return {
    id: `eco-threshold-${Math.floor(co2 / thresholdG)}`,
    source: "eco",
    title: `⚠️ ${co2.toFixed(0)}g CO₂ this session — consider switching to Haiku for simple tasks`,
    body: `Hit your ${thresholdG}g eco alert. Haiku is 8.5× greener for reads, searches, and formatting tasks.`,
    priority: "high",
    url: "https://github.com/pooriaarab/vibenotifications",
    timestamp: new Date().toISOString(),
    actionable: true,
  };
}

function computeCo2(session) {
  const rate = session.co2Rate ?? DEFAULT_CO2_RATE;
  const toolTokens = (session.toolCallCount || 0) * 2000;
  const elapsedMin = (Date.now() - session.startTime) / 60000;
  const estimatedTokens = Math.max(toolTokens, Math.round(elapsedMin * 500));
  return (estimatedTokens / 1000) * rate;
}

function tryAddThresholdNotification(notifications, config) {
  const thresholdG = getThreshold(config);
  if (thresholdG <= 0 || !existsSync(SESSION_FILE)) return;
  try {
    const session = JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
    const co2 = computeCo2(session);
    if (co2 >= thresholdG) notifications.push(buildThresholdNotification(co2, thresholdG));
  } catch {
    // Carbon plugin not installed or session file unreadable — skip threshold check
  }
}

export default {
  name: "eco",
  displayName: "Eco Mode",
  icon: "♻️",

  requiredConfig: {
    level: {
      label: "Eco intensity level",
      type: "string",
      placeholder: "full",
      instructions:
        "lite  → compress output only (~30% token savings)\n" +
        "   full  → compress + batch tool calls + model suggestions (~65% savings)\n" +
        "   ultra → maximum discipline, strict batching (~80% savings)\n" +
        "   All levels preserve 100% technical accuracy (Jegham 2025 / caveman benchmarks).",
      validate: (value) => {
        const v = (value || "full").trim().toLowerCase();
        if (!ECO_PROMPTS[v]) return `Unknown level. Options: ${VALID_LEVELS.join(", ")}`;
        return null;
      },
    },
    threshold: {
      label: "CO₂ alert threshold in grams (0 to disable)",
      type: "string",
      placeholder: "50",
      validate: (value) => {
        const n = parseFloat(value);
        if (value.trim() !== "" && (isNaN(n) || n < 0)) return "Enter a number >= 0, or 0 to disable";
        return null;
      },
    },
  },

  setup: async (config) => {
    const level = (config.level || "full").trim().toLowerCase();
    config.level = level;
    const savings = SAVINGS[level] || 65;
    return { connected: true, tracking: `eco-${level} · ~${savings}% token savings` };
  },

  fetch: async (config) => {
    const { level, savings, prompt } = resolveLevel(config);
    const notifications = [buildEcoNotification(level, savings, prompt)];
    tryAddThresholdNotification(notifications, config);
    return notifications;
  },
};
