import { describe, expect, test } from "bun:test";

import {
  createScrollViewport,
  handleScrollKey,
  maxScrollY,
  scrollBy,
  scrollTo,
} from "../viewport/scroll";
import { measureContentHeight, visibleCommands } from "../viewport/visible";

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

  test("handles arrow and page keys", () => {
    const viewport = createScrollViewport(10, 25);

    expect(handleScrollKey(viewport, key("down"))?.scrollY).toBe(1);
    expect(handleScrollKey(scrollTo(viewport, 5), key("up"))?.scrollY).toBe(4);
    expect(handleScrollKey(viewport, key("pagedown"))?.scrollY).toBe(9);
    expect(handleScrollKey(scrollTo(viewport, 12), key("pageup"))?.scrollY).toBe(3);
    expect(handleScrollKey(viewport, key("end"))?.scrollY).toBe(15);
    expect(handleScrollKey(scrollTo(viewport, 8), key("home"))?.scrollY).toBe(0);
  });

  test("ignores unbound keys", () => {
    const viewport = createScrollViewport(10, 25);
    expect(handleScrollKey(viewport, key("a"))).toBeNull();
    expect(handleScrollKey(viewport, key("down", "release"))).toBeNull();
  });
});

describe("visible commands", () => {
  test("measures content height from display commands", () => {
    const height = measureContentHeight([
      { x: 0, y: 0, text: "a" },
      { x: 0, y: 12, text: "b" },
    ]);

    expect(height).toBe(13);
  });

  test("offsets and filters commands to the visible viewport", () => {
    const visible = visibleCommands(
      [
        { x: 0, y: 0, text: "top" },
        { x: 0, y: 5, text: "middle" },
        { x: 0, y: 10, text: "bottom" },
      ],
      4,
      4,
    );

    expect(visible).toEqual([{ x: 0, y: 1, text: "middle" }]);
  });
});
