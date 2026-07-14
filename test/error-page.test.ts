import { resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  buildErrorPageHtml,
  ERROR_PAGE_TITLE,
  formatErrorPageLocation,
  formatLoadError,
  formatLoadErrorForDisplay,
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

describe("formatErrorPageLocation", () => {
  test("shortens absolute local paths relative to cwd", () => {
    const absolute = resolve("examples/missing.html");
    expect(formatErrorPageLocation(absolute)).toBe("examples/missing.html");
  });

  test("falls back to basename for paths outside cwd", () => {
    expect(formatErrorPageLocation("/tmp/missing.html")).toBe("missing.html");
  });

  test("keeps remote urls unchanged", () => {
    expect(formatErrorPageLocation("https://example.com/missing")).toBe(
      "https://example.com/missing",
    );
  });
});

describe("formatLoadErrorForDisplay", () => {
  test("shortens file-not-found paths in error messages", () => {
    const absolute = resolve("examples/missing.html");
    expect(formatLoadErrorForDisplay(new Error(`File not found: ${absolute}`))).toBe(
      "File not found: examples/missing.html",
    );
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

  test("shows shortened local paths while keeping full retry hrefs", () => {
    const absolute = resolve("examples/missing.html");
    const html = buildErrorPageHtml(
      absolute,
      new Error(`File not found: ${absolute}`),
    );

    expect(html).toContain("<code>examples/missing.html</code>");
    expect(html).toContain(`href="${absolute}"`);
    expect(html).toContain("File not found: examples/missing.html");
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
    const failedLocation = resolve("examples/missing.html");
    const html = buildErrorPageHtml(
      failedLocation,
      new Error(`File not found: ${failedLocation}`),
    );
    const dom = convert(parseHTML(html));
    const styled = await computeStyles(dom, { pageLocation: "examples/missing.html" });
    const laidOut = layout(styled, { viewport: { width: 80, height: 24 } });
    const links = collectLinks(styled, laidOut.output);

    expect(extractPageTitle(dom)).toBe(ERROR_PAGE_TITLE);
    expect(links.some((link) => link.href === failedLocation)).toBe(true);
    expect(links.some((link) => link.href === "examples/page.html")).toBe(true);
  });
});
