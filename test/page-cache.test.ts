import { describe, expect, test } from "bun:test";

import { NodeType } from "../dom/node";
import { loadPageContent } from "../navigation/load-page";
import { PageCache, resolveLoadedPage, type LoadedPageContent } from "../navigation/page-cache";

function stubPage(overrides: Partial<LoadedPageContent> = {}): LoadedPageContent {
  const dom = { type: NodeType.Document, children: [] };
  return {
    pageLocation: "examples/page.html",
    documentBase: "examples/page.html",
    dom,
    styled: {
      dom,
      style: { display: "block", bold: false, italic: false, underline: false },
      children: [],
    },
    isErrorPage: false,
    stylesViewportWidth: 80,
    cssWarnings: [],
    ...overrides,
  };
}

describe("PageCache", () => {
  test("stores and retrieves pages by location", () => {
    const cache = new PageCache();
    const page = stubPage({ pageTitle: "Home" });

    cache.set(page);

    expect(cache.get("examples/page.html")).toBe(page);
    expect(cache.size).toBe(1);
  });
});

describe("resolveLoadedPage", () => {
  test("reuses a cached page when reload is not forced", async () => {
    const cache = new PageCache();
    const cached = stubPage();
    cache.set(cached);

    let loadCalls = 0;
    const page = await resolveLoadedPage(
      "examples/page.html",
      cache,
      async () => {
        loadCalls += 1;
        throw new Error("should not fetch");
      },
      { forceReload: false },
    );

    expect(page).toBe(cached);
    expect(loadCalls).toBe(0);
  });

  test("refetches when reload is forced", async () => {
    const cache = new PageCache();
    const stale = stubPage({ pageTitle: "Old" });
    cache.set(stale);

    const fresh: LoadedPageContent = {
      ...stale,
      pageTitle: "New",
    };

    let loadCalls = 0;
    const page = await resolveLoadedPage(
      "examples/page.html",
      cache,
      async () => {
        loadCalls += 1;
        return fresh;
      },
      { forceReload: true },
    );

    expect(loadCalls).toBe(1);
    expect(page.pageTitle).toBe("New");
    expect(cache.get("examples/page.html")?.pageTitle).toBe("New");
  });
});

describe("loadPageContent", () => {
  test("loads a local example page", async () => {
    const page = await loadPageContent("examples/page.html");

    expect(page.pageLocation).toBe("examples/page.html");
    expect(page.isErrorPage).toBe(false);
    expect(page.styled.children.length).toBeGreaterThan(0);
  });
});
