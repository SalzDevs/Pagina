# Real-world HTML fixtures

Simplified pages modeled on common site shapes. They extend the hand-authored `examples/` demos with regression targets closer to pages users actually browse.

| Fixture | Modeled after | Exercises |
|---------|---------------|-----------|
| `blog-post.html` | Short-form article / blog post | Heading hierarchy, inline links, emphasis, blockquote |
| `docs-page.html` | Documentation article | `<pre>`/`<code>`, definition-style `<dl>`, intra-page links |
| `readme-page.html` | GitHub README | Tables, nested lists, inline code, external links |

## Known Pagina differences (all fixtures)

These fixtures intentionally avoid features Pagina does not implement. A real browser would differ in these ways:

- No JavaScript execution (dynamic nav, copy buttons, theme toggles)
- No CSS Grid/Flexbox layout (multi-column sidebars collapse to block flow)
- No web fonts or responsive images (`<picture>`, `srcset`)
- No form controls (`<input>`, `<button>`, `<select>`)
- No `:hover` / `:focus` / `:active` pseudo-class styling
- Images render as `[alt: …]` or `[image]` placeholders only

Each HTML file begins with an HTML comment documenting fixture-specific expectations.
