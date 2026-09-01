import { existsSync, readFileSync, writeFileSync, unlinkSync, openSync, statSync } from "fs";
import { join, dirname } from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { loadSettings, saveNotifications, loadNotifications, VN_DIR } from "./config.js";
import { getEnabledPlugins } from "./plugins.js";
import { deduplicateNotifications, sortByPriority, trimNotifications } from "./queue.js";
import { routeToSurfaces } from "./surfaces.js";
import { syncHookFiles } from "./hooks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID_FILE = join(VN_DIR, "daemon.pid");

export async function fetchOnce() {
  // Idempotent — keeps installed hook copies in sync with an upgraded
  // package instead of running stale copies forever (settings mutation
  // stays init-only, see installHooks).
  syncHookFiles();

  const settings = loadSettings();
  const enabledPlugins = await getEnabledPlugins(settings);

  if (enabledPlugins.length === 0) {
    console.log("No plugins enabled. Run 'vibenotifications init' first.");
    return;
  }

  console.log(`Fetching from ${enabledPlugins.length} source(s)...`);

  // Fetch all plugins concurrently — sequential awaits meant one slow/hung
  // source (e.g. a plugin doing several serial HTTP calls) stalled every
  // other source behind it.
  const allNotifications = [];
  const results = await Promise.allSettled(
    enabledPlugins.map(({ plugin, config }) => plugin.fetch(config)),
  );
  results.forEach((result, i) => {
    const { plugin } = enabledPlugins[i];
    if (result.status === "fulfilled") {
      allNotifications.push(...result.value);
      console.log(`  ${plugin.displayName}: ${result.value.length} notifications`);
    } else {
      console.log(`  ${plugin.displayName}: error - ${result.reason?.message ?? result.reason}`);
    }
  });

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
  const daemonLoopScript = join(__dirname, "daemon-loop.js");
  const logPath = join(VN_DIR, "daemon.log");

  // Cap the log instead of letting it grow forever.
  try {
    if (existsSync(logPath) && statSync(logPath).size > 1_000_000) {
      writeFileSync(logPath, "");
    }
  } catch {
    // Non-fatal — worst case the log grows a bit more before next start.
  }
  const log = openSync(logPath, "a");

  const child = spawn(process.execPath, [daemonLoopScript], {
    detached: true,
    stdio: ["ignore", log, log],
  });

  child.unref();
  writeFileSync(PID_FILE, String(child.pid));
  console.log(`Daemon started (PID: ${child.pid}, interval: ${interval}s, log: ${logPath})`);
}

export async function stopDaemon() {
  if (!isDaemonRunning()) {
    console.log("No daemon running.");
    return;
  }

  // isDaemonRunning() can itself unlink a stale PID file between the check
  // above and here — treat any failure in this whole sequence (missing file,
  // dead process) as "already stopped" instead of throwing.
  try {
    const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim());
    try {
      process.kill(pid);
      console.log(`Daemon stopped (PID: ${pid})`);
    } catch {
      console.log("Daemon was not running.");
    }
  } catch {
    console.log("No daemon running.");
  } finally {
    if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
  }
}

export function isDaemonRunning() {
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
