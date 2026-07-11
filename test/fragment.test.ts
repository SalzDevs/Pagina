import { resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import { collectLinks } from "../links/collect";
import {
  collectFragmentPositions,
  elementDocumentTop,
  findElementById,
  scrollToFragment,
} from "../navigation/anchors";
import { isSamePage, parseLinkTarget, splitPageLocation } from "../navigation/fragment";
import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { layout } from "../layout/layout";
import { computeStyles } from "../style/style";
import { createScrollViewport, maxScrollY, scrollToAlignTop } from "../viewport/scroll";

const viewport = { width: 80, height: 10 };
const fragmentsPagePath = resolve("examples/fragments-page.html");
const linksPagePath = resolve("examples/links-page.html");

const CHAPTER_IDS = [
  "intro",
  ...Array.from({ length: 20 }, (_, index) => `chapter-${String(index + 1).padStart(2, "0")}`),
  "appendix",
  "footer",
] as const;

async function pipelineFromFragmentsPage() {
  const html = await Bun.file("examples/fragments-page.html").text();
  const styled = await computeStyles(convert(parseHTML(html)), { pageLocation: fragmentsPagePath });
  layout(styled, { viewport });

  return {
    html,
    styled,
    links: collectLinks(styled),
    positions: collectFragmentPositions(styled),
  };
}

function expectedAlignTopScroll(
  viewportState: ReturnType<typeof createScrollViewport>,
  documentY: number,
): number {
  return scrollToAlignTop(viewportState, documentY).scrollY;
}

async function styledFrom(html: string, pageLocation?: string) {
  const styled = await computeStyles(convert(parseHTML(html)), { pageLocation });
  layout(styled, { viewport });
  return styled;
}

describe("splitPageLocation", () => {
  test("splits a page location and fragment", () => {
    expect(splitPageLocation("examples/page.html#intro")).toEqual({
      location: "examples/page.html",
      fragment: "intro",
    });
    expect(splitPageLocation("https://example.com/docs#section")).toEqual({
      location: "https://example.com/docs",
      fragment: "section",
    });
    expect(splitPageLocation("examples/page.html")).toEqual({
      location: "examples/page.html",
      fragment: null,
    });
  });

  test("handles deep fragment ids from the stress-test page", () => {
    for (const id of CHAPTER_IDS) {
      expect(splitPageLocation(`examples/fragments-page.html#${id}`)).toEqual({
        location: "examples/fragments-page.html",
        fragment: id,
      });
    }
  });
});

describe("parseLinkTarget", () => {
  test("parses same-page fragment links", () => {
    expect(parseLinkTarget("#intro", fragmentsPagePath)).toEqual({
      location: null,
      fragment: "intro",
    });
    expect(parseLinkTarget("#", fragmentsPagePath)).toEqual({
      location: null,
      fragment: null,
    });
  });

  test("parses every stress-test fragment href on the current page", () => {
    for (const id of CHAPTER_IDS) {
      expect(parseLinkTarget(`#${id}`, fragmentsPagePath)).toEqual({
        location: null,
        fragment: id,
      });
      expect(parseLinkTarget(`fragments-page.html#${id}`, fragmentsPagePath)).toEqual({
        location: fragmentsPagePath,
        fragment: id,
      });
    }
  });

  test("parses cross-page links with fragments", () => {
    expect(parseLinkTarget("other-page.html#top", linksPagePath)).toEqual({
      location: resolve("examples/other-page.html"),
      fragment: "top",
    });
    expect(parseLinkTarget("https://example.com/page#section", linksPagePath)).toEqual({
      location: "https://example.com/page",
      fragment: "section",
    });
  });

  test("parses plain navigation links without fragments", () => {
    expect(parseLinkTarget("other-page.html", linksPagePath)).toEqual({
      location: resolve("examples/other-page.html"),
      fragment: null,
    });
  });

  test("returns null for unsupported href kinds", () => {
    expect(parseLinkTarget("javascript:void(0)", linksPagePath)).toBeNull();
    expect(parseLinkTarget("", linksPagePath)).toBeNull();
  });
});

describe("isSamePage", () => {
  test("compares local and remote locations without fragments", () => {
    expect(isSamePage(linksPagePath, resolve("examples/links-page.html"))).toBe(true);
    expect(isSamePage(linksPagePath, resolve("examples/other-page.html"))).toBe(false);
    expect(isSamePage("https://example.com/a#x", "https://example.com/a#y")).toBe(true);
    expect(isSamePage(fragmentsPagePath, resolve("examples/fragments-page.html"))).toBe(true);
  });
});

describe("fragments-page.html stress test", () => {
  test("collects dozens of in-page fragment links from the table of contents", async () => {
    const { links } = await pipelineFromFragmentsPage();

    expect(links.length).toBeGreaterThanOrEqual(CHAPTER_IDS.length);

    const fragmentHrefs = links
      .map((link) => link.href)
      .filter((href) => href.startsWith("#"));

    for (const id of CHAPTER_IDS) {
      expect(fragmentHrefs).toContain(`#${id}`);
    }
  });

  test("registers every section id in document order", async () => {
    const { positions } = await pipelineFromFragmentsPage();

    expect(positions.size).toBe(CHAPTER_IDS.length);

    for (const id of CHAPTER_IDS) {
      expect(positions.has(id)).toBe(true);
    }

    const orderedTops = CHAPTER_IDS.map((id) => positions.get(id)!);

    for (let index = 1; index < orderedTops.length; index++) {
      expect(orderedTops[index]).toBeGreaterThan(orderedTops[index - 1]!);
    }
  });

  test("findElementById matches collectFragmentPositions for every section", async () => {
    const { styled, positions } = await pipelineFromFragmentsPage();

    for (const id of CHAPTER_IDS) {
      const node = findElementById(styled, id);
      expect(node).not.toBeNull();
      expect(elementDocumentTop(node!)).toBe(positions.get(id));
    }
  });

  test("creates a long document that requires substantial scrolling", async () => {
    const { positions } = await pipelineFromFragmentsPage();
    const footerTop = positions.get("footer")!;

    expect(footerTop).toBeGreaterThan(100);
  });

  test("scrolls to the top, middle, and bottom sections", async () => {
    const { positions } = await pipelineFromFragmentsPage();
    const contentHeight = positions.get("footer")! + 20;
    let viewportState = createScrollViewport(10, contentHeight);

    viewportState = { ...viewportState, scrollY: maxScrollY(viewportState) };

    const toIntro = scrollToFragment(viewportState, positions, "intro");
    expect(toIntro.scrollY).toBe(expectedAlignTopScroll(viewportState, positions.get("intro")!));

    const toMiddle = scrollToFragment(toIntro, positions, "chapter-10");
    expect(toMiddle.scrollY).toBe(expectedAlignTopScroll(toIntro, positions.get("chapter-10")!));

    const toFooter = scrollToFragment(toMiddle, positions, "footer");
    expect(toFooter.scrollY).toBe(expectedAlignTopScroll(toMiddle, positions.get("footer")!));
  });

  test("aligns every chapter id to the top of the viewport", async () => {
    const { positions } = await pipelineFromFragmentsPage();
    const contentHeight = positions.get("footer")! + 20;
    let viewportState = createScrollViewport(10, contentHeight);

    for (const id of CHAPTER_IDS) {
      const next = scrollToFragment(viewportState, positions, id);
      expect(next.scrollY).toBe(expectedAlignTopScroll(viewportState, positions.get(id)!));
      viewportState = next;
    }
  });

  test("scrolls to the top for an empty fragment", () => {
    let viewportState = createScrollViewport(10, 200);
    viewportState = { ...viewportState, scrollY: 120 };

    const next = scrollToFragment(viewportState, new Map(), null);

    expect(next.scrollY).toBe(0);
  });

  test("leaves scroll unchanged for unknown fragment ids", async () => {
    const { positions } = await pipelineFromFragmentsPage();
    const viewportState = { ...createScrollViewport(10, 200), scrollY: 42 };

    const next = scrollToFragment(viewportState, positions, "missing-section");

    expect(next.scrollY).toBe(42);
  });
});

describe("anchors", () => {
  test("finds elements by id and records their document positions", async () => {
    const html = await Bun.file("examples/fragments-page.html").text();
    const styled = await styledFrom(html, fragmentsPagePath);

    const intro = findElementById(styled, "intro");
    const chapter10 = findElementById(styled, "chapter-10");
    const footer = findElementById(styled, "footer");

    expect(intro).not.toBeNull();
    expect(chapter10).not.toBeNull();
    expect(footer).not.toBeNull();

    const introTop = elementDocumentTop(intro!);
    const chapter10Top = elementDocumentTop(chapter10!);
    const footerTop = elementDocumentTop(footer!);

    expect(introTop).not.toBeNull();
    expect(chapter10Top).not.toBeNull();
    expect(footerTop).not.toBeNull();
    expect(chapter10Top!).toBeGreaterThan(introTop!);
    expect(footerTop!).toBeGreaterThan(chapter10Top!);

    const positions = collectFragmentPositions(styled);
    expect(positions.get("intro")).toBe(introTop);
    expect(positions.get("chapter-10")).toBe(chapter10Top);
    expect(positions.get("footer")).toBe(footerTop);
  });
});
