import { describe, expect, test } from "bun:test";

import { isSupportedColorValue, normalizeBackgroundColor, normalizeColor } from "../style/css/color";

describe("normalizeColor", () => {
  test("accepts hex, rgb, and named colors", () => {
    expect(normalizeColor("#eee")).toBe("#eee");
    expect(normalizeColor("rgb(10, 20, 30)")).toBe("rgb(10, 20, 30)");
    expect(normalizeColor("white")).toBe("white");
  });

  test("rejects css variables, urls, and keywords", () => {
    expect(normalizeColor("var(--color-background-page)")).toBeUndefined();
    expect(
      normalizeColor("var(--color-background-page)", {
        "--color-background-page": "#111111",
      }),
    ).toBe("#111111");
    expect(normalizeColor('url("triangle.svg")')).toBeUndefined();
    expect(normalizeColor("initial")).toBeUndefined();
    expect(normalizeColor("transparent")).toBeUndefined();
    expect(normalizeColor("currentcolor")).toBeUndefined();
  });

  test("extracts a color token from background shorthand", () => {
    expect(
      normalizeBackgroundColor(undefined, 'url("triangle.svg"), linear-gradient(transparent, transparent) no-repeat'),
    ).toBeUndefined();
    expect(normalizeBackgroundColor(undefined, "#eee no-repeat center")).toBe("#eee");
  });
});

describe("isSupportedColorValue", () => {
  test("detects supported and unsupported values", () => {
    expect(isSupportedColorValue("#ffd700")).toBe(true);
    expect(isSupportedColorValue("var(--x)")).toBe(false);
    expect(isSupportedColorValue("linear-gradient(red, blue)")).toBe(false);
  });
});
