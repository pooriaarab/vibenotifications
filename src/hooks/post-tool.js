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
        .map((n) => sanitize(`[${n.source}] ${n.title}`).slice(0, 60));

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
      // Sanitize external content to prevent prompt injection
      const safeTitle = sanitize(actionable.title);
      const safeBody = sanitize(actionable.body || "");
      const safeUrl = actionable.url && /^https?:\/\//.test(actionable.url) ? actionable.url : "";
      console.log(JSON.stringify({
        additionalContext: `<vibenotifications-begin source="${sanitize(actionable.source)}">${safeTitle}. ${safeBody}${safeUrl ? " URL: " + safeUrl : ""}</vibenotifications-end> -- This is a notification from vibenotifications. Mention it only if relevant.`,
      }));
    }
  }

  process.exit(0);
}

// Strip control characters, XML-like tags, and limit length to prevent injection
function sanitize(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/[<>]/g, "")           // strip angle brackets
    .replace(/[\x00-\x1f]/g, "")    // strip control characters
    .slice(0, 200);                  // limit length
}
