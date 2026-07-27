import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Local-first bridge to the vibe suite: products (viberadio, …) append
// normalized VibeEvents as JSON lines to ~/.vibe/notify.jsonl via vibe-core's
// notify() sink, and this plugin tails that file. No API key, no network.
const DEFAULT_FILE = join(homedir(), ".vibe", "notify.jsonl");

// Match the daemon queue's 24h trim so aged channel lines don't resurface.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Errors and failures surface above routine milestones.
const PRIORITY_BY_KIND = {
  error: "high",
  "tests-fail": "high",
  "task-done": "normal",
  "tests-pass": "normal",
  "pr-opened": "normal",
  "spec-completed": "normal",
  "prototype-finished": "normal",
};

const asString = (v) => (typeof v === "string" && v.length > 0 ? v : undefined);

/**
 * Parse one JSONL line (a VibeEvent) into a notification, or return null for
 * blank/malformed lines. Exported so it can be unit-tested in isolation.
 */
export function parseVibeLine(line, index = 0) {
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    return null;
  }
  if (!event || typeof event.kind !== "string") return null;

  const ts = typeof event.ts === "number" && Number.isFinite(event.ts) ? event.ts : Date.now();
  const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
  const detail =
    asString(payload.message) ??
    asString(payload.summary) ??
    asString(payload.detail) ??
    asString(payload.title) ??
    asString(payload.description);
  const agent = asString(event.agent) ?? "vibe-suite";
  const kind = event.kind;

  return {
    // Stable per line position (the channel file is append-only), so the
    // daemon's id-based dedup upserts instead of duplicating on re-fetch.
    id: `vibe-${ts}-${kind}-${index}`,
    source: "vibe",
    title: `${agent}: ${kind.replace(/-/g, " ")}`,
    body: detail ?? (asString(event.cwd) ? `in ${event.cwd}` : ""),
    url: "",
    priority: PRIORITY_BY_KIND[kind] ?? "low",
    timestamp: new Date(ts).toISOString(),
    actionable: kind === "error" || kind === "tests-fail",
  };
}

export default {
  name: "vibe",
  displayName: "Vibe Suite",
  icon: "VS",

  // Zero-config: the channel is a local file, there is nothing to ask for.
  requiredConfig: {},

  setup: async () => ({ connected: true, channel: "~/.vibe/notify.jsonl" }),

  fetch: async (config) => {
    try {
      // config.file is an undocumented override used by tests.
      const file = asString(config?.file) ?? DEFAULT_FILE;
      if (!existsSync(file)) return [];

      const lines = readFileSync(file, "utf8").split("\n");
      const cutoff = Date.now() - MAX_AGE_MS;
      const notifications = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const n = parseVibeLine(line, i);
        if (n && new Date(n.timestamp).getTime() > cutoff) notifications.push(n);
      }
      return notifications;
    } catch {
      // Silent fail — same pattern as every other plugin's fetch()
      return [];
    }
  },
};
