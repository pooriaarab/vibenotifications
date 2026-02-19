#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const VN_DIR = join(homedir(), ".vibenotifications");
const CURRENT = join(VN_DIR, "current-notification.json");
const NOTIFICATIONS_FILE = join(VN_DIR, "notifications.json");

let input = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    render();
  } catch {
    // Silent fail
  }
});

function render() {
  let notification;

  // Try current notification first
  if (existsSync(CURRENT)) {
    const data = JSON.parse(readFileSync(CURRENT, "utf-8"));
    const age = Date.now() - new Date(data.timestamp).getTime();
    if (age < 5 * 60 * 1000) {
      notification = data.notification;
    }
  }

  // Fall back to top notification from queue
  if (!notification && existsSync(NOTIFICATIONS_FILE)) {
    const notifications = JSON.parse(readFileSync(NOTIFICATIONS_FILE, "utf-8"));
    if (notifications.length > 0) {
      notification = notifications[0];
    }
  }

  if (!notification) {
    console.log("\x1b[90mvibenotifications | no new notifications\x1b[0m");
    return;
  }

  const icon = notification.source.toUpperCase();
  console.log(
    `\x1b[33m[${icon}]\x1b[0m ${notification.title}`
  );

  if (notification.url) {
    console.log(
      `\x1b[90m  \x1b]8;;${notification.url}\x07${notification.url}\x1b]8;;\x07\x1b[0m`
    );
  }
}
