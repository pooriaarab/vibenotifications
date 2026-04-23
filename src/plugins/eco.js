// Eco Mode — reduce token/CO2 usage without compromising output quality.
//
// Inspired by the caveman skill (github.com/juliusbrussee/caveman):
// "why use many token when few do trick" — ~75% output token reduction, 0% quality loss.
// Key insight: compress the MOUTH (output tokens), NOT the BRAIN (thinking/reasoning).
// Same accuracy, less carbon.
//
// This plugin works via vibenotifications' context injection surface:
// high-priority notifications are injected into Claude's context at the configured rate.
// Eco mode sets injection to 100% so the eco prompt is always present.

const ECO_PROMPTS = {
  lite: `ECO MODE (lite) active — drop filler words, pleasantries, hedging. Keep all technical substance. No trailing summaries of what you just did.`,

  full: `ECO MODE (full) active:
- Compress output: drop filler, hedging, pleasantries. Fragments OK. Technical substance 100%.
- Batch tool calls: read multiple files in one message, not sequentially one-by-one.
- Avoid re-reading files you've already read this session.
- For simple lookups/grepping: note that claude-haiku-3-5 uses 8.5x less CO₂ than claude-sonnet-3-5 (0.10g vs 0.85g per 1K tokens). Flag sub-tasks that could use a smaller model.
Pattern: [finding] [action] [reason]. No throat-clearing.`,

  ultra: `ECO MODE (ultra) active — strict token discipline:
- Terse output only. Pattern: [thing] [action] [reason]. [next step]. Fragments. No filler.
- Batch ALL tool calls in a single message. Never read a file twice.
- Before each tool call: ask "is this necessary?" Skip git status unless asked.
- Sub-task model tiers: Haiku=0.10g/1Ktok, Sonnet=0.85g/1Ktok, Opus=0.45g/1Ktok. Flag downgrade opportunities.
- No summaries. No "I'll now...". No "Great, I've...". Just the output.
CAVEMAN RULE: why use many token when few do trick.`,
};

// Estimated token savings by level (from caveman benchmarks)
const SAVINGS = { lite: 30, full: 65, ultra: 80 };

export default {
  name: "eco",
  displayName: "Eco Mode",
  icon: "♻️",

  requiredConfig: {
    level: {
      label: "Eco intensity level",
      type: "select",
      options: ["lite", "full", "ultra"],
      default: "full",
      instructions:
        "lite: compress output only (~30% token savings)\n" +
        "   full: compress + batch tool calls + model suggestions (~65% savings)\n" +
        "   ultra: maximum discipline, terse output, strict batching (~80% savings)\n" +
        "   All levels preserve 100% technical accuracy (Jegham et al. 2025 / caveman benchmarks).",
    },
    threshold: {
      label: "CO₂ alert threshold (grams)",
      type: "string",
      default: "50",
      instructions:
        "Send a high-priority alert when your carbon tracker exceeds this many grams.\n" +
        "   Set to 0 to disable threshold alerts.",
    },
  },

  setup: async (config) => {
    const level = config.level || "full";
    const savings = SAVINGS[level] || 65;
    return { connected: true, tracking: `eco-${level} · ~${savings}% token savings` };
  },

  fetch: async (config) => {
    const level = config.level || "full";
    const savings = SAVINGS[level] || 65;
    const prompt = ECO_PROMPTS[level];

    // Primary: always-on context injection with the eco prompt
    const notifications = [
      {
        id: "eco-mode-active",
        source: "eco",
        title: `♻️ ECO ${level.toUpperCase()} · ~${savings}% token savings`,
        // body is injected into Claude's context — this IS the system prompt modifier
        body: prompt,
        priority: "high",
        url: "https://github.com/pooriaarab/vibenotifications",
        timestamp: new Date().toISOString(),
        actionable: false,
        // Signal to the context injection hook to always inject (override 30% default)
        forceInject: true,
      },
    ];

    // Threshold alert: check carbon-session.json if it exists
    try {
      const { readFileSync, existsSync } = await import("fs");
      const { join } = await import("path");
      const { homedir } = await import("os");
      const sessionFile = join(homedir(), ".vibenotifications", "carbon-session.json");

      if (existsSync(sessionFile)) {
        const session = JSON.parse(readFileSync(sessionFile, "utf-8"));
        const thresholdG = parseFloat(config.threshold) || 50;
        const toolTokens = (session.toolCallCount || 0) * 2000;
        const elapsedMin = (Date.now() - session.startTime) / 60000;
        const timeTokens = Math.round(elapsedMin * 500);
        const estimatedTokens = Math.max(toolTokens, timeTokens);
        const co2 = (estimatedTokens / 1000) * 0.85; // use Sonnet rate as worst case

        if (thresholdG > 0 && co2 >= thresholdG) {
          notifications.push({
            id: `eco-threshold-${Math.floor(co2 / thresholdG)}`,
            source: "eco",
            title: `⚠️ ${co2.toFixed(0)}g CO₂ this session — consider switching to Haiku for simple tasks`,
            body: `You've hit your ${thresholdG}g eco alert. Haiku is 8.5x greener for reads, searches, and formatting tasks.`,
            priority: "high",
            url: "https://github.com/pooriaarab/vibenotifications",
            timestamp: new Date().toISOString(),
            actionable: true,
          });
        }
      }
    } catch {
      // Silent — carbon plugin may not be installed
    }

    return notifications;
  },
};
