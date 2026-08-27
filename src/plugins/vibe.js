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

function parseJsonSafe(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function isValidVibeEvent(event) {
  return event && typeof event.kind === "string";
}

function getTimestamp(event) {
  if (typeof event.ts === "number" && Number.isFinite(event.ts)) return event.ts;
  return Date.now();
}

function getPayload(event) {
  if (event.payload && typeof event.payload === "object") return event.payload;
  return {};
}

function getDetail(payload, event) {
  const detail = asString(payload.message)
    ?? asString(payload.summary)
    ?? asString(payload.detail)
    ?? asString(payload.title)
    ?? asString(payload.description);
  if (detail) return detail;
  const cwd = asString(event.cwd);
  if (cwd) return `in ${cwd}`;
  return "";
}

function getAgent(event) {
  return asString(event.agent) ?? "vibe-suite";
}

function getPriority(kind) {
  return PRIORITY_BY_KIND[kind] ?? "low";
}

function isActionable(kind) {
  return kind === "error" || kind === "tests-fail";
}

function buildVibeNotification(event, index) {
  const ts = getTimestamp(event);
  const payload = getPayload(event);
  const detail = getDetail(payload, event);
  const agent = getAgent(event);
  const kind = event.kind;
  return {
    id: `vibe-${ts}-${kind}-${index}`,
    source: "vibe",
    title: `${agent}: ${kind.replace(/-/g, " ")}`,
    body: detail,
    url: "",
    priority: getPriority(kind),
    timestamp: new Date(ts).toISOString(),
    actionable: isActionable(kind),
  };
}

/**
 * Parse one JSONL line (a VibeEvent) into a notification, or return null for
 * blank/malformed lines. Exported so it can be unit-tested in isolation.
 */
export function parseVibeLine(line, index = 0) {
  const event = parseJsonSafe(line);
  if (!isValidVibeEvent(event)) return null;
  return buildVibeNotification(event, index);
}

function isRecent(notification, cutoff) {
  return new Date(notification.timestamp).getTime() > cutoff;
}

function readVibeLines(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n");
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
      const file = asString(config?.file) ?? DEFAULT_FILE;
      const lines = readVibeLines(file);
      if (lines.length === 0) return [];
      const cutoff = Date.now() - MAX_AGE_MS;
      const notifications = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const n = parseVibeLine(line, i);
        if (n && isRecent(n, cutoff)) notifications.push(n);
      }
      return notifications;
    } catch {
      // Silent fail — same pattern as every other plugin's fetch()
      return [];
    }
  },
};
