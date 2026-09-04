import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Local-first bridge to OffRouter: OffRouter appends privacy-safe routing,
// spend, limit, and provider events as JSON lines. No API key, no network.
const DEFAULT_HOME_DIRS = [
  join(homedir(), ".offrouter-personal"),
  join(homedir(), ".offrouter-work"),
];

// Match the daemon queue's 24h trim so aged channel lines don't resurface.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const EVENT_TYPES = [
  "route",
  "near_limit",
  "subscription_exhausted",
  "api_key_fallback",
  "provider_error",
];
const DEFAULT_TYPES = EVENT_TYPES.filter((type) => type !== "route");
const SEVERITY_RANK = { info: 0, warn: 1, error: 2 };
const PRIORITY_BY_SEVERITY = { info: "low", warn: "high", error: "high" };
const ICON_BY_SEVERITY = { info: "i", warn: "!", error: "x" };

const asString = (v) => (typeof v === "string" && v.length > 0 ? v : undefined);
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function expandHome(path) {
  const value = asString(path);
  if (!value) return undefined;
  if (value === "~") return homedir();
  if (value.startsWith("~/")) return join(homedir(), value.slice(2));
  return value;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function defaultHomes() {
  const homes = DEFAULT_HOME_DIRS.map((dir) => join(dir, "notify.jsonl"));
  const offrouterHome = expandHome(process.env.OFFROUTER_HOME);
  if (offrouterHome) homes.push(join(offrouterHome, "notify.jsonl"));
  return unique(homes);
}

function notifyPath(path) {
  const expanded = expandHome(path);
  if (!expanded) return undefined;
  return expanded.endsWith("notify.jsonl") ? expanded : join(expanded, "notify.jsonl");
}

function configuredHomes(config) {
  const homes = config?.homes;
  if (Array.isArray(homes)) return unique(homes.map(notifyPath));
  if (asString(homes)) return unique([notifyPath(homes)]);
  return defaultHomes();
}

function configuredTypes(config) {
  const input = config?.types;
  const values = Array.isArray(input) ? input : asString(input)?.split(",");
  const types = values
    ? values.map((type) => type.trim()).filter((type) => EVENT_TYPES.includes(type))
    : DEFAULT_TYPES;
  const effectiveTypes = config?.showRoutes ? [...types, "route"] : types;
  return new Set(effectiveTypes);
}

function configuredMinSeverity(config) {
  const severity = asString(config?.minSeverity);
  if (severity && hasOwn(SEVERITY_RANK, severity)) return severity;
  return "warn";
}

function shouldSurface(event, config) {
  const types = configuredTypes(config);
  const minSeverity = configuredMinSeverity(config);
  const explicitMinSeverity = hasOwn(config ?? {}, "minSeverity");
  if (event.type === "route" && config?.showRoutes && !explicitMinSeverity) return true;
  return types.has(event.type) && SEVERITY_RANK[event.severity] >= SEVERITY_RANK[minSeverity];
}

function eventBody(event) {
  const route = [asString(event.provider), asString(event.model)].filter(Boolean).join(" / ");
  const profile = asString(event.profile);
  return `${event.type}${profile ? ` via ${profile}` : ""}${route ? `: ${route}` : ""}`;
}

function parseJsonSafe(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function hasValidStructure(event) {
  return event && typeof event === "object" && !Array.isArray(event);
}

function hasValidType(event) {
  return EVENT_TYPES.includes(event.type);
}

function hasValidSeverity(event) {
  return hasOwn(SEVERITY_RANK, event.severity);
}

function extractMessage(event) {
  return asString(event.message) ?? null;
}

function buildTimestamp(event) {
  const parsed = asString(event.ts) ? Date.parse(event.ts) : NaN;
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return new Date().toISOString();
}

function parseEvent(line) {
  const event = parseJsonSafe(line);
  if (!hasValidStructure(event)) return null;
  if (!hasValidType(event)) return null;
  if (!hasValidSeverity(event)) return null;
  const message = extractMessage(event);
  if (!message) return null;
  const timestamp = buildTimestamp(event);
  return { ...event, home: asString(event.home) ?? "unknown", message, timestamp };
}

function notificationFromEvent(event, index) {
  const severity = event.severity;

  return {
    // Stable per line position and OffRouter home, so personal/work files do not
    // collide in the daemon's id-based dedup.
    id: `offrouter-${event.home}-${event.timestamp}-${event.type}-${index}`,
    source: "offrouter",
    title: `${ICON_BY_SEVERITY[severity]} ${event.message}`,
    body: eventBody(event),
    url: "",
    priority: PRIORITY_BY_SEVERITY[severity],
    timestamp: event.timestamp,
    actionable: severity !== "info",
  };
}

/**
 * Parse one JSONL line (an OffRouter event) into a notification, or return null
 * for blank/malformed lines. Exported so it can be unit-tested in isolation.
 */
export function parseOffrouterLine(line, index = 0) {
  const event = parseEvent(line);
  return event ? notificationFromEvent(event, index) : null;
}

function processFileLines(file, config, cutoff, notifications) {
  if (!existsSync(file)) return;
  let lines;
  try {
    lines = readFileSync(file, "utf8").split("\n");
  } catch {
    return;
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const event = parseEvent(line);
    if (!event) continue;
    if (new Date(event.timestamp).getTime() <= cutoff || !shouldSurface(event, config)) continue;
    notifications.push(notificationFromEvent(event, i));
  }
}

export default {
  name: "offrouter",
  displayName: "OffRouter",
  icon: "OR",

  // Zero-config: channels are local files, there is nothing to ask for.
  requiredConfig: {},

  setup: async (config) => ({ connected: true, channels: configuredHomes(config).length }),

  fetch: async (config) => {
    try {
      const homes = configuredHomes(config);
      const cutoff = Date.now() - MAX_AGE_MS;
      const notifications = [];
      for (const file of homes) {
        processFileLines(file, config, cutoff, notifications);
      }
      return notifications;
    } catch {
      // Silent fail -- same pattern as every other plugin's fetch()
      return [];
    }
  },
};
