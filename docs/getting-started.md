# Getting Started

## Install

```bash
npm install -g vibenotifications
```

## Setup

Run the interactive wizard:

```bash
vibenotifications init
```

This will:
1. Show you all available notification sources (plugins)
2. Walk you through enabling each one with API keys/tokens
3. Test each connection
4. Install Claude Code hooks automatically

## Quick start with Stocks (no API key)

If you just want to try it out, the stocks/crypto plugin works with no API key:

```bash
vibenotifications init
# Select only "Stocks/Crypto"
# Enter: BTC,ETH,SOL
```

Then fetch notifications:

```bash
vibenotifications fetch
```

You'll see live crypto prices. Run `vibenotifications dashboard` to view them.

## Start the daemon

For continuous background fetching:

```bash
vibenotifications start
```

This spawns a background process that fetches every 60 seconds (configurable). Stop it with:

```bash
vibenotifications stop
```

## What happens next

Once set up, notifications appear automatically in your Claude Code sessions:

- **Spinner verbs**: notification titles show up while Claude thinks
- **Status line**: top notification in the status bar
- **Session summary**: digest of what you missed when starting a session
- **Context injection**: Claude may mention urgent items naturally
- **Dashboard**: `vibenotifications dashboard` for the full list

## Uninstall

```bash
vibenotifications uninstall
```

Removes all hooks, stops the daemon, and deletes `~/.vibenotifications/`.
