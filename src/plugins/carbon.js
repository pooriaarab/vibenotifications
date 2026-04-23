import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const VN_DIR = join(homedir(), ".vibenotifications");
const SESSION_FILE = join(VN_DIR, "carbon-session.json");
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

// gCO2 per 1,000 tokens (April 2026)
// Claude 4.x: estimated from Jegham et al. arXiv:2505.09598 model-family scaling.
// GPT/Mistral: Jegham et al. + Mistral LCA 2025 (Carbone 4/ADEME).
const CO2_RATES = {
  // Claude 4.x (April 2026) — est. from Jegham et al. arXiv:2505.09598 model-family scaling
  "claude-sonnet-4-6":         0.85,  // Claude Code default (2026)
  "claude-opus-4-7":           0.55,  // est.
  "claude-haiku-4-5-20251001": 0.10,  // est.
  // OpenAI (April 2026) — est. from Jegham et al. scaling
  "gpt-5.4":                   0.50,
  "gpt-5.4-mini":              0.12,
  "o3":                        5.00,  // reasoning — chain-of-thought multiplier
  "o4-mini":                   1.50,  // smaller reasoning model
  // Mistral — benchmarked (Mistral LCA 2025, Carbone 4/ADEME)
  "mistral-large":             2.85,
};
const VALID_MODELS = Object.keys(CO2_RATES);

// Comparison thresholds — each entry applies when co2 <= maxG
// Sources: Greenspector 2020 (Slack 0.035g), Berners-Lee 2021 (email),
// Obringer et al. 2021 (Zoom ~17g/min), IEA 2020 (Netflix ~0.6g/min),
// EEA 2024 (driving ~170g/km), FootprintFacts (kettle ~70g)
const COMPARISONS = [
  { maxG: 0.01,  text: "fresh session",                    emoji: "🌱" },
  { maxG: 0.07,  text: "1 Slack message",                  emoji: "💬" },
  { maxG: 2,     text: "{n} Slack messages",               emoji: "💬", unit: 0.035 },
  { maxG: 6,     text: "{n} Google searches",              emoji: "🔍", unit: 0.2 },
  { maxG: 15,    text: "{n}% phone charge",                emoji: "📱", unit: 0.09 },
  { maxG: 50,    text: "{n} min of Zoom",                  emoji: "📹", unit: 17 },
  { maxG: 110,   text: "boiling a kettle",                 emoji: "☕" },
  { maxG: 300,   text: "{n}km drive",                      emoji: "🚗", unit: 170 },
  { maxG: 10000, text: "{n} kettles",                      emoji: "☕", unit: 70 },
];

function getComparison(grams) {
  for (const c of COMPARISONS) {
    if (grams <= c.maxG) {
      if (!c.unit) return `${c.emoji} ${c.text}`;
      const n = Math.max(1, Math.round(grams / c.unit));
      return `${c.emoji} ${c.text.replace("{n}", n)}`;
    }
  }
  return `🌍 ${(grams / 1000).toFixed(2)}kg CO₂`;
}

function getOrCreateSession(model) {
  if (!existsSync(VN_DIR)) mkdirSync(VN_DIR, { recursive: true });

  if (existsSync(SESSION_FILE)) {
    try {
      const existing = JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
      // Reset if session is stale (new working day)
      if (Date.now() - existing.startTime < SESSION_MAX_AGE_MS) {
        if (model && !existing.model) {
          existing.model = model;
          writeFileSync(SESSION_FILE, JSON.stringify(existing));
        }
        return existing;
      }
    } catch {
      // Corrupt file — fall through to create fresh
    }
  }

  const session = {
    startTime: Date.now(),
    toolCallCount: 0,
    estimatedTokens: 0,
    model: model || "claude-sonnet-4-6",
    co2Rate: CO2_RATES[model] ?? CO2_RATES["claude-sonnet-4-6"],
  };
  writeFileSync(SESSION_FILE, JSON.stringify(session));
  return session;
}

export default {
  name: "carbon",
  displayName: "Carbon Tracker",
  icon: "🌱",

  requiredConfig: {
    model: {
      label: "Claude model you use in Claude Code",
      type: "string",
      placeholder: "claude-sonnet-4-6",
      instructions:
        `Model selects the CO₂ rate (Jegham et al. 2025, arXiv:2505.09598).\n` +
        `   Options: ${VALID_MODELS.join(", ")}\n` +
        `   Press Enter to use default (claude-sonnet-4-6 = 0.85g/1K tokens)`,
      validate: (value) => {
        const v = value.trim() || "claude-sonnet-4-6";
        if (!CO2_RATES[v]) return `Unknown model. Options: ${VALID_MODELS.join(", ")}`;
        return null;
      },
    },
  },

  setup: async (config) => {
    const model = (config.model || "claude-sonnet-4-6").trim();
    config.model = model; // normalize
    getOrCreateSession(model);
    return { connected: true, tracking: `session CO₂ at ${CO2_RATES[model] ?? 0.85}g/1K tok` };
  },

  fetch: async (config) => {
    const model = (config.model || "claude-sonnet-4-6").trim();
    const rate = CO2_RATES[model] ?? CO2_RATES["claude-sonnet-4-6"];
    const session = getOrCreateSession(model);

    // Estimate tokens: each tool call ≈ 2,000 tokens (input context + output + response delta).
    // Time-based baseline catches reading/thinking between tool calls.
    const toolTokens = (session.toolCallCount || 0) * 2000;
    const elapsedMin = (Date.now() - session.startTime) / 60000;
    const timeTokens = Math.round(elapsedMin * 500);
    const estimatedTokens = Math.max(toolTokens, timeTokens, session.estimatedTokens || 0);

    const co2 = (estimatedTokens / 1000) * rate;
    const comparison = getComparison(co2);
    const kTokens = Math.round(estimatedTokens / 1000);

    // Time-bucketed ID (5-min window) so deduplication refreshes regularly
    const bucket = Math.floor(Date.now() / (5 * 60000));

    return [
      {
        id: `carbon-session-${bucket}`,
        source: "carbon",
        title: `🌱 ${co2.toFixed(1)}g CO₂ · ${comparison}`,
        body: `Session: ~${kTokens}K tokens → ${co2.toFixed(1)}g CO₂e (${model}, ${rate}g/1K tok) | Jegham et al. arXiv:2505.09598`,
        url: "https://carbon-llm.com",
        priority: co2 > 200 ? "high" : co2 > 50 ? "normal" : "low",
        timestamp: new Date().toISOString(),
        actionable: false,
      },
    ];
  },
};
