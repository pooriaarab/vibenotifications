#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const VN_DIR = join(homedir(), ".vibenotifications");
const NOTIFICATIONS_FILE = join(VN_DIR, "notifications.json");

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

  const bySource = {};
  for (const n of notifications) {
    if (!bySource[n.source]) bySource[n.source] = [];
    bySource[n.source].push(n);
  }

  const lines = ["[vibenotifications] Here's what you missed:"];
  for (const [source, notifs] of Object.entries(bySource)) {
    const urgent = notifs.filter((n) => n.priority === "urgent" || n.priority === "high");
    if (urgent.length > 0) {
      lines.push(`  - ${source}: ${notifs.length} (${urgent.length} important: ${urgent[0].title})`);
    } else {
      lines.push(`  - ${source}: ${notifs.length} notifications`);
    }
  }

  // SessionStart stdout is injected into Claude's context
  console.log(lines.join("\n"));
  process.exit(0);
}
