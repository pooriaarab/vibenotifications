import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const VN_DIR = join(homedir(), ".vibenotifications");
const SESSION_FILE = join(VN_DIR, "carbon-session.json");

// gCO2 per 1,000 tokens — Jegham et al. arXiv:2505.09598 (2025)
const CO2_RATES = {
  "claude-sonnet-3-5": 0.85,
  "claude-haiku-3-5": 0.10,
  "claude-opus-3": 0.45,
  "gpt-4o": 0.37,
  "gpt-4o-mini": 0.10,
  "mistral-large": 2.85,
};

// Comparison thresholds in grams CO2
// Sources: Greenspector 2020 (Slack), Berners-Lee 2021 (email),
// Obringer et al. 2021 (Zoom), IEA 2020 (Netflix), EEA 2024 (driving)
const COMPARISONS = [
  { maxG: 0.07,  text: "1 Slack message",                  emoji: "💬" }, // 0.035g each
  { maxG: 0.5,   text: "{n} Slack messages",               emoji: "💬", unit: 0.035 },
  { maxG: 3,     text: "{n} Google searches",              emoji: "🔍", unit: 0.2 },
  { maxG: 15,    text: "{n}% phone charge",                emoji: "📱", unit: 0.09 },  // ~9g full charge (US grid)
  { maxG: 50,    text: "{n} min of Zoom video",            emoji: "📹", unit: 17 },    // 17g/min (Obringer 2021)
  { maxG: 110,   text: "boiling a kettle",                 emoji: "☕" },              // ~70g
  { maxG: 300,   text: "{n}km drive",                      emoji: "🚗", unit: 170 },   // 170g/km (EEA 2024)
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

function getOrCreateSession() {
  if (!existsSync(VN_DIR)) mkdirSync(VN_DIR, { recursive: true });
  if (existsSync(SESSION_FILE)) {
    try {
      return JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
    } catch {
      // Fall through to create new
    }
  }
  const session = { startTime: Date.now(), toolCallCount: 0, estimatedTokens: 0 };
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
      type: "select",
      options: Object.keys(CO2_RATES),
      default: "claude-sonnet-3-5",
      instructions:
        "Selects the CO₂ rate used for estimation (Jegham et al. 2025, arXiv:2505.09598).\n" +
        "  claude-sonnet-3-5: 0.85g/1K tokens  |  claude-haiku-3-5: 0.10g/1K tokens",
    },
  },

  setup: async () => {
    getOrCreateSession();
    return { connected: true, tracking: "session CO₂" };
  },

  fetch: async (config) => {
    const session = getOrCreateSession();
    const rate = CO2_RATES[config.model] ?? CO2_RATES["claude-sonnet-3-5"];

    // Estimate tokens: tool calls are the most reliable signal from Claude Code hooks.
    // Each tool call averages ~2,000 tokens (input context + tool output + response delta).
    // Also add time-based baseline: ~500 tokens/min for reading/thinking between tool calls.
    const toolTokens = (session.toolCallCount || 0) * 2000;
    const elapsedMin = (Date.now() - session.startTime) / 60000;
    const timeTokens = Math.round(elapsedMin * 500);
    const estimatedTokens = Math.max(toolTokens, timeTokens, session.estimatedTokens || 0);

    const co2 = (estimatedTokens / 1000) * rate;
    const comparison = getComparison(co2);
    const kTokens = Math.round(estimatedTokens / 1000);

    return [
      {
        id: `carbon-session-${Math.floor(session.startTime / 60000)}`,
        source: "carbon",
        title: `🌱 ${co2.toFixed(1)}g CO₂ · ${comparison}`,
        body: `Session: ~${kTokens}K tokens → ${co2.toFixed(1)}g CO₂e (${config.model}, ${rate}g/1K tok)\nSource: Jegham et al. arXiv:2505.09598`,
        url: "https://carbon-llm.com",
        priority: co2 > 200 ? "high" : co2 > 50 ? "normal" : "low",
        timestamp: new Date().toISOString(),
        actionable: false,
      },
    ];
  },
};
