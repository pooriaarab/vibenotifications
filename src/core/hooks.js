import { readFileSync, writeFileSync, existsSync, copyFileSync, chmodSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { VN_DIR } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_SETTINGS = join(homedir(), ".claude", "settings.json");

export async function installHooks() {
  // Copy hook scripts to ~/.vibenotifications/
  const hookFiles = [
    { src: join(__dirname, "../hooks/post-tool.js"), dest: join(VN_DIR, "hooks/post-tool.js") },
    { src: join(__dirname, "../hooks/session-start.js"), dest: join(VN_DIR, "hooks/session-start.js") },
    { src: join(__dirname, "../statusline.js"), dest: join(VN_DIR, "statusline.js") },
  ];

  for (const { src, dest } of hookFiles) {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    chmodSync(dest, "755");
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
    hooks: [{
      type: "command",
      command: `node ${join(VN_DIR, "hooks/post-tool.js")}`,
      timeout: 3,
    }],
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

  writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2));
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

  writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2));
}

function isVNHook(hookGroup) {
  return hookGroup.hooks?.some((h) => h.command?.includes(".vibenotifications"));
}
