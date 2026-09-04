// Single source of truth for CO2 rate/comparison data used by carbon.js, eco.js,
// and statusline.js. statusline.js is copied standalone to ~/.vibenotifications/
// (see core/hooks.js installHooks) so this file is copied alongside it into
// ~/.vibenotifications/core/co2-rates.js, preserving the same relative path.

// gCO2 per 1,000 tokens (April 2026)
// Claude 4.x: estimated from Jegham et al. arXiv:2505.09598 model-family scaling.
// GPT/Mistral: Jegham et al. + Mistral LCA 2025 (Carbone 4/ADEME).
export const CO2_RATES = {
  // Claude 4.x (April 2026) — est. from Jegham et al. arXiv:2505.09598 model-family scaling
  "claude-sonnet-4-6": 0.85, // Claude Code default (2026)
  "claude-opus-4-7": 0.55, // est.
  "claude-haiku-4-5-20251001": 0.1, // est.
  // OpenAI (April 2026) — est. from Jegham et al. scaling
  "gpt-5.4": 0.5,
  "gpt-5.4-mini": 0.12,
  o3: 5.0, // reasoning — chain-of-thought multiplier
  "o4-mini": 1.5, // smaller reasoning model
  // Mistral — benchmarked (Mistral LCA 2025, Carbone 4/ADEME)
  "mistral-large": 2.85,
};

export const DEFAULT_MODEL = "claude-sonnet-4-6";
export const DEFAULT_CO2_RATE = CO2_RATES[DEFAULT_MODEL];

// Comparison thresholds — each entry applies when co2 <= maxG
// Sources: Greenspector 2020 (Slack 0.035g), Berners-Lee 2021 (email),
// Obringer et al. 2021 (Zoom ~17g/min), IEA 2020 (Netflix ~0.6g/min),
// EEA 2024 (driving ~170g/km), FootprintFacts (kettle ~70g)
export const COMPARISONS = [
  { maxG: 0.01, text: "fresh session", emoji: "🌱" },
  { maxG: 0.07, text: "1 Slack message", emoji: "💬" },
  { maxG: 2, text: "{n} Slack messages", emoji: "💬", unit: 0.035 },
  { maxG: 6, text: "{n} Google searches", emoji: "🔍", unit: 0.2 },
  { maxG: 15, text: "{n}% phone charge", emoji: "📱", unit: 0.09 },
  { maxG: 50, text: "{n} min of Zoom", emoji: "📹", unit: 17 },
  { maxG: 110, text: "boiling a kettle", emoji: "☕" },
  { maxG: 300, text: "{n}km drive", emoji: "🚗", unit: 170 },
  { maxG: 10000, text: "{n} kettles", emoji: "☕", unit: 70 },
];

export function getComparison(grams) {
  for (const c of COMPARISONS) {
    if (grams <= c.maxG) {
      if (!c.unit) return `${c.emoji} ${c.text}`;
      const n = Math.max(1, Math.round(grams / c.unit));
      return `${c.emoji} ${c.text.replace("{n}", n)}`;
    }
  }
  return `🌍 ${(grams / 1000).toFixed(2)}kg CO₂`;
}
