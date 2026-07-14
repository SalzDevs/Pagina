import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { layout } from "../layout/layout";
import { paint } from "../paint/paint";
import { computeStyles } from "../style/style";
import { buildPageView } from "../viewport/page-view";
import {
  createScrollViewport,
  handleScrollKey,
  maxScrollX,
  maxScrollY,
  scrollBy,
  scrollByX,
  scrollTo,
  withScroll,
} from "../viewport/scroll";
import {
  displayListMountEntries,
  hasVisibleContentAtMaxScroll,
  measureContentHeight,
  measureDisplayListHeight,
  measureDisplayListWidth,
  shouldCullDisplayList,
  visibleCommandEntries,
} from "../viewport/visible";

function key(name: string, eventType: "press" | "release" = "press", shift = false) {
  return {
    name,
    eventType,
    ctrl: false,
    meta: false,
    shift,
    option: false,
    sequence: "",
    number: false,
    raw: "",
    source: "raw" as const,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {},
    stopPropagation() {},
  };
}

describe("scroll viewport", () => {
  test("clamps scroll position to content bounds", () => {
    const viewport = createScrollViewport(10, 10, 10, 25);

    expect(maxScrollY(viewport)).toBe(15);
    expect(scrollTo(viewport, 99).scrollY).toBe(15);
    expect(scrollBy(viewport, -99).scrollY).toBe(0);
  });

  test("clamps horizontal scroll position to content bounds", () => {
    const viewport = createScrollViewport(10, 10, 25, 10);

    expect(maxScrollX(viewport)).toBe(15);
    expect(withScroll(viewport, { scrollX: 99 }).scrollX).toBe(15);
    expect(scrollByX(viewport, -99).scrollX).toBe(0);
  });

  test("does not scroll when content fits in the viewport", () => {
    const viewport = createScrollViewport(24, 24, 20, 20);

    expect(maxScrollY(viewport)).toBe(0);
    expect(maxScrollX(viewport)).toBe(0);
    expect(scrollBy(viewport, 10).scrollY).toBe(0);
    expect(scrollByX(viewport, 10).scrollX).toBe(0);
  });

  test("handles arrow and page keys", () => {
    const viewport = createScrollViewport(10, 10, 10, 25);

    expect(handleScrollKey(viewport, key("down"))?.scrollY).toBe(1);
    expect(handleScrollKey(scrollTo(viewport, 5), key("up"))?.scrollY).toBe(4);
    expect(handleScrollKey(viewport, key("pagedown"))?.scrollY).toBe(9);
    expect(handleScrollKey(scrollTo(viewport, 12), key("pageup"))?.scrollY).toBe(3);
    expect(handleScrollKey(viewport, key("end"))?.scrollY).toBe(15);
    expect(handleScrollKey(scrollTo(viewport, 8), key("home"))?.scrollY).toBe(0);
    expect(handleScrollKey(scrollTo(viewport, 8), key("g"))?.scrollY).toBe(0);
    expect(handleScrollKey(viewport, key("g", "press", true))?.scrollY).toBe(15);
  });

  test("handles horizontal scroll keys", () => {
    const viewport = createScrollViewport(10, 10, 25, 10);

    expect(handleScrollKey(viewport, key("l"))?.scrollX).toBe(1);
    expect(handleScrollKey(withScroll(viewport, { scrollX: 5 }), key("h"))?.scrollX).toBe(4);
    expect(handleScrollKey(viewport, key("right"))?.scrollX).toBe(1);
    expect(handleScrollKey(withScroll(viewport, { scrollX: 3 }), key("left"))?.scrollX).toBe(2);
  });

  test("ignores ctrl-modified keys", () => {
    const viewport = createScrollViewport(10, 10, 10, 25);
    const ctrlUp = key("up");
    ctrlUp.ctrl = true;

    expect(handleScrollKey(viewport, ctrlUp)).toBeNull();
  });

  test("can scroll up after reaching the bottom", () => {
    const viewport = withScroll(createScrollViewport(10, 10, 10, 25), { scrollY: 15 });

    expect(handleScrollKey(viewport, key("up"))?.scrollY).toBe(14);
  });

  test("ignores unbound keys", () => {
    const viewport = createScrollViewport(10, 10, 10, 25);
    expect(handleScrollKey(viewport, key("a"))).toBeNull();
    expect(handleScrollKey(viewport, key("down", "release"))).toBeNull();
  });
});

describe("visible commands", () => {
  test("measures content height from display commands", () => {
    const height = measureDisplayListHeight([
      { kind: "text", x: 0, y: 0, text: "a" },
      { kind: "text", x: 0, y: 12, text: "b" },
    ]);

    expect(height).toBe(13);
  });

  test("measures content width from display commands", () => {
    const width = measureDisplayListWidth([
      { kind: "text", x: 0, y: 0, text: "short" },
      { kind: "text", x: 0, y: 1, text: "much longer line" },
    ]);

    expect(width).toBe(16);
  });

  test("offsets and filters commands to the visible viewport", () => {
    const visible = visibleCommandEntries(
      [
        { kind: "text", x: 0, y: 0, text: "top" },
        { kind: "text", x: 0, y: 5, text: "middle" },
        { kind: "text", x: 0, y: 10, text: "bottom" },
      ],
      0,
      4,
      40,
      4,
    ).map((entry) => entry.command);

    expect(visible).toEqual([{ kind: "text", x: 0, y: 1, text: "middle" }]);
  });

  test("filters horizontally scrolled commands", () => {
    const visible = visibleCommandEntries(
      [
        { kind: "text", x: 0, y: 0, text: "left" },
        { kind: "text", x: 8, y: 0, text: "right" },
      ],
      5,
      0,
      4,
      4,
    ).map((entry) => entry.command);

    expect(visible).toEqual([{ kind: "text", x: 3, y: 0, text: "right" }]);
  });

  test("preserves display-list indices for visible commands", () => {
    const entries = visibleCommandEntries(
      [
        { kind: "text", x: 0, y: 0, text: "top" },
        { kind: "text", x: 0, y: 5, text: "middle" },
      ],
      0,
      4,
      40,
      4,
      0,
    );

    expect(entries).toEqual([
      { commandIndex: 1, command: { kind: "text", x: 0, y: 1, text: "middle" } },
    ]);
  });

  test("culls long pages to the visible slice", async () => {
    const html = await Bun.file("examples/long-page.html").text();
    const styled = await computeStyles(convert(parseHTML(html)));
    const laidOut = layout(styled, { viewport: { width: 80, height: 24 } });
    const displayList = paint(styled, laidOut.output).displayList;
    const contentHeight = measureContentHeight(styled, laidOut.output);
    const contentWidth = measureDisplayListWidth(displayList);

    expect(shouldCullDisplayList(displayList, contentHeight, 24)).toBe(true);

    const mounted = displayListMountEntries(displayList, {
      scrollX: 0,
      scrollY: 40,
      viewportWidth: 80,
      viewportHeight: 24,
      contentWidth,
      contentHeight,
    });

    expect(mounted.length).toBeLessThan(displayList.length);
    expect(mounted.length).toBeGreaterThan(0);
    expect(mounted.length / displayList.length).toBeLessThan(0.5);
  });

  test("keeps short pages on the full mount path", async () => {
    const styled = await computeStyles(convert(parseHTML("<p>hello</p>")));
    const laidOut = layout(styled, { viewport: { width: 40, height: 10 } });
    const displayList = paint(styled, laidOut.output).displayList;
    const contentHeight = measureContentHeight(styled, laidOut.output);
    const contentWidth = measureDisplayListWidth(displayList);

    expect(shouldCullDisplayList(displayList, contentHeight, 10)).toBe(false);
    expect(
      displayListMountEntries(displayList, {
        scrollX: 0,
        scrollY: 0,
        viewportWidth: 40,
        viewportHeight: 10,
        contentWidth,
        contentHeight,
      }),
    ).toHaveLength(displayList.length);
  });

  test("still shows content at max scroll on a long page", async () => {
    const html = await Bun.file("examples/long-page.html").text();
    const styled = await computeStyles(convert(parseHTML(html)));
    const laidOut = layout(styled, { viewport: { width: 80, height: 24 } });
    const displayList = paint(styled, laidOut.output).displayList;
    const contentHeight = measureContentHeight(styled, laidOut.output);

    expect(
      hasVisibleContentAtMaxScroll(displayList, contentHeight, 24),
    ).toBe(true);

    const max = maxScrollY(createScrollViewport(80, 24, 80, contentHeight));
    expect(visibleCommandEntries(displayList, 0, max, 80, 24).length).toBeGreaterThan(0);
    expect(visibleCommandEntries(displayList, 0, contentHeight, 80, 24, 0).length).toBe(0);
  });
});

describe("measureContentHeight", () => {
  test("uses text fragments rather than block boxes", async () => {
    const styled = await computeStyles(convert(parseHTML("<p>top</p><p>bottom</p>")));
    const laidOut = layout(styled, { viewport: { width: 40, height: 10 } });

    expect(measureContentHeight(styled, laidOut.output)).toBeGreaterThan(0);
  });
});

describe("wide preformatted content", () => {
  test("reports content wider than the viewport for long pre lines", async () => {
    const html = `<pre>${"x".repeat(20)}</pre>`;
    const styled = await computeStyles(convert(parseHTML(html)));
    const view = buildPageView(styled, { width: 10, height: 10 });

    expect(view.contentWidth).toBeGreaterThan(10);
  });
});
