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

const SESSION_FILE = join(homedir(), ".vibenotifications", "carbon-session.json");

// Default CO₂ rate used for threshold estimates when carbon plugin not configured
const DEFAULT_CO2_RATE = 0.85; // claude-sonnet-4, g per 1K tokens

const ECO_PROMPTS = {
  lite: `ECO MODE (lite): Drop filler words, pleasantries, hedging. Keep all technical substance. No trailing summaries of what you just did.`,

  full: `ECO MODE (full):
- Compress output: drop filler, hedging, pleasantries. Fragments OK. 100% technical substance.
- Batch tool calls: read multiple files in one message, not sequentially.
- Avoid re-reading files you've already read this session.
- For simple lookups/grepping: claude-haiku-3-5 uses 8.5x less CO2 than claude-sonnet-4 (0.10g vs 0.85g per 1K tokens). Flag sub-tasks that could use a smaller model.
Pattern: [finding] [action] [reason]. No throat-clearing.`,

  ultra: `ECO MODE (ultra) — strict token discipline:
- Terse output only. Pattern: [thing] [action] [reason]. [next step]. Fragments. No filler.
- Batch ALL tool calls. Never read a file twice.
- Before each tool call: ask "is this necessary?" Skip git status unless asked.
- Flag model downgrade opportunities: Haiku=0.10g/1Ktok, Sonnet=0.85g/1Ktok, Opus=0.45g/1Ktok.
- No summaries. No "I'll now...". No "Great, I've...". Just the output.
CAVEMAN RULE: why use many token when few do trick.`,
};

const SAVINGS = { lite: 30, full: 65, ultra: 80 };
const VALID_LEVELS = Object.keys(ECO_PROMPTS);

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
    const level = (config.level || "full").trim().toLowerCase();
    const savings = SAVINGS[level] || 65;
    const prompt = ECO_PROMPTS[level] || ECO_PROMPTS.full;

    const notifications = [
      {
        id: "eco-mode-active",
        source: "eco",
        title: `♻️ ECO ${level.toUpperCase()} · ~${savings}% token savings`,
        body: prompt,
        priority: "high",
        url: "https://github.com/pooriaarab/vibenotifications",
        timestamp: new Date().toISOString(),
        // actionable:true enables the standard context injection path.
        // forceInject:true signals post-tool.js to bypass the 30% random gate.
        actionable: true,
        forceInject: true,
      },
    ];

    // Threshold alert: check carbon session for current CO₂ estimate
    const thresholdG = parseFloat(config.threshold) || 50;
    if (thresholdG > 0 && existsSync(SESSION_FILE)) {
      try {
        const session = JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
        const rate = session.co2Rate ?? DEFAULT_CO2_RATE;
        const toolTokens = (session.toolCallCount || 0) * 2000;
        const elapsedMin = (Date.now() - session.startTime) / 60000;
        const estimatedTokens = Math.max(toolTokens, Math.round(elapsedMin * 500));
        const co2 = (estimatedTokens / 1000) * rate;

        if (co2 >= thresholdG) {
          notifications.push({
            id: `eco-threshold-${Math.floor(co2 / thresholdG)}`,
            source: "eco",
            title: `⚠️ ${co2.toFixed(0)}g CO₂ this session — consider switching to Haiku for simple tasks`,
            body: `Hit your ${thresholdG}g eco alert. Haiku is 8.5× greener for reads, searches, and formatting tasks.`,
            priority: "high",
            url: "https://github.com/pooriaarab/vibenotifications",
            timestamp: new Date().toISOString(),
            actionable: true,
          });
        }
      } catch {
        // Carbon plugin not installed or session file unreadable — skip threshold check
      }
    }

    return notifications;
  },
};
