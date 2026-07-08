---
name: vibenotifications-context
description: Repo map, conventions, and gotchas for the vibenotifications repo (Claude Code notification CLI). Load before doing ANY work in this repo — it explains the data flow, the copy-on-install hook constraint that causes code duplication, and where the landmines are (dedup IDs, ~/.claude/settings.json writes, plaintext secrets).
---

# vibenotifications — repo context

Node.js CLI (ESM, zero runtime dependencies, published to npm as global package
`vibenotifications`). Surfaces real-world notifications (GitHub, Slack, X, email,
stocks, calendars, MCP status, carbon tracking, eco mode) into Claude Code via
five surfaces: spinner verbs, status line, context injection, session summary,
dashboard.

## Architecture / data flow

```
plugins (src/plugins/*.js)  --fetch()-->  daemon (src/core/daemon.js fetchOnce)
    -> queue.js (dedupe by id / trim 24h,100 max / sort by priority)
    -> ~/.vibenotifications/notifications.json          (the single store)
    -> surfaces.js routeToSurfaces:
         - spinner verbs  -> writes ~/.claude/settings.json (spinnerVerbs key)
         - status line    -> writes ~/.vibenotifications/current-notification.json

Claude Code hooks (installed by src/core/hooks.js, COPIED to ~/.vibenotifications/):
    - hooks/post-tool.js     (PostToolUse) reads notifications.json -> spinner verbs +
                             stdout JSON {additionalContext} for context injection
    - hooks/carbon-track.js  (PostToolUse) increments ~/.vibenotifications/carbon-session.json
    - hooks/session-start.js (SessionStart) stdout summary -> injected into context
    - statusline.js          (statusLine command) reads notifications.json +
                             carbon-session.json, prints one or two lines
```

- **Entry point**: `bin/vibenotifications.js` — a switch over `process.argv[2]`,
  each case lazy-`import()`s its module. No arg parser lib; keep it that way.
- **Daemon**: `start` spawns `src/core/daemon-loop.js` detached (`stdio: "ignore"`,
  PID in `~/.vibenotifications/daemon.pid`); the loop calls `fetchOnce()` every
  `settings.fetchInterval` seconds (read ONCE at startup — settings changes need a
  daemon restart).
- **State lives in `~/.vibenotifications/`**: `settings.json` (config incl.
  plaintext API tokens), `notifications.json` (the queue), `carbon-session.json`,
  `current-notification.json`, `daemon.pid`, copied hook scripts, and
  `claude-settings.backup.json` (backup taken before first hook install).

## The plugin contract (src/plugins/*.js)

Every plugin is a default-exported object; `src/core/plugins.js` auto-discovers
every `.js` file in `src/plugins/` (no registry — dropping a file in IS the
registration). Shape:

```js
export default {
  name, displayName, icon,
  requiredConfig: { key: { label, type: "string"|"secret", placeholder,
                           instructions, validate(value) -> string|null } },
  setup: async (config) => ({ connected: true, ...infoShownToUser }), // throws on failure
  fetch: async (config) => [ Notification, ... ],   // MUST catch its own errors, return []
}
```

Notification shape (informal, no schema/validation anywhere):
`{ id, source, title, body, url, priority: "urgent"|"high"|"normal"|"low",
   timestamp: ISO string, actionable: bool, forceInject?: bool }`

Docs for the contract: `docs/creating-plugins.md`. Design history:
`docs/plans/2026-02-19-*.md`.

## Critical gotchas (read before touching anything)

1. **Hook files are COPIED, not imported.** `hooks.js installHooks()` copies
   `src/hooks/*` and `src/statusline.js` into `~/.vibenotifications/` and points
   Claude Code at the copies. Therefore hook files MUST be self-contained
   (no imports from `src/core/`) — this is why sanitize(), the CO₂ rate tables,
   and the session-summary logic are duplicated across files. If you change
   `CO2_RATES`/`COMPARISONS` in `src/plugins/carbon.js` you MUST mirror the change
   in `src/statusline.js` (and the numbers quoted in `src/plugins/eco.js` prompts).
   Also: users only get updated hooks after re-running `init` — a version bump
   alone does nothing for already-installed users.

2. **Dedup is by exact `id` string, forever-ish.** `queue.js
   deduplicateNotifications` drops incoming ids already in the store; entries
   live 24h / max 100. Consequences: an `id` containing `Date.now()` is a NEW
   notification every fetch (queue flooding); a fully-stable id never refreshes.
   The established convention for "recurring status" notifications is a
   time-bucketed id (see carbon.js `carbon-session-${bucket}`, 5-min buckets).

3. **`~/.claude/settings.json` is written by three uncoordinated writers**:
   `surfaces.js updateSpinnerVerbs` (daemon, every interval), the copied
   `post-tool.js` (every tool call), and Claude Code itself. Plain
   read-modify-`writeFileSync`, no locking, no atomic rename. Be extremely
   conservative editing anything that writes this file — a corrupt
   settings.json breaks the user's Claude Code, which is the tool's #1
   "never do" (see the `// Never break Claude Code` comments).

4. **Hooks must be silent and fast.** Every hook wraps everything in
   try/catch and exits 0 on any failure. PostToolUse hooks have 2–3s timeouts
   (set in hooks.js). Never add stdout noise to a hook except the intentional
   `additionalContext` JSON (post-tool.js) / summary text (session-start.js) —
   hook stdout is injected into Claude's context.

5. **Prompt-injection surface.** External data (GitHub titles, Slack messages,
   tweets) flows into Claude's context. `post-tool.js sanitize()` strips
   `<>` + control chars and caps at 200 chars; `forceInject: true` bypasses the
   30% random injection gate and uses the looser `sanitizeInternal` (800 chars,
   keeps angle brackets) — it is ONLY for internal, non-external-data plugins
   (currently eco). Never set `forceInject` on a plugin that carries external
   text.

6. **Secrets are plaintext** in `~/.vibenotifications/settings.json` (GitHub
   PAT, Slack bot token, X bearer, email app password) with default 0644 perms.
   Never log config objects, never print `settings.sources` values, never
   commit example settings with real tokens.

7. **Carbon numbers are estimates, quoted in three places.** Rates come from
   Jegham et al. arXiv:2505.09598; token estimation is heuristic
   (`max(toolCalls*2000, elapsedMin*500, estimatedTokens)`), session resets
   after 8h. Duplicated in carbon.js, statusline.js, carbon-track.js, eco.js.

## Conventions ("what good looks like" here)

- **Zero dependencies is a feature.** No `dependencies` in package.json; the
  interactive CLI (`src/cli/prompts.js`) is hand-rolled raw-TTY. Do not add
  deps (no inquirer, no chalk, no node-fetch — global `fetch` is available).
  The email plugin is a placeholder precisely because IMAP needs a dep.
- **ESM everywhere** (`"type": "module"`), `__dirname` via
  `fileURLToPath(import.meta.url)`. Node built-ins only.
- **Plugins fail silently**: `fetch()` catches its own network errors and
  returns `[]`; `fetchOnce` additionally catches per-plugin and prints one
  line. User-facing CLI output uses the `ANSI` object from `src/cli/prompts.js`.
- **Small flat files**, one concern each (~30–150 lines). No classes, no
  factories. Keep it that way.
- **No tests, no CI, no `scripts` in package.json** (current state, not an
  ideal — see docs/fable-findings/architecture.md). If adding tests use
  `node:test`, no framework.
- Versioning: manual bump in package.json + version-tagged commit titles
  (e.g. "fix: ... (v0.5.2) (#14)"). PRs merged to `main`; npm publish is manual.
- Docs live in `docs/` (user-facing) and `README.md`; `site/` is a static
  landing page; `SKILL.md` at repo root is the *published* Claude skill for
  users of the tool (do not confuse it with this repo-context skill).

## Verification (no test suite exists)

- Syntax/smoke: `node --check <file>`; `node bin/vibenotifications.js help`.
- `vibenotifications fetch` runs one full pipeline pass with console output —
  the closest thing to an integration test, but it mutates the REAL
  `~/.vibenotifications/` and `~/.claude/settings.json`. Prefer setting `HOME`
  to a temp dir when exercising it. (Paths are all built from `homedir()`.)
- Hook scripts can be tested by piping JSON to stdin:
  `echo '{}' | node src/hooks/post-tool.js`.
- Statusline: `echo '{}' | node src/statusline.js`.

## Known open findings

Concrete file:line-referenced bugs, security issues, and architecture work are
catalogued in `docs/fable-findings/` (bugs.md, security.md, architecture.md).
Check there before re-diagnosing anything that looks off.
