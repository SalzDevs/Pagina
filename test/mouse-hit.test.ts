import { resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import { collectLinks } from "../links/collect";
import { buildLinkHitIndex, linkIndexAtPoint } from "../links/hit";
import { loadHtmlFromFile } from "../navigation/load";
import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { layout } from "../layout/layout";
import { BREADCRUMB_HEIGHT } from "../render/breadcrumb";
import { computeStyles } from "../style/style";
import { mouseToDocumentPoint } from "../viewport/mouse";

const viewport = { width: 80, height: 24 };
const linksPagePath = resolve("examples/links-page.html");

async function linksFromFile(path: string) {
  const html = await loadHtmlFromFile(path);
  const styled = await computeStyles(convert(parseHTML(html)), { pageLocation: resolve(path) });
  layout(styled, { viewport });
  return collectLinks(styled);
}

describe("mouseToDocumentPoint", () => {
  test("subtracts chrome offset before applying scroll", () => {
    expect(
      mouseToDocumentPoint({ x: 10, y: 5 }, { top: BREADCRUMB_HEIGHT }, 0),
    ).toEqual({ x: 10, y: 4 });
    expect(
      mouseToDocumentPoint({ x: 10, y: 5 }, { top: BREADCRUMB_HEIGHT }, 20),
    ).toEqual({ x: 10, y: 24 });
  });

  test("maps root mouse coords to link bounds on links-page.html", async () => {
    const links = await linksFromFile(linksPagePath);
    const hitIndex = buildLinkHitIndex(links);
    const layoutTop = BREADCRUMB_HEIGHT;

    for (let index = 0; index < links.length; index++) {
      const bound = links[index]?.bounds[0];
      expect(bound).toBeDefined();

      const screenY = layoutTop + bound!.y;
      const point = mouseToDocumentPoint({ x: bound!.x, y: screenY }, { top: layoutTop }, 0);
      expect(linkIndexAtPoint(hitIndex, point.x, point.y)).toBe(index);
    }
  });

  test("stays aligned when the page is scrolled", async () => {
    const links = await linksFromFile(linksPagePath);
    const hitIndex = buildLinkHitIndex(links);
    const link = links[0];
    const bound = link?.bounds[0];
    expect(bound).toBeDefined();

    const scrollY = 3;
    const layoutTop = BREADCRUMB_HEIGHT;
    const screenY = layoutTop + bound!.y - scrollY;
    const point = mouseToDocumentPoint({ x: bound!.x, y: screenY }, { top: layoutTop }, scrollY);

    expect(linkIndexAtPoint(hitIndex, point.x, point.y)).toBe(0);
  });
});
