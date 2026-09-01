# Design Context

## Overview

The shipped surfaces are the landing page and terminal output.
Use `site/style.css` for web rules and `src/statusline.js` for terminal rules.
Keep the interface dark, compact, and information-first.

## Colors

The landing page uses these roles:

- Canvas: `#0a0a0a`.
- Cards: `#111111`, `#141414`, and `#161616`.
- Borders: `#1e1e1e`, `#262626`, and `#303030`.
- Primary text: `#e5e5e5` and `#ffffff`.
- Muted text: `#a3a3a3`, `#737373`, and `#525252`.
- Brand amber: `#f59e0b`; hover amber: `#fbbf24`.
- Hero gradient: `#f59e0b` to `#f97316` at 135 degrees.
- Success: `#22c55e`.
- Source accents: GitHub `#a78bfa`, Slack `#38bdf8`, and email `#fb923c`.

Terminal output uses ANSI yellow for labels and ANSI gray for secondary text.
Always reset ANSI styles after colored output.

## Typography

- Use the system sans stack from `site/style.css` for interface text.
- Use the existing SF Mono, Cascadia Code, Fira Code, and Menlo stack for code.
- Keep body line height at `1.6`.
- Set hero titles between `2.5rem` and `4rem` with `clamp()`.
- Set section titles between `1.6rem` and `2.25rem` with `clamp()`.
- Let the user's terminal control terminal fonts and sizes.

## Layout

- Center page content within a `1080px` container.
- Keep horizontal page padding at `1.5rem`.
- Use three feature columns on wide screens.
- Use two columns below `768px` and one below `480px`.
- Keep the install control within `620px` and the terminal within `680px`.
- Keep status labels on one line.
- Put a valid notification URL on a separate line with two leading spaces.

## Elevation & Depth

- Use borders and small background changes for cards and controls.
- Reserve the large shadow for the terminal mockup.
- Use its existing two-part shadow from `site/style.css`.
- Do not add shadows to terminal output.

## Shapes

- Use full pills for the hero badge.
- Use `12px` corners for the terminal and feature grid.
- Use `10px` corners for install and surface cards.
- Use `6px` corners for small footer badges.
- Use circles for terminal window controls.
- Use square brackets around terminal source labels.

## Components

- Hero: badge, product name, promise, and install command.
- Install control: prompt, command, and copy state.
- Terminal mockup: title bar, source lines, times, spinner, and cursor.
- Feature grid: one source per card with its assigned accent.
- Surface list: five numbered Claude Code destinations.
- Status line: sanitized source label, title, and optional HTTPS link.
- Dashboard and session summary: dense text surfaces, not marketing pages.

## Do's and Don'ts

- Do keep landing-page changes consistent with `site/style.css`.
- Do sanitize external terminal text and URLs before rendering.
- Do keep spinner entries within the configured maximum length.
- Do preserve visible focus and readable contrast.
- Do add reduced-motion handling when adding animation.
- Don't invent new colors when an existing role fits.
- Don't place unsanitized notification content inside ANSI or OSC sequences.
- Don't make terminal typography depend on a specific local font.
