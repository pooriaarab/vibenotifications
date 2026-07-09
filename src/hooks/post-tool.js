#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const VN_DIR = join(homedir(), ".vibenotifications");
const NOTIFICATIONS_FILE = join(VN_DIR, "notifications.json");

// forceInject bypasses the random gate and is trusted enough to use the looser
// sanitizeInternal() — restrict it to sources we ship, not arbitrary plugin data.
const FORCE_INJECT_SOURCES = new Set(["eco"]);

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

  // Spinner verbs are written solely by the daemon (core/surfaces.js), which
  // respects the enabled/maxLength/minSpinner settings — this hook used to
  // duplicate that write but ignored those settings, so disabling the
  // spinner surface didn't actually disable it. The daemon refreshes verbs
  // every fetchInterval (60s default); per-tool-call freshness isn't needed
  // for a list of up to 20 verbs.

  // forceInject: always inject (e.g. eco mode system prompt) — bypasses random gate
  const forced = notifications.find(
    (n) => n.forceInject && n.actionable && FORCE_INJECT_SOURCES.has(n.source)
  );
  if (forced) {
    const safeTitle = sanitize(forced.title);
    // forceInject sources are internal (not external API data) — allow longer body
    const safeBody = sanitizeInternal(forced.body || "");
    console.log(JSON.stringify({
      additionalContext: `<vibenotifications-begin source="${sanitize(forced.source)}">${safeTitle}. ${safeBody}</vibenotifications-end> -- This is an active mode from vibenotifications. Follow these instructions.`,
    }));
    process.exit(0);
    return;
  }

  // Context injection for high-priority actionable items (30% of the time)
  if (Math.random() < 0.3) {
    const actionable = notifications.find((n) => n.actionable && (n.priority === "urgent" || n.priority === "high"));
    if (actionable) {
      // Sanitize external content to prevent prompt injection
      const safeTitle = sanitize(actionable.title);
      const safeBody = sanitize(actionable.body || "");
      const safeUrl = actionable.url && /^https?:\/\/[\x21-\x7e]{1,200}$/.test(actionable.url) ? actionable.url : "";
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

// For internal (non-external-API) sources — allow longer body for system prompt injection
function sanitizeInternal(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/[\x00-\x1f]/g, "")    // strip control characters only
    .slice(0, 800);                  // longer limit for eco prompt
}
