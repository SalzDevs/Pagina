import { resolve } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

import { loadHtml, loadHtmlFromFile, loadText, loadTextFromUrl } from "../navigation/load";
import { normalizePageLocation } from "../navigation/location";
import { isRemoteUrl, resolveHref, resolveResource } from "../navigation/resolve";

const linksPagePath = resolve("examples/links-page.html");
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("isRemoteUrl", () => {
  test("detects http and https locations", () => {
    expect(isRemoteUrl("https://example.com")).toBe(true);
    expect(isRemoteUrl("http://example.com/page")).toBe(true);
    expect(isRemoteUrl("examples/page.html")).toBe(false);
    expect(isRemoteUrl("/tmp/page.html")).toBe(false);
  });
});

describe("normalizePageLocation", () => {
  test("preserves remote urls and resolves local paths", () => {
    expect(normalizePageLocation("https://example.com/docs")).toBe("https://example.com/docs");
    expect(normalizePageLocation("examples/page.html")).toBe(resolve("examples/page.html"));
  });
});

describe("resolveResource", () => {
  test("resolves relative resources against remote page locations", () => {
    expect(resolveResource("/about", "https://example.com/docs/page.html")).toBe(
      "https://example.com/about",
    );
    expect(resolveResource("other.html", "https://example.com/docs/page.html")).toBe(
      "https://example.com/docs/other.html",
    );
    expect(resolveResource("https://cdn.example.com/theme.css", "https://example.com")).toBe(
      "https://cdn.example.com/theme.css",
    );
  });

  test("resolves relative resources against local page locations", () => {
    expect(resolveResource("theme.css", resolve("examples/linked-page.html"))).toBe(
      resolve("examples/theme.css"),
    );
  });

  test("returns null for unsupported resource kinds", () => {
    expect(resolveResource("#section", "https://example.com")).toBeNull();
    expect(resolveResource("javascript:void(0)", linksPagePath)).toBeNull();
    expect(resolveResource("", linksPagePath)).toBeNull();
  });
});

describe("resolveHref", () => {
  test("returns absolute remote links unchanged", () => {
    expect(resolveHref("https://example.com/about", linksPagePath)).toBe("https://example.com/about");
  });
});

describe("loadTextFromUrl", () => {
  test("fetches remote text content", async () => {
    globalThis.fetch = (async (input) => {
      expect(input).toBe("https://example.com/page.html");
      return new Response("<html><body>Hello web</body></html>", { status: 200 });
    }) as typeof fetch;

    const html = await loadTextFromUrl("https://example.com/page.html");
    expect(html).toContain("Hello web");
  });

  test("throws when the remote response is not ok", async () => {
    globalThis.fetch = (async () => new Response("missing", { status: 404, statusText: "Not Found" })) as typeof fetch;

    await expect(loadTextFromUrl("https://example.com/missing")).rejects.toThrow(
      "Failed to fetch https://example.com/missing: 404 Not Found",
    );
  });
});

describe("loadText", () => {
  test("loads local files and remote urls", async () => {
    const local = await loadText("examples/page.html");
    expect(local).toContain("<html>");

    globalThis.fetch = (async () => new Response("remote", { status: 200 })) as typeof fetch;
    await expect(loadText("https://example.com/page.html")).resolves.toBe("remote");
  });
});

describe("loadHtmlFromFile", () => {
  test("reads html from a file path", async () => {
    const html = await loadHtmlFromFile("examples/page.html");

    expect(html).toContain("<html>");
    expect(html).toContain("<strong>Pagina</strong>");
  });

  test("throws when the file does not exist", async () => {
    await expect(loadHtmlFromFile("examples/missing.html")).rejects.toThrow("File not found");
  });
});

describe("loadHtml", () => {
  test("loads html from a remote url", async () => {
    globalThis.fetch = (async () =>
      new Response("<html><body><a href=\"/next\">next</a></body></html>", { status: 200 })) as typeof fetch;

    const html = await loadHtml("https://example.com/start");
    expect(html).toContain('href="/next"');
  });
});
