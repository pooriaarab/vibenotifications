# Configuration

All settings are stored in `~/.vibenotifications/settings.json`.

## Full Settings Reference

```json
{
  "version": "0.1.0",
  "fetchInterval": 60,
  "sources": {
    "github": {
      "enabled": true,
      "token": "ghp_..."
    },
    "stocks": {
      "enabled": true,
      "symbols": "BTC,ETH,SOL"
    }
  },
  "surfaces": {
    "spinnerVerbs": {
      "enabled": true,
      "maxLength": 60
    },
    "statusLine": {
      "enabled": true
    },
    "contextInjection": {
      "enabled": true,
      "rate": 0.3
    },
    "sessionSummary": {
      "enabled": true
    }
  },
  "priority": {
    "minSpinner": "normal",
    "minStatusLine": "low",
    "minContextInjection": "high"
  }
}
```

## Settings

### `fetchInterval`

How often the daemon fetches notifications, in seconds. Default: `60`.

```json
"fetchInterval": 120
```

### `sources`

Each enabled plugin has an entry here with `enabled: true` and its configuration fields.

### `surfaces`

Control which notification surfaces are active.

#### `spinnerVerbs`

Replaces Claude Code's spinner text with notification titles while it thinks.

- `enabled`: turn on/off
- `maxLength`: max character length per spinner verb (default: 60)

#### `statusLine`

Shows the top-priority notification in Claude Code's status bar with clickable OSC 8 links.

- `enabled`: turn on/off

#### `contextInjection`

Injects high-priority actionable notifications into Claude's context so it can mention them naturally.

- `enabled`: turn on/off
- `rate`: probability (0-1) of injection per tool use. Default: `0.3` (30%)

#### `sessionSummary`

Shows a digest of notifications when starting or resuming a Claude Code session.

- `enabled`: turn on/off

### `priority`

Controls the minimum priority level for each surface.

| Setting | Default | Effect |
|---------|---------|--------|
| `minSpinner` | `"normal"` | Only `urgent`, `high`, and `normal` show in spinner |
| `minStatusLine` | `"low"` | All priorities show in status line |
| `minContextInjection` | `"high"` | Only `urgent` and `high` get injected into context |

Priority order: `urgent` > `high` > `normal` > `low`

## File Locations

| File | Purpose |
|------|---------|
| `~/.vibenotifications/settings.json` | Configuration |
| `~/.vibenotifications/notifications.json` | Notification queue |
| `~/.vibenotifications/current-notification.json` | Current status line notification |
| `~/.vibenotifications/daemon.pid` | Daemon process ID |
| `~/.vibenotifications/hooks/` | Installed hook scripts |
| `~/.vibenotifications/statusline.js` | Status line script |

## Editing Settings Manually

You can edit `~/.vibenotifications/settings.json` directly. Changes take effect on the next daemon fetch cycle (or immediately for hooks that read on each tool use).

## Resetting

To reset to defaults, delete the settings file:

```bash
rm ~/.vibenotifications/settings.json
```

Then run `vibenotifications init` again.
