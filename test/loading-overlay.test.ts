import { describe, expect, test } from "bun:test";

import { formatLoadingOverlayContent, mountLoadingOverlay } from "../render/loading-overlay";
import { createTestRenderer } from "./helpers/test-renderer";

describe("loading overlay", () => {
  test("formats a headline and location label", () => {
    const content = formatLoadingOverlayContent("https://example.com/docs/page.html", 40);

    expect(content).toBe("Loading…\n\nexample.com/docs/page.html");
  });

  test("truncates long location labels", () => {
    const content = formatLoadingOverlayContent(
      "https://example.com/very/long/path/to/a/page.html",
      20,
    );
    const lines = content.split("\n");

    expect(lines[0]).toBe("Loading…");
    expect(lines[2]?.endsWith("...")).toBe(true);
    expect(lines[2]?.length).toBeLessThanOrEqual(20);
  });

  test("raises the loading panel without calling remove on itself", () => {
    const renderer = createTestRenderer();
    const overlay = mountLoadingOverlay(renderer);

    overlay.show("examples/page.html");
    overlay.show("examples/other-page.html");

    const children = renderer.root.getChildren();
    expect(children.at(-1)?.id).toBe("pagina-loading");

    overlay.destroy();
  });
});
