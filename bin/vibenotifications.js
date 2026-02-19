#!/usr/bin/env node

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
  switch (command) {
    case "init": {
      const { init } = await import("../src/cli/init.js");
      await init();
      break;
    }
    case "dashboard": {
      const { dashboard } = await import("../src/cli/dashboard.js");
      await dashboard();
      break;
    }
    case "add": {
      const { add } = await import("../src/cli/add.js");
      await add(args[0]);
      break;
    }
    case "remove": {
      const { remove } = await import("../src/cli/remove.js");
      await remove(args[0]);
      break;
    }
    case "start": {
      const { startDaemon } = await import("../src/core/daemon.js");
      await startDaemon();
      break;
    }
    case "stop": {
      const { stopDaemon } = await import("../src/core/daemon.js");
      await stopDaemon();
      break;
    }
    case "fetch": {
      const { fetchOnce } = await import("../src/core/daemon.js");
      await fetchOnce();
      break;
    }
    case "uninstall": {
      const { uninstall } = await import("../src/cli/uninstall.js");
      await uninstall();
      break;
    }
    case "help":
    case "--help":
    case "-h":
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

Plugins: apple-calendar, email, github, google-calendar, mcp-bridge, slack, stocks, x`);
      break;
    default: {
      const { init } = await import("../src/cli/init.js");
      await init();
    }
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
