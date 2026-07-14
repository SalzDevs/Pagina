import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { layout } from "../layout/layout";
import { computeStyles, type StyledNode } from "../style/style";
import { buildPageView } from "../viewport/page-view";
import { clampScrollY, maxScrollY } from "../viewport/scroll";

function findParagraph(styled: StyledNode) {
  const body = styled.children[0]?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === "body",
  );
  return body?.children.find((child) => child.dom.type === "element" && child.dom.tag === "p");
}

describe("layout relayout", () => {
  test("clears previous fragments when layout runs again at a new width", async () => {
    const html = "<p>hello terminal browser engine</p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOutWide = layout(styled, { viewport: { width: 40, height: 10 } });
    const wideYs = new Set(
      findParagraph(styled)
        ?.children.flatMap((child) => laidOutWide.output.getFragments(child))
        .map((fragment) => fragment.y),
    );

    const laidOutNarrow = layout(styled, { viewport: { width: 10, height: 10 } });
    const narrowYs = new Set(
      findParagraph(styled)
        ?.children.flatMap((child) => laidOutNarrow.output.getFragments(child))
        .map((fragment) => fragment.y),
    );

    expect(narrowYs.size).toBeGreaterThan(wideYs.size);
  });
});

describe("buildPageView resize", () => {
  test("changes line wrapping when viewport width changes", async () => {
    const html = "<p>hello terminal browser engine</p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const wide = buildPageView(styled, { width: 40, height: 10 });
    const narrow = buildPageView(styled, { width: 10, height: 10 });

    expect(wide.contentHeight).toBeLessThan(narrow.contentHeight);
  });

  test("clamps scroll position when content shrinks after relayout", async () => {
    const html = "<p>one two three four five six seven eight nine ten</p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const tall = buildPageView(styled, { width: 8, height: 10 });
    const scrolledFar = tall.contentHeight - 1;

    const short = buildPageView(styled, { width: 40, height: 10 });
    const clamped = clampScrollY(
      {
        scrollX: 0,
        scrollY: scrolledFar,
        viewportWidth: 40,
        viewportHeight: 10,
        contentWidth: short.contentWidth,
        contentHeight: short.contentHeight,
      },
      scrolledFar,
    );

    expect(clamped).toBe(maxScrollY({
      scrollX: 0,
      scrollY: 0,
      viewportWidth: 40,
      viewportHeight: 10,
      contentWidth: short.contentWidth,
      contentHeight: short.contentHeight,
    }));
    expect(clamped).toBeLessThan(scrolledFar);
  });
});
