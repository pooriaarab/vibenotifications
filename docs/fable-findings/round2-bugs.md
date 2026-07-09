# Round 2 findings: bugs

Round 1 (`docs/fable-findings/bugs.md`) shipped no fixes — `git log` shows the
only commit since is `617afd6` (docs-only, adding the round-1 findings
themselves). Verified against current code (still `0e80c63`/v0.5.2): every
round-1 bug is still present (spot-checked B1/B3/B5/B11 directly). They are
carried forward below, unchanged, plus two new findings (B14, B15) from a
fresh sweep of files round 1 didn't cover in depth (github.js, hooks.js).
Line numbers current as of `617afd6`.

## Carried forward from round 1 (still open, unchanged)

B1–B13 in `docs/fable-findings/bugs.md` are all still open as written. Do not
re-derive them — implement directly from that file. Summary for reference:

- B1: `Date.now()` notification ids defeat dedup (stocks.js, email.js, mcp-bridge.js)
- B2: time-bucketed ids accumulate instead of replacing (carbon.js)
- B3: eco threshold "0 to disable" coerced to 50 (eco.js:102)
- B4: unknown CLI command silently launches init wizard (bin/vibenotifications.js:66-69)
- B5: hardcoded plugin lists drifted from actual plugins (bin:64, add.js:8)
- B6: dashboard reports daemon "running" from a stale PID file (dashboard.js:36-38)
- B7: ICS parser has no line unfolding, no recurring events (google-calendar.js:112-137)
- B8: ICS dates ignore TZID (google-calendar.js:139-146)
- B9: changing the carbon model in config never updates an existing session (carbon.js:61-67)
- B10: `remove` leaves the removed source's notifications in the store (remove.js:9-16)
- B11: `loadSettings` doesn't merge defaults (config.js:17-23)
- B12: Opus CO2 rate contradicts itself between eco.js and the rate tables
- B13: Apple Calendar event ids collide for same-title events; `-f` flag garbles parsing

## New findings

### B14. GitHub plugin's `fetch()` doesn't catch its own errors, violating the plugin contract

- **File**: `src/plugins/github.js:39-59`
- **Bug**: every other plugin (`slack.js:41-73`, `x.js:49-71`, `stocks.js:41-69`)
  wraps its network/parsing logic in `try { ... } catch { /* silent */ }`, per
  the documented plugin contract (`docs/creating-plugins.md`, and
  `.claude/skills/vibenotifications-context/SKILL.md`: "`fetch()` MUST catch
  its own errors, return `[]`"). `github.js` does not — a malformed
  notification (`n.subject` null, which the GitHub notifications API can
  return for deleted/inaccessible subjects) throws inside `.map()` uncaught.
  `daemon.js:26-32` happens to catch it one level up today, so the daemon
  doesn't crash, but the entire fetch for that cycle silently drops (whereas
  a plugin-local catch would only drop the one bad notification), and any
  future direct caller of `plugin.fetch()` (e.g. round-1 A9's planned unit
  tests) will get an unhandled rejection instead of `[]`.
- **Fix**: wrap the body of `fetch` in try/catch matching the other plugins'
  style, and use `n.subject?.title ?? "(no title)"` / `n.repository?.full_name
  ?? "unknown repo"` defensively inside the `.map()`.

### B15. `installHooks` clobbers a pre-existing custom `statusLine` with no way back

- **File**: `src/core/hooks.js:72-75` (write), `:91-93` (removeHooks)
- **Bug**: `installHooks` unconditionally overwrites `settings.statusLine`
  with vibenotifications' own command, discarding any statusline command the
  user had configured before running `init`. The one general-purpose backup
  (`claude-settings.backup.json`, hooks.js:26-29) is written but nothing ever
  restores it. On `uninstall`, `removeHooks` deletes `settings.statusLine`
  whenever its command contains `.vibenotifications` (:91-93) — it can't tell
  "vibenotifications installed a fresh one" from "vibenotifications overwrote
  the user's", so the user's original statusline command is gone for good.
- **Fix**: in `installHooks`, before overwriting, if `settings.statusLine`
  exists and its command does NOT already reference `.vibenotifications`,
  persist it to `join(VN_DIR, "statusline.orig.json")`. In `removeHooks`,
  when deleting `settings.statusLine`, first check for that file and restore
  its contents into `settings.statusLine` instead of deleting, mirroring the
  fix already scoped for spinnerVerbs in `docs/fable-findings/security.md` S7
  (same pattern, same file, do both in one pass).

### B16. Corrupt/truncated JSON store files crash their readers uncaught

- **Files**: `src/core/config.js:22` (`loadSettings`), `:54`
  (`loadNotifications`)
- **Bug**: both do a bare `JSON.parse(readFileSync(...))` with no try/catch.
  A `notifications.json` or `settings.json` truncated by a crash mid-write
  (see architecture.md A10 — writes are non-atomic today) throws
  `SyntaxError` uncaught. For `loadNotifications`, every CLI command that
  touches the store (`dashboard`, `remove`, `add`) hard-crashes with a stack
  trace instead of the tool's usual silent-degrade behavior. For
  `loadSettings` called from `daemon-loop.js`'s `fetchOnce()`, the daemon's
  own try/catch (`daemon-loop.js:17-21`) catches it every cycle forever —
  a wedged, silently-erroring daemon that never recovers because the corrupt
  file is never replaced.
- **Fix**: wrap both `JSON.parse` calls in try/catch; on parse failure, log
  once to stderr and return `getDefaultSettings()` / `[]` respectively (same
  fallback already used for "file doesn't exist"). Do not auto-delete the
  corrupt file — leave it for the user/a future recovery path to inspect.
