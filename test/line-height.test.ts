import { describe, expect, test } from "bun:test";

import { lineHeightForFontSize } from "../layout/line-height";

describe("lineHeightForFontSize", () => {
  test("uses one row for base and smaller sizes", () => {
    expect(lineHeightForFontSize()).toBe(1);
    expect(lineHeightForFontSize(1)).toBe(1);
    expect(lineHeightForFontSize(0.75)).toBe(1);
  });

  test("scales larger font sizes to multiple rows", () => {
    expect(lineHeightForFontSize(1.17)).toBe(2);
    expect(lineHeightForFontSize(1.5)).toBe(2);
    expect(lineHeightForFontSize(2)).toBe(3);
  });
});
