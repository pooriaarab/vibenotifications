# Findings: architecture

Structural improvements. Line numbers as of commit `0e80c63` (v0.5.2).
Constraint to respect throughout: hook files (`src/hooks/*`, `src/statusline.js`)
are COPIED standalone into `~/.vibenotifications/` by
`src/core/hooks.js:10-23` and cannot import from `src/core/` at runtime.

## A1. CO₂ tables duplicated in three files (already drifted once)

- **Files**: `src/plugins/carbon.js:12-41`, `src/statusline.js:11-27`,
  quoted numbers in `src/plugins/eco.js:25,32` (drift: see bugs.md B12)
- **Issue**: `CO2_RATES` + `COMPARISONS` are hand-synced copies.
- **Fix (respects the copy constraint)**: create `src/carbon-constants.js`
  (sibling of `src/statusline.js`) exporting `CO2_RATES`, `COMPARISONS`,
  `getComparison`. Add it to the `hookFiles` copy list in `hooks.js:12-17`
  with dest `VN_DIR/carbon-constants.js` — i.e. next to the copied
  `statusline.js`. Then `statusline.js` imports `./carbon-constants.js`
  (resolves identically in the repo layout and the copied layout),
  `src/plugins/carbon.js` imports `../carbon-constants.js`, and
  `src/hooks/carbon-track.js` needs nothing (it stores counts only, no
  rates). eco.js interpolates its prompt numbers from `CO2_RATES` instead of
  literals. Delete the two duplicated tables.

## A2. Spinner-verb logic duplicated, and the copies disagree

- **Files**: `src/core/surfaces.js:26-49` vs `src/hooks/post-tool.js:35-49`
- **Issue**: both write `settings.spinnerVerbs` into `~/.claude/settings.json`,
  but only the surfaces.js version respects
  `surfaces.spinnerVerbs.enabled`, `maxLength`, and the
  `priority.minSpinner` filter; the post-tool copy ignores all three, so
  disabling the spinner surface in settings does NOT actually disable it.
- **Fix**: make the daemon the single writer — delete the spinner-verb block
  from `post-tool.js:34-49` entirely. The daemon already refreshes verbs every
  `fetchInterval` (60s default); per-tool-call freshness is not needed for a
  list of up to 20 verbs. This also removes one of the settings.json race
  writers (see A4).

## A3. Dead exports: `getSessionSummary` and `getContextInjection`

- **File**: `src/core/surfaces.js:65-103`
- **Issue**: neither function is imported anywhere (verified by grep). The
  live implementations are the self-contained copies in
  `src/hooks/session-start.js:33-47` and `src/hooks/post-tool.js:52-76`, which
  have since evolved (forceInject support) while the dead ones didn't.
- **Fix**: delete both functions and the now-unused `sanitize` at
  `surfaces.js:100-103`. Add a comment in surfaces.js pointing to the hook
  files as the owners of session-summary and context-injection logic.

## A4. `~/.claude/settings.json` written non-atomically by multiple processes

- **Files**: `src/core/surfaces.js:44`, `src/hooks/post-tool.js:44`,
  `src/core/hooks.js:77`
- **Issue**: read-modify-`writeFileSync` with no atomicity. The daemon, the
  PostToolUse hook (every tool call), and Claude Code itself can interleave:
  lost updates at best, a truncated/corrupt settings.json (breaking the user's
  Claude Code) at worst.
- **Fix**: (a) implement A2 first (removes one writer); (b) in the remaining
  writers (`surfaces.js updateSpinnerVerbs`, `hooks.js
  installHooks/removeHooks`), write atomically: serialize, `writeFileSync` to
  `${CLAUDE_SETTINGS}.vn-tmp` in the same directory, then `renameSync` over
  the target; (c) in `updateSpinnerVerbs`, skip the write entirely when the
  serialized `verbs` array equals the currently stored one (cheap
  `JSON.stringify` compare) — steady-state daemon cycles then write nothing.

## A5. Plugin fetches are sequential with no network timeout — one hung source stalls the daemon

- **Files**: `src/core/daemon.js:24-33`, all `fetch()` calls in
  `src/plugins/*.js` (e.g. slack.js:42-51 does up to 6 serial HTTP calls)
- **Fix**: in `fetchOnce`, run plugins concurrently:
  ```js
  const results = await Promise.allSettled(
    enabledPlugins.map(({ plugin, config }) => plugin.fetch(config)));
  ```
  keeping the per-plugin success/error log lines. Add
  `signal: AbortSignal.timeout(10_000)` to every `fetch()` call in
  `src/plugins/github.js`, `slack.js`, `x.js`, `stocks.js`,
  `google-calendar.js` (both call sites) — global fetch supports it on
  Node ≥ 17.3, and the plugins' existing try/catch already handles the
  TimeoutError.

## A6. Daemon is a black box — `stdio: "ignore"` swallows all errors

- **Files**: `src/core/daemon.js:56-63`, `src/core/daemon-loop.js:20`
- **Issue**: `daemon-loop.js` `console.error`s on failure, but the parent
  spawns it with `stdio: "ignore"`, so nothing is ever observable. Silent
  8-day-outage class of failure.
- **Fix**: in `startDaemon`, open a log file and wire it in:
  ```js
  const log = openSync(join(VN_DIR, "daemon.log"), "a");
  spawn(process.execPath, [daemonLoopScript], { detached: true,
        stdio: ["ignore", log, log] });
  ```
  In `daemon-loop.js`, prefix each loop error with an ISO timestamp. Add a
  size guard at daemon start: if `daemon.log` > 1 MB, truncate it (simple
  `writeFileSync(path, "")`). Surface the log path in
  `src/cli/dashboard.js` output.

## A7. Daemon never picks up settings changes

- **File**: `src/core/daemon-loop.js:12-13`
- **Issue**: `fetchInterval` is read once at spawn; `fetchOnce` re-loads
  settings per cycle (daemon.js:14) so sources update, but interval changes
  require a manual stop/start nobody knows to do.
- **Fix**: move the `loadSettings()` call inside the `while` loop and compute
  the sleep from the fresh value each iteration. Delete the top-level read.

## A8. Installed hooks go stale on package upgrade

- **Files**: `src/core/hooks.js:10-23`, `src/core/daemon.js:46`
- **Issue**: hooks are copied at `init` time only. `npm update -g
  vibenotifications` leaves old copies in `~/.vibenotifications/` running
  forever (this exact failure shipped as v0.5.2 — see commit `0e80c63`
  "actually include statusline.js this time").
- **Fix**: extract the file-copy block of `installHooks` (hooks.js:12-23) into
  an exported `syncHookFiles()` and call it at the top of both `startDaemon`
  and `fetchOnce` in `daemon.js` (idempotent, 4 small file copies). Settings
  mutation stays init-only.

## A9. No tests, no CI, no npm scripts

- **Files**: `package.json` (no `scripts` at all), no `.github/workflows/`,
  zero test files in repo
- **Fix (minimal, zero new deps)**:
  1. Add `"scripts": { "test": "node --test test/" }` to package.json.
  2. Create `test/queue.test.js` (node:test) covering
     `deduplicateNotifications`, `sortByPriority`, `filterByMinPriority`,
     `trimNotifications` — pure functions, no mocking needed.
  3. Create `test/ics.test.js` for `parseICS`/`parseICSDate` — requires
     exporting them from `src/plugins/google-calendar.js` (add named exports;
     the default export is untouched).
  4. Create `test/sanitize.test.js` exercising post-tool's sanitize via a
     child-process invocation: pipe `{}` on stdin with a crafted
     `HOME`-pointed temp dir containing a malicious notifications.json;
     assert stdout contains no `<` / control chars.
  5. `.github/workflows/ci.yml`: on push/PR, Node 20 + 22 matrix,
     `node --check` every file in `bin/ src/`, then `npm test`.

## A10. Store writes are non-atomic while three other processes read them

- **Files**: `src/core/config.js:57-60` (`saveNotifications`), readers
  `src/statusline.js:67`, `src/hooks/post-tool.js:28`,
  `src/hooks/session-start.js:27`
- **Issue**: statusline runs every few seconds and can catch
  `notifications.json` mid-write. All readers try/catch, so the symptom is
  a blank status line flicker, not a crash — but it's free to fix.
- **Fix**: in `saveNotifications` and `saveSettings`, write to
  `<file>.tmp` then `renameSync` (same pattern as A4b). Keep `mode: 0o600`
  from security.md S1 on the tmp write.

## A11. `stopDaemon` can throw on a missing PID file race; `remove`/`uninstall` call it blind

- **File**: `src/core/daemon.js:70-84`
- **Issue**: between `isDaemonRunning()` (which may `unlinkSync` a stale PID
  file at `:93`) and the `readFileSync` at `:76` the file can be gone —
  unhandled ENOENT. Low probability, trivial fix.
- **Fix**: wrap the read+kill+unlink body in one try/catch that treats ENOENT
  as "No daemon running." and always attempts the unlink inside the same
  try (with `{ force: true }`-style guard: `if (existsSync(PID_FILE))`).
