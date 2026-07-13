import { resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { extractBaseHref, resolveDocumentBase } from "../navigation/base-url";
import { ERROR_PAGE_TITLE } from "../navigation/error-page";
import {
  formatErrorHistoryLabel,
  historyEntryLabel,
  isErrorPageTitle,
} from "../navigation/history";
import { parseLinkTarget } from "../navigation/fragment";
import { resolveAgainstBase, resolveHref } from "../navigation/resolve";
import { collectLinks } from "../links/collect";
import { layout } from "../layout/layout";
import { computeStyles } from "../style/style";
import { collectStylesheetRules } from "../style/css/collect";

const viewport = { width: 80, height: 24 };
const catalogPath = resolve("examples/nested/catalog.html");
const linksPagePath = resolve("examples/links-page.html");
const themePath = resolve("examples/theme.css");

describe("base href", () => {
  test("extracts the first base href from the document", () => {
    const dom = convert(
      parseHTML(`
        <html>
          <head>
            <base href="../" />
            <base href="ignored/" />
          </head>
        </html>
      `),
    );

    expect(extractBaseHref(dom)).toBe("../");
  });

  test("resolves relative links and stylesheets against the document base", async () => {
    const html = await Bun.file("examples/nested/catalog.html").text();
    const dom = convert(parseHTML(html));
    const documentBase = resolveDocumentBase(dom, catalogPath);

    expect(documentBase).toBe(resolve("examples"));
    expect(resolveAgainstBase("links-page.html", documentBase, catalogPath)).toBe(linksPagePath);
    expect(parseLinkTarget("links-page.html", documentBase, catalogPath)?.location).toBe(
      linksPagePath,
    );

    const rules = await collectStylesheetRules(dom, catalogPath, documentBase);
    expect(rules.some((rule) => rule.declarations.color === "#cccccc")).toBe(true);
  });

  test("applies linked CSS from a base-resolved stylesheet on catalog.html", async () => {
    const html = await Bun.file("examples/nested/catalog.html").text();
    const dom = convert(parseHTML(html));
    const documentBase = resolveDocumentBase(dom, catalogPath);
    const styled = await computeStyles(dom, { pageLocation: catalogPath, documentBase });
    const laidOut = layout(styled, { viewport });

    const body = styled.children[0]?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "body",
    );
    const heading = body?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "h1",
    );

    expect(body?.style.fg).toBe("#cccccc");
    expect(body?.style.bg).toBe("#111111");
    expect(heading?.style.fg).toBe("#ffd700");

    const links = collectLinks(styled, laidOut.output);
    expect(links[0]?.href).toBe("links-page.html");
    expect(resolveAgainstBase(links[0]!.href, documentBase, catalogPath)).toBe(linksPagePath);
  });
});

describe("stylesheet load errors", () => {
  test("skips missing linked stylesheets without crashing", async () => {
    const dom = convert(parseHTML('<link rel="stylesheet" href="missing.css" />'));
    const rules = await collectStylesheetRules(dom, catalogPath, resolve("examples/nested"));

    expect(rules).toHaveLength(0);
  });

  test("keeps inline styles when a linked stylesheet fails", async () => {
    const dom = convert(
      parseHTML(`
        <link rel="stylesheet" href="missing.css" />
        <style>body { color: red; }</style>
      `),
    );
    const rules = await collectStylesheetRules(dom, catalogPath, resolve("examples/nested"));

    expect(rules).toHaveLength(1);
    expect(rules[0]?.declarations.color).toBe("red");
  });

  test("still renders a page when linked CSS is missing", async () => {
    const html = `
      <style>body { color: green; }</style>
      <link rel="stylesheet" href="missing.css" />
      <p>hello</p>
    `;
    const styled = await computeStyles(convert(parseHTML(html)), {
      pageLocation: catalogPath,
      documentBase: resolve("examples/nested"),
    });

    const body = styled.children[0]?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "body",
    );

    expect(body?.style.fg).toBe("green");
  });
});

describe("error breadcrumb labels", () => {
  test("detects the generated error page title", () => {
    expect(isErrorPageTitle(ERROR_PAGE_TITLE)).toBe(true);
    expect(isErrorPageTitle("Links Demo")).toBe(false);
  });

  test("formats failed navigation labels with a warning prefix", () => {
    expect(formatErrorHistoryLabel("https://example.com/missing")).toBe(
      "⚠ example.com/missing",
    );
    expect(historyEntryLabel("examples/missing.html", ERROR_PAGE_TITLE)).toBe(
      "⚠ missing.html",
    );
    expect(historyEntryLabel("examples/page.html", "Hello")).toBe("Hello");
  });
});
