# Round 2 findings: human-required

None of round 1's or round 2's findings need a human hand. Checked
specifically for the disqualifying categories:

- **Live credentials in the repo to rotate**: none found.
  `grep -rniE "ghp_|xox[bp]-|sk-|AIza"` across the tree turns up only
  placeholder strings in docs/prompts/validation messages
  (`docs/configuration.md:14`, `src/plugins/github.js:18-19`,
  `src/plugins/slack.js:17-21`) — no committed tokens.
- **Auth semantics changes that could lock out real users**: none of the
  open findings touch how a user authenticates; they're local-file handling,
  dedup logic, and sanitization.
- **Irreversible/destructive data operations**: `uninstall.js`'s `rmSync` on
  `~/.vibenotifications/` is existing, documented, user-invoked behavior —
  not a new finding. Nothing in bugs/architecture/security proposes deleting
  data as a *fix*.
- **CI/publish secrets**: architecture.md A9 (add CI) only needs
  `node --check` + `npm test`, no `NPM_TOKEN` or other secret — there's no
  `.github/workflows/` today and the proposed one doesn't publish.

If a future round finds something in this bucket (e.g. rotating a
compromised token, or a fix that changes what `uninstall` deletes), file it
here instead of the mechanical-findings docs.
