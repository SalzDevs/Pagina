import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { layout } from "../layout/layout";
import { paint } from "../paint/paint";
import { computeStyles } from "../style/style";
import {
  createScrollViewport,
  handleScrollKey,
  maxScrollY,
  scrollBy,
  scrollTo,
} from "../viewport/scroll";
import {
  displayListMountEntries,
  hasVisibleContentAtMaxScroll,
  measureContentHeight,
  measureDisplayListHeight,
  shouldCullDisplayList,
  visibleCommandEntries,
  visibleCommands,
} from "../viewport/visible";

function key(name: string, eventType: "press" | "release" = "press") {
  return {
    name,
    eventType,
    ctrl: false,
    meta: false,
    shift: false,
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
    const viewport = createScrollViewport(10, 25);

    expect(maxScrollY(viewport)).toBe(15);
    expect(scrollTo(viewport, 99).scrollY).toBe(15);
    expect(scrollBy(viewport, -99).scrollY).toBe(0);
  });

  test("does not scroll when content fits in the viewport", () => {
    const viewport = createScrollViewport(24, 20);

    expect(maxScrollY(viewport)).toBe(0);
    expect(scrollBy(viewport, 10).scrollY).toBe(0);
  });

  test("handles arrow and page keys", () => {
    const viewport = createScrollViewport(10, 25);

    expect(handleScrollKey(viewport, key("down"))?.scrollY).toBe(1);
    expect(handleScrollKey(scrollTo(viewport, 5), key("up"))?.scrollY).toBe(4);
    expect(handleScrollKey(viewport, key("pagedown"))?.scrollY).toBe(9);
    expect(handleScrollKey(scrollTo(viewport, 12), key("pageup"))?.scrollY).toBe(3);
    expect(handleScrollKey(viewport, key("end"))?.scrollY).toBe(15);
    expect(handleScrollKey(scrollTo(viewport, 8), key("home"))?.scrollY).toBe(0);
  });

  test("ignores ctrl-modified keys", () => {
    const viewport = createScrollViewport(10, 25);
    const ctrlUp = key("up");
    ctrlUp.ctrl = true;

    expect(handleScrollKey(viewport, ctrlUp)).toBeNull();
  });

  test("can scroll up after reaching the bottom", () => {
    const viewport = scrollTo(createScrollViewport(10, 25), 15);

    expect(handleScrollKey(viewport, key("up"))?.scrollY).toBe(14);
  });

  test("ignores unbound keys", () => {
    const viewport = createScrollViewport(10, 25);
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

  test("offsets and filters commands to the visible viewport", () => {
    const visible = visibleCommands(
      [
        { kind: "text", x: 0, y: 0, text: "top" },
        { kind: "text", x: 0, y: 5, text: "middle" },
        { kind: "text", x: 0, y: 10, text: "bottom" },
      ],
      4,
      4,
    );

    expect(visible).toEqual([{ kind: "text", x: 0, y: 1, text: "middle" }]);
  });

  test("preserves display-list indices for visible commands", () => {
    const entries = visibleCommandEntries(
      [
        { kind: "text", x: 0, y: 0, text: "top" },
        { kind: "text", x: 0, y: 5, text: "middle" },
      ],
      4,
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
    layout(styled, { viewport: { width: 80, height: 24 } });
    const displayList = paint(styled).displayList;
    const contentHeight = measureContentHeight(styled);

    expect(shouldCullDisplayList(displayList, contentHeight, 24)).toBe(true);

    const mounted = displayListMountEntries(displayList, {
      scrollY: 40,
      viewportHeight: 24,
      contentHeight,
    });

    expect(mounted.length).toBeLessThan(displayList.length);
    expect(mounted.length).toBeGreaterThan(0);
    expect(mounted.length / displayList.length).toBeLessThan(0.5);
  });

  test("keeps short pages on the full mount path", async () => {
    const styled = await computeStyles(convert(parseHTML("<p>hello</p>")));
    layout(styled, { viewport: { width: 40, height: 10 } });
    const displayList = paint(styled).displayList;
    const contentHeight = measureContentHeight(styled);

    expect(shouldCullDisplayList(displayList, contentHeight, 10)).toBe(false);
    expect(
      displayListMountEntries(displayList, {
        scrollY: 0,
        viewportHeight: 10,
        contentHeight,
      }),
    ).toHaveLength(displayList.length);
  });

  test("still shows content at max scroll on a long page", async () => {
    const html = await Bun.file("examples/long-page.html").text();
    const styled = await computeStyles(convert(parseHTML(html)));
    layout(styled, { viewport: { width: 80, height: 24 } });
    const displayList = paint(styled).displayList;
    const contentHeight = measureContentHeight(styled);

    expect(
      hasVisibleContentAtMaxScroll(displayList, contentHeight, 24),
    ).toBe(true);

    const max = maxScrollY(createScrollViewport(24, contentHeight));
    expect(visibleCommands(displayList, max, 24).length).toBeGreaterThan(0);
    expect(visibleCommands(displayList, contentHeight, 24, 0).length).toBe(0);
  });
});

describe("measureContentHeight", () => {
  test("uses text fragments rather than block boxes", async () => {
    const styled = await computeStyles(convert(parseHTML("<p>top</p><p>bottom</p>")));
    layout(styled, { viewport: { width: 40, height: 10 } });

    expect(measureContentHeight(styled)).toBeGreaterThan(0);
  });
});
