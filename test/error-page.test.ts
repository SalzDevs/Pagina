import { describe, expect, test } from "bun:test";

import {
  buildErrorPageHtml,
  ERROR_PAGE_TITLE,
  formatLoadError,
} from "../navigation/error-page";
import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { collectLinks } from "../links/collect";
import { layout } from "../layout/layout";
import { extractPageTitle } from "../navigation/history";
import { computeStyles } from "../style/style";

describe("formatLoadError", () => {
  test("uses Error messages", () => {
    expect(formatLoadError(new Error("File not found: /tmp/missing.html"))).toBe(
      "File not found: /tmp/missing.html",
    );
  });

  test("stringifies unknown values", () => {
    expect(formatLoadError("network down")).toBe("network down");
  });
});

describe("buildErrorPageHtml", () => {
  test("includes the failed location and error message", () => {
    const html = buildErrorPageHtml(
      "https://example.com/missing",
      new Error("Failed to fetch https://example.com/missing: 404 Not Found"),
    );

    expect(html).toContain(`<title>${ERROR_PAGE_TITLE}</title>`);
    expect(html).toContain("https://example.com/missing");
    expect(html).toContain("404 Not Found");
    expect(html).toContain("Try again");
    expect(html).toContain("Go to home page");
  });

  test("escapes html in the url and error message", () => {
    const html = buildErrorPageHtml(
      'https://example.com/<script>',
      new Error('Unexpected token "<"'),
    );

    expect(html).toContain("https://example.com/&lt;script&gt;");
    expect(html).toContain("Unexpected token &quot;&lt;&quot;");
    expect(html).not.toContain("<script>");
  });

  test("produces navigable links after parsing", async () => {
    const html = buildErrorPageHtml(
      "examples/missing.html",
      new Error("File not found: examples/missing.html"),
    );
    const dom = convert(parseHTML(html));
    const styled = await computeStyles(dom, { pageLocation: "examples/missing.html" });
    layout(styled, { viewport: { width: 80, height: 24 } });
    const links = collectLinks(styled);

    expect(extractPageTitle(dom)).toBe(ERROR_PAGE_TITLE);
    expect(links.some((link) => link.href === "examples/missing.html")).toBe(true);
    expect(links.some((link) => link.href === "examples/page.html")).toBe(true);
  });
});
