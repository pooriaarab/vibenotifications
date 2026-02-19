# vibenotifications

Customizable notifications for Claude Code -- GitHub PRs, Slack DMs, stock prices, and more while you code.

```
npm install -g vibenotifications
vibenotifications init
```

## What it does

vibenotifications brings real-world notifications into your Claude Code session. While Claude works on your code, you'll see GitHub PR reviews, Slack messages, stock prices, and more -- right in the terminal.

Notifications appear across **5 Claude Code surfaces**:

| Surface | How it works |
|---------|-------------|
| **Spinner verbs** | Notification titles replace spinner text while Claude thinks |
| **Status line** | Top notification shown in the status bar with clickable links |
| **Context injection** | High-priority items injected into Claude's context (30% rate) |
| **Session summary** | Notification digest shown when starting/resuming a session |
| **Dashboard** | Full notification list via `vibenotifications dashboard` |

## Plugins

| Plugin | Source | API key needed? |
|--------|--------|----------------|
| **GitHub** | PR reviews, CI failures, mentions | Yes (PAT) |
| **Slack** | DMs, channel messages | Yes (Bot token) |
| **X/Twitter** | Mentions | Yes (Bearer token) |
| **Email** | Unread count (placeholder) | Yes (IMAP) |
| **Stocks/Crypto** | BTC, ETH, SOL, DOGE prices | No |
| **MCP Bridge** | Connected MCP server status | No |

## Setup

Interactive setup wizard:

```
vibenotifications init
```

This walks you through:
1. Selecting which notification sources to enable
2. Entering API keys/tokens for each source
3. Testing connections
4. Installing Claude Code hooks automatically

## Usage

```bash
vibenotifications init            # Interactive setup wizard
vibenotifications dashboard       # View all notifications
vibenotifications add <plugin>    # Enable a new source
vibenotifications remove <plugin> # Disable a source
vibenotifications start           # Start notification daemon
vibenotifications stop            # Stop notification daemon
vibenotifications fetch           # Fetch notifications once (no daemon)
vibenotifications uninstall       # Remove everything
```

## How it works

1. **Background daemon** fetches notifications from enabled sources on a schedule (default: 60s)
2. Notifications are deduplicated, priority-sorted, and written to `~/.vibenotifications/notifications.json`
3. **Claude Code hooks** read this file and route notifications to surfaces:
   - PostToolUse hook updates spinner verbs and injects context
   - SessionStart hook shows a summary digest
   - Status line command shows the top notification

## Configuration

Settings are stored in `~/.vibenotifications/settings.json`:

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

## Uninstall

```
vibenotifications uninstall
```

This removes all hooks, stops the daemon, and cleans up `~/.vibenotifications/`.

## Contributing

1. Fork the repo
2. Create a feature branch
3. Add your plugin in `src/plugins/` following the existing pattern
4. Submit a PR

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

## License

MIT
