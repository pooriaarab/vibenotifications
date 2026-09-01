import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { filterByMinPriority, sortByPriority } from "./queue.js";
import { VN_DIR } from "./config.js";
import { atomicWriteFileSync } from "./atomic-write.js";

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
      atomicWriteFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2));
    }
  } catch {
    // Never break Claude Code
  }
}

function updateStatusLine(notification) {
  try {
    atomicWriteFileSync(
      CURRENT_NOTIFICATION,
      JSON.stringify({
        notification,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch {
    // Silent fail
  }
}

// Session-summary and context-injection surfaces are owned by the hook files
// (src/hooks/session-start.js, src/hooks/post-tool.js), not this module —
// those hooks run standalone (copied out of the dev tree, can't import from
// core/) and have since evolved (forceInject support) independently of the
// versions that used to live here. Keeping both around was dead code drifting
// from the real implementation.
