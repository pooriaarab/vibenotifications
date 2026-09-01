# Findings: bugs

Concrete, file:line-referenced defects. Each item is scoped so a mechanical
implementer can fix it without further judgment calls. Line numbers are as of
commit `0e80c63` (v0.5.2).

## B1. `Date.now()` in notification ids defeats deduplication — queue flooding

- **Files**: `src/plugins/stocks.js:55` and `:74`, `src/plugins/email.js:111`,
  `src/plugins/mcp-bridge.js:30`
- **Bug**: ids like `stocks-${symbol}-${Date.now()}` are unique on every fetch,
  so `deduplicateNotifications` (`src/core/queue.js:3-7`) never dedupes them.
  With the daemon fetching every 60s, each symbol/email/MCP server adds a new
  queue entry per minute; the 100-entry cap (`queue.js:25`) then evicts real
  notifications.
- **Fix**: use time-bucketed ids matching the existing carbon convention
  (`src/plugins/carbon.js:130`): 5-minute bucket
  `const bucket = Math.floor(Date.now() / (5 * 60000))`, then
  `stocks-${symbol}-${bucket}`, `email-unread-${bucket}`, `mcp-${name}-${bucket}`.
  (See B2 for making bucketed ids replace their predecessors.)

## B2. Time-bucketed ids accumulate instead of replacing — carbon floods the queue

- **Files**: `src/plugins/carbon.js:130-134`, `src/core/queue.js:3-7`
- **Bug**: `carbon-session-${bucket}` changes every 5 minutes; the old bucket's
  entry stays in the store for 24h. One working day = up to 288 carbon entries,
  alone enough to hit `maxCount = 100` and evict everything else. Same applies
  to B1's fix once bucketed.
- **Fix**: in `deduplicateNotifications` (or a step right after it in
  `fetchOnce`, `src/core/daemon.js:36`), before merging, drop existing entries
  whose `source` matches an incoming notification's `source` AND whose id shares
  the incoming id's prefix up to the last `-` (the bucket suffix). Simpler
  equivalent: add a `replaceKey` convention — treat everything before the final
  `-<digits>` segment as the identity key and keep only the newest per key.
  Either way, add a unit check: two fetches 5 min apart must leave exactly one
  carbon entry.

## B3. Eco threshold "0 to disable" is silently coerced to 50

- **File**: `src/plugins/eco.js:102`
- **Bug**: `const thresholdG = parseFloat(config.threshold) || 50;` — a user
  entering `0` (documented at `eco.js:62` as "0 to disable") gets `0 || 50 = 50`,
  so threshold alerts still fire. Empty string also becomes 50 (intended
  default), which masks the bug.
- **Fix**:
  ```js
  const parsed = parseFloat(config.threshold);
  const thresholdG = Number.isFinite(parsed) ? parsed : 50;
  ```
  The existing `if (thresholdG > 0 ...)` at `eco.js:103` then disables correctly.

## B4. Unknown CLI command silently launches the init wizard

- **File**: `bin/vibenotifications.js:66-69`
- **Bug**: the `default` switch case runs `init()`. A typo (`vibenotifications
strat`) drops the user into the interactive setup wizard, which can rewrite
  `~/.claude/settings.json` hooks.
- **Fix**: keep bare `vibenotifications` (no args) → `init()`, but for an
  unrecognized command print `Unknown command: <cmd>` plus the existing help
  text and `process.exit(1)`. Concretely: `if (command === undefined) { init }
else { unknown-command path }` in the default case.

## B5. Hardcoded plugin lists drifted from actual plugins (two places, both wrong)

- **Files**: `bin/vibenotifications.js:64` (missing `carbon`, `eco`),
  `src/cli/add.js:8` (missing `apple-calendar`, `google-calendar`)
- **Fix**: derive the list at runtime:
  `const plugins = await loadPlugins(); Object.keys(plugins).sort().join(", ")`
  (`loadPlugins` from `src/core/plugins.js` is already async-import-friendly).
  Replace both hardcoded strings.

## B6. Dashboard reports daemon "running" from a stale PID file

- **Files**: `src/cli/dashboard.js:36-38`, `src/core/daemon.js:86-96`
- **Bug**: dashboard only checks `existsSync(daemon.pid)`. After a crash or
  reboot the PID file remains and the dashboard lies. `daemon.js` already has
  the correct liveness check (`process.kill(pid, 0)`) in its private
  `isDaemonRunning()`.
- **Fix**: `export function isDaemonRunning()` in `daemon.js` (it also cleans up
  the stale PID file as a side effect, which is desirable) and use it in
  `dashboard.js` instead of `existsSync`.

## B7. ICS parser: no RFC 5545 line unfolding, no recurring events

- **File**: `src/plugins/google-calendar.js:112-137` (`parseICS`)
- **Bug 1 (unfolding)**: ICS folds long lines as CRLF + single space/tab
  (RFC 5545 §3.1). `getField` matches single lines, so folded `SUMMARY`/`URL`
  values are truncated at the fold point.
  **Fix**: before splitting into blocks, `text = text.replace(/\r?\n[ \t]/g, "")`.
- **Bug 2 (recurrence)**: `RRULE` is ignored, so a recurring meeting (the
  common case for standups) only ever notifies on its original `DTSTART` date —
  i.e. effectively never.
  **Fix (scoped)**: full RRULE support is out of scope for a zero-dep tool;
  implement only `FREQ=DAILY` and `FREQ=WEEKLY;BYDAY=...` by projecting the
  event's start time onto today when today matches the rule (respect `UNTIL`
  if present, ignore `COUNT`/`INTERVAL>1` — document that limitation in
  `docs/configuration.md`).

## B8. ICS dates ignore TZID — wrong meeting times across timezones

- **File**: `src/plugins/google-calendar.js:139-146` (`parseICSDate`)
- **Bug**: `str.replace(/^.*:/, "")` throws away `;TZID=America/New_York:` and
  the naive branch constructs the date in the machine's local zone. Any
  calendar whose events carry a TZID different from the local machine gets
  shifted times, so "urgent / starting now" fires at the wrong moment.
- **Fix**: capture the TZID parameter; if present and ≠ local, convert using
  `Intl.DateTimeFormat` with `timeZone: tzid` to compute the UTC offset for
  that wall-clock time (standard zero-dep technique: build the date as UTC,
  format it into the target zone, take the difference, adjust). Keep the `Z`
  and no-TZID branches as-is.

## B9. Changing the carbon model in config never updates an existing session

- **File**: `src/plugins/carbon.js:61-67` (`getOrCreateSession`)
- **Bug**: `if (model && !existing.model)` only stamps the model when absent.
  If the user reruns setup and switches model (e.g. sonnet → haiku), the live
  session keeps the old `model`/`co2Rate` for up to 8h, and `statusline.js:46`
  reads `s.model` from that stale session.
- **Fix**: `if (model && existing.model !== model) { existing.model = model;
existing.co2Rate = CO2_RATES[model] ?? CO2_RATES["claude-sonnet-4-6"];
writeFileSync(...); }`

## B10. `remove` leaves the removed source's notifications in the store

- **Files**: `src/cli/remove.js:9-16`, store helpers in `src/core/config.js:49-60`
- **Bug**: removing a plugin deletes its config but its notifications stay in
  `notifications.json` for up to 24h — the statusline and spinner keep showing
  a source the user just removed.
- **Fix**: after `saveSettings`, do
  `saveNotifications(loadNotifications().filter(n => n.source !== pluginName))`.

## B11. `loadSettings` doesn't merge defaults — old settings files can crash the pipeline

- **Files**: `src/core/config.js:17-23`, consumer `src/core/daemon.js:41`,
  `src/core/surfaces.js:10-24`
- **Bug**: a `settings.json` written by an older version (or hand-edited) that
  lacks `surfaces` or `priority` makes `routeToSurfaces(sorted, undefined,
undefined)` throw (`surfaceConfig.spinnerVerbs` on undefined) — uncaught in
  `fetchOnce`, so every daemon iteration errors.
- **Fix**: in `loadSettings`, shallow-merge per top-level key:
  ```js
  const d = getDefaultSettings();
  const s = JSON.parse(...);
  return { ...d, ...s, surfaces: { ...d.surfaces, ...s.surfaces },
           priority: { ...d.priority, ...s.priority } };
  ```

## B12. Opus CO₂ rate contradicts itself between eco prompt and rate tables

- **Files**: `src/plugins/eco.js:32` ("Opus=0.45g/1Ktok") vs
  `src/plugins/carbon.js:15` and `src/statusline.js:12`
  (`"claude-opus-4-7": 0.55`)
- **Fix**: change `eco.js:32` to `0.55g` (the tables are the source of truth).
  Root cause (three hand-synced copies of the table) is A1 in architecture.md.

## B13. Apple Calendar event ids collide for same-title events; `-f` flag garbles parsing

- **File**: `src/plugins/apple-calendar.js:64-66` and `:81`
- **Bug 1**: `eventId` is `title + date` only — two meetings titled "1:1" on the
  same day dedupe into one, and the earlier one's priority/body sticks.
  **Fix**: include the parsed event time in the id when `timeMatch` exists:
  `...-${timeMatch[1].replace(/[\s:]/g, "").toLowerCase()}`.
- **Bug 2**: the `icalBuddy` invocation uses `-f` (formatting/ANSI colors),
  which inserts escape codes into the output that the regexes at `:76` and
  `:84` must then match around. Remove `-f`; also add
  `-b "• "` to pin the bullet string the title regex expects.
