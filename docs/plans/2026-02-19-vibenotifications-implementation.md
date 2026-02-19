# vibenotifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an npm package (`vibenotifications`) that surfaces notifications from GitHub, Slack, X, Email, stocks, and MCP servers across 5 Claude Code surfaces via an interactive CLI and background daemon.

**Architecture:** Monolithic npm package with a plugin system (plugins as files). Background daemon fetches notifications on a schedule and writes to `~/.vibenotifications/notifications.json`. Claude Code hooks read from this file to stay fast. Interactive CLI for setup. Landing page on Cloudflare Pages.

**Tech Stack:** Node.js (ESM), no external dependencies for core (use built-in `fetch`, `readline`, `fs`). ANSI escape codes + OSC 8 for terminal rendering. Static HTML/CSS for landing page.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `bin/vibenotifications.js`
- Create: `.gitignore`

**Step 1: Create package.json**

```json
{
  "name": "vibenotifications",
  "version": "0.1.0",
  "description": "Customizable notifications for Claude Code -- GitHub PRs, Slack DMs, stock prices, and more while you code",
  "type": "module",
  "bin": {
    "vibenotifications": "./bin/vibenotifications.js"
  },
  "files": [
    "bin/",
    "src/",
    "README.md"
  ],
  "keywords": [
    "claude-code",
    "notifications",
    "developer-tools",
    "github",
    "slack",
    "productivity"
  ],
  "author": "Pooria Arab",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/pooriaarab/vibenotifications.git"
  }
}
```

**Step 2: Create CLI entry point**

Create `bin/vibenotifications.js`:

```javascript
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
    default:
      console.log(`vibenotifications -- customizable notifications for Claude Code

Usage:
  vibenotifications init            Interactive setup wizard
  vibenotifications dashboard       View all notifications
  vibenotifications add <plugin>    Enable a new source
  vibenotifications remove <plugin> Disable a source
  vibenotifications start           Start notification daemon
  vibenotifications stop            Stop notification daemon
  vibenotifications fetch           Fetch notifications once (no daemon)
  vibenotifications uninstall       Remove everything

Plugins: github, slack, x, email, stocks, mcp-bridge`);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
```

**Step 3: Create .gitignore**

```
node_modules/
.DS_Store
*.log
```

**Step 4: Create directory structure**

```bash
mkdir -p src/{core,plugins,cli,hooks}
```

**Step 5: Commit**

```bash
git add package.json bin/vibenotifications.js .gitignore
git commit -m "feat: scaffold vibenotifications with CLI entry point"
```

---

### Task 2: Config Manager

**Files:**
- Create: `src/core/config.js`

**Step 1: Create config manager**

This module reads/writes `~/.vibenotifications/settings.json` and provides helpers for managing plugin configs.

```javascript
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const VN_DIR = join(homedir(), ".vibenotifications");
const SETTINGS_FILE = join(VN_DIR, "settings.json");
const NOTIFICATIONS_FILE = join(VN_DIR, "notifications.json");

export { VN_DIR, SETTINGS_FILE, NOTIFICATIONS_FILE };

export function ensureDir() {
  if (!existsSync(VN_DIR)) {
    mkdirSync(VN_DIR, { recursive: true });
  }
}

export function loadSettings() {
  ensureDir();
  if (!existsSync(SETTINGS_FILE)) {
    return getDefaultSettings();
  }
  return JSON.parse(readFileSync(SETTINGS_FILE, "utf-8"));
}

export function saveSettings(settings) {
  ensureDir();
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

export function getDefaultSettings() {
  return {
    version: "0.1.0",
    fetchInterval: 60,
    sources: {},
    surfaces: {
      spinnerVerbs: { enabled: true, maxLength: 60 },
      statusLine: { enabled: true },
      contextInjection: { enabled: true, rate: 0.3 },
      sessionSummary: { enabled: true },
    },
    priority: {
      minSpinner: "normal",
      minStatusLine: "low",
      minContextInjection: "high",
    },
  };
}

export function loadNotifications() {
  ensureDir();
  if (!existsSync(NOTIFICATIONS_FILE)) {
    return [];
  }
  return JSON.parse(readFileSync(NOTIFICATIONS_FILE, "utf-8"));
}

export function saveNotifications(notifications) {
  ensureDir();
  writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2));
}
```

**Step 2: Commit**

```bash
git add src/core/config.js
git commit -m "feat: add config manager for settings and notifications"
```

---

### Task 3: Plugin Loader

**Files:**
- Create: `src/core/plugins.js`

**Step 1: Create plugin loader**

Discovers and loads all plugins from `src/plugins/`. Returns a registry of available plugins.

```javascript
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { readdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = join(__dirname, "../plugins");

let pluginCache = null;

export async function loadPlugins() {
  if (pluginCache) return pluginCache;

  const files = readdirSync(PLUGINS_DIR).filter((f) => f.endsWith(".js"));
  const plugins = {};

  for (const file of files) {
    const mod = await import(join(PLUGINS_DIR, file));
    const plugin = mod.default;
    plugins[plugin.name] = plugin;
  }

  pluginCache = plugins;
  return plugins;
}

export async function getPlugin(name) {
  const plugins = await loadPlugins();
  return plugins[name] || null;
}

export async function getEnabledPlugins(settings) {
  const plugins = await loadPlugins();
  const enabled = [];
  for (const [name, config] of Object.entries(settings.sources)) {
    if (config.enabled && plugins[name]) {
      enabled.push({ plugin: plugins[name], config });
    }
  }
  return enabled;
}
```

**Step 2: Commit**

```bash
git add src/core/plugins.js
git commit -m "feat: add plugin loader with discovery and registry"
```

---

### Task 4: Notification Queue

**Files:**
- Create: `src/core/queue.js`

**Step 1: Create notification queue**

Handles deduplication, priority sorting, and rate limiting.

```javascript
const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 };

export function deduplicateNotifications(existing, incoming) {
  const seen = new Set(existing.map((n) => n.id));
  const newOnes = incoming.filter((n) => !seen.has(n.id));
  return [...newOnes, ...existing];
}

export function sortByPriority(notifications) {
  return [...notifications].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 2;
    const pb = PRIORITY_ORDER[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
}

export function filterByMinPriority(notifications, minPriority) {
  const minOrder = PRIORITY_ORDER[minPriority] ?? 2;
  return notifications.filter(
    (n) => (PRIORITY_ORDER[n.priority] ?? 2) <= minOrder
  );
}

export function trimNotifications(notifications, maxAge = 24 * 60 * 60 * 1000, maxCount = 100) {
  const cutoff = Date.now() - maxAge;
  return notifications
    .filter((n) => new Date(n.timestamp).getTime() > cutoff)
    .slice(0, maxCount);
}
```

**Step 2: Commit**

```bash
git add src/core/queue.js
git commit -m "feat: add notification queue with dedup and priority sorting"
```

---

### Task 5: Surface Router

**Files:**
- Create: `src/core/surfaces.js`

**Step 1: Create surface router**

Routes notifications to the 5 Claude Code surfaces: spinner verbs, status line, context injection, session summary. Writes to Claude Code settings.json for spinner verbs (hot-reloads mid-session).

```javascript
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { filterByMinPriority, sortByPriority } from "./queue.js";
import { VN_DIR } from "./config.js";

const CLAUDE_SETTINGS = join(homedir(), ".claude", "settings.json");
const CURRENT_NOTIFICATION = join(VN_DIR, "current-notification.json");

export function routeToSurfaces(notifications, surfaceConfig, priorityConfig) {
  if (!notifications.length) return;

  const sorted = sortByPriority(notifications);

  // Spinner verbs: short titles from notifications
  if (surfaceConfig.spinnerVerbs?.enabled) {
    updateSpinnerVerbs(sorted, surfaceConfig.spinnerVerbs, priorityConfig);
  }

  // Status line: top priority notification
  if (surfaceConfig.statusLine?.enabled) {
    updateStatusLine(sorted[0]);
  }
}

function updateSpinnerVerbs(notifications, config, priorityConfig) {
  try {
    if (!existsSync(CLAUDE_SETTINGS)) return;
    const settings = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf-8"));

    const maxLen = config.maxLength || 60;
    const filtered = filterByMinPriority(notifications, priorityConfig.minSpinner || "normal");

    const verbs = filtered
      .map((n) => {
        const prefix = `[${n.source}]`;
        const title = n.title.slice(0, maxLen - prefix.length - 1);
        return `${prefix} ${title}`;
      })
      .slice(0, 20);

    if (verbs.length > 0) {
      settings.spinnerVerbs = { mode: "replace", verbs };
      writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2));
    }
  } catch {
    // Never break Claude Code
  }
}

function updateStatusLine(notification) {
  try {
    writeFileSync(
      CURRENT_NOTIFICATION,
      JSON.stringify({
        notification,
        timestamp: new Date().toISOString(),
      })
    );
  } catch {
    // Silent fail
  }
}

export function getSessionSummary(notifications) {
  if (!notifications.length) return null;

  const bySource = {};
  for (const n of notifications) {
    if (!bySource[n.source]) bySource[n.source] = [];
    bySource[n.source].push(n);
  }

  const lines = ["[vibenotifications] Here's what you missed:"];
  for (const [source, notifs] of Object.entries(bySource)) {
    const urgent = notifs.filter((n) => n.priority === "urgent" || n.priority === "high");
    if (urgent.length > 0) {
      lines.push(`  - ${source}: ${notifs.length} notifications (${urgent.length} important: ${urgent[0].title})`);
    } else {
      lines.push(`  - ${source}: ${notifs.length} notifications`);
    }
  }

  return lines.join("\n");
}

export function getContextInjection(notifications, priorityConfig) {
  const filtered = filterByMinPriority(notifications, priorityConfig.minContextInjection || "high");
  const actionable = filtered.filter((n) => n.actionable);

  if (actionable.length === 0) return null;

  const top = actionable[0];
  return `[vibenotifications] ${top.title}. ${top.body || ""} ${top.url ? "Link: " + top.url : ""} -- Mention this naturally only if relevant to what you're helping with.`;
}
```

**Step 2: Commit**

```bash
git add src/core/surfaces.js
git commit -m "feat: add surface router for spinner, status line, context injection"
```

---

### Task 6: Background Daemon

**Files:**
- Create: `src/core/daemon.js`

**Step 1: Create daemon**

Lightweight background process that fetches from all enabled plugins on a schedule, deduplicates, and routes to surfaces.

```javascript
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import { homedir } from "os";
import { loadSettings, saveNotifications, loadNotifications, VN_DIR } from "./config.js";
import { getEnabledPlugins } from "./plugins.js";
import { deduplicateNotifications, sortByPriority, trimNotifications } from "./queue.js";
import { routeToSurfaces } from "./surfaces.js";

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

  // Spawn a detached child process that fetches periodically
  const child = spawn(
    process.execPath,
    [
      "-e",
      `
      import("${join(import.meta.url, "../../core/daemon.js").replace(/\\/g, "/")}").then(async (mod) => {
        while (true) {
          try { await mod.fetchOnce(); } catch {}
          await new Promise(r => setTimeout(r, ${interval * 1000}));
        }
      });
      `,
      "--input-type=module",
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
    process.kill(pid, 0); // Signal 0 = check if process exists
    return true;
  } catch {
    unlinkSync(PID_FILE);
    return false;
  }
}
```

**Step 2: Commit**

```bash
git add src/core/daemon.js
git commit -m "feat: add background daemon with fetch, start, stop"
```

---

### Task 7: GitHub Plugin

**Files:**
- Create: `src/plugins/github.js`

**Step 1: Create GitHub plugin**

Fetches notifications from GitHub API (PR reviews, CI failures, mentions).

```javascript
export default {
  name: "github",
  displayName: "GitHub",
  icon: "GH",

  requiredConfig: {
    token: {
      label: "GitHub Personal Access Token",
      type: "secret",
      instructions:
        "1. Go to github.com/settings/tokens/new\n" +
        "   2. Name: vibenotifications\n" +
        "   3. Select scopes: notifications, repo\n" +
        "   4. Generate and copy the token",
    },
  },

  setup: async (config) => {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${config.token}`,
        "User-Agent": "vibenotifications",
      },
    });
    if (!res.ok) throw new Error("Invalid GitHub token");
    const user = await res.json();
    return { connected: true, user: user.login };
  },

  fetch: async (config) => {
    const res = await fetch("https://api.github.com/notifications", {
      headers: {
        Authorization: `Bearer ${config.token}`,
        "User-Agent": "vibenotifications",
      },
    });
    if (!res.ok) return [];
    const data = await res.json();

    return data.map((n) => ({
      id: `github-${n.id}`,
      source: "github",
      title: n.subject.title,
      body: `${n.reason} in ${n.repository.full_name}`,
      url: n.repository.html_url,
      priority: n.reason === "review_requested" || n.reason === "ci_activity" ? "high" : "normal",
      timestamp: n.updated_at,
      actionable: n.reason === "review_requested" || n.reason === "ci_activity",
    }));
  },
};
```

**Step 2: Commit**

```bash
git add src/plugins/github.js
git commit -m "feat: add GitHub plugin (PR reviews, CI, mentions)"
```

---

### Task 8: Stocks Plugin

**Files:**
- Create: `src/plugins/stocks.js`

**Step 1: Create stocks plugin**

Fetches stock/crypto prices from free APIs (CoinGecko for crypto, no API key needed).

```javascript
export default {
  name: "stocks",
  displayName: "Stocks/Crypto",
  icon: "$",

  requiredConfig: {
    symbols: {
      label: "Symbols to track (comma-separated, e.g. AAPL,BTC,ETH)",
      type: "string",
      instructions: "Enter stock tickers or crypto symbols separated by commas.",
    },
  },

  setup: async (config) => {
    const symbols = parseSymbols(config.symbols);
    if (symbols.length === 0) throw new Error("No symbols provided");
    return { connected: true, tracking: symbols.length + " symbols" };
  },

  fetch: async (config) => {
    const symbols = parseSymbols(config.symbols);
    const notifications = [];

    // Crypto via CoinGecko (free, no key)
    const cryptoMap = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", DOGE: "dogecoin" };
    const cryptoSymbols = symbols.filter((s) => cryptoMap[s.toUpperCase()]);
    const stockSymbols = symbols.filter((s) => !cryptoMap[s.toUpperCase()]);

    if (cryptoSymbols.length > 0) {
      try {
        const ids = cryptoSymbols.map((s) => cryptoMap[s.toUpperCase()]).join(",");
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
        );
        if (res.ok) {
          const data = await res.json();
          for (const symbol of cryptoSymbols) {
            const id = cryptoMap[symbol.toUpperCase()];
            const info = data[id];
            if (info) {
              const change = info.usd_24h_change?.toFixed(1) || "0.0";
              const arrow = parseFloat(change) >= 0 ? "+" : "";
              notifications.push({
                id: `stocks-${symbol}-${Date.now()}`,
                source: "stocks",
                title: `${symbol.toUpperCase()}: $${info.usd.toLocaleString()} (${arrow}${change}%)`,
                body: `24h change: ${arrow}${change}%`,
                url: `https://www.coingecko.com/en/coins/${id}`,
                priority: Math.abs(parseFloat(change)) > 5 ? "high" : "low",
                timestamp: new Date().toISOString(),
                actionable: false,
              });
            }
          }
        }
      } catch {
        // Silent fail for crypto
      }
    }

    // For stocks, we'd use Alpha Vantage or similar — for MVP, just show placeholder
    for (const symbol of stockSymbols) {
      notifications.push({
        id: `stocks-${symbol}-${Date.now()}`,
        source: "stocks",
        title: `${symbol.toUpperCase()}: price tracking requires API key (coming soon)`,
        body: "Stock price tracking via Alpha Vantage coming in next release",
        url: `https://finance.yahoo.com/quote/${symbol}`,
        priority: "low",
        timestamp: new Date().toISOString(),
        actionable: false,
      });
    }

    return notifications;
  },
};

function parseSymbols(input) {
  if (Array.isArray(input)) return input;
  if (typeof input === "string") return input.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}
```

**Step 2: Commit**

```bash
git add src/plugins/stocks.js
git commit -m "feat: add stocks/crypto plugin (CoinGecko for crypto)"
```

---

### Task 9: Slack Plugin

**Files:**
- Create: `src/plugins/slack.js`

**Step 1: Create Slack plugin**

Fetches unread DMs and channel mentions from Slack.

```javascript
export default {
  name: "slack",
  displayName: "Slack",
  icon: "#",

  requiredConfig: {
    token: {
      label: "Slack Bot Token (xoxb-...)",
      type: "secret",
      instructions:
        "1. Go to api.slack.com/apps -> Create New App\n" +
        "   2. From Scratch -> name it 'vibenotifications'\n" +
        "   3. OAuth & Permissions -> Add Bot Token Scopes:\n" +
        "      channels:history, channels:read, im:history, im:read, users:read\n" +
        "   4. Install to Workspace\n" +
        "   5. Copy the Bot User OAuth Token (xoxb-...)",
    },
  },

  setup: async (config) => {
    const res = await fetch("https://slack.com/api/auth.test", {
      headers: { Authorization: `Bearer ${config.token}` },
    });
    const data = await res.json();
    if (!data.ok) throw new Error(`Slack auth failed: ${data.error}`);
    return { connected: true, user: data.user, team: data.team };
  },

  fetch: async (config) => {
    const notifications = [];

    // Fetch recent DMs
    try {
      const convRes = await fetch("https://slack.com/api/conversations.list?types=im&limit=10", {
        headers: { Authorization: `Bearer ${config.token}` },
      });
      const convData = await convRes.json();
      if (convData.ok) {
        for (const channel of convData.channels.slice(0, 5)) {
          const histRes = await fetch(
            `https://slack.com/api/conversations.history?channel=${channel.id}&limit=1`,
            { headers: { Authorization: `Bearer ${config.token}` } }
          );
          const histData = await histRes.json();
          if (histData.ok && histData.messages?.length > 0) {
            const msg = histData.messages[0];
            const age = Date.now() / 1000 - parseFloat(msg.ts);
            if (age < 3600) {
              // Only last hour
              notifications.push({
                id: `slack-${channel.id}-${msg.ts}`,
                source: "slack",
                title: `DM: ${msg.text?.slice(0, 50) || "(attachment)"}`,
                body: msg.text?.slice(0, 200) || "",
                url: `https://app.slack.com`,
                priority: "normal",
                timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
                actionable: false,
              });
            }
          }
        }
      }
    } catch {
      // Silent fail
    }

    return notifications;
  },
};
```

**Step 2: Commit**

```bash
git add src/plugins/slack.js
git commit -m "feat: add Slack plugin (DMs and channel messages)"
```

---

### Task 10: X/Twitter Plugin

**Files:**
- Create: `src/plugins/x.js`

**Step 1: Create X plugin**

Fetches mentions and DMs from X/Twitter API v2.

```javascript
export default {
  name: "x",
  displayName: "X/Twitter",
  icon: "X",

  requiredConfig: {
    bearerToken: {
      label: "X API Bearer Token",
      type: "secret",
      instructions:
        "1. Go to developer.x.com/en/portal/dashboard\n" +
        "   2. Create a project and app\n" +
        "   3. Go to Keys and Tokens\n" +
        "   4. Copy the Bearer Token",
    },
    userId: {
      label: "Your X user ID (numeric)",
      type: "string",
      instructions: "Find your user ID at tweeterid.com by entering your @handle",
    },
  },

  setup: async (config) => {
    const res = await fetch(`https://api.x.com/2/users/${config.userId}`, {
      headers: { Authorization: `Bearer ${config.bearerToken}` },
    });
    if (!res.ok) throw new Error("Invalid X API credentials");
    const data = await res.json();
    return { connected: true, user: data.data?.username };
  },

  fetch: async (config) => {
    const notifications = [];

    try {
      const res = await fetch(
        `https://api.x.com/2/users/${config.userId}/mentions?max_results=10&tweet.fields=created_at,author_id,text`,
        { headers: { Authorization: `Bearer ${config.bearerToken}` } }
      );
      if (res.ok) {
        const data = await res.json();
        for (const tweet of data.data || []) {
          notifications.push({
            id: `x-${tweet.id}`,
            source: "x",
            title: `@mention: ${tweet.text?.slice(0, 50)}`,
            body: tweet.text?.slice(0, 200) || "",
            url: `https://x.com/i/status/${tweet.id}`,
            priority: "normal",
            timestamp: tweet.created_at || new Date().toISOString(),
            actionable: false,
          });
        }
      }
    } catch {
      // Silent fail
    }

    return notifications;
  },
};
```

**Step 2: Commit**

```bash
git add src/plugins/x.js
git commit -m "feat: add X/Twitter plugin (mentions)"
```

---

### Task 11: Email Plugin

**Files:**
- Create: `src/plugins/email.js`

**Step 1: Create email plugin**

Connects via IMAP to show unread email count and subject lines.

```javascript
export default {
  name: "email",
  displayName: "Email",
  icon: "@",

  requiredConfig: {
    imapHost: {
      label: "IMAP server (e.g. imap.gmail.com)",
      type: "string",
      instructions: "Gmail: imap.gmail.com | Outlook: outlook.office365.com | Yahoo: imap.mail.yahoo.com",
    },
    email: {
      label: "Email address",
      type: "string",
    },
    password: {
      label: "App password (not your main password)",
      type: "secret",
      instructions:
        "Gmail: Go to myaccount.google.com/apppasswords -> Generate\n" +
        "   Outlook: Go to account.microsoft.com/security -> App passwords",
    },
  },

  setup: async (config) => {
    // IMAP requires a TCP connection which is complex in pure Node.js
    // For MVP, just validate that config is provided
    if (!config.imapHost || !config.email || !config.password) {
      throw new Error("Missing required IMAP configuration");
    }
    return { connected: true, note: "IMAP connection will be tested on first fetch" };
  },

  fetch: async (config) => {
    // IMAP is complex without external deps. For MVP, return a placeholder.
    // Full IMAP support would need 'imapflow' or similar package.
    return [
      {
        id: `email-unread-${Date.now()}`,
        source: "email",
        title: `Email: check ${config.email} for unread messages`,
        body: "Full IMAP integration coming soon. For now, this is a reminder to check your inbox.",
        url: config.imapHost.includes("gmail") ? "https://mail.google.com" : "https://outlook.live.com",
        priority: "low",
        timestamp: new Date().toISOString(),
        actionable: false,
      },
    ];
  },
};
```

**Step 2: Commit**

```bash
git add src/plugins/email.js
git commit -m "feat: add email plugin (placeholder, IMAP coming)"
```

---

### Task 12: MCP Bridge Plugin

**Files:**
- Create: `src/plugins/mcp-bridge.js`

**Step 1: Create MCP bridge plugin**

Reads from connected MCP servers' notification-like outputs.

```javascript
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export default {
  name: "mcp-bridge",
  displayName: "MCP Bridge",
  icon: "MCP",

  requiredConfig: {},

  setup: async () => {
    const mcpConfig = getMcpConfig();
    if (!mcpConfig) {
      return { connected: true, note: "No MCP servers found. Configure MCPs in Claude Code first." };
    }
    const serverCount = Object.keys(mcpConfig).length;
    return { connected: true, servers: serverCount };
  },

  fetch: async () => {
    const mcpConfig = getMcpConfig();
    if (!mcpConfig) return [];

    const notifications = [];
    const serverNames = Object.keys(mcpConfig);

    for (const name of serverNames) {
      notifications.push({
        id: `mcp-${name}-${Date.now()}`,
        source: "mcp-bridge",
        title: `MCP: ${name} connected`,
        body: `MCP server '${name}' is available`,
        url: "",
        priority: "low",
        timestamp: new Date().toISOString(),
        actionable: false,
      });
    }

    return notifications;
  },
};

function getMcpConfig() {
  const paths = [
    join(homedir(), ".claude", "settings.json"),
    join(homedir(), ".claude", "settings.local.json"),
  ];

  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const settings = JSON.parse(readFileSync(p, "utf-8"));
        if (settings.mcpServers && Object.keys(settings.mcpServers).length > 0) {
          return settings.mcpServers;
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}
```

**Step 2: Commit**

```bash
git add src/plugins/mcp-bridge.js
git commit -m "feat: add MCP bridge plugin (reads connected MCP servers)"
```

---

### Task 13: Interactive CLI Setup

**Files:**
- Create: `src/cli/init.js`

**Step 1: Create interactive init wizard**

Uses Node.js built-in `readline` for interactive prompts. Walks user through plugin selection and API key setup.

```javascript
import { createInterface } from "readline";
import { loadSettings, saveSettings, ensureDir } from "../core/config.js";
import { loadPlugins } from "../core/plugins.js";
import { installHooks } from "../core/hooks.js";

export async function init() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  console.log("");
  console.log("vibenotifications -- customizable notifications for Claude Code");
  console.log("");

  ensureDir();
  const plugins = await loadPlugins();
  const settings = loadSettings();

  console.log("Available sources:");
  const pluginList = Object.values(plugins);
  for (let i = 0; i < pluginList.length; i++) {
    const p = pluginList[i];
    const status = settings.sources[p.name]?.enabled ? " (enabled)" : "";
    console.log(`  ${i + 1}. ${p.displayName}${status}`);
  }

  console.log("");
  const selection = await ask("Which sources to enable? (comma-separated numbers, e.g. 1,2,5): ");
  const indices = selection.split(",").map((s) => parseInt(s.trim()) - 1).filter((i) => i >= 0 && i < pluginList.length);

  for (const idx of indices) {
    const plugin = pluginList[idx];
    console.log("");
    console.log(`Setting up ${plugin.displayName}...`);

    const pluginConfig = { enabled: true };
    for (const [key, schema] of Object.entries(plugin.requiredConfig)) {
      if (schema.instructions) {
        console.log(`  ${schema.instructions}`);
      }
      const value = await ask(`  ${schema.label}: `);
      pluginConfig[key] = value.trim();
    }

    // Test connection
    try {
      const result = await plugin.setup(pluginConfig);
      console.log(`  Connected! ${JSON.stringify(result)}`);
      settings.sources[plugin.name] = pluginConfig;
    } catch (err) {
      console.log(`  Connection failed: ${err.message}`);
      const retry = await ask("  Skip this source? (y/n): ");
      if (retry.toLowerCase() !== "n") continue;
    }
  }

  saveSettings(settings);
  console.log("");
  console.log("  Saved settings to ~/.vibenotifications/settings.json");

  // Install Claude Code hooks
  await installHooks();
  console.log("  Installed Claude Code hooks");

  console.log("");
  console.log("Done! Run 'vibenotifications fetch' to test, or 'vibenotifications start' for the daemon.");
  console.log("Run 'vibenotifications dashboard' to see notifications.");
  console.log("");

  rl.close();
}
```

**Step 2: Commit**

```bash
git add src/cli/init.js
git commit -m "feat: add interactive CLI setup wizard"
```

---

### Task 14: Claude Code Hooks

**Files:**
- Create: `src/core/hooks.js`
- Create: `src/hooks/post-tool.js`
- Create: `src/hooks/session-start.js`
- Create: `src/statusline.js`

**Step 1: Create hooks installer**

Installs PostToolUse, SessionStart hooks and status line into Claude Code settings.

```javascript
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
```

**Step 2: Create PostToolUse hook**

`src/hooks/post-tool.js` — reads latest notifications and routes to surfaces on each tool use.

```javascript
#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const VN_DIR = join(homedir(), ".vibenotifications");
const NOTIFICATIONS_FILE = join(VN_DIR, "notifications.json");
const CLAUDE_SETTINGS = join(homedir(), ".claude", "settings.json");

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

  // Update spinner verbs with latest notifications
  try {
    if (existsSync(CLAUDE_SETTINGS)) {
      const settings = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf-8"));
      const verbs = notifications
        .slice(0, 20)
        .map((n) => `[${n.source}] ${n.title}`.slice(0, 60));

      if (verbs.length > 0) {
        settings.spinnerVerbs = { mode: "replace", verbs };
        writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2));
      }
    }
  } catch {
    // Silent fail
  }

  // Context injection for high-priority actionable items (30% of the time)
  if (Math.random() < 0.3) {
    const actionable = notifications.find((n) => n.actionable && (n.priority === "urgent" || n.priority === "high"));
    if (actionable) {
      console.log(JSON.stringify({
        additionalContext: `[vibenotifications] ${actionable.title}. ${actionable.body || ""} ${actionable.url ? "URL: " + actionable.url : ""} -- Mention this naturally if relevant.`,
      }));
    }
  }

  process.exit(0);
}
```

**Step 3: Create SessionStart hook**

`src/hooks/session-start.js` — shows a summary of notifications on session start.

```javascript
#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const VN_DIR = join(homedir(), ".vibenotifications");
const NOTIFICATIONS_FILE = join(VN_DIR, "notifications.json");

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

  const bySource = {};
  for (const n of notifications) {
    if (!bySource[n.source]) bySource[n.source] = [];
    bySource[n.source].push(n);
  }

  const lines = ["[vibenotifications] Here's what you missed:"];
  for (const [source, notifs] of Object.entries(bySource)) {
    const urgent = notifs.filter((n) => n.priority === "urgent" || n.priority === "high");
    if (urgent.length > 0) {
      lines.push(`  - ${source}: ${notifs.length} (${urgent.length} important: ${urgent[0].title})`);
    } else {
      lines.push(`  - ${source}: ${notifs.length} notifications`);
    }
  }

  // SessionStart stdout is injected into Claude's context
  console.log(lines.join("\n"));
  process.exit(0);
}
```

**Step 4: Create status line**

`src/statusline.js` — shows the top notification with clickable link.

```javascript
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
```

**Step 5: Commit**

```bash
git add src/core/hooks.js src/hooks/post-tool.js src/hooks/session-start.js src/statusline.js
git commit -m "feat: add Claude Code hooks, status line, and session summary"
```

---

### Task 15: Dashboard & Uninstall CLI

**Files:**
- Create: `src/cli/dashboard.js`
- Create: `src/cli/uninstall.js`
- Create: `src/cli/add.js`
- Create: `src/cli/remove.js`

**Step 1: Create dashboard**

```javascript
import { loadNotifications, loadSettings, VN_DIR } from "../core/config.js";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

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

  const pidFile = join(VN_DIR, "daemon.pid");
  const daemonRunning = existsSync(pidFile);
  console.log(`Daemon:     ${daemonRunning ? "running" : "stopped"}`);
  console.log(`Interval:   ${settings.fetchInterval}s`);
  console.log("");
}
```

**Step 2: Create uninstall**

```javascript
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
```

**Step 3: Create add/remove commands**

`src/cli/add.js`:

```javascript
import { createInterface } from "readline";
import { loadSettings, saveSettings } from "../core/config.js";
import { getPlugin } from "../core/plugins.js";

export async function add(pluginName) {
  if (!pluginName) {
    console.log("Usage: vibenotifications add <plugin>");
    console.log("Plugins: github, slack, x, email, stocks, mcp-bridge");
    return;
  }

  const plugin = await getPlugin(pluginName);
  if (!plugin) {
    console.log(`Unknown plugin: ${pluginName}`);
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  const settings = loadSettings();
  const pluginConfig = { enabled: true };

  console.log(`Setting up ${plugin.displayName}...`);
  for (const [key, schema] of Object.entries(plugin.requiredConfig)) {
    if (schema.instructions) console.log(`  ${schema.instructions}`);
    const value = await ask(`  ${schema.label}: `);
    pluginConfig[key] = value.trim();
  }

  try {
    const result = await plugin.setup(pluginConfig);
    console.log(`  Connected! ${JSON.stringify(result)}`);
    settings.sources[plugin.name] = pluginConfig;
    saveSettings(settings);
    console.log("  Saved.");
  } catch (err) {
    console.log(`  Failed: ${err.message}`);
  }

  rl.close();
}
```

`src/cli/remove.js`:

```javascript
import { loadSettings, saveSettings } from "../core/config.js";

export async function remove(pluginName) {
  if (!pluginName) {
    console.log("Usage: vibenotifications remove <plugin>");
    return;
  }

  const settings = loadSettings();
  if (settings.sources[pluginName]) {
    delete settings.sources[pluginName];
    saveSettings(settings);
    console.log(`Removed ${pluginName}.`);
  } else {
    console.log(`${pluginName} is not enabled.`);
  }
}
```

**Step 4: Commit**

```bash
git add src/cli/dashboard.js src/cli/uninstall.js src/cli/add.js src/cli/remove.js
git commit -m "feat: add dashboard, uninstall, add, remove CLI commands"
```

---

### Task 16: End-to-End Testing

**Step 1:** `npm link` and test CLI help: `vibenotifications`

**Step 2:** Test init: `vibenotifications init` — enable stocks only (no API keys needed)

**Step 3:** Test fetch: `vibenotifications fetch` — should fetch crypto prices

**Step 4:** Test dashboard: `vibenotifications dashboard`

**Step 5:** Test status line: `echo '{}' | node ~/.vibenotifications/statusline.js`

**Step 6:** Test uninstall: `vibenotifications uninstall`

**Step 7:** Fix any issues, commit.

---

### Task 17: README

**Files:**
- Create: `README.md`

Write a README with: one-liner, install command, interactive setup example, 6 plugins table, 5 surfaces explained, dashboard, uninstall, contributing guide, MIT license.

**Step 1: Write README and commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

### Task 18: Landing Page

**Files:**
- Create: `site/index.html`
- Create: `site/style.css`

Static HTML/CSS landing page for vibenotifications.com. Dark theme, terminal mockup, install command, feature grid. Deploy to Cloudflare Pages.

**Step 1: Create site directory and files**

Minimal landing page with:
- Hero: "See your GitHub PRs, Slack DMs, and stock prices while you code."
- Terminal mockup showing spinner verbs with notifications
- Install: `npm install -g vibenotifications`
- 6 plugins with icons
- "Open Source" badge + GitHub link

**Step 2: Deploy to Cloudflare Pages**

```bash
# Connect GitHub repo to Cloudflare Pages
# Build command: (none, static)
# Output directory: site/
```

**Step 3: Commit**

```bash
git add site/
git commit -m "feat: add landing page for vibenotifications.com"
```

---

### Task 19: GitHub Repo & npm Publish

**Step 1:** Create GitHub repo: `gh repo create vibenotifications --public --source . --push`

**Step 2:** Publish to npm: `npm publish --access public`

**Step 3:** Verify: `npm view vibenotifications`
