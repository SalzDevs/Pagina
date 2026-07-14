# Pagina

A terminal-first web browser built with [Bun](https://bun.sh), [OpenTUI](https://github.com/openTUI/opentui), and parse5. Pagina loads HTML pages (local files or remote URLs), applies CSS, lays out content for a monospace viewport, and renders it in the terminal with link navigation, scrolling, history, and mouse support.

## Requirements

- [Bun](https://bun.sh) 1.x

## Install

```bash
bun install
```

## Run

```bash
# Default home page
bun run start

# Open a specific page (local file or URL)
bun run index.ts examples/links-page.html
bun run index.ts https://example.com

# Open with a fragment
bun run index.ts examples/fragments-page.html#chapter-3
```

Press **`?`** at any time to show in-app keyboard and mouse help. Press **`:`** to open a URL or local file path without restarting.

## Test

```bash
bun test
```

## Example pages

| Page | Command | What it demonstrates |
|------|---------|----------------------|
| `examples/page.html` | `bun run start` | Minimal home page |
| `examples/lists-page.html` | `bun run index.ts examples/lists-page.html` | Bulleted and numbered lists |
| `examples/links-page.html` | `bun run index.ts examples/links-page.html` | Link focus, click, keyboard nav |
| `examples/other-page.html` | (via links demo) | Cross-page navigation |
| `examples/styled-page.html` | `bun run index.ts examples/styled-page.html` | Inline CSS selectors |
| `examples/linked-page.html` | `bun run index.ts examples/linked-page.html` | External stylesheet |
| `examples/long-page.html` | `bun run index.ts examples/long-page.html` | Scrolling |
| `examples/fragments-page.html` | `bun run index.ts examples/fragments-page.html` | In-page `#fragment` links |
| `examples/nested/catalog.html` | `bun run index.ts examples/nested/catalog.html` | `<base href>` resolution |
| `examples/images-page.html` | `bun run index.ts examples/images-page.html` | Image alt-text placeholders |
| `examples/table-page.html` | `bun run index.ts examples/table-page.html` | Monospace table columns |
| `examples/definitions-page.html` | `bun run index.ts examples/definitions-page.html` | Definition list indents |

## Keyboard & mouse

| Keys | Action |
|------|--------|
| `↑` / `↓`, `j` / `k` | Scroll one line |
| `PgUp` / `PgDn` | Scroll one page |
| `Home` / `End`, `g` / `G` | Jump to top / bottom |
| `[` / `]` | Previous / next link |
| `Enter`, `o` | Follow focused link |
| `u` | Back |
| `U` (Shift+u) | Forward |
| `Option+←` / `Option+→` | Back / forward (macOS) |
| Mouse wheel | Scroll |
| Mouse hover | Focus link under cursor |
| Mouse click | Follow link under cursor |
| `:` | Open a URL or file path |
| `?` | Toggle help overlay |
| `Ctrl+C` | Quit |

The breadcrumb bar at the top shows your navigation trail. The current page is wrapped in `[brackets]`.

## Pipeline

Pagina processes each page through a linear pipeline:

```
load → parseHTML → convert → computeStyles → layout → paint → mountDisplayList
```

| Stage | Role |
|-------|------|
| **load** | Fetch local files or remote URLs |
| **parse / convert** | parse5 HTML → internal DOM |
| **computeStyles** | UA defaults, author CSS, inline styles |
| **layout** | Block/inline flow, word wrap |
| **paint** | Display list (text + block backgrounds) |
| **render** | OpenTUI viewport with scroll and link focus |

## Features

- Local and remote pages
- `<link rel="stylesheet">`, `<style>`, and inline CSS
- Basic `@media` queries (`screen`, `min-width`, `max-width` against terminal columns)
- `<base href>` for relative URLs
- Back/forward history with scroll restoration
- Fragment (`#section`) navigation
- Navigable error pages when loads fail
- Terminal resize relayout
- Mouse hover, click, and wheel scrolling

## CSS support

Pagina implements a small subset of CSS aimed at terminal rendering. Supported today:

- Selectors: tag, class, id, and simple descendant chains
- Common text and box properties (`color`, `background`, spacing, `font-size`, etc.)
- `@media` queries for `screen`, `min-width`, and `max-width` (compared against terminal columns; `ch` and `px` map 1:1 to columns)

Not supported or ignored:

- `@supports`, `@keyframes`, and most other at-rules
- Complex selectors (`:hover`, `::before`, attribute selectors)
- `@media` features beyond width (orientation, resolution, etc.)

Media queries are evaluated when styles are computed and re-evaluated on terminal resize.

## License

Private project.
