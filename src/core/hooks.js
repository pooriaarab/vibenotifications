import { readFileSync, existsSync, copyFileSync, chmodSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { VN_DIR } from "./config.js";
import { atomicWriteFileSync } from "./atomic-write.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_SETTINGS = join(homedir(), ".claude", "settings.json");

// Copies hook scripts (and the shared modules they relative-import) into
// ~/.vibenotifications/. Exported and idempotent so daemon.js can re-run it
// on every startDaemon/fetchOnce — otherwise an `npm update -g` only takes
// effect for users who happen to re-run `init`, and stale copies keep
// running forever (shipped as v0.5.2, see commit 0e80c63).
export function syncHookFiles() {
  const hookFiles = [
    { src: join(__dirname, "../hooks/post-tool.js"), dest: join(VN_DIR, "hooks/post-tool.js") },
    { src: join(__dirname, "../hooks/carbon-track.js"), dest: join(VN_DIR, "hooks/carbon-track.js") },
    { src: join(__dirname, "../hooks/session-start.js"), dest: join(VN_DIR, "hooks/session-start.js") },
    { src: join(__dirname, "../statusline.js"), dest: join(VN_DIR, "statusline.js") },
    // Shared modules relative-imported by the files above (e.g. statusline.js
    // imports "./core/co2-rates.js", post-tool.js imports "../core/atomic-write.js") —
    // copy them into the same relative layout so those imports resolve outside the dev tree.
    { src: join(__dirname, "co2-rates.js"), dest: join(VN_DIR, "core/co2-rates.js") },
    { src: join(__dirname, "atomic-write.js"), dest: join(VN_DIR, "core/atomic-write.js") },
  ];

  for (const { src, dest } of hookFiles) {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    chmodSync(dest, "755");
  }
}

export async function installHooks() {
  syncHookFiles();

  // Backup Claude Code settings before modifying
  if (existsSync(CLAUDE_SETTINGS)) {
    const backupPath = join(VN_DIR, "claude-settings.backup.json");
    copyFileSync(CLAUDE_SETTINGS, backupPath);
  }

  // Update Claude Code settings
  let settings = {};
  if (existsSync(CLAUDE_SETTINGS)) {
    settings = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf-8"));
  }

  if (!settings.hooks) settings.hooks = {};

  // PostToolUse hook
  if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];
  settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter((h) => !isVNHook(h));
  settings.hooks.PostToolUse.push({
    matcher: "Bash|Write|Edit|Read",
    hooks: [
      {
        type: "command",
        command: `node ${join(VN_DIR, "hooks/post-tool.js")}`,
        timeout: 3,
      },
      {
        type: "command",
        command: `node ${join(VN_DIR, "hooks/carbon-track.js")}`,
        timeout: 2,
      },
    ],
  });

  // SessionStart hook
  if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];
  settings.hooks.SessionStart = settings.hooks.SessionStart.filter((h) => !isVNHook(h));
  settings.hooks.SessionStart.push({
    matcher: "startup|resume",
    hooks: [{
      type: "command",
      command: `node ${join(VN_DIR, "hooks/session-start.js")}`,
      statusMessage: "Loading your notifications...",
      timeout: 10,
    }],
  });

  // Status line
  settings.statusLine = {
    type: "command",
    command: `node ${join(VN_DIR, "statusline.js")}`,
  };

  atomicWriteFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2));
}

export async function removeHooks() {
  if (!existsSync(CLAUDE_SETTINGS)) return;
  const settings = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf-8"));

  if (settings.hooks) {
    for (const event of Object.keys(settings.hooks)) {
      settings.hooks[event] = settings.hooks[event].filter((h) => !isVNHook(h));
      if (settings.hooks[event].length === 0) delete settings.hooks[event];
    }
  }

  if (settings.statusLine?.command?.includes(".vibenotifications")) {
    delete settings.statusLine;
  }

  // Restore spinner verbs
  delete settings.spinnerVerbs;

  atomicWriteFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2));
}

function isVNHook(hookGroup) {
  return hookGroup.hooks?.some((h) => h.command?.includes(".vibenotifications"));
}
