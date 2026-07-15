import { describe, expect, test } from "bun:test";

import {
  contrastingForeground,
  focusedLinkColors,
  parseTerminalColor,
} from "../links/focus-style";

describe("focused link colors", () => {
  test("swaps foreground and background when both are present", () => {
    expect(focusedLinkColors("#ff0000", "#0000ff")).toEqual({
      fg: "#0000ff",
      bg: "#ff0000",
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
});
