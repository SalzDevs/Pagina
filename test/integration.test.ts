import { resolve } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

import { buildLinkHitIndex, linkIndexAtPoint } from "../links/hit";
import { ERROR_PAGE_TITLE } from "../navigation/error-page";
import { loadPageContent } from "../navigation/load-page";
import { computeStyles, type StyledNode } from "../style/style";
import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { mountDisplayList } from "../render/render";
import { BREADCRUMB_HEIGHT } from "../render/breadcrumb";
import { isTextCommand } from "../paint/display-list";
import { buildPageView } from "../viewport/page-view";
import { createBrowserSession } from "../viewport/session";
import { clampScrollY } from "../viewport/scroll";
import { mouseToDocumentPoint } from "../viewport/mouse";
import { createTestRenderer } from "./helpers/test-renderer";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function findBody(styled: StyledNode) {
  return styled.children[0]?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === "body",
  );
}

async function ensureStylesForViewport(
  page: Awaited<ReturnType<typeof loadPageContent>>,
  viewportWidth: number,
) {
  if (page.stylesViewportWidth === viewportWidth) return page;

  const cssWarnings: string[] = [];
  const styled = await computeStyles(page.dom, {
    pageLocation: page.pageLocation,
    documentBase: page.documentBase,
    viewportWidth,
    cssWarnings,
  });

  return {
    ...page,
    styled,
    stylesViewportWidth: viewportWidth,
    cssWarnings,
  };
}

describe("painted page content", () => {
  test("includes list item text in the display list from examples/lists-page.html", async () => {
    const page = await loadPageContent("examples/lists-page.html");
    const view = buildPageView(page.styled, { width: 60, height: 30 });
    const text = view.displayList
      .filter(isTextCommand)
      .map((command) => command.text)
      .join("");

    expect(text).toContain("First item");
    expect(text).toContain("Step one");
    expect(text).toContain("Inner A");
  });
});

describe("mountDisplayList lifecycle", () => {
  test("cleans up renderables across destroy and remount cycles", async () => {
    const renderer = createTestRenderer();
    const styled = await computeStyles(convert(parseHTML("<p>hello terminal browser</p>")));
    const layout = { top: BREADCRUMB_HEIGHT, width: 40, height: 10 };

    const firstView = buildPageView(styled, { width: layout.width, height: layout.height });
    const firstMount = mountDisplayList(
      renderer,
      firstView.displayList,
      firstView.contentHeight,
      null,
      layout,
    );
    firstMount.setScrollY(3);
    expect(renderer.root.getChildren()).toHaveLength(1);

    firstMount.destroy();
    expect(renderer.root.getChildren()).toHaveLength(0);

    const secondView = buildPageView(styled, { width: 20, height: layout.height });
    const secondMount = mountDisplayList(
      renderer,
      secondView.displayList,
      secondView.contentHeight,
      null,
      { ...layout, width: 20 },
    );
    secondMount.relayout(secondView.displayList, secondView.contentHeight, {
      ...layout,
      width: 20,
    });
    expect(renderer.root.getChildren()).toHaveLength(1);

    secondMount.destroy();
    renderer.destroy();
    expect(renderer.root.getChildren()).toHaveLength(0);
  });
});

describe("browser session relayout", () => {
  test("preserves scroll position when possible and clamps when content shrinks", async () => {
    const renderer = createTestRenderer(80, 24);
    const html = "<p>one two three four five six seven eight nine ten eleven twelve</p>";
    const styled = await computeStyles(convert(parseHTML(html)));
    const narrowLayout = { top: BREADCRUMB_HEIGHT, width: 12, height: 10 };
    const wideLayout = { top: BREADCRUMB_HEIGHT, width: 40, height: 10 };

    const narrowView = buildPageView(styled, {
      width: narrowLayout.width,
      height: narrowLayout.height,
    });
    const scrolledFar = narrowView.contentHeight - 1;

    const session = createBrowserSession(
      renderer,
      narrowView.displayList,
      narrowView.contentHeight,
      narrowView.links,
      {
        pageLocation: "examples/page.html",
        documentBase: "examples/page.html",
        layout: narrowLayout,
        fragmentPositions: narrowView.fragmentPositions,
        initialScrollY: scrolledFar,
        onNavigate: () => {},
      },
    );

    const wideView = buildPageView(styled, {
      width: wideLayout.width,
      height: wideLayout.height,
    });
    session.relayout(wideView, wideLayout);

    expect(session.viewport.scrollY).toBe(
      clampScrollY(
        {
          scrollY: scrolledFar,
          viewportHeight: wideLayout.height,
          contentHeight: wideView.contentHeight,
        },
        scrolledFar,
      ),
    );
    expect(session.viewport.scrollY).toBeLessThan(scrolledFar);

    session.destroy();
    renderer.destroy();
  });
});

describe("mouse hover focus churn", () => {
  test("ignores repeated hover events on the same cell", async () => {
    const linksPagePath = resolve("examples/links-page.html");
    const page = await loadPageContent(linksPagePath);
    const view = buildPageView(page.styled, { width: 80, height: 20 });
    const layout = { top: BREADCRUMB_HEIGHT, width: 80, height: 20 };
    const hitIndex = buildLinkHitIndex(view.links);
    const firstLink = view.links[0];
    expect(firstLink).toBeDefined();

    let lastHoverCell: { x: number; y: number } | null = null;
    let focusedIndex: number | null = null;
    let focusUpdates = 0;

    const move = (screenX: number, screenY: number) => {
      const point = mouseToDocumentPoint({ x: screenX, y: screenY }, layout, 0);
      const cell = { x: Math.trunc(point.x), y: Math.trunc(point.y) };
      if (lastHoverCell?.x === cell.x && lastHoverCell?.y === cell.y) return;

      lastHoverCell = cell;
      const index = linkIndexAtPoint(hitIndex, point.x, point.y);
      if (index === focusedIndex) return;

      focusedIndex = index;
      focusUpdates += 1;
    };

    const bound = firstLink!.bounds[0]!;
    const screenX = bound.x;
    const screenY = layout.top + bound.y;

    move(screenX, screenY);
    move(screenX, screenY);
    move(screenX + 0.2, screenY + 0.2);

    const secondLink = view.links[1];
    expect(secondLink).toBeDefined();
    const secondBound = secondLink!.bounds[0]!;
    move(secondBound.x, layout.top + secondBound.y);

    expect(focusedIndex).toBe(1);
    expect(focusUpdates).toBe(2);
  });
});

describe("remote page load failures", () => {
  test("builds an error page when remote HTML fetch fails", async () => {
    globalThis.fetch = (async () =>
      new Response("missing", { status: 404, statusText: "Not Found" })) as typeof fetch;

    const page = await loadPageContent("https://example.com/missing");

    expect(page.isErrorPage).toBe(true);
    expect(page.pageTitle).toBe(ERROR_PAGE_TITLE);
    expect(page.pageLocation).toBe("https://example.com/missing");
  });

  test("records css warnings when remote stylesheets fail during page load", async () => {
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url.endsWith("page.html")) {
        return new Response(
          '<html><head><link rel="stylesheet" href="theme.css" /></head><body>Hello</body></html>',
          { status: 200 },
        );
      }
      return new Response("missing", { status: 404, statusText: "Not Found" });
    }) as typeof fetch;

    const page = await loadPageContent("https://example.com/page.html");

    expect(page.isErrorPage).toBe(false);
    expect(page.cssWarnings).toEqual(["https://example.com/theme.css"]);
  });
});

describe("linked stylesheet cascade", () => {
  test("applies linked rules in document order through the page pipeline", async () => {
    const html = `
      <html>
        <head>
          <link rel="stylesheet" href="first.css" />
          <style>body { color: white; }</style>
          <link rel="stylesheet" href="second.css" />
        </head>
        <body>Hello</body>
      </html>
    `;

    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url === "https://example.com/page.html") {
        return new Response(html, { status: 200 });
      }
      if (url.endsWith("first.css")) {
        return new Response("body { color: red; }", { status: 200 });
      }
      if (url.endsWith("second.css")) {
        return new Response("body { color: blue; }", { status: 200 });
      }
      return new Response("", { status: 404 });
    }) as typeof fetch;

    const page = await loadPageContent("https://example.com/page.html");
    const body = findBody(page.styled);

    expect(body?.style.fg).toBe("blue");
  });
});

describe("page resize lifecycle", () => {
  test("recomputes styles and preserves clamped scroll across viewport changes", async () => {
    const paragraphs = Array.from({ length: 12 }, (_, index) => `<p>Paragraph ${index + 1} with enough words to wrap</p>`).join("");
    const html = `
      <style>
        @media (min-width: 40ch) {
          body { color: navy; }
        }
      </style>
      <body>${paragraphs}</body>
    `;
    globalThis.fetch = (async () => new Response(html, { status: 200 })) as typeof fetch;

    let page = await loadPageContent("https://example.com/responsive", { viewportWidth: 20 });
    const narrowLayout = { top: BREADCRUMB_HEIGHT, width: 20, height: 8 };
    const narrowView = buildPageView(page.styled, {
      width: narrowLayout.width,
      height: narrowLayout.height,
    });
    const scrolledFar = narrowView.contentHeight - 1;

    page = await ensureStylesForViewport(page, 50);
    const wideLayout = { top: BREADCRUMB_HEIGHT, width: 50, height: 8 };
    const wideView = buildPageView(page.styled, {
      width: wideLayout.width,
      height: wideLayout.height,
    });
    const nextScrollY = clampScrollY(
      {
        scrollY: scrolledFar,
        viewportHeight: wideLayout.height,
        contentHeight: wideView.contentHeight,
      },
      scrolledFar,
    );

    expect(findBody(page.styled)?.style.fg).toBe("navy");
    expect(wideView.contentHeight).toBeLessThan(narrowView.contentHeight);
    expect(nextScrollY).toBeLessThan(scrolledFar);
    expect(nextScrollY).toBeLessThanOrEqual(
      Math.max(0, wideView.contentHeight - wideLayout.height),
    );
  });
});
