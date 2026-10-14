# vibenotifications

[![npm version](https://img.shields.io/npm/v/vibenotifications)](https://www.npmjs.com/package/vibenotifications)
[![Downloads/month](https://img.shields.io/npm/dm/vibenotifications)](https://www.npmjs.com/package/vibenotifications)
[![MIT license](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/license/mit)

[Website](https://getvibe.dev/vibenotifications) · [Setup](#send-your-first-notification) · [Commands](#runtime-surfaces)

vibenotifications is an open-source notification CLI for Claude Code users who monitor external services while they code.
It polls configured sources and stores a local notification queue.
Hooks expose events through spinner text, a status line, context, and session summaries; a terminal dashboard provides the fifth surface.

## Install

```sh
npm install -g vibenotifications
```

Use Node.js 20 or 22, the versions covered by repository CI.
The package has zero runtime dependencies.
Claude Code is required for hooks; the dashboard runs separately.

## Send your first notification

This local-file example needs no credentials or environment variables. The CLI does not load a `.env` file.

```sh
vibenotifications add vibe
mkdir -p ~/.vibe
node --input-type=module -e 'import { appendFileSync } from "node:fs"; import { homedir } from "node:os"; appendFileSync(homedir()+"/.vibe/notify.jsonl", JSON.stringify({kind:"task-done",agent:"demo",ts:Date.now(),payload:{message:"Hello from your terminal"}})+"\n")'
vibenotifications fetch
vibenotifications dashboard
```

Success: the dashboard includes `demo: task done` under `vibe`.
Run `vibenotifications init` in an interactive terminal to select sources and install Claude Code hooks.
It changes `~/.claude/settings.json` and saves a pre-install snapshot under `~/.vibenotifications/`.

## How it works

```text
12 plugins -> fetch once / daemon -> deduplicated local queue
                                    -> spinner / status line
                                    -> context / session summary / dashboard
```

The daemon defaults to a 60-second interval and reads settings each cycle.
Settings and credentials live in `~/.vibenotifications/settings.json` with owner-only file permissions.

## Why it exists

GitHub and Slack each have their own inbox. Switching to those applications interrupts terminal work.
vibenotifications brings selected events into Claude Code. ntfy serves a different destination: phone and desktop push notifications.

## Compare

Scope checked on 2026-10-14 against source and [ntfy documentation](https://docs.ntfy.sh/).

| Aspect | vibenotifications | ntfy |
| --- | --- | --- |
| Main scope | Poll sources into Claude Code | Publish push messages to phone or desktop |
| Input | Configured plugins and local event files | HTTP PUT/POST or CLI publish |
| Configuration | Local JSON and setup wizard | Topics and subscriber clients |
| Deployment | Local Node.js process | Notification server and clients |

## Coverage

The loader discovers 12 plugin files. Status describes source implementation, not a live service certification.

| Plugin | Status | Behavior and setup |
| --- | --- | --- |
| GitHub | Implemented; live verification pending | Notifications API; personal access token with `notifications` and `repo` scopes |
| Slack | Implemented; live verification pending | Latest recent message from up to five direct-message conversations; bot token |
| X (Twitter) | Implemented; live verification pending | Up to ten mentions; bearer token and numeric user ID |
| Email | Stub | Inbox reminder only; no IMAP connection or unread count |
| Stocks/Crypto | Partial | CoinGecko prices for BTC, ETH, SOL, DOGE; all other tickers are placeholders |
| MCP Bridge | Configuration-only | Reads Model Context Protocol (MCP) server names from Claude settings; no health checks |
| Carbon Tracker | Estimate | Local tool-call and time-based CO₂ estimates; model selection |
| Eco Mode | Prompt | Injects shorter-output instructions; `lite`, `full`, or `ultra` |
| Vibe Suite | Implemented local reader | Reads `~/.vibe/notify.jsonl`; no key |
| private-repo-4944 | Implemented local reader | Reads personal/work `notify.jsonl` files; no key |
| Apple Calendar | Implemented; live verification pending | Requires macOS and `icalBuddy` |
| Google Calendar | Implemented; live verification pending | Private ICS calendar URL and lookahead minutes |

No credential-backed integration was live-verified for this rewrite.
All 12 implementations were source-inspected; local automated checks do not establish remote API availability.

## Common use cases

1. Claude Code developers: show GitHub review requests in the status line.
2. Slack users: inspect recent bot-accessible direct messages without opening another window.
3. Vibe Suite users: surface local test failures from JSON Lines events.
4. private-repo-4944 users: show provider errors and subscription-limit warnings in Claude Code.
5. macOS developers: display Apple Calendar meeting reminders through `icalBuddy`.

## Features

- **Local queue:** upserts matching IDs and sorts events by priority.
- **Source selection:** enables and removes plugins through the CLI.
- **Five surfaces:** spinner, status line, context, session summary, and dashboard.
- **Optional estimates:** Carbon Tracker reports estimates; Eco Mode adds output instructions.

## Runtime surfaces

Node.js runs the CLI and background daemon. Apple Calendar also needs macOS.
The MCP Bridge is a configuration reader; this package exposes no MCP server tools.

| Command | Purpose |
| --- | --- |
| No command, or `init` | Interactive source setup and hook installation |
| `add [plugin]` | Configure a source, or list plugin IDs |
| `remove <plugin>` | Remove a configured source |
| `fetch` | Poll enabled sources once |
| `start` | Start the background daemon |
| `stop` | Stop the daemon |
| `dashboard` | Print the local queue |
| `uninstall` | Stop the daemon, remove hooks, restore saved settings, delete local configuration |
| `help`, `--help`, `-h` | Print usage |

## Delivery and behavior limits

The queue retains at most 100 notifications younger than 24 hours. It has no durable delivery acknowledgement.
Fetch errors commonly produce empty results. A successful command does not prove every service responded.
Slack reads direct messages, despite setup instructions requesting channel scopes. It does not fetch channel messages.
Google Calendar uses a small ICS parser without recurrence expansion or full timezone handling.
Email setup accepts an app password but does not authenticate to an IMAP server.
Keep credentials local; they are stored as JSON, without encryption.
Context injection uses a fixed 30% random gate for actionable high-priority events. Eco Mode bypasses that gate.
Some surface settings do not govern standalone hooks. Output and carbon estimates carry no accuracy or savings guarantee.

## Integration guides

- GitHub: run `vibenotifications add github`, then enter the personal access token when prompted.
- Slack: run `vibenotifications add slack`, then enter a bot token with direct-message read and history access.
- Google Calendar: run `vibenotifications add google-calendar`, then enter the secret iCal address from calendar settings.
- Apple Calendar: install `icalBuddy` on macOS, then run `vibenotifications add apple-calendar`.
- CoinGecko: run `vibenotifications add stocks`, then enter `BTC,ETH,SOL,DOGE` in the symbol prompt.

## Status

Version 0.6.0 is pre-1.0; configuration and behavior can change.
Report problems through [GitHub issues](https://github.com/pooriaarab/vibenotifications/issues).
Public case studies are not yet published in this repository.

## FAQ

### Which integrations are verified?

vibenotifications has 12 source-inspected plugins with the limits listed above.
Credential-backed services were not live-tested for this rewrite.

### Does vibenotifications provide a managed notification service?

vibenotifications runs on your machine. You manage credentials, polling, and the local daemon.

### How is vibenotifications different from ntfy?

vibenotifications polls plugins and surfaces events inside Claude Code.
[ntfy](https://docs.ntfy.sh/) accepts published messages for phone and desktop push clients.

### Does vibenotifications read email?

vibenotifications currently emits a reminder to check your inbox.
It does not read messages or count unread mail.

### Can vibenotifications track stock prices?

vibenotifications fetches four crypto symbols from CoinGecko.
Other symbols produce placeholder notifications without market prices.

### Does vibenotifications check MCP server health?

vibenotifications reads configured server names from Claude settings.
It does not connect to those servers or verify availability.

### Where does vibenotifications store credentials?

vibenotifications stores source settings in `~/.vibenotifications/settings.json`.
The file uses owner-only permissions; values remain readable JSON.

### How do I remove vibenotifications hooks?

vibenotifications provides `vibenotifications uninstall` to stop the daemon and remove local configuration.
It restores saved status-line and spinner settings from the installation snapshot.

## Contributing and releasing

Plugins export a default object with `name`, `displayName`, `icon`, `requiredConfig`, `setup`, and `fetch`.
The loader imports every JavaScript file in `src/plugins/`; `fetch` returns notification objects with stable IDs.
Run `npm test` and `git diff --check` before submitting changes.
The publish workflow uses version tags and an `NPM_TOKEN` secret; this documentation change does not publish a release.

## License

[MIT](https://opensource.org/license/mit).
