import { describe, expect, test } from "bun:test";

import { createScrollViewport } from "../viewport/scroll";
import {
  formatScrollStatus,
  isVerticallyScrollable,
  scrollLinePosition,
  scrollPercent,
} from "../viewport/scroll-indicator";

describe("scroll indicator", () => {
  test("hides when the page fits in the viewport", () => {
    const viewport = createScrollViewport(80, 20, 80, 20);
    expect(isVerticallyScrollable(viewport)).toBe(false);
    expect(formatScrollStatus(viewport, 40)).toBe("");
  });

  test("reports line position and percent on long pages", () => {
    const viewport = createScrollViewport(80, 20, 80, 500);
    const scrolled = { ...viewport, scrollY: 120 };

    expect(scrollLinePosition(scrolled)).toEqual({ line: 121, total: 500 });
    expect(scrollPercent(scrolled)).toBe(25);
  });

  test("prefers line counts when width allows", () => {
    const viewport = {
      ...createScrollViewport(80, 20, 80, 500),
      scrollY: 119,
    };

    expect(formatScrollStatus(viewport, 20)).toBe(" | 120/500");
  });

  test("falls back to percent on narrow widths", () => {
    const viewport = {
      ...createScrollViewport(80, 20, 80, 500),
      scrollY: 240,
    };

    expect(formatScrollStatus(viewport, 6)).toBe(" | 50%");
    expect(formatScrollStatus(viewport, 4)).toBe(" |50%");
  });
});
