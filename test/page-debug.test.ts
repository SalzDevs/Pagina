import { describe, expect, test } from "bun:test";

import { loadPageContent } from "../navigation/load-page";
import { buildPageView } from "../viewport/page-view";
import { formatPageDebugLines } from "../viewport/page-debug";

describe("formatPageDebugLines", () => {
  test("includes page metadata, dom, and applied styles", async () => {
    const page = await loadPageContent("examples/page.html", { viewportWidth: 80 });
    const view = buildPageView(page.styled, { width: 80, height: 24 });
    const text = formatPageDebugLines(80, {
      page,
      viewportWidth: 80,
      viewportHeight: 24,
      contentWidth: view.contentWidth,
      contentHeight: view.contentHeight,
      linkCount: view.links.length,
      fragmentCount: view.fragmentPositions.size,
    }).join("\n");

    expect(text).toContain("examples/page.html");
    expect(text).toContain("Pipeline");
    expect(text).toContain("links:");
    expect(text).toContain("DOM (simplified)");
    expect(text).toContain("<body");
    expect(text).toContain("Applied styles (sample)");
    expect(text).toContain("Press v to close");
  });

  test("shows css warnings when stylesheets fail", async () => {
    const page = {
      ...(await loadPageContent("examples/page.html", { viewportWidth: 80 })),
      cssWarnings: ["https://example.com/theme.css"],
    };

    const text = formatPageDebugLines(80, { page }).join("\n");
    expect(text).toContain("CSS warnings");
    expect(text).toContain("theme.css");
  });
});
