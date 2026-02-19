#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const VN_DIR = join(homedir(), ".vibenotifications");
const NOTIFICATIONS_FILE = join(VN_DIR, "notifications.json");
const CLAUDE_SETTINGS = join(homedir(), ".claude", "settings.json");

let input = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    run();
  } catch {
    process.exit(0);
  }
});

function run() {
  if (!existsSync(NOTIFICATIONS_FILE)) {
    process.exit(0);
    return;
  }

  const notifications = JSON.parse(readFileSync(NOTIFICATIONS_FILE, "utf-8"));
  if (!notifications.length) {
    process.exit(0);
    return;
  }

  // Update spinner verbs with latest notifications
  try {
    if (existsSync(CLAUDE_SETTINGS)) {
      const settings = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf-8"));
      const verbs = notifications
        .slice(0, 20)
        .map((n) => `[${n.source}] ${n.title}`.slice(0, 60));

      if (verbs.length > 0) {
        settings.spinnerVerbs = { mode: "replace", verbs };
        writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2));
      }
    }
  } catch {
    // Silent fail
  }

  // Context injection for high-priority actionable items (30% of the time)
  if (Math.random() < 0.3) {
    const actionable = notifications.find((n) => n.actionable && (n.priority === "urgent" || n.priority === "high"));
    if (actionable) {
      console.log(JSON.stringify({
        additionalContext: `[vibenotifications] ${actionable.title}. ${actionable.body || ""} ${actionable.url ? "URL: " + actionable.url : ""} -- Mention this naturally if relevant.`,
      }));
    }
  }

  process.exit(0);
}
