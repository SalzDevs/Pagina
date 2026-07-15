import { describe, expect, test } from "bun:test";

import { loadPageContent } from "../navigation/load-page";
import { buildPageView } from "../viewport/page-view";
import { layout } from "../layout/layout";
import { isFillCommand, isTextCommand } from "../paint/display-list";
import { createUxTestApp } from "./ux/setup";
import { findSpanStyles, meetsFocusContrast, spanContrastRatio } from "./ux/spans";
import { MIN_READABLE_CONTRAST_RATIO } from "../links/focus-style";
import { buildPaginaRender } from "./render-compare/pagina";
import { DEFAULT_VIEWPORT } from "./render-compare/fixtures";
import type { StyledNode } from "../style/style";
import { NodeType } from "../dom/node";

const EXAMPLE_COM = "https://example.com/";

function findBody(styled: StyledNode) {
  return styled.children[0]?.children.find(
    (child) => child.dom.type === NodeType.Element && child.dom.tag === "body",
  );
}

describe("example.com rendering parity", () => {
  test("preserves browser-visible words and link target", async () => {
    const pagina = await buildPaginaRender(EXAMPLE_COM, DEFAULT_VIEWPORT);
    const collapsed = pagina.plainText.replace(/\s+/g, " ").toLowerCase();

    expect(collapsed).toContain("example domain");
    expect(collapsed).toContain("learn more");
    expect(pagina.links[0]?.href).toBe("https://iana.org/domains/example");
    expect(pagina.cssWarnings).toEqual([]);
  });

  test("applies light page background and dimmed author link color", async () => {
    const page = await loadPageContent(EXAMPLE_COM, {
      viewportWidth: DEFAULT_VIEWPORT.width,
      viewportHeight: DEFAULT_VIEWPORT.height,
    });
    const view = buildPageView(page.styled, DEFAULT_VIEWPORT);

    const bodyFill = view.displayList.find(
      (command) => isFillCommand(command) && command.bg === "#eee",
    );
    const linkText = view.displayList
      .filter(isTextCommand)
      .find((command) => command.text === "Learn more");

    expect(bodyFill).toBeDefined();
    expect(linkText?.fg).toBe("#58669c");
  });

  test("renders readable body text contrast in the terminal", async () => {
    const ctx = await createUxTestApp(EXAMPLE_COM);
    const bodySpan = findSpanStyles(ctx.captureSpans(), "This domain")[0];

    expect(bodySpan).toBeDefined();
    expect(spanContrastRatio(bodySpan!)).toBeGreaterThanOrEqual(MIN_READABLE_CONTRAST_RATIO);
    expect(meetsFocusContrast(findSpanStyles(ctx.captureSpans(), "Learn more")[0]!)).toBe(true);

    await ctx.cleanup();
  });

  test("centers the page card at roughly 48 columns", async () => {
    const page = await loadPageContent(EXAMPLE_COM, {
      viewportWidth: DEFAULT_VIEWPORT.width,
      viewportHeight: DEFAULT_VIEWPORT.height,
    });
    const laidOut = layout(page.styled, { viewport: DEFAULT_VIEWPORT });
    const body = findBody(page.styled);
    const box = laidOut.output.getLayout(body!);

    expect(box?.width).toBe(48);
    expect(box?.x).toBe(16);
  });

  test("dims text inside semi-transparent blocks", async () => {
    const page = await loadPageContent(EXAMPLE_COM, {
      viewportWidth: DEFAULT_VIEWPORT.width,
      viewportHeight: DEFAULT_VIEWPORT.height,
    });
    const view = buildPageView(page.styled, DEFAULT_VIEWPORT);
    const bodyText = view.displayList
      .filter(isTextCommand)
      .find((command) => command.text.includes("This domain"));

    expect(bodyText?.fg).toBe("#303030");
  });
});
