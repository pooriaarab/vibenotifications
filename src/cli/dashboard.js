import { join } from "path";

import { VN_DIR, loadNotifications, loadSettings } from "../core/config.js";
import { isDaemonRunning } from "../core/daemon.js";

export async function dashboard() {
  const settings = loadSettings();
  const notifications = loadNotifications();

  console.log("");
  console.log("vibenotifications Dashboard");
  console.log("----------------------------");

  if (notifications.length === 0) {
    console.log("No notifications yet. Run 'vibenotifications fetch' to check.");
  } else {
    const bySource = {};
    for (const n of notifications) {
      if (!bySource[n.source]) bySource[n.source] = [];
      bySource[n.source].push(n);
    }

    for (const [source, notifs] of Object.entries(bySource)) {
      const urgent = notifs.filter((n) => n.priority === "urgent" || n.priority === "high");
      console.log(`  ${source}: ${notifs.length} notifications${urgent.length ? ` (${urgent.length} important)` : ""}`);
      for (const n of notifs.slice(0, 3)) {
        console.log(`    - ${n.title}`);
      }
    }
  }

  console.log("");

  const enabledSources = Object.entries(settings.sources).filter(([, c]) => c.enabled).map(([n]) => n);
  console.log(`Sources:    ${enabledSources.join(", ") || "none"}`);

  const daemonRunning = isDaemonRunning();
  console.log(`Daemon:     ${daemonRunning ? "running" : "stopped"}`);
  console.log(`Interval:   ${settings.fetchInterval}s`);
  if (daemonRunning) console.log(`Log:        ${join(VN_DIR, "daemon.log")}`);
  console.log("");
}
