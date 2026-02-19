import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { loadSettings, saveNotifications, loadNotifications, VN_DIR } from "./config.js";
import { getEnabledPlugins } from "./plugins.js";
import { deduplicateNotifications, sortByPriority, trimNotifications } from "./queue.js";
import { routeToSurfaces } from "./surfaces.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID_FILE = join(VN_DIR, "daemon.pid");

export async function fetchOnce() {
  const settings = loadSettings();
  const enabledPlugins = await getEnabledPlugins(settings);

  if (enabledPlugins.length === 0) {
    console.log("No plugins enabled. Run 'vibenotifications init' first.");
    return;
  }

  console.log(`Fetching from ${enabledPlugins.length} source(s)...`);

  const allNotifications = [];
  for (const { plugin, config } of enabledPlugins) {
    try {
      const notifications = await plugin.fetch(config);
      allNotifications.push(...notifications);
      console.log(`  ${plugin.displayName}: ${notifications.length} notifications`);
    } catch (err) {
      console.log(`  ${plugin.displayName}: error - ${err.message}`);
    }
  }

  const existing = loadNotifications();
  const merged = deduplicateNotifications(existing, allNotifications);
  const trimmed = trimNotifications(merged);
  const sorted = sortByPriority(trimmed);

  saveNotifications(sorted);
  routeToSurfaces(sorted, settings.surfaces, settings.priority);

  console.log(`Total: ${sorted.length} notifications routed to surfaces.`);
}

export async function startDaemon() {
  if (isDaemonRunning()) {
    console.log("Daemon is already running.");
    return;
  }

  const settings = loadSettings();
  const interval = settings.fetchInterval || 60;
  const daemonScript = join(__dirname, "daemon.js");

  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
      const mod = await import("file://${daemonScript.replace(/\\/g, "/")}");
      while (true) {
        try { await mod.fetchOnce(); } catch (e) { console.error(e); }
        await new Promise(r => setTimeout(r, ${interval * 1000}));
      }
      `,
    ],
    {
      detached: true,
      stdio: "ignore",
    }
  );

  child.unref();
  writeFileSync(PID_FILE, String(child.pid));
  console.log(`Daemon started (PID: ${child.pid}, interval: ${interval}s)`);
}

export async function stopDaemon() {
  if (!isDaemonRunning()) {
    console.log("No daemon running.");
    return;
  }

  const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim());
  try {
    process.kill(pid);
    console.log(`Daemon stopped (PID: ${pid})`);
  } catch {
    console.log("Daemon was not running.");
  }
  unlinkSync(PID_FILE);
}

function isDaemonRunning() {
  if (!existsSync(PID_FILE)) return false;
  const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim());
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    unlinkSync(PID_FILE);
    return false;
  }
}
