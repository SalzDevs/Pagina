import { describe, expect, test } from "bun:test";

import {
  lineHeightForFontSize,
  textWrapUnits,
  wrapCharacterBudget,
} from "../layout/line-height";

describe("lineHeightForFontSize", () => {
  test("uses one row for base and smaller sizes", () => {
    expect(lineHeightForFontSize()).toBe(1);
    expect(lineHeightForFontSize(1)).toBe(1);
    expect(lineHeightForFontSize(0.75)).toBe(1);
  });

  test("scales larger font sizes to multiple rows", () => {
    expect(lineHeightForFontSize(1.3)).toBe(2);
    expect(lineHeightForFontSize(1.75)).toBe(3);
    expect(lineHeightForFontSize(2.5)).toBe(4);
  });
});

describe("wrapCharacterBudget", () => {
  test("scales character budget inversely with font size", () => {
    expect(wrapCharacterBudget(30)).toBe(30);
    expect(wrapCharacterBudget(30, 1.5)).toBe(20);
    expect(wrapCharacterBudget(30, 2)).toBe(15);
  });
});

describe("textWrapUnits", () => {
  test("weights text length by font size", () => {
    expect(textWrapUnits("hello")).toBe(5);
    expect(textWrapUnits("hello", 2)).toBe(10);
  });
});
