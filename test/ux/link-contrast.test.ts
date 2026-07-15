import { afterEach, describe, expect, test } from "bun:test";

import { createUxTestApp, type UxTestContext } from "./setup";
import {
  findSpanStyles,
  focusColorsCollapsed,
  hasFocusedLinkBackground,
  meetsFocusContrast,
  MIN_FOCUS_CONTRAST_RATIO,
  spanContrastRatio,
} from "./spans";

const contexts: UxTestContext[] = [];

afterEach(async () => {
  while (contexts.length > 0) {
    await contexts.pop()?.cleanup();
  }
});

async function boot(page: string): Promise<UxTestContext> {
  const ctx = await createUxTestApp(page);
  contexts.push(ctx);
  return ctx;
}

const CONTRAST_PAGES = [
  { page: "examples/links-page.html", focusedNeedle: "other page" },
  { page: "examples/styled-page.html", focusedNeedle: "home page" },
] as const;

describe("UX — focused link contrast", () => {
  for (const { page, focusedNeedle } of CONTRAST_PAGES) {
    test(`${page} auto-focused link meets contrast threshold`, async () => {
      const ctx = await boot(page);
      const focused = findSpanStyles(ctx.captureSpans(), focusedNeedle)[0];

      expect(focused).toBeDefined();
      expect(hasFocusedLinkBackground(focused!)).toBe(true);
      expect(focusColorsCollapsed(focused!)).toBe(false);
      expect(meetsFocusContrast(focused!)).toBe(true);
      expect(spanContrastRatio(focused!)).toBeGreaterThanOrEqual(MIN_FOCUS_CONTRAST_RATIO);
    });
  }

  test("fails readability checks when focus colors collapse to the same value", () => {
    const collapsed = {
      text: "example",
      fg: [128, 128, 128, 255] as const,
      bg: [128, 128, 128, 255] as const,
      attributes: 0,
    };

    expect(focusColorsCollapsed(collapsed)).toBe(true);
    expect(meetsFocusContrast(collapsed)).toBe(false);
    expect(spanContrastRatio(collapsed)).toBeCloseTo(1, 0);
  });
});
