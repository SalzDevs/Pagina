import { describe, expect, test } from "bun:test";

import { loadPageContent } from "../navigation/load-page";
import { buildPageView } from "../viewport/page-view";
import { isFillCommand, isTextCommand } from "../paint/display-list";
import { createUxTestApp } from "./ux/setup";
import { findSpanStyles, meetsFocusContrast, spanContrastRatio } from "./ux/spans";
import { MIN_READABLE_CONTRAST_RATIO } from "../links/focus-style";
import { buildPaginaRender } from "./render-compare/pagina";
import { DEFAULT_VIEWPORT } from "./render-compare/fixtures";

const EXAMPLE_COM = "https://example.com/";

describe("example.com rendering parity", () => {
  test("preserves browser-visible words and link target", async () => {
    const pagina = await buildPaginaRender(EXAMPLE_COM, DEFAULT_VIEWPORT);
    const collapsed = pagina.plainText.replace(/\s+/g, " ").toLowerCase();

    expect(collapsed).toContain("example domain");
    expect(collapsed).toContain("learn more");
    expect(pagina.links[0]?.href).toBe("https://iana.org/domains/example");
    expect(pagina.cssWarnings).toEqual([]);
  });

  test("applies light page background and author link color", async () => {
    const page = await loadPageContent(EXAMPLE_COM, { viewportWidth: DEFAULT_VIEWPORT.width });
    const view = buildPageView(page.styled, DEFAULT_VIEWPORT);

    const bodyFill = view.displayList.find(
      (command) => isFillCommand(command) && command.bg === "#eee",
    );
    const linkText = view.displayList
      .filter(isTextCommand)
      .find((command) => command.text === "Learn more");

    expect(bodyFill).toBeDefined();
    expect(linkText?.fg).toBe("#348");
  });

  test("renders readable body text contrast in the terminal", async () => {
    const ctx = await createUxTestApp(EXAMPLE_COM);
    const bodySpan = findSpanStyles(ctx.captureSpans(), "This domain")[0];

    expect(bodySpan).toBeDefined();
    expect(spanContrastRatio(bodySpan!)).toBeGreaterThanOrEqual(MIN_READABLE_CONTRAST_RATIO);
    expect(meetsFocusContrast(findSpanStyles(ctx.captureSpans(), "Learn more")[0]!)).toBe(true);

    await ctx.cleanup();
  });
});
