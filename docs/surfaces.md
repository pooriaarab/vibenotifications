# Surfaces

vibenotifications routes notifications to 5 different Claude Code surfaces. Each surface is independently configurable and priority-aware.

## 1. Spinner Verbs

**What**: While Claude Code is thinking (the spinner is active), notification titles replace the default spinner text.

**How it works**: The PostToolUse hook writes notification titles to `~/.claude/settings.json` under the `spinnerVerbs` key. Claude Code hot-reloads this setting, so changes appear mid-session.

**Example spinner text**:
```
* [GITHUB] Review requested: Add auth middleware
* [STOCKS] BTC: $66,756 (+2.3%)
* [SLACK] DM: Hey, can you check the PR?
```

**Config**:
```json
{
  "surfaces": {
    "spinnerVerbs": { "enabled": true, "maxLength": 60 }
  },
  "priority": {
    "minSpinner": "normal"
  }
}
```

## 2. Status Line

**What**: The top-priority notification is shown in Claude Code's persistent status bar at the bottom of the terminal. Includes clickable links via OSC 8 hyperlinks.

**How it works**: A status line command (`node ~/.vibenotifications/statusline.js`) is registered in Claude Code settings. It reads the current notification and renders ANSI-colored output with clickable URLs.

**Example**:
```
[GITHUB] Review requested: Add auth middleware
  https://github.com/user/repo/pull/42
```

**Config**:
```json
{
  "surfaces": {
    "statusLine": { "enabled": true }
  },
  "priority": {
    "minStatusLine": "low"
  }
}
```

## 3. Context Injection

**What**: High-priority actionable notifications are injected into Claude's context via the PostToolUse hook. Claude can then mention them naturally during conversation.

**How it works**: On each tool use, the hook checks for urgent/high-priority actionable items. With a 30% probability (configurable), it outputs `additionalContext` JSON that Claude Code injects into the conversation.

**Example Claude response**:
> "By the way, your CI is failing on the `auth-middleware` PR — it looks like the test suite has a timeout issue."

**Config**:
```json
{
  "surfaces": {
    "contextInjection": { "enabled": true, "rate": 0.3 }
  },
  "priority": {
    "minContextInjection": "high"
  }
}
```

## 4. Session Summary

**What**: When you start or resume a Claude Code session, a digest of all notifications is shown. Groups by source, highlights important items.

**How it works**: The SessionStart hook reads all notifications and outputs a grouped summary to stdout, which Claude Code injects as context.

**Example**:
```
[vibenotifications] Here's what you missed:
  - github: 5 (2 important: Review requested: Add auth middleware)
  - stocks: 2 notifications
  - slack: 1 notifications
```

**Config**:
```json
{
  "surfaces": {
    "sessionSummary": { "enabled": true }
  }
}
```

## 5. Dashboard

**What**: A full notification list accessible via the CLI command `vibenotifications dashboard`.

**How it works**: Reads `~/.vibenotifications/notifications.json` and renders a grouped, formatted list in the terminal.

**Example**:
```
vibenotifications Dashboard
----------------------------
  github: 5 notifications (2 important)
    - Review requested: Add auth middleware
    - CI failed: test-suite on main
    - Mentioned in: Discussion #123
  stocks: 2 notifications
    - BTC: $66,756 (+2.3%)
    - ETH: $1,935 (-1.2%)

Sources:    github, stocks
Daemon:     running
Interval:   60s
```

## Priority Routing

Not all notifications go to all surfaces. Priority controls visibility:

| Priority | Spinner | Status Line | Context Injection | Session Summary | Dashboard |
|----------|---------|-------------|-------------------|-----------------|-----------|
| `urgent` | Yes | Yes | Yes | Yes | Yes |
| `high` | Yes | Yes | Yes | Yes | Yes |
| `normal` | Yes | Yes | No | Yes | Yes |
| `low` | No | Yes | No | Yes | Yes |

These defaults are configurable via the `priority` section in settings.
