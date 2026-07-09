# Round 2 findings: architecture

Round 1 (`docs/fable-findings/architecture.md`) shipped no fixes — the only
commit since is `617afd6` (docs-only). Verified against current code (still
`0e80c63`/v0.5.2 content, `617afd6` HEAD): A1–A11 are all still open exactly
as written. Do not re-derive them — implement directly from that file.
Summary for reference:

- A1: CO2 tables duplicated in three files (carbon.js, statusline.js, eco.js)
- A2: spinner-verb logic duplicated between surfaces.js and post-tool.js, copies disagree
- A3: dead exports `getSessionSummary`/`getContextInjection` in surfaces.js
- A4: `~/.claude/settings.json` written non-atomically by multiple processes
- A5: plugin fetches are sequential, no network timeout
- A6: daemon is a black box, `stdio: "ignore"` swallows all errors
- A7: daemon never picks up settings changes (`fetchInterval` read once at spawn)
- A8: installed hooks go stale on package upgrade
- A9: no tests, no CI, no npm scripts
- A10: store writes (`notifications.json`, `settings.json`) are non-atomic
- A11: `stopDaemon` can throw on a missing PID file race

No new architecture findings from this pass's fresh sweep (`config.js`,
`surfaces.js`, `daemon.js`, `daemon-loop.js`, `mcp-bridge.js`, `uninstall.js`)
beyond bug-level defects, which are filed in `round2-bugs.md` (B16) instead —
a crash from unguarded `JSON.parse` is a concrete defect with a one-line fix,
not a structural issue.
