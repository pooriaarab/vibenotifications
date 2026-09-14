# vibenotifications

<p align="center">Pull GitHub, Slack, and stock alerts into Claude Code while you stay in the terminal.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/vibenotifications"><img src="https://img.shields.io/npm/v/vibenotifications" alt="npm v0.6.0"/></a>
  <a href="https://github.com/pooriaarab/vibenotifications/actions"><img src="https://github.com/pooriaarab/vibenotifications/actions/workflows/ci.yml/badge.svg" alt="CI"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License MIT"/></a>
  <a href="src/plugins"><img src="https://img.shields.io/badge/plugins-12-informational" alt="12 notification plugins"/></a>
</p>

```text
$ vibenotifications dashboard

vibenotifications Dashboard
----------------------------
  stocks: 3 notifications
    - ETH: $2,599.51 (+3.6%)
    - SOL: $104.61 (+3.2%)
    - BTC: $79,418 (+2.7%)

Sources:    stocks
Daemon:     stopped
Interval:   60s
```

<p align="center"><em>Dashboard after <code>vibenotifications fetch</code> with the stocks plugin, 14 Sep 2026.</em></p>

## Install

```bash
npm install -g vibenotifications
vibenotifications init
```

One line to install, one line to run.

`init` is a wizard: pick sources, enter tokens, test each connection, and install Claude Code hooks. It needs a real terminal (raw stdin). It writes hooks into `~/.claude/settings.json`. A full pre-install snapshot of that file is kept at `~/.vibenotifications/claude-settings.backup.json`.

## Quick start

The stocks plugin is the path that needs no API key. Crypto symbols `BTC`, `ETH`, `SOL`, and `DOGE` fetch live prices from CoinGecko.

```bash
vibenotifications add stocks
vibenotifications fetch
vibenotifications dashboard
```

When `add stocks` asks for symbols, enter `BTC,ETH,SOL`.

```
Fetching from 1 source(s)...
  Stocks/Crypto: 3 notifications
Total: 3 notifications routed to surfaces.

vibenotifications Dashboard
----------------------------
  stocks: 3 notifications
    - ETH: $2,599.51 (+3.6%)
    - SOL: $104.61 (+3.2%)
    - BTC: $79,418 (+2.7%)

Sources:    stocks
Daemon:     stopped
Interval:   60s
```

## Why

For people who work in Claude Code and today check GitHub's inbox or Slack in a browser. Not for anyone who does not run Claude Code. This is not a replacement for Slack, Notification Center, or GitHub's own inbox, and it is not a general notification daemon.

## add

Enable one source. `add` with no name lists the plugins.

```bash
vibenotifications add stocks
```

```
Setting up Stocks/Crypto...
  Enter crypto or stock symbols separated by commas.
   Crypto (free): BTC, ETH, SOL, DOGE  |  Stocks: AAPL, TSLA, etc.
  Symbols to track (BTC,ETH,SOL):   ✓ Connected! {"connected":true,"tracking":"3 symbols"}
  Saved.
```

```bash
vibenotifications remove stocks
```

```
Removed stocks.
```

| Plugin | Source | Credentials |
|--------|--------|-------------|
| **GitHub** | PR reviews, CI failures, mentions | GitHub PAT (`notifications`, `repo`) |
| **Slack** | DMs, channel messages | Slack bot token (`xoxb-...`) |
| **X/Twitter** | Mentions | Bearer token and numeric user id |
| **Email** | Reminder to check mail. IMAP unread count is not implemented | Email address and app password |
| **Stocks/Crypto** | BTC, ETH, SOL, DOGE from CoinGecko. Other tickers are placeholders | None for those four crypto symbols |
| **MCP Bridge** | Names of MCP servers in Claude Code settings | None |
| **Carbon Tracker** | Session CO₂ estimate in the queue | Claude model name |
| **Eco Mode** | Injects a shorter-output prompt into Claude's context | Intensity level (`lite`, `full`, `ultra`) |
| **Vibe Suite** | Events from `~/.vibe/notify.jsonl` | None |
| **OffRouter** | Routing, limit, and spend events from `~/.offrouter-*/notify.jsonl` | None |
| **Apple Calendar** | Upcoming macOS Calendar events | `icalBuddy` on macOS |
| **Google Calendar** | Upcoming events from a private ICS URL | Google Calendar ICS URL |

## fetch

Pull every enabled source once. No daemon.

```bash
vibenotifications fetch
```

```
Fetching from 1 source(s)...
  Stocks/Crypto: 3 notifications
Total: 3 notifications routed to surfaces.
```

Start a background loop (default 60s) and stop it:

```bash
vibenotifications start
vibenotifications stop
```

```
Daemon started (PID: 61070, interval: 60s, log: ~/.vibenotifications/daemon.log)
Daemon stopped (PID: 61070)
```

## dashboard

Read `~/.vibenotifications/notifications.json` and print the queue.

```bash
vibenotifications dashboard
```

```
vibenotifications Dashboard
----------------------------
  stocks: 3 notifications
    - ETH: $2,599.51 (+3.6%)
    - SOL: $104.61 (+3.2%)
    - BTC: $79,418 (+2.7%)

Sources:    stocks
Daemon:     stopped
Interval:   60s
```

## uninstall

```bash
vibenotifications uninstall
```

```
No daemon running.
  Removed Claude Code hooks
  Cleaned up ~/.vibenotifications/

vibenotifications removed.
```

This removes the hooks, stops the daemon, and deletes `~/.vibenotifications/`. Any custom `statusLine` or `spinnerVerbs` you had before install are restored from the snapshot taken at install.

## How it works

1. A background daemon fetches enabled sources on a schedule (default: 60s). `fetch` does the same pass once.
2. Notifications are deduplicated, priority-sorted, and written to `~/.vibenotifications/notifications.json`.
3. Claude Code hooks read that file and route items to surfaces:
   - PostToolUse updates spinner verbs and may inject context
   - SessionStart prints a summary digest
   - A status line command shows the top notification

Notifications appear on five Claude Code surfaces:

| Surface | How it works |
|---------|-------------|
| **Spinner verbs** | Notification titles replace spinner text while Claude thinks |
| **Status line** | Top notification in the status bar, with clickable links |
| **Context injection** | High-priority items injected into Claude's context (30% rate) |
| **Session summary** | Digest when you start or resume a session |
| **Dashboard** | Full list via `vibenotifications dashboard` |

## Configuration

Settings live in `~/.vibenotifications/settings.json`:

```json
{
  "fetchInterval": 60,
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

See [docs/configuration.md](docs/configuration.md) and [docs/surfaces.md](docs/surfaces.md).

## Contributing

See [CONTRIBUTING.md](https://github.com/pooriaarab/.github/blob/main/CONTRIBUTING.md). Add plugins in `src/plugins/` (the loader reads every `.js` file there). Full guide: [docs/creating-plugins.md](docs/creating-plugins.md).

### Plugin interface

Every plugin exports a default object with:

```javascript
export default {
  name: "my-plugin",       // unique identifier
  displayName: "My Plugin", // shown in CLI
  icon: "MP",              // short icon for status line

  requiredConfig: {        // prompts during setup
    apiKey: { label: "API Key", type: "secret", instructions: "..." }
  },

  setup: async (config) => {
    // Validate credentials, return { connected: true }
  },

  fetch: async (config) => {
    // Return array of notification objects
    return [{
      id: "unique-id",
      source: "my-plugin",
      title: "Short title",
      body: "Longer description",
      url: "https://...",
      priority: "normal", // urgent | high | normal | low
      timestamp: new Date().toISOString(),
      actionable: false,
    }];
  },
};
```

### Releasing

CI runs on every PR and push to `main` (syntax-check + package validation). To publish a new version:

1. Bump `version` in `package.json`, commit, merge to `main`.
2. `git tag vX.Y.Z && git push origin vX.Y.Z`
3. The publish workflow builds and publishes to npm automatically (idempotent — safe to rerun; skips if that version is already published).

Requires an `NPM_TOKEN` repo secret (npm automation token with publish access).

## License

[MIT](LICENSE)
