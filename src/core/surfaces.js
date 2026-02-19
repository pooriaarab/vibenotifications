import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { filterByMinPriority, sortByPriority } from "./queue.js";
import { VN_DIR } from "./config.js";

const CLAUDE_SETTINGS = join(homedir(), ".claude", "settings.json");
const CURRENT_NOTIFICATION = join(VN_DIR, "current-notification.json");

export function routeToSurfaces(notifications, surfaceConfig, priorityConfig) {
  if (!notifications.length) return;

  const sorted = sortByPriority(notifications);

  // Spinner verbs: short titles from notifications
  if (surfaceConfig.spinnerVerbs?.enabled) {
    updateSpinnerVerbs(sorted, surfaceConfig.spinnerVerbs, priorityConfig);
  }

  // Status line: top priority notification
  if (surfaceConfig.statusLine?.enabled) {
    updateStatusLine(sorted[0]);
  }
}

function updateSpinnerVerbs(notifications, config, priorityConfig) {
  try {
    if (!existsSync(CLAUDE_SETTINGS)) return;
    const settings = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf-8"));

    const maxLen = config.maxLength || 60;
    const filtered = filterByMinPriority(notifications, priorityConfig.minSpinner || "normal");

    const verbs = filtered
      .map((n) => {
        const prefix = `[${n.source}]`;
        const title = n.title.slice(0, maxLen - prefix.length - 1);
        return `${prefix} ${title}`;
      })
      .slice(0, 20);

    if (verbs.length > 0) {
      settings.spinnerVerbs = { mode: "replace", verbs };
      writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2));
    }
  } catch {
    // Never break Claude Code
  }
}

function updateStatusLine(notification) {
  try {
    writeFileSync(
      CURRENT_NOTIFICATION,
      JSON.stringify({
        notification,
        timestamp: new Date().toISOString(),
      })
    );
  } catch {
    // Silent fail
  }
}

export function getSessionSummary(notifications) {
  if (!notifications.length) return null;

  const bySource = {};
  for (const n of notifications) {
    if (!bySource[n.source]) bySource[n.source] = [];
    bySource[n.source].push(n);
  }

  const lines = ["[vibenotifications] Here's what you missed:"];
  for (const [source, notifs] of Object.entries(bySource)) {
    const urgent = notifs.filter((n) => n.priority === "urgent" || n.priority === "high");
    if (urgent.length > 0) {
      lines.push(`  - ${source}: ${notifs.length} notifications (${urgent.length} important: ${urgent[0].title})`);
    } else {
      lines.push(`  - ${source}: ${notifs.length} notifications`);
    }
  }

  return lines.join("\n");
}

export function getContextInjection(notifications, priorityConfig) {
  const filtered = filterByMinPriority(notifications, priorityConfig.minContextInjection || "high");
  const actionable = filtered.filter((n) => n.actionable);

  if (actionable.length === 0) return null;

  const top = actionable[0];
  return `[vibenotifications] ${top.title}. ${top.body || ""} ${top.url ? "Link: " + top.url : ""} -- Mention this naturally only if relevant to what you're helping with.`;
}
