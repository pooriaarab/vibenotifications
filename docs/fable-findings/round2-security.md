# Round 2 findings: security

Round 1 (`docs/fable-findings/security.md`) shipped no fixes — the only
commit since is `617afd6` (docs-only). Verified against current code (HEAD
`617afd6`, content unchanged since `0e80c63`/v0.5.2): S1–S7 are all still
open exactly as written (spot-checked S1's `writeFileSync` mode, S4's missing
`sanitize()` in session-start.js, S6's loose URL regex in surfaces.js:96).
Do not re-derive them — implement directly from that file. Summary for
reference:

- S1: API tokens stored world-readable, `settings.json` written 0644
- S2: terminal escape injection via statusline (external titles printed raw)
- S3: `forceInject` honored from data, not restricted to trusted sources
- S4: SessionStart hook injects external titles with no sanitization
- S5: secret inputs (`type: "secret"`) echoed in plaintext during setup
- S6: injected URLs only scheme-checked, arbitrary text rides in after `https://`
- S7: `uninstall` never restores the settings backup; spinnerVerbs deleted not restored

No new security findings from this pass's fresh sweep (`prompts.js` textInput,
`mcp-bridge.js`, `post-tool.js` sanitize path). All are implementable
without touching live credentials — see `round2-human-required.md` for the
(empty) human-required list and why.
