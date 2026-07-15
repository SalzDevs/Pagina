import { describe, expect, test } from "bun:test";

import {
  contrastRatio,
  contrastingForeground,
  focusedLinkColors,
  meetsContrastThreshold,
  MIN_READABLE_CONTRAST_RATIO,
  parseTerminalColor,
} from "../links/focus-style";

describe("focused link colors", () => {
  test("uses readable inverted colors when swapping would be low contrast", () => {
    expect(focusedLinkColors("#ff0000", "#0000ff")).toEqual({
      fg: "#000000",
      bg: "#ff0000",
    });
  });

  test("swaps foreground and background when both already contrast enough", () => {
    expect(focusedLinkColors("#569cd6", "#111111")).toEqual({
      fg: "#111111",
      bg: "#569cd6",
    });
  });

  test("uses the link color as a background when only foreground is set", () => {
    expect(focusedLinkColors("#336699")).toEqual({
      fg: "#ffffff",
      bg: "#336699",
    });
  });

  test("uses contrasting text on a background-only link", () => {
    expect(focusedLinkColors(undefined, "#50fa7b")).toEqual({
      fg: "#000000",
      bg: "#50fa7b",
    });
  });

  test("falls back to a neutral pair when no colors are available", () => {
    expect(focusedLinkColors()).toEqual({ fg: "#000000", bg: "#cccccc" });
  });

  test("parses hex and rgb colors for contrast checks", () => {
    expect(parseTerminalColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseTerminalColor("rgb(10, 20, 30)")).toEqual({ r: 10, g: 20, b: 30 });
    expect(contrastingForeground({ r: 255, g: 255, b: 255 })).toBe("#000000");
    expect(contrastingForeground({ r: 0, g: 0, b: 0 })).toBe("#ffffff");
  });

  test("computes WCAG contrast ratios", () => {
    expect(contrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 })).toBeCloseTo(21, 0);
    expect(contrastRatio({ r: 119, g: 119, b: 119 }, { r: 119, g: 119, b: 119 })).toBeCloseTo(1, 0);
  });

  test("focused link color pairs meet the readability threshold", () => {
    const samples = [
      focusedLinkColors("#ff0000", "#0000ff"),
      focusedLinkColors("#336699"),
      focusedLinkColors(undefined, "#50fa7b"),
      focusedLinkColors(),
      focusedLinkColors("#569cd6", "#111111"),
    ];

    for (const colors of samples) {
      expect(
        meetsContrastThreshold(colors.fg, colors.bg, MIN_READABLE_CONTRAST_RATIO),
        `${colors.fg} on ${colors.bg}`,
      ).toBe(true);
    }
  });
});
