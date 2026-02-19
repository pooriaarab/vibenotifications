import { existsSync, rmSync } from "fs";
import { VN_DIR } from "../core/config.js";
import { removeHooks } from "../core/hooks.js";
import { stopDaemon } from "../core/daemon.js";

export async function uninstall() {
  console.log("");

  try { await stopDaemon(); } catch {}
  await removeHooks();
  console.log("  Removed Claude Code hooks");

  if (existsSync(VN_DIR)) {
    rmSync(VN_DIR, { recursive: true });
    console.log("  Cleaned up ~/.vibenotifications/");
  }

  console.log("");
  console.log("vibenotifications removed.");
  console.log("");
}
