# vibenotifications -- Design Document

**Date:** 2026-02-19
**Author:** Pooria Arab
**Status:** Approved

## Overview

vibenotifications is a customizable notification platform for Claude Code. It surfaces notifications from GitHub, Slack, X/Twitter, Email, stocks/crypto, and connected MCP servers across 5 Claude Code surfaces -- spinner verbs, status line, context injection, session summaries, and hook status messages.

Developers install vibenotifications, connect their accounts through an interactive CLI, and see their notifications while they code -- without context-switching.

## Product Details

- **npm package**: vibenotifications
- **Domain**: vibenotifications.com (Cloudflare Pages)
- **GitHub**: github.com/pooriaarab/vibenotifications
- **License**: MIT (open source, monetize later)
- **Architecture**: Monolithic (plugins as files, refactor to packages later)

## Core Value Propositions

1. **Stay informed without leaving flow** -- See emails, Slack DMs, tweets in peripheral vision while coding
2. **Customizable coding companion** -- Jokes, quotes, stock prices, whatever you want scrolling by
3. **Developer productivity hub** -- CI failures, PR reviews, Stripe alerts right where you're working

## 5 Notification Surfaces

| Surface | Behavior | Best for |
|---------|----------|----------|
| Spinner verbs | Dynamic, hot-reloads mid-session via settings.json | Short alerts: "PR #42 approved by @jane" |
| Status line | Persistent footer with clickable OSC 8 links | Current most important notification |
| Context injection | Claude mentions things naturally in response | Actionable items Claude can help with |
| Session summary | On session start, summary of what you missed | Catch-up after being away |
| Hook statusMessage | Brief message during tool execution | Activity indicators |

## Architecture

### System Flow

```
[Plugin: GitHub]  --+
[Plugin: Slack]   --+
[Plugin: X]       --+--> [Notification Queue] --> [Surface Router]
[Plugin: Email]   --+      (priority, dedup,       +--> Spinner verbs
[Plugin: Stocks]  --+       rate limit)             +--> Status line
[Plugin: MCP]     --+                               +--> Context injection
                                                    +--> Session summary
```

### Components

1. **Plugin Loader** -- Discovers and loads plugins from `src/plugins/`. Each exports `{ name, fetch, setup, requiredConfig }`.

2. **Notification Queue** -- Background daemon fetches from all enabled plugins on a schedule (default: 60s). Deduplicates by ID. Prioritizes (urgent > high > normal > low). Writes to `~/.vibenotifications/notifications.json`.

3. **Surface Router** -- Decides which notification goes where based on priority settings in config. Writes spinner verbs to Claude Code settings.json (hot-reloads). Updates status line recommendation file. Injects context for Claude.

4. **Background Daemon** -- Lightweight Node.js process that runs periodically. Fetches notifications and writes to local JSON. Hooks read from this file (no network during hook execution = fast).

5. **Config Manager** -- Interactive CLI setup + direct JSON editing. Reads/writes `~/.vibenotifications/settings.json`.

## Plugin Interface

```javascript
export default {
  name: "github",
  displayName: "GitHub",
  icon: "GH",

  requiredConfig: {
    token: {
      label: "GitHub Personal Access Token",
      type: "secret",
      instructions: "Go to github.com/settings/tokens -> Generate -> Select 'notifications' and 'repo' scopes",
    },
    username: {
      label: "GitHub username",
      type: "string",
    },
  },

  setup: async (config) => {
    // Validate config, test connection
    // Returns { connected: true, ... }
  },

  fetch: async (config) => {
    // Fetch current notifications
    // Returns array of Notification objects
  },
};
```

## Notification Object Schema

```javascript
{
  id: "github-123",            // Unique, for deduplication
  source: "github",            // Plugin name
  title: "PR #42 approved",    // Short (for spinner verbs, max 60 chars)
  body: "review in user/repo", // Longer (for status line)
  url: "https://...",          // Clickable link (OSC 8)
  priority: "high",            // urgent | high | normal | low
  timestamp: "2026-02-19...",
  actionable: true,            // Can Claude help with this?
}
```

## MVP Plugins (6)

| Plugin | What it fetches | API needed |
|--------|----------------|------------|
| github | PR reviews, CI failures, mentions, issues | GitHub PAT |
| slack | DMs, channel mentions, threads | Slack Bot Token |
| x | Mentions, DMs, bookmark highlights | X API Bearer Token |
| email | Unread count, important emails (subject lines) | IMAP or Gmail API |
| stocks | Price alerts, portfolio changes | Free API (Alpha Vantage / CoinGecko) |
| mcp-bridge | Pull from connected MCP servers | None (reads Claude Code MCP config) |

## User Experience

### Install and Setup

```
$ npm install -g vibenotifications
$ vibenotifications init

vibenotifications -- customizable notifications for Claude Code

Which sources do you want to enable?
  [x] GitHub (PR reviews, CI failures, mentions)
  [x] Slack (DMs, channel mentions)
  [ ] X/Twitter (mentions, DMs)
  [ ] Email (unread, important subjects)
  [ ] Stocks/Crypto (price alerts)
  [ ] MCP Bridge (pull from connected MCPs)

Setting up GitHub...
  We need a Personal Access Token with 'notifications' + 'repo' scopes.
  1. Go to: github.com/settings/tokens/new
  2. Name: vibenotifications
  3. Select scopes: notifications, repo
  Paste token: ghp_****
  Connected as @pooriaarab. 5 unread notifications.

Installed hooks to ~/.claude/settings.json
Started notification daemon (fetches every 60s)
Created ~/.vibenotifications/settings.json

Done! Open a Claude Code session to see your notifications.
```

### Settings File (~/.vibenotifications/settings.json)

```json
{
  "version": "0.1.0",
  "fetchInterval": 60,
  "sources": {
    "github": {
      "enabled": true,
      "token": "ghp_****",
      "events": ["review_requested", "ci_failure", "mention"]
    },
    "slack": {
      "enabled": true,
      "token": "xoxb-****",
      "channels": [],
      "dmsOnly": false
    },
    "stocks": {
      "enabled": true,
      "symbols": ["AAPL", "BTC"],
      "alertThreshold": 2
    }
  },
  "surfaces": {
    "spinnerVerbs": { "enabled": true, "maxLength": 60 },
    "statusLine": { "enabled": true },
    "contextInjection": { "enabled": true, "rate": 0.3 },
    "sessionSummary": { "enabled": true }
  },
  "priority": {
    "minSpinner": "normal",
    "minStatusLine": "low",
    "minContextInjection": "high"
  }
}
```

### During Coding

Spinner (contextual, dynamic):
```
* PR #42 approved by @jane -- merge when ready... (23s)
* CI failed on main: test_auth.py line 42... (15s)
* @devfriend mentioned you: "great PR!"... (8s)
* AAPL: $245.30 (+2.1% today)... (12s)
```

Status line (persistent, clickable):
```
Slack (DM) -- @sarah: "can you review the API changes?"
  https://app.slack.com/...
```

Context injection (Claude mentions naturally):
"By the way, your CI is failing on test_auth.py line 42 -- it looks like the same auth module we're working on. Want me to check the error?"

Session start summary:
```
[vibenotifications] Welcome back! Here's what you missed:
  - 3 GitHub notifications (1 review request, 2 CI failures)
  - 5 Slack DMs from @sarah, @mike
  - AAPL: $245.30 (+2.1%), BTC: $98,450 (-0.3%)
```

### CLI Commands

```
vibenotifications init          # Interactive setup
vibenotifications dashboard     # View all notifications
vibenotifications add <plugin>  # Enable a new source
vibenotifications remove <plugin> # Disable a source
vibenotifications stop          # Pause daemon
vibenotifications start         # Resume daemon
vibenotifications uninstall     # Remove everything
```

## Package Structure

```
vibenotifications/
├── bin/vibenotifications.js
├── src/
│   ├── core/
│   │   ├── daemon.js           # Background fetch process
│   │   ├── hooks.js            # Install/manage Claude Code hooks
│   │   ├── surfaces.js         # Route notifications to surfaces
│   │   ├── config.js           # Read/write settings
│   │   └── queue.js            # Notification dedup/priority
│   ├── plugins/
│   │   ├── github.js
│   │   ├── slack.js
│   │   ├── x.js
│   │   ├── email.js
│   │   ├── stocks.js
│   │   └── mcp-bridge.js
│   ├── cli/
│   │   ├── init.js             # Interactive setup wizard
│   │   ├── dashboard.js
│   │   ├── add.js
│   │   └── remove.js
│   ├── hooks/
│   │   ├── post-tool.js        # PostToolUse hook
│   │   └── session-start.js    # SessionStart hook
│   └── statusline.js
├── README.md
├── package.json
└── docs/
```

## Landing Page (vibenotifications.com)

Cloudflare Pages deployment. Minimal, dark theme, developer-focused.

- Hero: Terminal mockup showing notifications in Claude Code
- One-liner: "See your GitHub PRs, Slack DMs, and stock prices while you code."
- Install command: `npm install -g vibenotifications`
- Feature grid: 6 plugins x 5 surfaces
- GitHub star button + npm badge
- "Built by @pooriaarab"
- Open source badge

Tech: Static HTML/CSS or simple Astro/Next.js deployed to Cloudflare Pages.

## Relationship to vibeads

vibeads remains a separate, standalone project. vibenotifications is the generalized platform. In the future, vibeads could become a vibenotifications plugin (`vibenotifications add vibeads`) but that's post-MVP.

## Success Criteria

- Working `npm install -g vibenotifications` with auto-setup
- Interactive CLI that walks users through API key setup
- At least 3 plugins working (GitHub, Slack, stocks)
- All 5 surfaces showing notifications
- Background daemon fetching every 60s
- Clean uninstall
- Landing page live at vibenotifications.com
- Open source on GitHub
