import { describe, expect, test } from "bun:test";

import { formatLoadingOverlayContent } from "../render/loading-overlay";

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
});
