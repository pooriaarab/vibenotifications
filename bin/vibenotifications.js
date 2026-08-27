#!/usr/bin/env node

const command = process.argv[2];
const args = process.argv.slice(3);

async function handleInit() {
  const { init } = await import("../src/cli/init.js");
  await init();
}

async function handleDashboard() {
  const { dashboard } = await import("../src/cli/dashboard.js");
  await dashboard();
}

async function handleAdd() {
  const { add } = await import("../src/cli/add.js");
  await add(args[0]);
}

async function handleRemove() {
  const { remove } = await import("../src/cli/remove.js");
  await remove(args[0]);
}

async function handleStart() {
  const { startDaemon } = await import("../src/core/daemon.js");
  await startDaemon();
}

async function handleStop() {
  const { stopDaemon } = await import("../src/core/daemon.js");
  await stopDaemon();
}

async function handleFetch() {
  const { fetchOnce } = await import("../src/core/daemon.js");
  await fetchOnce();
}

async function handleUninstall() {
  const { uninstall } = await import("../src/cli/uninstall.js");
  await uninstall();
}

async function handleHelp() {
  console.log(`vibenotifications -- customizable notifications for Claude Code

Usage:
  vibenotifications                 Interactive setup wizard
  vibenotifications init            Interactive setup wizard
  vibenotifications dashboard       View all notifications
  vibenotifications add <plugin>    Enable a new source
  vibenotifications remove <plugin> Disable a source
  vibenotifications start           Start notification daemon
  vibenotifications stop            Stop notification daemon
  vibenotifications fetch           Fetch notifications once (no daemon)
  vibenotifications uninstall       Remove everything

Plugins: ${await pluginList()}`);
}

const handlers = {
  init: handleInit,
  dashboard: handleDashboard,
  add: handleAdd,
  remove: handleRemove,
  start: handleStart,
  stop: handleStop,
  fetch: handleFetch,
  uninstall: handleUninstall,
  help: handleHelp,
  "--help": handleHelp,
  "-h": handleHelp,
};

async function main() {
  if (command === undefined) {
    await handleInit();
    return;
  }
  if (Object.hasOwn(handlers, command)) {
    await handlers[command]();
    return;
  }
  console.log(`Unknown command: ${command}

vibenotifications -- customizable notifications for Claude Code

Usage:
  vibenotifications                 Interactive setup wizard
  vibenotifications init            Interactive setup wizard
  vibenotifications dashboard       View all notifications
  vibenotifications add <plugin>    Enable a new source
  vibenotifications remove <plugin> Disable a source
  vibenotifications start           Start notification daemon
  vibenotifications stop            Stop notification daemon
  vibenotifications fetch           Fetch notifications once (no daemon)
  vibenotifications uninstall       Remove everything

Plugins: ${await pluginList()}`);
  process.exit(1);
}

async function pluginList() {
  const { loadPlugins } = await import("../src/core/plugins.js");
  const plugins = await loadPlugins();
  return Object.keys(plugins).sort().join(", ");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
