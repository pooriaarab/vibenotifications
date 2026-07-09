import { readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { atomicWriteFileSync } from "../core/atomic-write.js";
import { CO2_RATES, getComparison } from "../core/co2-rates.js";

const VN_DIR = join(homedir(), ".vibenotifications");
const SESSION_FILE = join(VN_DIR, "carbon-session.json");
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

const VALID_MODELS = Object.keys(CO2_RATES);

function getOrCreateSession(model) {
  if (!existsSync(VN_DIR)) mkdirSync(VN_DIR, { recursive: true });

  if (existsSync(SESSION_FILE)) {
    try {
      const existing = JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
      // Reset if session is stale (new working day)
      if (Date.now() - existing.startTime < SESSION_MAX_AGE_MS) {
        if (model && !existing.model) {
          existing.model = model;
          atomicWriteFileSync(SESSION_FILE, JSON.stringify(existing));
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
  atomicWriteFileSync(SESSION_FILE, JSON.stringify(session));
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

    return [
      {
        // Stable id: one carbon notification per session, updated in place by
        // queue.js's upsert-by-id merge (was time-bucketed, which accumulated
        // a new "seen" id every 5 min instead of replacing the prior one).
        id: "carbon-session",
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
