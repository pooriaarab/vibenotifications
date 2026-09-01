# Brand Context

## Identity

`vibenotifications` brings external events into Claude Code while the user works.
The product uses a bell, `🔔`, as its landing-page mark.

## Audience

The primary audience is Claude Code users who monitor work or personal services.
They value awareness without leaving the terminal.

## Promise

Keep important events visible across five Claude Code surfaces.
Stay lightweight, configurable, and quiet when nothing needs attention.

## Voice

- Use direct, technical language.
- Lead with the event, source, or required action.
- Keep terminal text brief enough to scan.
- Explain resource estimates as estimates.
- Avoid hype, urgency, and unsupported savings claims.

## Claims

Current source supports these claims:

- Notifications can use spinner verbs, the status line, context, session summaries, and a dashboard.
- Sources include GitHub, Slack, X, email, markets, calendars, local event files, and MCP status.
- Carbon tracking and Eco Mode are optional plugins.
- The Node.js package has no runtime dependencies.
- Setup stores local configuration under `~/.vibenotifications`.

Do not promise accuracy, savings, delivery speed, or service availability without current evidence.

## Naming

- Write `vibenotifications` for the product, package, command, and repository.
- Use lowercase plugin IDs in code and configuration.
- Use readable service names, such as `GitHub` and `Google Calendar`, in prose.
- Use the configured plugin icon and label in terminal output.

## Assets

- Landing page: `site/index.html`
- Landing styles: `site/style.css`
- Terminal renderer: `src/statusline.js`
- Product copy: `README.md`
