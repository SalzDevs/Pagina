import { describe, expect, test } from "bun:test";

import { formatPageCopyUrl } from "../navigation/copy-url";
import { formatCopyUrlStatus } from "../navigation/history";

describe("formatPageCopyUrl", () => {
  test("copies the page location only by default", () => {
    expect(formatPageCopyUrl("/tmp/page.html")).toBe("/tmp/page.html");
    expect(
      formatPageCopyUrl("https://example.com/page.html", {
        fragment: "intro",
        scrollY: 40,
      }),
    ).toBe("https://example.com/page.html");
  });

  test("includes fragment and scroll context in detailed mode", () => {
    expect(
      formatPageCopyUrl("https://example.com/page.html", {
        detailed: true,
        fragment: "intro",
        scrollY: 40,
      }),
    ).toBe("https://example.com/page.html#intro (line 41)");
  });

  test("omits empty fragment and zero scroll from detailed mode", () => {
    expect(
      formatPageCopyUrl("https://example.com/page.html", {
        detailed: true,
        fragment: "  ",
        scrollY: 0,
      }),
    ).toBe("https://example.com/page.html");
  });
});

describe("formatCopyUrlStatus", () => {
  test("formats success and failure variants", () => {
    expect(formatCopyUrlStatus(true, 40)).toBe(" | ✓ Copied URL");
    expect(formatCopyUrlStatus(false, 40)).toBe(" | ⚠ Copy failed");
    expect(formatCopyUrlStatus(true, 10)).toBe(" | ✓");
  });
});
